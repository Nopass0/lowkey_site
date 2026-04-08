package handlers

import (
	"context"
	"net/http"
	"time"

	"bogdan/backend/config"
	"bogdan/backend/voiddb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MindmapHandler struct {
	cfg *config.Config
	db  *voiddb.Client
}

func NewMindmapHandler(cfg *config.Config, db *voiddb.Client) *MindmapHandler {
	return &MindmapHandler{cfg: cfg, db: db}
}

// GET /api/mindmaps
func (h *MindmapHandler) List(c *gin.Context) {
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("mindmaps")

	docs, err := col.Find(ctx, voiddb.NewQuery().OrderBy("updated_at", "desc"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if docs == nil {
		docs = []voiddb.Doc{}
	}
	c.JSON(http.StatusOK, docs)
}

// POST /api/mindmaps
// Body: { "title": "...", "description": "...", "nodes": [...], "edges": [...] }
// Node: { "id": "...", "label": "...", "x": 0, "y": 0, "color": "#...", "parent_id": "..." }
// Edge: { "id": "...", "source": "...", "target": "...", "label": "..." }
func (h *MindmapHandler) Create(c *gin.Context) {
	var req struct {
		Title       string      `json:"title" binding:"required"`
		Description string      `json:"description"`
		Nodes       interface{} `json:"nodes"`
		Edges       interface{} `json:"edges"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("mindmaps")

	now := time.Now().Unix()

	nodes := req.Nodes
	if nodes == nil {
		nodes = []interface{}{}
	}
	edges := req.Edges
	if edges == nil {
		edges = []interface{}{}
	}

	doc := voiddb.Doc{
		"id":          uuid.New().String(),
		"title":       req.Title,
		"description": req.Description,
		"nodes":       nodes,
		"edges":       edges,
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

// GET /api/mindmaps/:id
func (h *MindmapHandler) Get(c *gin.Context) {
	mmID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("mindmaps")

	doc, err := col.Get(ctx, mmID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "mindmap not found"})
		return
	}
	c.JSON(http.StatusOK, doc)
}

// PATCH /api/mindmaps/:id
// Supports partial updates: title, description, nodes, edges
func (h *MindmapHandler) Update(c *gin.Context) {
	mmID := c.Param("id")
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("mindmaps")

	existing, err := col.Get(ctx, mmID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "mindmap not found"})
		return
	}

	req["updated_at"] = time.Now().Unix()
	delete(req, "_id")

	updated, err := col.Patch(ctx, mmID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// DELETE /api/mindmaps/:id
func (h *MindmapHandler) Delete(c *gin.Context) {
	mmID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("mindmaps")

	existing, err := col.Get(ctx, mmID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "mindmap not found"})
		return
	}

	if err := col.Delete(ctx, mmID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// PATCH /api/mindmaps/:id/nodes
// Add/update/remove individual nodes without replacing the whole mindmap
func (h *MindmapHandler) UpdateNodes(c *gin.Context) {
	mmID := c.Param("id")
	var req struct {
		Nodes interface{} `json:"nodes"`
		Edges interface{} `json:"edges"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("mindmaps")

	existing, err := col.Get(ctx, mmID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "mindmap not found"})
		return
	}

	patch := voiddb.Doc{"updated_at": time.Now().Unix()}
	if req.Nodes != nil {
		patch["nodes"] = req.Nodes
	}
	if req.Edges != nil {
		patch["edges"] = req.Edges
	}

	updated, err := col.Patch(ctx, mmID, patch)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}
