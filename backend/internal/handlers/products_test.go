package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ARS-caffanap/octo-pos/backend/internal/database"
	"github.com/ARS-caffanap/octo-pos/backend/internal/middleware"
	"github.com/ARS-caffanap/octo-pos/backend/internal/models"
	"github.com/gin-gonic/gin"
)

func setupTestRouter(repo *database.ProductRepo) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	handler := NewProductsHandler(repo)

	// Simulate JWT middleware by injecting tenant_id
	api := r.Group("/api/v1")
	api.Use(func(c *gin.Context) {
		c.Set(middleware.ContextKeyTenantID, "tenant-test-001")
		c.Set(middleware.ContextKeyUserID, "user-test-001")
		c.Next()
	})

	products := api.Group("/products")
	{
		products.GET("", handler.ListProducts)
		products.GET("/:id", handler.GetProduct)
		products.POST("", handler.CreateProduct)
		products.PUT("/:id", handler.UpdateProduct)
		products.DELETE("/:id", handler.DeleteProduct)
	}

	return r
}

func makeJSON(method, url string, body interface{}) (*http.Request, error) {
	if body == nil {
		return http.NewRequest(method, url, nil)
	}
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(method, url, bytes.NewBuffer(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return req, nil
}

func TestCreateProduct_Success(t *testing.T) {
	repo := &database.ProductRepo{} // Will panic on DB calls — we need a real DB or mock
	_ = repo
	t.Skip("requires database — run as integration test with real PostgreSQL")
}

func TestCreateProduct_ValidationErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	handler := NewProductsHandler(nil) // repo=nil, but we won't reach DB

	api := r.Group("/api/v1")
	api.Use(func(c *gin.Context) {
		c.Set(middleware.ContextKeyTenantID, "tenant-test-001")
		c.Next()
	})
	api.POST("/products", handler.CreateProduct)

	tests := []struct {
		name       string
		body       models.CreateProductRequest
		wantStatus int
		wantError  string
	}{
		{
			name:       "empty body",
			body:       models.CreateProductRequest{},
			wantStatus: http.StatusBadRequest,
			wantError:  "validation_error",
		},
		{
			name: "missing name",
			body: models.CreateProductRequest{
				SKU:   "SKU001",
				Price: 100,
			},
			wantStatus: http.StatusBadRequest,
			wantError:  "validation_error",
		},
		{
			name: "missing SKU",
			body: models.CreateProductRequest{
				Name:  "Product A",
				Price: 100,
			},
			wantStatus: http.StatusBadRequest,
			wantError:  "validation_error",
		},
		{
			name: "negative price",
			body: models.CreateProductRequest{
				Name:  "Product A",
				SKU:   "SKU001",
				Price: -10,
			},
			wantStatus: http.StatusBadRequest,
			wantError:  "validation_error",
		},
		{
			name: "negative stock",
			body: models.CreateProductRequest{
				Name:          "Product A",
				SKU:           "SKU001",
				Price:         100,
				StockQuantity: -5,
			},
			wantStatus: http.StatusBadRequest,
			wantError:  "validation_error",
		},
		{
			name: "invalid status",
			body: models.CreateProductRequest{
				Name:   "Product A",
				SKU:    "SKU001",
				Price:  100,
				Status: "deleted",
			},
			wantStatus: http.StatusBadRequest,
			wantError:  "validation_error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := makeJSON("POST", "/api/v1/products", tt.body)
			if err != nil {
				t.Fatalf("failed to create request: %v", err)
			}

			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("expected status %d, got %d", tt.wantStatus, w.Code)
			}

			var resp map[string]interface{}
			json.Unmarshal(w.Body.Bytes(), &resp)

			if errType, ok := resp["error"]; !ok || errType != tt.wantError {
				t.Errorf("expected error type %q, got %v", tt.wantError, resp["error"])
			}
		})
	}
}

func TestGetProduct_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	handler := NewProductsHandler(nil)

	api := r.Group("/api/v1")
	api.Use(func(c *gin.Context) {
		c.Set(middleware.ContextKeyTenantID, "tenant-test-001")
		c.Next()
	})
	api.GET("/products/:id", handler.GetProduct)

	req, _ := http.NewRequest("GET", "/api/v1/products/abc", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestUpdateProduct_ValidationErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	handler := NewProductsHandler(nil)

	api := r.Group("/api/v1")
	api.Use(func(c *gin.Context) {
		c.Set(middleware.ContextKeyTenantID, "tenant-test-001")
		c.Next()
	})
	api.PUT("/products/:id", handler.UpdateProduct)

	negativePrice := -10.0
	req, _ := makeJSON("PUT", "/api/v1/products/1", models.UpdateProductRequest{
		Price: &negativePrice,
	})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for negative price, got %d", w.Code)
	}
}

func TestDeleteProduct_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	handler := NewProductsHandler(nil)

	api := r.Group("/api/v1")
	api.Use(func(c *gin.Context) {
		c.Set(middleware.ContextKeyTenantID, "tenant-test-001")
		c.Next()
	})
	api.DELETE("/products/:id", handler.DeleteProduct)

	req, _ := http.NewRequest("DELETE", "/api/v1/products/abc", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for non-numeric ID, got %d", w.Code)
	}
}

func TestProductsRequireAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	handler := NewProductsHandler(nil)

	api := r.Group("/api/v1")
	api.GET("/products", handler.ListProducts)
	api.GET("/products/:id", handler.GetProduct)
	api.POST("/products", handler.CreateProduct)

	tests := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/products"},
		{"GET", "/api/v1/products/1"},
		{"POST", "/api/v1/products"},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req, _ := http.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			// Without middleware, tenant_id won't be set
			if w.Code != http.StatusUnauthorized {
				t.Errorf("expected 401 without auth, got %d", w.Code)
			}
		})
	}
}
