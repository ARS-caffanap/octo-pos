package server

import (
	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
	"github.com/ARS-caffanap/octo-pos/backend/internal/handlers"
	"github.com/gin-gonic/gin"
)

// New creates and configures a Gin engine with routes.
func New(cfg *config.Config) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// Health check
	r.GET("/health", handlers.Health)

	// API v1 group (routes will be added by future tickets)
	api := r.Group("/api/v1")
	_ = api // placeholder for future routes

	return r
}
