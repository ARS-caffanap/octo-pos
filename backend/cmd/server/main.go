package main

import (
	"fmt"
	"log"
	"os"

	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
	"github.com/ARS-caffanap/octo-pos/backend/internal/server"

	_ "github.com/ARS-caffanap/octo-pos/backend/docs" // swagger docs
)

// @title           OctoPOS API
// @version         1.0
// @description     REST API for OctoPOS — a point-of-sale and inventory management system.
// @description     This API provides endpoints for authentication, product management,
// @description     transaction processing, and inventory tracking.

// @contact.name   OctoPOS Team
// @contact.email  dev@octopos.example.com

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:8080
// @BasePath  /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and the JWT token.

// @tag.name Health
// @tag.description Health check endpoints

// @tag.name Auth
// @tag.description Authentication and authorization endpoints

// @tag.name Products
// @tag.description Product management endpoints

// @tag.name Transactions
// @tag.description Transaction processing endpoints

// @tag.name Inventory
// @tag.description Inventory tracking endpoints

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	srv := server.New(cfg)
	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	log.Printf("OctoPOS backend starting on %s", addr)
	log.Printf("Swagger docs available at http://%s/api-docs/index.html", addr)
	if err := srv.Run(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func init() {
	// Default to debug mode in development
	if os.Getenv("GIN_MODE") == "" {
		_ = os.Setenv("GIN_MODE", "debug")
	}
}
