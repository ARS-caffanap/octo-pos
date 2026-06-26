package database

import (
	"fmt"
	"log"
)

// Migrate runs database migrations to create required tables.
func Migrate() error {
	if DB == nil {
		return fmt.Errorf("database not connected")
	}

	migrations := []struct {
		name string
		sql  string
	}{
		{
			name: "001_create_tenants",
			sql: `CREATE TABLE IF NOT EXISTS tenants (
				id VARCHAR(36) PRIMARY KEY,
				name VARCHAR(255) NOT NULL,
				slug VARCHAR(100) NOT NULL UNIQUE,
				created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
			)`,
		},
		{
			name: "002_create_users",
			sql: `CREATE TABLE IF NOT EXISTS users (
				id VARCHAR(36) PRIMARY KEY,
				tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
				email VARCHAR(255) NOT NULL UNIQUE,
				password_hash VARCHAR(255) NOT NULL,
				name VARCHAR(255) NOT NULL DEFAULT '',
				role VARCHAR(50) NOT NULL DEFAULT 'staff',
				created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
			)`,
		},
		{
			name: "003_create_users_indexes",
			sql: `CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
				CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
		},
		{
			name: "004_create_products",
			sql: `CREATE TABLE IF NOT EXISTS products (
				id BIGSERIAL PRIMARY KEY,
				tenant_id VARCHAR(255) NOT NULL,
				name VARCHAR(255) NOT NULL,
				sku VARCHAR(100) NOT NULL,
				price NUMERIC(12,2) NOT NULL DEFAULT 0,
				stock_quantity INTEGER NOT NULL DEFAULT 0,
				low_stock_threshold INTEGER NOT NULL DEFAULT 10,
				category VARCHAR(100) NOT NULL DEFAULT '',
				status VARCHAR(20) NOT NULL DEFAULT 'active',
				created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
			)`,
		},
		{
			name: "005_create_products_indexes",
			sql: `CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
				CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
				CREATE INDEX IF NOT EXISTS idx_products_tenant_status ON products(tenant_id, status);
				CREATE INDEX IF NOT EXISTS idx_products_tenant_category ON products(tenant_id, category);`,
		},
	}

	for _, m := range migrations {
		if _, err := DB.Exec(m.sql); err != nil {
			return fmt.Errorf("migration %s: %w", m.name, err)
		}
		log.Printf("migration: %s applied", m.name)
	}

	return nil
}
