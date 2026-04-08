package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"bogdan/backend/config"
	"bogdan/backend/middleware"
	"bogdan/backend/voiddb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type FilesHandler struct {
	cfg *config.Config
	db  *voiddb.Client
}

func NewFilesHandler(cfg *config.Config, db *voiddb.Client) *FilesHandler {
	return &FilesHandler{cfg: cfg, db: db}
}

// POST /api/files/upload
// multipart/form-data: file, folder_id (optional)
func (h *FilesHandler) Upload(c *gin.Context) {
	userID := middleware.GetUserID(c)

	// Max 100MB
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 100<<20)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file required: " + err.Error()})
		return
	}
	defer file.Close()

	folderID := c.Request.FormValue("folder_id")
	description := c.Request.FormValue("description")

	// Build storage path: UPLOAD_DIR/{userID}/{uuid}.ext
	ext := filepath.Ext(header.Filename)
	fileID := uuid.New().String()
	relPath := fmt.Sprintf("%s/%s%s", userID, fileID, ext)
	absPath := filepath.Join(h.cfg.Upload.Dir, relPath)

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(absPath), 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create upload dir: " + err.Error()})
		return
	}

	// Write file
	dst, err := os.Create(absPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create file: " + err.Error()})
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to write file: " + err.Error()})
		return
	}

	// Detect MIME type from extension
	mimeType := detectMIME(ext)

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("files")
	now := time.Now().Unix()

	doc := voiddb.Doc{
		"id":           fileID,
		"user_id":      userID,
		"folder_id":    folderID,
		"original_name": header.Filename,
		"stored_path":  relPath,
		"size":         written,
		"mime_type":    mimeType,
		"ext":          ext,
		"description":  description,
		"created_at":   now,
		"updated_at":   now,
	}

	id, err := col.Insert(ctx, doc)
	if err != nil {
		// Clean up the file on DB error
		os.Remove(absPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	doc["_id"] = id
	c.JSON(http.StatusCreated, doc)
}

// GET /api/files?folder_id=...&page=1&per_page=50&search=...
func (h *FilesHandler) ListFiles(c *gin.Context) {
	folderID := c.Query("folder_id")
	search := c.Query("search")
	page := 1
	perPage := 50
	if v := c.Query("page"); v != "" {
		fmt.Sscanf(v, "%d", &page)
	}
	if v := c.Query("per_page"); v != "" {
		fmt.Sscanf(v, "%d", &perPage)
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 200 {
		perPage = 50
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("files")

	q := voiddb.NewQuery().OrderBy("created_at", "desc")
	if folderID != "" {
		q = q.Where("folder_id", voiddb.Eq, folderID)
	}
	if search != "" {
		q = q.WhereNode(voiddb.QueryNode{
			OR: []voiddb.QueryNode{
				{Field: "original_name", Op: voiddb.Contains, Value: search},
				{Field: "description", Op: voiddb.Contains, Value: search},
			},
		})
	}

	result, err := col.FindWithCount(ctx, q.Skip((page-1)*perPage).Limit(perPage))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if result.Results == nil {
		result.Results = []voiddb.Doc{}
	}
	c.JSON(http.StatusOK, gin.H{
		"files":    result.Results,
		"total":    result.Count,
		"page":     page,
		"per_page": perPage,
	})
}

// GET /api/files/:id/download
func (h *FilesHandler) Download(c *gin.Context) {
	fileID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("files")

	doc, err := col.Get(ctx, fileID)
	if err != nil || doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	storedPath, _ := doc["stored_path"].(string)
	originalName, _ := doc["original_name"].(string)
	mimeType, _ := doc["mime_type"].(string)

	absPath := filepath.Join(h.cfg.Upload.Dir, storedPath)

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found on disk"})
		return
	}

	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, originalName))
	c.File(absPath)
	_ = mimeType
}

// DELETE /api/files/:id
func (h *FilesHandler) DeleteFile(c *gin.Context) {
	fileID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("files")

	doc, err := col.Get(ctx, fileID)
	if err != nil || doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	storedPath, _ := doc["stored_path"].(string)
	absPath := filepath.Join(h.cfg.Upload.Dir, storedPath)

	if err := col.Delete(ctx, fileID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Remove file from disk (best effort)
	os.Remove(absPath)

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// POST /api/folders
// Body: { "name": "...", "parent_id": "...", "description": "..." }
func (h *FilesHandler) CreateFolder(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		ParentID    string `json:"parent_id"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("file_folders")

	now := time.Now().Unix()
	doc := voiddb.Doc{
		"id":          uuid.New().String(),
		"name":        req.Name,
		"parent_id":   req.ParentID,
		"description": req.Description,
		"created_at":  now,
		"updated_at":  now,
	}

	id, err := col.Insert(ctx, doc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	doc["_id"] = id
	c.JSON(http.StatusCreated, doc)
}

// GET /api/folders
// Returns folder tree
func (h *FilesHandler) ListFolders(c *gin.Context) {
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("file_folders")

	docs, err := col.Find(ctx, voiddb.NewQuery().OrderBy("name", "asc"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if docs == nil {
		docs = []voiddb.Doc{}
	}

	tree := buildFolderTree(docs)
	c.JSON(http.StatusOK, gin.H{"folders": docs, "tree": tree})
}

func detectMIME(ext string) string {
	ext = strings.ToLower(ext)
	mimeMap := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".svg":  "image/svg+xml",
		".pdf":  "application/pdf",
		".txt":  "text/plain",
		".md":   "text/markdown",
		".doc":  "application/msword",
		".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		".xls":  "application/vnd.ms-excel",
		".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		".zip":  "application/zip",
		".mp4":  "video/mp4",
		".mp3":  "audio/mpeg",
		".json": "application/json",
		".csv":  "text/csv",
	}
	if m, ok := mimeMap[ext]; ok {
		return m
	}
	return "application/octet-stream"
}
