package main

import (
	"fmt"
	"log"
	"os"

	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
	"github.com/ARS-caffanap/octo-pos/backend/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	srv := server.New(cfg)
	addr := fmt.Sprintf("%s:%s", cfg.Host, cfg.Port)
	log.Printf("OctoPOS backend starting on %s", addr)
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
