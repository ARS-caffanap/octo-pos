package database

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/ARS-caffanap/octo-pos/backend/internal/models"
)

// ProductRepo handles database operations for products.
type ProductRepo struct {
	db *sql.DB
}

// NewProductRepo creates a new ProductRepo.
func NewProductRepo(db *sql.DB) *ProductRepo {
	return &ProductRepo{db: db}
}

// List returns paginated and filtered products for a tenant.
func (r *ProductRepo) List(tenantID string, filter models.ProductFilter, pagination models.Pagination) (*models.ProductListResponse, error) {
	where := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	argIdx := 2

	if filter.Category != "" {
		where = append(where, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, filter.Category)
		argIdx++
	}
	if filter.Status != "" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}
	if filter.LowStock != nil && *filter.LowStock {
		where = append(where, fmt.Sprintf("stock_quantity <= low_stock_threshold AND status = $%d", argIdx))
		args = append(args, models.ProductStatusActive)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	// Count total
	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM products WHERE %s", whereClause)
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count products: %w", err)
	}

	// Set defaults
	limit := pagination.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := pagination.Offset
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(
		"SELECT id, tenant_id, name, sku, price, stock_quantity, low_stock_threshold, category, status, created_at, updated_at FROM products WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		whereClause, argIdx, argIdx+1,
	)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list products: %w", err)
	}
	defer rows.Close()

	products := make([]models.Product, 0)
	for rows.Next() {
		var p models.Product
		if err := rows.Scan(&p.ID, &p.TenantID, &p.Name, &p.SKU, &p.Price, &p.StockQuantity, &p.LowStockThreshold, &p.Category, &p.Status, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan product: %w", err)
		}
		products = append(products, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return &models.ProductListResponse{
		Data:   products,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// GetByID returns a single product scoped to a tenant.
func (r *ProductRepo) GetByID(tenantID string, id int64) (*models.Product, error) {
	query := `SELECT id, tenant_id, name, sku, price, stock_quantity, low_stock_threshold, category, status, created_at, updated_at
		FROM products WHERE id = $1 AND tenant_id = $2`

	var p models.Product
	err := r.db.QueryRow(query, id, tenantID).Scan(
		&p.ID, &p.TenantID, &p.Name, &p.SKU, &p.Price, &p.StockQuantity,
		&p.LowStockThreshold, &p.Category, &p.Status, &p.CreatedAt, &p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get product: %w", err)
	}

	return &p, nil
}

// Create inserts a new product.
func (r *ProductRepo) Create(p *models.Product) error {
	query := `INSERT INTO products (tenant_id, name, sku, price, stock_quantity, low_stock_threshold, category, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at`

	return r.db.QueryRow(
		query, p.TenantID, p.Name, p.SKU, p.Price, p.StockQuantity,
		p.LowStockThreshold, p.Category, p.Status,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

// Update modifies an existing product. Returns the updated product or nil if not found.
func (r *ProductRepo) Update(tenantID string, id int64, req *models.UpdateProductRequest) (*models.Product, error) {
	// First fetch existing
	existing, err := r.GetByID(tenantID, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, nil
	}

	// Apply updates
	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.SKU != nil {
		existing.SKU = *req.SKU
	}
	if req.Price != nil {
		existing.Price = *req.Price
	}
	if req.StockQuantity != nil {
		existing.StockQuantity = *req.StockQuantity
	}
	if req.LowStockThreshold != nil {
		existing.LowStockThreshold = *req.LowStockThreshold
	}
	if req.Category != nil {
		existing.Category = *req.Category
	}
	if req.Status != nil {
		existing.Status = *req.Status
	}

	query := `UPDATE products SET name=$1, sku=$2, price=$3, stock_quantity=$4, low_stock_threshold=$5, category=$6, status=$7, updated_at=NOW()
		WHERE id=$8 AND tenant_id=$9
		RETURNING updated_at`

	err = r.db.QueryRow(
		query, existing.Name, existing.SKU, existing.Price, existing.StockQuantity,
		existing.LowStockThreshold, existing.Category, existing.Status,
		id, tenantID,
	).Scan(&existing.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update product: %w", err)
	}

	return existing, nil
}

// SoftDelete sets a product's status to inactive.
func (r *ProductRepo) SoftDelete(tenantID string, id int64) error {
	result, err := r.db.Exec(
		"UPDATE products SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3",
		models.ProductStatusInactive, id, tenantID,
	)
	if err != nil {
		return fmt.Errorf("soft delete product: %w", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("product not found")
	}

	return nil
}
