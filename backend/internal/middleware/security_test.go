package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSecurityHeaders_AllHeadersPresent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SecurityHeaders())
	r.GET("/api/products", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	req, _ := http.NewRequest("GET", "/api/products", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	checkHeader(t, w, "Strict-Transport-Security", "max-age=63072000; includeSubDomains")
	checkHeader(t, w, "X-Content-Type-Options", "nosniff")
	checkHeader(t, w, "X-Frame-Options", "DENY")
	checkHeader(t, w, "Referrer-Policy", "strict-origin-when-cross-origin")
}

func TestSecurityHeaders_AuthPathCacheControl(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SecurityHeaders())
	r.POST("/api/auth/login", func(c *gin.Context) { c.JSON(200, gin.H{"token": "xyz"}) })

	req, _ := http.NewRequest("POST", "/api/auth/login", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	checkHeader(t, w, "Cache-Control", "no-store")
}

func TestSecurityHeaders_NonAuthPathNoCacheControl(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SecurityHeaders())
	r.GET("/api/v1/products", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	req, _ := http.NewRequest("GET", "/api/v1/products", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	if v := w.Header().Get("Cache-Control"); v != "" {
		t.Errorf("expected no Cache-Control header on non-auth path, got %q", v)
	}
}

func TestSecurityHeaders_HealthCheckHasHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SecurityHeaders())
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })

	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	// All security headers must be present even on unauthenticated endpoints.
	checkHeader(t, w, "Strict-Transport-Security", "max-age=63072000; includeSubDomains")
	checkHeader(t, w, "X-Content-Type-Options", "nosniff")
	checkHeader(t, w, "X-Frame-Options", "DENY")
	checkHeader(t, w, "Referrer-Policy", "strict-origin-when-cross-origin")
}

func checkHeader(t *testing.T, w *httptest.ResponseRecorder, name, want string) {
	t.Helper()
	got := w.Header().Get(name)
	if got != want {
		t.Errorf("header %q: got %q, want %q", name, got, want)
	}
}
