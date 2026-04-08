package handlers

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"bogdan/backend/config"
	"bogdan/backend/middleware"
	"bogdan/backend/voiddb"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-imap/v2/imapclient"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MailHandler struct {
	cfg *config.Config
	db  *voiddb.Client
}

func NewMailHandler(cfg *config.Config, db *voiddb.Client) *MailHandler {
	return &MailHandler{cfg: cfg, db: db}
}

// GET /api/mail/mailboxes
func (h *MailHandler) ListMailboxes(c *gin.Context) {
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("mailboxes")
	docs, err := col.Find(ctx, voiddb.NewQuery().OrderBy("created_at", "asc"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if docs == nil {
		docs = []voiddb.Doc{}
	}
	c.JSON(http.StatusOK, docs)
}

// POST /api/mail/mailboxes
// Body: { "email": "...", "password": "...", "imap_host": "...", "imap_port": 993, "smtp_host": "...", "smtp_port": 587, "display_name": "..." }
func (h *MailHandler) AddMailbox(c *gin.Context) {
	var req struct {
		Email       string `json:"email" binding:"required"`
		Password    string `json:"password" binding:"required"`
		IMAPHost    string `json:"imap_host"`
		IMAPPort    int    `json:"imap_port"`
		SMTPHost    string `json:"smtp_host"`
		SMTPPort    int    `json:"smtp_port"`
		DisplayName string `json:"display_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Default IMAP/SMTP settings
	imapHost := req.IMAPHost
	if imapHost == "" {
		imapHost = h.cfg.Mail.IMAPHost
	}
	imapPort := req.IMAPPort
	if imapPort == 0 {
		imapPort = h.cfg.Mail.IMAPPort
	}
	smtpHost := req.SMTPHost
	if smtpHost == "" {
		smtpHost = h.cfg.Mail.SMTPHost
	}
	smtpPort := req.SMTPPort
	if smtpPort == 0 {
		smtpPort = h.cfg.Mail.SMTPPort
	}
	displayName := req.DisplayName
	if displayName == "" {
		displayName = req.Email
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("mailboxes")

	id, err := col.Insert(ctx, voiddb.Doc{
		"email":        req.Email,
		"password":     req.Password,
		"imap_host":    imapHost,
		"imap_port":    imapPort,
		"smtp_host":    smtpHost,
		"smtp_port":    smtpPort,
		"display_name": displayName,
		"created_at":   time.Now().Unix(),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id, "email": req.Email})
}

// GET /api/mail/messages?mailbox_id=...&folder=INBOX&page=1&per_page=20
func (h *MailHandler) ListMessages(c *gin.Context) {
	mailboxID := c.Query("mailbox_id")
	folder := c.DefaultQuery("folder", "INBOX")
	_ = middleware.GetUserID(c)

	if mailboxID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mailbox_id required"})
		return
	}

	ctx := context.Background()
	mbCol := h.db.DB("bogdan").Collection("mailboxes")
	mbDoc, err := mbCol.Get(ctx, mailboxID)
	if err != nil || mbDoc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "mailbox not found"})
		return
	}

	client, err := connectIMAP(mbDoc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP connect failed: " + err.Error()})
		return
	}
	defer client.Close()

	// Select folder
	_, err = client.Select(folder, nil).Wait()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP select failed: " + err.Error()})
		return
	}

	// Search all messages
	searchData, err := client.Search(&imap.SearchCriteria{}, nil).Wait()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP search failed: " + err.Error()})
		return
	}

	allUIDs := searchData.AllUIDs()
	total := len(allUIDs)

	// Reverse for newest-first
	for i, j := 0, len(allUIDs)-1; i < j; i, j = i+1, j-1 {
		allUIDs[i], allUIDs[j] = allUIDs[j], allUIDs[i]
	}

	// Pagination
	page := 1
	perPage := 20
	if v := c.Query("page"); v != "" {
		fmt.Sscanf(v, "%d", &page)
	}
	if v := c.Query("per_page"); v != "" {
		fmt.Sscanf(v, "%d", &perPage)
	}
	start := (page - 1) * perPage
	end := start + perPage
	if start >= total {
		c.JSON(http.StatusOK, gin.H{"messages": []interface{}{}, "total": total, "page": page, "per_page": perPage})
		return
	}
	if end > total {
		end = total
	}
	pageUIDs := allUIDs[start:end]
	if len(pageUIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"messages": []interface{}{}, "total": total, "page": page, "per_page": perPage})
		return
	}

	// Fetch headers
	seqSet := imap.UIDSetNum(pageUIDs...)
	fetchOptions := &imap.FetchOptions{
		Envelope: true,
		Flags:    true,
		UID:      true,
		BodySection: []*imap.FetchItemBodySection{},
	}

	messages, err := client.Fetch(seqSet, fetchOptions).Collect()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP fetch failed: " + err.Error()})
		return
	}

	result := make([]gin.H, 0, len(messages))
	for _, msg := range messages {
		env := msg.Envelope
		if env == nil {
			continue
		}

		from := ""
		if len(env.From) > 0 {
			from = addressString(env.From[0])
		}
		to := make([]string, 0)
		for _, addr := range env.To {
			to = append(to, addressString(addr))
		}

		flags := make([]string, 0)
		for _, f := range msg.Flags {
			flags = append(flags, string(f))
		}

		result = append(result, gin.H{
			"uid":     msg.UID,
			"subject": env.Subject,
			"from":    from,
			"to":      to,
			"date":    env.Date,
			"flags":   flags,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"messages": result,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// GET /api/mail/messages/:id?mailbox_id=...&folder=INBOX
func (h *MailHandler) GetMessage(c *gin.Context) {
	mailboxID := c.Query("mailbox_id")
	folder := c.DefaultQuery("folder", "INBOX")
	uidStr := c.Param("id")

	if mailboxID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mailbox_id required"})
		return
	}

	var uid uint32
	fmt.Sscanf(uidStr, "%d", &uid)
	if uid == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
		return
	}

	ctx := context.Background()
	mbCol := h.db.DB("bogdan").Collection("mailboxes")
	mbDoc, err := mbCol.Get(ctx, mailboxID)
	if err != nil || mbDoc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "mailbox not found"})
		return
	}

	client, err := connectIMAP(mbDoc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP connect failed: " + err.Error()})
		return
	}
	defer client.Close()

	_, err = client.Select(folder, nil).Wait()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP select failed: " + err.Error()})
		return
	}

	seqSet := imap.UIDSetNum(imap.UID(uid))
	fetchOptions := &imap.FetchOptions{
		Envelope: true,
		Flags:    true,
		UID:      true,
		BodySection: []*imap.FetchItemBodySection{
			{},
		},
	}

	messages, err := client.Fetch(seqSet, fetchOptions).Collect()
	if err != nil || len(messages) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
		return
	}

	msg := messages[0]
	env := msg.Envelope

	from := ""
	if env != nil && len(env.From) > 0 {
		from = addressString(env.From[0])
	}
	to := make([]string, 0)
	if env != nil {
		for _, addr := range env.To {
			to = append(to, addressString(addr))
		}
	}

	// Read body — BodySection is map[*imap.FetchItemBodySection][]byte
	body := ""
	for _, data := range msg.BodySection {
		if data != nil {
			body = string(data)
			break
		}
	}

	flags := make([]string, 0)
	for _, f := range msg.Flags {
		flags = append(flags, string(f))
	}

	subject := ""
	var date time.Time
	if env != nil {
		subject = env.Subject
		date = env.Date
	}

	c.JSON(http.StatusOK, gin.H{
		"uid":     msg.UID,
		"subject": subject,
		"from":    from,
		"to":      to,
		"date":    date,
		"flags":   flags,
		"body":    body,
	})
}

// POST /api/mail/send
// Body: { "mailbox_id": "...", "to": ["..."], "subject": "...", "body": "...", "html": false }
func (h *MailHandler) SendMessage(c *gin.Context) {
	var req struct {
		MailboxID string   `json:"mailbox_id" binding:"required"`
		To        []string `json:"to" binding:"required"`
		CC        []string `json:"cc"`
		Subject   string   `json:"subject"`
		Body      string   `json:"body"`
		HTML      bool     `json:"html"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	mbCol := h.db.DB("bogdan").Collection("mailboxes")
	mbDoc, err := mbCol.Get(ctx, req.MailboxID)
	if err != nil || mbDoc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "mailbox not found"})
		return
	}

	email, _ := mbDoc["email"].(string)
	password, _ := mbDoc["password"].(string)
	smtpHost, _ := mbDoc["smtp_host"].(string)
	smtpPortF, _ := mbDoc["smtp_port"].(float64)
	smtpPort := int(smtpPortF)
	displayName, _ := mbDoc["display_name"].(string)

	if smtpHost == "" {
		smtpHost = h.cfg.Mail.SMTPHost
	}
	if smtpPort == 0 {
		smtpPort = h.cfg.Mail.SMTPPort
	}

	// Build message
	fromHeader := email
	if displayName != "" {
		fromHeader = fmt.Sprintf("%s <%s>", displayName, email)
	}

	contentType := "text/plain"
	if req.HTML {
		contentType = "text/html"
	}

	headers := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: %s; charset=UTF-8\r\n\r\n",
		fromHeader,
		strings.Join(req.To, ", "),
		req.Subject,
		contentType,
	)
	message := []byte(headers + req.Body)

	addr := fmt.Sprintf("%s:%d", smtpHost, smtpPort)
	auth := smtp.PlainAuth("", email, password, smtpHost)

	if err := smtp.SendMail(addr, auth, email, req.To, message); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "SMTP send failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "sent"})
}

