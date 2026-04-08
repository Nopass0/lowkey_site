package main

import (
	"fmt"
	"log"
	"os"

	"bogdan/backend/config"
	"bogdan/backend/handlers"
	"bogdan/backend/middleware"
	"bogdan/backend/voiddb"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	// Ensure upload dir exists
	if err := os.MkdirAll(cfg.Upload.Dir, 0755); err != nil {
		log.Fatalf("failed to create upload dir: %v", err)
	}

	// Initialize VoidDB client
	db := voiddb.New(cfg.VoidDB.URL, cfg.VoidDB.Username, cfg.VoidDB.Password, cfg.VoidDB.Token)

	// Set up Gin
	r := gin.Default()

	// CORS — allow all origins (personal app)
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length", "Content-Disposition"},
		AllowCredentials: false,
	}))

	// Handlers
	authH := handlers.NewAuthHandler(cfg, db)
	mailH := handlers.NewMailHandler(cfg, db)
	tasksH := handlers.NewTasksHandler(cfg, db)
	notesH := handlers.NewNotesHandler(cfg, db)
	filesH := handlers.NewFilesHandler(cfg, db)
	aiH := handlers.NewAIHandler(cfg)
	mmH := handlers.NewMindmapHandler(cfg, db)

	// Auth middleware
	authMW := middleware.AuthRequired(cfg)

	// ─── Public routes ────────────────────────────────────────────────────────
	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/request", authH.RequestOTP)
			auth.POST("/verify", authH.VerifyOTP)
			auth.GET("/me", authMW, authH.Me)
		}
	}

	// ─── Protected routes ─────────────────────────────────────────────────────
	protected := r.Group("/api", authMW)
	{
		// Mail
		mail := protected.Group("/mail")
		{
			mail.GET("/mailboxes", mailH.ListMailboxes)
			mail.POST("/mailboxes", mailH.AddMailbox)
			mail.GET("/messages", mailH.ListMessages)
			mail.GET("/messages/:id", mailH.GetMessage)
			mail.POST("/send", mailH.SendMessage)
			mail.DELETE("/messages/:id", mailH.DeleteMessage)
			mail.POST("/temp-email", mailH.CreateTempEmail)
			mail.GET("/temp-email/:address/messages", mailH.GetTempEmailMessages)
		}

		// Kanban boards
		protected.GET("/boards", tasksH.ListBoards)
		protected.POST("/boards", tasksH.CreateBoard)
		protected.GET("/boards/:id", tasksH.GetBoard)
		protected.PATCH("/boards/:id", tasksH.UpdateBoard)
		protected.DELETE("/boards/:id", tasksH.DeleteBoard)

		// Tasks
		protected.GET("/tasks", tasksH.ListTasks)
		protected.POST("/tasks", tasksH.CreateTask)
		protected.GET("/tasks/:id", tasksH.GetTask)
		protected.PATCH("/tasks/:id", tasksH.UpdateTask)
		protected.DELETE("/tasks/:id", tasksH.DeleteTask)
		protected.PATCH("/tasks/:id/move", tasksH.MoveTask)

		// Notes
		protected.GET("/note-folders", notesH.ListFolders)
		protected.POST("/note-folders", notesH.CreateFolder)
		protected.GET("/note-folders/:id", notesH.GetFolder)
		protected.PATCH("/note-folders/:id", notesH.UpdateFolder)
		protected.DELETE("/note-folders/:id", notesH.DeleteFolder)

		protected.GET("/notes", notesH.ListNotes)
		protected.POST("/notes", notesH.CreateNote)
		protected.GET("/notes/:id", notesH.GetNote)
		protected.PATCH("/notes/:id", notesH.UpdateNote)
		protected.DELETE("/notes/:id", notesH.DeleteNote)

		// Files
		protected.POST("/files/upload", filesH.Upload)
		protected.GET("/files", filesH.ListFiles)
		protected.GET("/files/:id/download", filesH.Download)
		protected.DELETE("/files/:id", filesH.DeleteFile)
		protected.POST("/folders", filesH.CreateFolder)
		protected.GET("/folders", filesH.ListFolders)

		// AI
		ai := protected.Group("/ai")
		{
			ai.POST("/chat", aiH.Chat)
			ai.GET("/models", aiH.ListModels)
			ai.POST("/mindmap-suggest", aiH.MindmapSuggest)
		}

		// Mind maps
		mm := protected.Group("/mindmaps")
		{
			mm.GET("", mmH.List)
			mm.POST("", mmH.Create)
			mm.GET("/:id", mmH.Get)
			mm.PATCH("/:id", mmH.Update)
			mm.DELETE("/:id", mmH.Delete)
			mm.PATCH("/:id/nodes", mmH.UpdateNodes)
		}
	}

	// Health check (public)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Bogdan backend starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
