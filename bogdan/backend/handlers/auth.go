package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"time"

	"bogdan/backend/config"
	"bogdan/backend/middleware"
	"bogdan/backend/voiddb"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type AuthHandler struct {
	cfg *config.Config
	db  *voiddb.Client
}

func NewAuthHandler(cfg *config.Config, db *voiddb.Client) *AuthHandler {
	return &AuthHandler{cfg: cfg, db: db}
}

// POST /api/auth/request
// Body: { "telegram_user_id": 123456 }
func (h *AuthHandler) RequestOTP(c *gin.Context) {
	var req struct {
		TelegramUserID int64 `json:"telegram_user_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Check if user is allowed
	allowed := false
	for _, id := range h.cfg.Telegram.AllowedUserIDs {
		if id == req.TelegramUserID {
			allowed = true
			break
		}
	}
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "telegram user not allowed"})
		return
	}

	// Generate 6-digit OTP
	otp, err := generateOTP()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate OTP"})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("otps")

	// Invalidate any existing OTPs for this user
	existing, _ := col.Find(ctx, voiddb.NewQuery().Where("telegram_user_id", voiddb.Eq, req.TelegramUserID))
	for _, doc := range existing {
		if id, ok := doc["_id"].(string); ok {
			col.Delete(ctx, id)
		}
	}

	// Store OTP
	expiresAt := time.Now().Add(5 * time.Minute).Unix()
	_, err = col.Insert(ctx, voiddb.Doc{
		"telegram_user_id": req.TelegramUserID,
		"code":             otp,
		"expires_at":       expiresAt,
		"used":             false,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store OTP"})
		return
	}

	// Send via Telegram bot
	if err := sendTelegramMessage(h.cfg.Telegram.BotToken, req.TelegramUserID,
		fmt.Sprintf("Your Bogdan Workspace login code: *%s*\n\nExpires in 5 minutes.", otp)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send Telegram message: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "OTP sent to your Telegram"})
}

// POST /api/auth/verify
// Body: { "telegram_user_id": 123456, "code": "123456" }
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req struct {
		TelegramUserID int64  `json:"telegram_user_id"`
		Code           string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("otps")

	// Find OTP
	doc, err := col.FindOne(ctx, voiddb.NewQuery().
		Where("telegram_user_id", voiddb.Eq, req.TelegramUserID).
		Where("code", voiddb.Eq, req.Code).
		Where("used", voiddb.Eq, false))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	if doc == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid OTP code"})
		return
	}

	// Check expiry
	expiresAt, _ := toInt64(doc["expires_at"])
	if time.Now().Unix() > expiresAt {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "OTP has expired"})
		return
	}

	// Mark OTP as used
	otpID, _ := doc["_id"].(string)
	col.Patch(ctx, otpID, voiddb.Doc{"used": true})

	// Get or create session record for this telegram user
	sessionCol := h.db.DB("bogdan").Collection("sessions")
	userID := strconv.FormatInt(req.TelegramUserID, 10)

	// Generate JWT
	claims := &middleware.Claims{
		UserID:     userID,
		TelegramID: req.TelegramUserID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        uuid.New().String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(h.cfg.JWT.Secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// Store session
	sessionID := uuid.New().String()
	sessionCol.Insert(ctx, voiddb.Doc{
		"session_id":       sessionID,
		"telegram_user_id": req.TelegramUserID,
		"user_id":          userID,
		"token":            tokenStr,
		"created_at":       time.Now().Unix(),
		"expires_at":       time.Now().Add(30 * 24 * time.Hour).Unix(),
	})

	c.JSON(http.StatusOK, gin.H{
		"token":   tokenStr,
		"user_id": userID,
		"expires_at": time.Now().Add(30 * 24 * time.Hour).Unix(),
	})
}

// GET /api/auth/me
func (h *AuthHandler) Me(c *gin.Context) {
	userID := middleware.GetUserID(c)
	telegramID := middleware.GetTelegramID(c)

	c.JSON(http.StatusOK, gin.H{
		"user_id":     userID,
		"telegram_id": telegramID,
	})
}

func generateOTP() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func sendTelegramMessage(botToken string, chatID int64, text string) error {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("telegram API returned status %d", resp.StatusCode)
	}
	return nil
}

func toInt64(v interface{}) (int64, bool) {
	switch val := v.(type) {
	case int64:
		return val, true
	case float64:
		return int64(val), true
	case int:
		return int64(val), true
	case string:
		n, err := strconv.ParseInt(val, 10, 64)
		return n, err == nil
	}
	return 0, false
}
