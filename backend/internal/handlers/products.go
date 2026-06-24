package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"github.com/ARS-caffanap/octo-pos/backend/internal/database"
	"github.com/ARS-caffanap/octo-pos/backend/internal/middleware"
	"github.com/ARS-caffanap/octo-pos/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

// ProductsHandler handles product-related HTTP requests.
type ProductsHandler struct {
	repo *database.ProductRepo
}

// NewProductsHandler creates a new ProductsHandler.
func NewProductsHandler(repo *database.ProductRepo) *ProductsHandler {
	return &ProductsHandler{repo: repo}
}

// ListProducts godoc
// @Summary      List products
// @Description  Returns a paginated, filtered list of products for the authenticated tenant.
// @Tags         Products
// @Security     BearerAuth
// @Produce      json
// @Param        category   query     string  false  "Filter by category"
// @Param        status     query     string  false  "Filter by status (active, inactive)"
// @Param        low_stock  query     bool    false  "Filter low stock products"
// @Param        limit      query     int     false  "Page size (default 20, max 100)"
// @Param        offset     query     int     false  "Page offset (default 0)"
// @Success      200  {object}  models.ProductListResponse
// @Failure      401  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /products [get]
func (h *ProductsHandler) ListProducts(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "tenant not resolved"})
		return
	}

	var filter models.ProductFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_query", "message": err.Error()})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	pagination := models.Pagination{Limit: limit, Offset: offset}

	result, err := h.repo.List(tenantID, filter, pagination)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "failed to list products"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetProduct godoc
// @Summary      Get a product
// @Description  Returns a single product by ID for the authenticated tenant.
// @Tags         Products
// @Security     BearerAuth
// @Produce      json
// @Param        id   path      int  true  "Product ID"
// @Success      200  {object}  models.Product
// @Failure      401  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /products/{id} [get]
func (h *ProductsHandler) GetProduct(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "tenant not resolved"})
		return
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id", "message": "id must be an integer"})
		return
	}

	product, err := h.repo.GetByID(tenantID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "failed to get product"})
		return
	}
	if product == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "product not found"})
		return
	}

	c.JSON(http.StatusOK, product)
}

// CreateProduct godoc
// @Summary      Create a product
// @Description  Creates a new product for the authenticated tenant.
// @Tags         Products
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        body  body      models.CreateProductRequest  true  "Product data"
// @Success      201   {object}  models.Product
// @Failure      400   {object}  map[string]interface{}
// @Failure      401   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /products [post]
func (h *ProductsHandler) CreateProduct(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "tenant not resolved"})
		return
	}

	var req models.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_body", "message": err.Error()})
		return
	}

	if err := validate.Struct(req); err != nil {
		var validationErrors validator.ValidationErrors
		if errors.As(err, &validationErrors) {
			errs := make([]string, 0, len(validationErrors))
			for _, e := range validationErrors {
				errs = append(errs, formatValidationError(e))
			}
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "validation_error",
				"message": "request validation failed",
				"details": errs,
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	// Default status to active
	if req.Status == "" {
		req.Status = models.ProductStatusActive
	}

	product := &models.Product{
		TenantID:          tenantID,
		Name:              req.Name,
		SKU:               req.SKU,
		Price:             req.Price,
		StockQuantity:     req.StockQuantity,
		LowStockThreshold: req.LowStockThreshold,
		Category:          req.Category,
		Status:            req.Status,
	}

	if err := h.repo.Create(product); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "failed to create product"})
		return
	}

	c.JSON(http.StatusCreated, product)
}

// UpdateProduct godoc
// @Summary      Update a product
// @Description  Updates an existing product for the authenticated tenant.
// @Tags         Products
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        id    path      int                        true  "Product ID"
// @Param        body  body      models.UpdateProductRequest  true  "Fields to update"
// @Success      200   {object}  models.Product
// @Failure      400   {object}  map[string]interface{}
// @Failure      401   {object}  map[string]string
// @Failure      404   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /products/{id} [put]
func (h *ProductsHandler) UpdateProduct(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "tenant not resolved"})
		return
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id", "message": "id must be an integer"})
		return
	}

	var req models.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_body", "message": err.Error()})
		return
	}

	if err := validate.Struct(req); err != nil {
		var validationErrors validator.ValidationErrors
		if errors.As(err, &validationErrors) {
			errs := make([]string, 0, len(validationErrors))
			for _, e := range validationErrors {
				errs = append(errs, formatValidationError(e))
			}
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "validation_error",
				"message": "request validation failed",
				"details": errs,
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	product, err := h.repo.Update(tenantID, id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "failed to update product"})
		return
	}
	if product == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "product not found"})
		return
	}

	c.JSON(http.StatusOK, product)
}

// DeleteProduct godoc
// @Summary      Delete a product (soft delete)
// @Description  Sets a product's status to inactive (soft delete) for the authenticated tenant.
// @Tags         Products
// @Security     BearerAuth
// @Produce      json
// @Param        id   path      int  true  "Product ID"
// @Success      200  {object}  map[string]string
// @Failure      401  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /products/{id} [delete]
func (h *ProductsHandler) DeleteProduct(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	if tenantID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "message": "tenant not resolved"})
		return
	}

	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id", "message": "id must be an integer"})
		return
	}

	err = h.repo.SoftDelete(tenantID, id)
	if err != nil {
		if err.Error() == "product not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": "failed to delete product"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "product deactivated"})
}

// formatValidationError returns a human-readable validation error message.
func formatValidationError(e validator.FieldError) string {
	switch e.Tag() {
	case "required":
		return e.Field() + " is required"
	case "min":
		return e.Field() + " must be at least " + e.Param()
	case "max":
		return e.Field() + " must be at most " + e.Param()
	case "gte":
		return e.Field() + " must be greater than or equal to " + e.Param()
	case "oneof":
		return e.Field() + " must be one of: " + e.Param()
	default:
		return e.Field() + " failed validation: " + e.Tag()
	}
}

// Ensure sql is used (imported for documentation completeness)
var _ = sql.ErrNoRows
