package server

import (
	"log"

	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
	"github.com/ARS-caffanap/octo-pos/backend/internal/database"
	"github.com/ARS-caffanap/octo-pos/backend/internal/handlers"
	"github.com/ARS-caffanap/octo-pos/backend/internal/middleware"
	"github.com/gin-gonic/gin"

	_ "github.com/ARS-caffanap/octo-pos/backend/docs" // swagger docs
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// New creates and configures a Gin engine with routes and middleware.
func New(cfg *config.Config) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// Health check (no auth required)
	r.GET("/health", handlers.Health)

	// Swagger documentation (no auth required)
	r.GET("/api-docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Initialize database
	if err := database.Connect(cfg); err != nil {
		log.Printf("WARNING: database connection failed: %v", err)
	} else {
		if err := database.Migrate(); err != nil {
			log.Printf("WARNING: database migration failed: %v", err)
		}
	}

	// Repositories
	productRepo := database.NewProductRepo(database.DB)

	// Handlers
	productsHandler := handlers.NewProductsHandler(productRepo)

	// API v1 group (protected routes)
	api := r.Group("/api/v1")
	api.Use(middleware.JWTAuth(cfg))

	// Products routes
	products := api.Group("/products")
	{
		products.GET("", productsHandler.ListProducts)
		products.GET("/:id", productsHandler.GetProduct)
		products.POST("", productsHandler.CreateProduct)
		products.PUT("/:id", productsHandler.UpdateProduct)
		products.DELETE("/:id", productsHandler.DeleteProduct)
	}

	return r
}
