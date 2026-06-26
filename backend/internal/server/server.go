package server

import (
	"log"

	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
	"github.com/ARS-caffanap/octo-pos/backend/internal/database"
	"github.com/ARS-caffanap/octo-pos/backend/internal/handlers"
	"github.com/ARS-caffanap/octo-pos/backend/internal/middleware"
	"github.com/gin-contrib/cors"
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

	// CORS middleware — allow frontend origin + preflight (OPTIONS)
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"https://octopos.choirulaffan.dev", "http://localhost:3000", "http://localhost:3232"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           86400,
	}))

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
		} else {
			// Seed dev data (idempotent — safe to call repeatedly).
			if err := database.SeedDefaultTenantAndAdmin(); err != nil {
				log.Printf("WARNING: seed failed: %v", err)
			}
		}
	}

	// Repositories
	productRepo := database.NewProductRepo(database.DB)
	userRepo := database.NewUserRepo(database.DB)

	// Handlers
	productsHandler := handlers.NewProductsHandler(productRepo)
	authHandler := handlers.NewAuthHandler(cfg, userRepo)

	// Public auth routes (no middleware)
	r.POST("/api/auth/login", authHandler.Login)

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
