package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"bogdan/backend/config"
	"bogdan/backend/voiddb"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TasksHandler struct {
	cfg *config.Config
	db  *voiddb.Client
}

func NewTasksHandler(cfg *config.Config, db *voiddb.Client) *TasksHandler {
	return &TasksHandler{cfg: cfg, db: db}
}

// GET /api/boards
func (h *TasksHandler) ListBoards(c *gin.Context) {
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("boards")
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

// POST /api/boards
// Body: { "name": "...", "description": "...", "color": "#..." }
func (h *TasksHandler) CreateBoard(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		Color       string `json:"color"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("boards")

	now := time.Now().Unix()
	doc := voiddb.Doc{
		"id":          uuid.New().String(),
		"name":        req.Name,
		"description": req.Description,
		"color":       req.Color,
		"created_at":  now,
		"updated_at":  now,
		// Default columns
		"columns": []interface{}{
			map[string]interface{}{"id": "todo", "name": "To Do", "order": 0},
			map[string]interface{}{"id": "in_progress", "name": "In Progress", "order": 1},
			map[string]interface{}{"id": "done", "name": "Done", "order": 2},
		},
	}

	id, err := col.Insert(ctx, doc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	doc["_id"] = id
	c.JSON(http.StatusCreated, doc)
}

// GET /api/boards/:id
func (h *TasksHandler) GetBoard(c *gin.Context) {
	boardID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("boards")

	doc, err := col.Get(ctx, boardID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "board not found"})
		return
	}
	c.JSON(http.StatusOK, doc)
}

// PATCH /api/boards/:id
func (h *TasksHandler) UpdateBoard(c *gin.Context) {
	boardID := c.Param("id")
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("boards")

	// Verify exists
	existing, err := col.Get(ctx, boardID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "board not found"})
		return
	}

	req["updated_at"] = time.Now().Unix()
	// Remove _id from patch
	delete(req, "_id")

	updated, err := col.Patch(ctx, boardID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// DELETE /api/boards/:id
func (h *TasksHandler) DeleteBoard(c *gin.Context) {
	boardID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("boards")

	if err := col.Delete(ctx, boardID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Delete all tasks in this board
	tasksCol := h.db.DB("bogdan").Collection("tasks")
	tasks, _ := tasksCol.Find(ctx, voiddb.NewQuery().Where("board_id", voiddb.Eq, boardID))
	for _, task := range tasks {
		if id, ok := task["_id"].(string); ok {
			tasksCol.Delete(ctx, id)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// GET /api/tasks?board_id=...&column=...&page=1&per_page=50&search=...
func (h *TasksHandler) ListTasks(c *gin.Context) {
	boardID := c.Query("board_id")
	column := c.Query("column")
	search := c.Query("search")
	pageStr := c.DefaultQuery("page", "1")
	perPageStr := c.DefaultQuery("per_page", "50")

	page, _ := strconv.Atoi(pageStr)
	if page < 1 {
		page = 1
	}
	perPage, _ := strconv.Atoi(perPageStr)
	if perPage < 1 || perPage > 200 {
		perPage = 50
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("tasks")

	q := voiddb.NewQuery().OrderBy("created_at", "desc")
	if boardID != "" {
		q = q.Where("board_id", voiddb.Eq, boardID)
	}
	if column != "" {
		q = q.Where("column", voiddb.Eq, column)
	}
	if search != "" {
		q = q.WhereNode(voiddb.QueryNode{
			OR: []voiddb.QueryNode{
				{Field: "title", Op: voiddb.Contains, Value: search},
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
		"tasks":    result.Results,
		"total":    result.Count,
		"page":     page,
		"per_page": perPage,
	})
}

// POST /api/tasks
// Body: { "board_id": "...", "title": "...", "description": "...", "column": "todo", "priority": "medium", "due_date": 0, "labels": [], "assignee": "" }
func (h *TasksHandler) CreateTask(c *gin.Context) {
	var req struct {
		BoardID     string      `json:"board_id" binding:"required"`
		Title       string      `json:"title" binding:"required"`
		Description string      `json:"description"`
		Column      string      `json:"column"`
		Priority    string      `json:"priority"`
		DueDate     int64       `json:"due_date"`
		Labels      interface{} `json:"labels"`
		Assignee    string      `json:"assignee"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Column == "" {
		req.Column = "todo"
	}
	if req.Priority == "" {
		req.Priority = "medium"
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("tasks")

	now := time.Now().Unix()
	doc := voiddb.Doc{
		"id":          uuid.New().String(),
		"board_id":    req.BoardID,
		"title":       req.Title,
		"description": req.Description,
		"column":      req.Column,
		"priority":    req.Priority,
		"due_date":    req.DueDate,
		"labels":      req.Labels,
		"assignee":    req.Assignee,
		"completed":   false,
		"created_at":  now,
		"updated_at":  now,
	}

	// Get max order in column
	tasks, _ := col.Find(ctx, voiddb.NewQuery().
		Where("board_id", voiddb.Eq, req.BoardID).
		Where("column", voiddb.Eq, req.Column).
		OrderBy("order", "desc").
		Limit(1))
	order := 0
	if len(tasks) > 0 {
		if o, ok := tasks[0]["order"].(float64); ok {
			order = int(o) + 1
		}
	}
	doc["order"] = order

	id, err := col.Insert(ctx, doc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	doc["_id"] = id
	c.JSON(http.StatusCreated, doc)
}

// GET /api/tasks/:id
func (h *TasksHandler) GetTask(c *gin.Context) {
	taskID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("tasks")

	doc, err := col.Get(ctx, taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if doc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}
	c.JSON(http.StatusOK, doc)
}

// PATCH /api/tasks/:id
func (h *TasksHandler) UpdateTask(c *gin.Context) {
	taskID := c.Param("id")
	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("tasks")

	existing, err := col.Get(ctx, taskID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	req["updated_at"] = time.Now().Unix()
	delete(req, "_id")

	updated, err := col.Patch(ctx, taskID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// DELETE /api/tasks/:id
func (h *TasksHandler) DeleteTask(c *gin.Context) {
	taskID := c.Param("id")
	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("tasks")

	if err := col.Delete(ctx, taskID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// PATCH /api/tasks/:id/move
// Body: { "column": "in_progress", "order": 2 }
func (h *TasksHandler) MoveTask(c *gin.Context) {
	taskID := c.Param("id")
	var req struct {
		Column string `json:"column" binding:"required"`
		Order  int    `json:"order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	col := h.db.DB("bogdan").Collection("tasks")

	existing, err := col.Get(ctx, taskID)
	if err != nil || existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	updated, err := col.Patch(ctx, taskID, voiddb.Doc{
		"column":     req.Column,
		"order":      req.Order,
		"updated_at": time.Now().Unix(),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, updated)
}
