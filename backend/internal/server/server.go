package server

import (
	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
	"github.com/ARS-caffanap/octo-pos/backend/internal/handlers"
	"github.com/gin-gonic/gin"

	_ "github.com/ARS-caffanap/octo-pos/backend/docs" // swagger docs
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// New creates and configures a Gin engine with routes.
func New(cfg *config.Config) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// Health check
	r.GET("/health", handlers.Health)

	// Swagger documentation
	r.GET("/api-docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// API v1 group (routes will be added by future tickets)
	api := r.Group("/api/v1")
	_ = api // placeholder for future routes

	return r
}
