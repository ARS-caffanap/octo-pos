package database

import (
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
)

// SeedDefaultTenantAndAdmin creates a default tenant and admin user for
// development. Safe to call repeatedly — uses ON CONFLICT DO NOTHING.
func SeedDefaultTenantAndAdmin() error {
	if DB == nil {
		return fmt.Errorf("database not connected")
	}

	// Default tenant
	tenantID := "00000000-0000-0000-0000-000000000001"
	_, err := DB.Exec(
		`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		tenantID, "Default Store", "default",
	)
	if err != nil {
		return fmt.Errorf("seed tenant: %w", err)
	}

	// Default admin user (password: "admin123")
	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("seed user hash: %w", err)
	}

	_, err = DB.Exec(
		`INSERT INTO users (id, tenant_id, email, password_hash, name, role)
		 VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING`,
		"00000000-0000-0000-0000-000000000001",
		tenantID,
		"admin@octopos.local",
		string(hash),
		"Admin",
		"admin",
	)
	if err != nil {
		return fmt.Errorf("seed user: %w", err)
	}

	log.Printf("seed: default tenant and admin user ready (admin@octopos.local / admin123)")
	return nil
}
