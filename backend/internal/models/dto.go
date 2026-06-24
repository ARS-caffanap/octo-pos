package models

// CreateProductRequest is the request body for creating a product.
type CreateProductRequest struct {
	Name             string  `json:"name" validate:"required,min=1,max=255"`
	SKU              string  `json:"sku" validate:"required,min=1,max=100"`
	Price            float64 `json:"price" validate:"required,gte=0"`
	StockQuantity    int     `json:"stock_quantity" validate:"gte=0"`
	LowStockThreshold int    `json:"low_stock_threshold" validate:"gte=0"`
	Category         string  `json:"category" validate:"max=100"`
	Status           string  `json:"status" validate:"omitempty,oneof=active inactive"`
}

// UpdateProductRequest is the request body for updating a product.
type UpdateProductRequest struct {
	Name             *string  `json:"name" validate:"omitempty,min=1,max=255"`
	SKU              *string  `json:"sku" validate:"omitempty,min=1,max=100"`
	Price            *float64 `json:"price" validate:"omitempty,gte=0"`
	StockQuantity    *int     `json:"stock_quantity" validate:"omitempty,gte=0"`
	LowStockThreshold *int    `json:"low_stock_threshold" validate:"omitempty,gte=0"`
	Category         *string  `json:"category" validate:"omitempty,max=100"`
	Status           *string  `json:"status" validate:"omitempty,oneof=active inactive"`
}

// ProductListResponse is the response for listing products.
type ProductListResponse struct {
	Data       []Product `json:"data"`
	Total      int64     `json:"total"`
	Limit      int       `json:"limit"`
	Offset     int       `json:"offset"`
}

// ProductFilter holds query parameters for filtering products.
type ProductFilter struct {
	Category string `form:"category"`
	Status   string `form:"status"`
	LowStock *bool  `form:"low_stock"`
}

// Pagination holds pagination parameters.
type Pagination struct {
	Limit  int `form:"limit"`
	Offset int `form:"offset"`
}
