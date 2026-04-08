package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"bogdan/backend/config"
	"bogdan/backend/voiddb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type NotesHandler struct {
	cfg *config.Config
	db  *voiddb.Client
}

func NewNotesHandler(cfg *config.Config, db *voiddb.Client) *NotesHandler {
	return &NotesHandler{cfg: cfg, db: db}
}

// GET /api/note-folders
// Returns full folder tree
func (h *NotesHandler) ListFolders(c *gin.Context) {
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("note_folders")

	docs, err := col.Find(ctx, voiddb.NewQuery().OrderBy("path", "asc"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if docs == nil {
		docs = []voiddb.Doc{}
	}

	// Build tree
	tree := buildFolderTree(docs)
	c.JSON(http.StatusOK, gin.H{"folders": docs, "tree": tree})
}

// POST /api/note-folders
// Body: { "name": "...", "parent_id": "...", "path": "/path/to/folder" }
func (h *NotesHandler) CreateFolder(c *gin.Context) {
	var req struct {
		Name     string `json:"name" binding:"required"`
		ParentID string `json:"parent_id"`
		Path     string `json:"path"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("note_folders")

	// Compute path if not provided
	path := req.Path
	if path == "" {
		if req.ParentID != "" {
			parent, err := col.Get(ctx, req.ParentID)
			if err == nil && parent != nil {
				parentPath, _ := parent["path"].(string)
				path = parentPath + "/" + req.Name
			} else {
				path = "/" + req.Name
			}
		} else {
			path = "/" + req.Name
		}
	}

	now := time.Now().Unix()
	doc := voiddb.Doc{
		"id":         uuid.New().String(),
		"name":       req.Name,
		"parent_id":  req.ParentID,
		"path":       path,
		"created_at": now,
		"updated_at": now,
	}

	id, err := col.Insert(ctx, doc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	doc["_id"] = id
	c.JSON(http.StatusCreated, doc)
}

// GET /api/note-folders/:id
func (h *NotesHandler) GetFolder(c *gin.Context) {
	folderID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("note_folders")

	doc, err := col.Get(ctx, folderID)
	if err != nil || doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "folder not found"})
		return
	}
	c.JSON(http.StatusOK, doc)
}

// PATCH /api/note-folders/:id
func (h *NotesHandler) UpdateFolder(c *gin.Context) {
	folderID := c.Param("id")
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("note_folders")

	existing, err := col.Get(ctx, folderID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "folder not found"})
		return
	}

	req["updated_at"] = time.Now().Unix()
	delete(req, "_id")

	updated, err := col.Patch(ctx, folderID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// DELETE /api/note-folders/:id
func (h *NotesHandler) DeleteFolder(c *gin.Context) {
	folderID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("note_folders")

	existing, err := col.Get(ctx, folderID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "folder not found"})
		return
	}

	// Delete all notes in this folder
	notesCol := h.db.DB("bogdan").Collection("notes")
	notes, _ := notesCol.Find(ctx, voiddb.NewQuery().Where("folder_id", voiddb.Eq, folderID))
	for _, note := range notes {
		if id, ok := note["_id"].(string); ok {
			notesCol.Delete(ctx, id)
		}
	}

	if err := col.Delete(ctx, folderID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// GET /api/notes?folder_id=...&search=...&page=1&per_page=50
func (h *NotesHandler) ListNotes(c *gin.Context) {
	folderID := c.Query("folder_id")
	search := c.Query("search")

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("notes")

	q := voiddb.NewQuery().OrderBy("updated_at", "desc")
	if folderID != "" {
		q = q.Where("folder_id", voiddb.Eq, folderID)
	}
	if search != "" {
		q = q.WhereNode(voiddb.QueryNode{
			OR: []voiddb.QueryNode{
				{Field: "title", Op: voiddb.Contains, Value: search},
				{Field: "content", Op: voiddb.Contains, Value: search},
				{Field: "tags", Op: voiddb.Contains, Value: search},
			},
		})
	}

	page := 1
	perPage := 50
	if v := c.Query("page"); v != "" {
		_, _ = (&page), v
		_ = sscanf(v, &page)
	}
	if v := c.Query("per_page"); v != "" {
		_ = sscanf(v, &perPage)
	}
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 200 {
		perPage = 50
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
		"notes":    result.Results,
		"total":    result.Count,
		"page":     page,
		"per_page": perPage,
	})
}

// POST /api/notes
// Body: { "title": "...", "content": "...", "folder_id": "...", "tags": [], "path": "/folder/note.md" }
func (h *NotesHandler) CreateNote(c *gin.Context) {
	var req struct {
		Title    string      `json:"title" binding:"required"`
		Content  string      `json:"content"`
		FolderID string      `json:"folder_id"`
		Tags     interface{} `json:"tags"`
		Path     string      `json:"path"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()

	// Compute path if not given
	path := req.Path
	if path == "" && req.FolderID != "" {
		folderCol := h.db.DB("bogdan").Collection("note_folders")
		folder, err := folderCol.Get(ctx, req.FolderID)
		if err == nil && folder != nil {
			folderPath, _ := folder["path"].(string)
			path = folderPath + "/" + req.Title + ".md"
		}
	}
	if path == "" {
		path = "/" + req.Title + ".md"
	}

	col := h.db.DB("bogdan").Collection("notes")
	now := time.Now().Unix()
	doc := voiddb.Doc{
		"id":         uuid.New().String(),
		"title":      req.Title,
		"content":    req.Content,
		"folder_id":  req.FolderID,
		"tags":       req.Tags,
		"path":       path,
		"created_at": now,
		"updated_at": now,
	}

	id, err := col.Insert(ctx, doc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	doc["_id"] = id
	c.JSON(http.StatusCreated, doc)
}

// GET /api/notes/:id
func (h *NotesHandler) GetNote(c *gin.Context) {
	noteID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("notes")

	doc, err := col.Get(ctx, noteID)
	if err != nil || doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "note not found"})
		return
	}
	c.JSON(http.StatusOK, doc)
}

// PATCH /api/notes/:id
func (h *NotesHandler) UpdateNote(c *gin.Context) {
	noteID := c.Param("id")
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("notes")

	existing, err := col.Get(ctx, noteID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "note not found"})
		return
	}

	req["updated_at"] = time.Now().Unix()
	delete(req, "_id")

	updated, err := col.Patch(ctx, noteID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// DELETE /api/notes/:id
func (h *NotesHandler) DeleteNote(c *gin.Context) {
	noteID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("notes")

	if err := col.Delete(ctx, noteID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// buildFolderTree organizes flat folder list into nested tree.
func buildFolderTree(docs []voiddb.Doc) []interface{} {
	type TreeNode struct {
		Doc      voiddb.Doc
		Children []*TreeNode
	}

	nodes := make(map[string]*TreeNode)
	roots := make([]*TreeNode, 0)

	for i := range docs {
		id, _ := docs[i]["_id"].(string)
		nodes[id] = &TreeNode{Doc: docs[i], Children: []*TreeNode{}}
	}

	for id, node := range nodes {
		parentID, _ := node.Doc["parent_id"].(string)
		if parentID == "" {
			roots = append(roots, nodes[id])
		} else if parent, ok := nodes[parentID]; ok {
			parent.Children = append(parent.Children, nodes[id])
		} else {
			roots = append(roots, nodes[id])
		}
	}

	var serialize func(n *TreeNode) interface{}
	serialize = func(n *TreeNode) interface{} {
		result := map[string]interface{}{}
		for k, v := range n.Doc {
			result[k] = v
		}
		children := make([]interface{}, 0, len(n.Children))
		for _, child := range n.Children {
			children = append(children, serialize(child))
		}
		result["children"] = children
		return result
	}

	tree := make([]interface{}, 0, len(roots))
	for _, root := range roots {
		tree = append(tree, serialize(root))
	}
	return tree
}

func sscanf(s string, target *int) error {
	n, err := parseInt(s)
	if err == nil {
		*target = n
	}
	return err
}

func parseInt(s string) (int, error) {
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	return n, err
}
