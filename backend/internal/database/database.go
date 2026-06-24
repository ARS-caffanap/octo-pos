package database

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
)

// DB wraps the sql.DB connection pool.
var DB *sql.DB

// Connect initializes the PostgreSQL connection pool.
func Connect(cfg *config.Config) error {
	var err error
	DB, err = sql.Open("postgres", cfg.DSN())
	if err != nil {
		return fmt.Errorf("database open: %w", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("database ping: %w", err)
	}

	log.Println("database: connected to PostgreSQL")
	return nil
}

// Close shuts down the database connection pool.
func Close() {
	if DB != nil {
		DB.Close()
	}
}