// DELETE /api/mail/messages/:id?mailbox_id=...&folder=INBOX
func (h *MailHandler) DeleteMessage(c *gin.Context) {
	mailboxID := c.Query("mailbox_id")
	folder := c.DefaultQuery("folder", "INBOX")
	uidStr := c.Param("id")

	if mailboxID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mailbox_id required"})
		return
	}

	var uid uint32
	fmt.Sscanf(uidStr, "%d", &uid)
	if uid == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
		return
	}

	ctx := context.Background()
	mbCol := h.db.DB("bogdan").Collection("mailboxes")
	mbDoc, err := mbCol.Get(ctx, mailboxID)
	if err != nil || mbDoc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "mailbox not found"})
		return
	}

	client, err := connectIMAP(mbDoc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP connect failed: " + err.Error()})
		return
	}
	defer client.Close()

	_, err = client.Select(folder, nil).Wait()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP select failed: " + err.Error()})
		return
	}

	seqSet := imap.UIDSetNum(imap.UID(uid))
	storeFlags := &imap.StoreFlags{
		Op:     imap.StoreFlagsAdd,
		Flags:  []imap.Flag{imap.FlagDeleted},
		Silent: true,
	}
	if err := client.Store(seqSet, storeFlags, nil).Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP store failed: " + err.Error()})
		return
	}

	if err := client.Expunge().Close(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP expunge failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// POST /api/mail/temp-email
// Creates a temporary email address that maps to a mailbox subfolder
func (h *MailHandler) CreateTempEmail(c *gin.Context) {
	var req struct {
		Label      string `json:"label"`
		MailboxID  string `json:"mailbox_id"`
		ExpiresIn  int    `json:"expires_in"` // seconds, 0 = no expiry
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("temp_emails")

	// Generate a unique address
	prefix := uuid.New().String()[:8]
	domain := h.cfg.Mail.Domain
	address := fmt.Sprintf("tmp+%s@%s", prefix, domain)

	var expiresAt int64
	if req.ExpiresIn > 0 {
		expiresAt = time.Now().Add(time.Duration(req.ExpiresIn) * time.Second).Unix()
	}

	doc := voiddb.Doc{
		"address":    address,
		"label":      req.Label,
		"mailbox_id": req.MailboxID,
		"prefix":     prefix,
		"created_at": time.Now().Unix(),
		"expires_at": expiresAt,
	}

	id, err := col.Insert(ctx, doc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	doc["_id"] = id
	c.JSON(http.StatusCreated, doc)
}

// GET /api/mail/temp-email/:address/messages
func (h *MailHandler) GetTempEmailMessages(c *gin.Context) {
	address := c.Param("address")

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("temp_emails")

	tempDoc, err := col.FindOne(ctx, voiddb.NewQuery().Where("address", voiddb.Eq, address))
	if err != nil || tempDoc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "temp email not found"})
		return
	}

	// Check expiry
	expiresAt, _ := toInt64(tempDoc["expires_at"])
	if expiresAt > 0 && time.Now().Unix() > expiresAt {
		c.JSON(http.StatusGone, gin.H{"error": "temp email has expired"})
		return
	}

	mailboxID, _ := tempDoc["mailbox_id"].(string)
	prefix, _ := tempDoc["prefix"].(string)

	if mailboxID == "" {
		c.JSON(http.StatusOK, gin.H{"messages": []interface{}{}, "address": address})
		return
	}

	mbCol := h.db.DB("bogdan").Collection("mailboxes")
	mbDoc, err := mbCol.Get(ctx, mailboxID)
	if err != nil || mbDoc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "linked mailbox not found"})
		return
	}

	client, err := connectIMAP(mbDoc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP connect failed: " + err.Error()})
		return
	}
	defer client.Close()

	_, err = client.Select("INBOX", nil).Wait()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP select failed: " + err.Error()})
		return
	}

	// Search for messages to this temp address (using TO header criteria)
	searchCriteria := &imap.SearchCriteria{
		Header: []imap.SearchCriteriaHeaderField{
			{Key: "To", Value: "tmp+" + prefix},
		},
	}

	searchData, err := client.Search(searchCriteria, nil).Wait()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP search failed: " + err.Error()})
		return
	}

	allUIDs := searchData.AllUIDs()
	if len(allUIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{"messages": []interface{}{}, "address": address})
		return
	}

	seqSet := imap.UIDSetNum(allUIDs...)
	fetchOptions := &imap.FetchOptions{
		Envelope: true,
		Flags:    true,
		UID:      true,
	}

	messages, err := client.Fetch(seqSet, fetchOptions).Collect()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "IMAP fetch failed: " + err.Error()})
		return
	}

	result := make([]gin.H, 0, len(messages))
	for _, msg := range messages {
		env := msg.Envelope
		if env == nil {
			continue
		}
		from := ""
		if len(env.From) > 0 {
			from = addressString(env.From[0])
		}
		result = append(result, gin.H{
			"uid":     msg.UID,
			"subject": env.Subject,
			"from":    from,
			"date":    env.Date,
		})
	}

	c.JSON(http.StatusOK, gin.H{"messages": result, "address": address})
}

