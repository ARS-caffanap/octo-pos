package models

import "time"

// Product represents a product in the system.
type Product struct {
	ID               int64     `json:"id"`
	TenantID         string    `json:"tenant_id"`
	Name             string    `json:"name"`
	SKU              string    `json:"sku"`
	Price            float64   `json:"price"`
	StockQuantity    int       `json:"stock_quantity"`
	LowStockThreshold int      `json:"low_stock_threshold"`
	Category         string    `json:"category"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// ProductStatus values
const (
	ProductStatusActive   = "active"
	ProductStatusInactive = "inactive"
)

// IsActive returns true if the product is active.
func (p *Product) IsActive() bool {
	return p.Status == ProductStatusActive
}

// IsLowStock returns true if stock quantity is at or below the threshold.
func (p *Product) IsLowStock() bool {
	return p.StockQuantity <= p.LowStockThreshold
}