// connectIMAP dials IMAP using credentials from a mailbox doc.
func connectIMAP(mbDoc voiddb.Doc) (*imapclient.Client, error) {
	imapHost, _ := mbDoc["imap_host"].(string)
	imapPortF, _ := mbDoc["imap_port"].(float64)
	imapPort := int(imapPortF)
	email, _ := mbDoc["email"].(string)
	password, _ := mbDoc["password"].(string)

	if imapHost == "" {
		return nil, fmt.Errorf("no IMAP host configured")
	}
	if imapPort == 0 {
		imapPort = 993
	}

	addr := net.JoinHostPort(imapHost, fmt.Sprintf("%d", imapPort))

	var client *imapclient.Client
	var err error

	if imapPort == 993 {
		tlsConfig := &tls.Config{ServerName: imapHost}
		client, err = imapclient.DialTLS(addr, &imapclient.Options{TLSConfig: tlsConfig})
	} else {
		client, err = imapclient.DialStartTLS(addr, &imapclient.Options{
			TLSConfig: &tls.Config{ServerName: imapHost},
		})
	}
	if err != nil {
		// Try plain connection as fallback
		conn, dialErr := net.Dial("tcp", addr)
		if dialErr != nil {
			return nil, fmt.Errorf("dial failed: %w", err)
		}
		client = imapclient.New(conn, nil)
	}

	if err := client.Login(email, password).Wait(); err != nil {
		client.Close()
		return nil, fmt.Errorf("IMAP login failed: %w", err)
	}

	return client, nil
}

func addressString(addr imap.Address) string {
	name := addr.Name
	mailbox := addr.Mailbox
	host := addr.Host
	email := mailbox + "@" + host
	if name != "" {
		return fmt.Sprintf("%s <%s>", name, email)
	}
	return email
}
