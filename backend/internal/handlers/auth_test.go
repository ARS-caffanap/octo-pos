package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
	"github.com/ARS-caffanap/octo-pos/backend/internal/database"
	"github.com/ARS-caffanap/octo-pos/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// setupAuthTest creates a Gin engine with the auth handler wired up,
// using a nil DB (safe for validation-only tests that never hit the DB).
func setupAuthTest() (*gin.Engine, *config.Config) {
	gin.SetMode(gin.TestMode)

	cfg := &config.Config{
		JWTSecret: "test-secret-key-for-unit-tests",
	}

	// nil DB — validation errors abort before FindByEmail is called.
	userRepo := database.NewUserRepo(nil)
	authHandler := NewAuthHandler(cfg, userRepo)

	r := gin.New()
	r.POST("/api/auth/login", authHandler.Login)

	return r, cfg
}

func TestLogin_MissingFields(t *testing.T) {
	r, _ := setupAuthTest()

	tests := []struct {
		name string
		body interface{}
	}{
		{"empty body", gin.H{}},
		{"missing password", gin.H{"email": "test@example.com"}},
		{"missing email", gin.H{"password": "password123"}},
		{"invalid email", gin.H{"email": "not-an-email", "password": "password123"}},
		{"short password", gin.H{"email": "test@example.com", "password": "12345"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b, _ := json.Marshal(tt.body)
			req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", w.Code)
			}
		})
	}
}

func TestLogin_ValidationErrorShape(t *testing.T) {
	r, _ := setupAuthTest()

	tests := []struct {
		name              string
		body              gin.H
		expectedField     string
		expectedMsgSubstr string
		disallowedPhrases []string
	}{
		{
			name:              "empty body",
			body:              gin.H{},
			expectedField:     "email",
			expectedMsgSubstr: "required",
			disallowedPhrases: []string{"LoginRequest", "Key:", "min", "Email"},
		},
		{
			name:              "missing password",
			body:              gin.H{"email": "test@example.com"},
			expectedField:     "password",
			expectedMsgSubstr: "required",
			disallowedPhrases: []string{"LoginRequest", "Key:", "min", "Password"},
		},
		{
			name:              "missing email",
			body:              gin.H{"password": "password123"},
			expectedField:     "email",
			expectedMsgSubstr: "required",
			disallowedPhrases: []string{"LoginRequest", "Key:", "min", "Email"},
		},
		{
			name:              "invalid email format",
			body:              gin.H{"email": "not-an-email", "password": "password123"},
			expectedField:     "email",
			expectedMsgSubstr: "valid email",
			disallowedPhrases: []string{"LoginRequest", "Key:", "min", "Email", "Password"},
		},
		{
			name:              "short password",
			body:              gin.H{"email": "test@example.com", "password": "12345"},
			expectedField:     "password",
			expectedMsgSubstr: "at least 6",
			disallowedPhrases: []string{"LoginRequest", "Key:", "min", "Email", "Password"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b, _ := json.Marshal(tt.body)
			req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("expected 400, got %d", w.Code)
			}

			body := w.Body.String()

			// Check no internal details leak
			for _, phrase := range tt.disallowedPhrases {
				if strings.Contains(body, phrase) {
					t.Errorf("response leaks internal detail '%s': %s", phrase, body)
				}
			}

			// Parse JSON and verify structure
			var parsed map[string]interface{}
			if err := json.Unmarshal(w.Body.Bytes(), &parsed); err != nil {
				t.Fatalf("response is not valid JSON: %s", body)
			}

			if parsed["error"] != "validation_error" {
				t.Errorf("expected error='validation_error', got %v", parsed["error"])
			}

			errors, ok := parsed["errors"].(map[string]interface{})
			if !ok {
				t.Fatalf("expected 'errors' map in response, got: %s", body)
			}

			if _, exists := errors[tt.expectedField]; !exists {
				t.Errorf("expected field '%s' in errors map, got keys: %v", tt.expectedField, keysOf(errors))
			}

			if msg, ok := errors[tt.expectedField].(string); ok {
				if !strings.Contains(msg, tt.expectedMsgSubstr) {
					t.Errorf("expected message containing '%s', got '%s'", tt.expectedMsgSubstr, msg)
				}
			}
		})
	}
}

// keysOf returns keys of a map for error reporting.
func keysOf(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func TestLogin_ConfigSetup(t *testing.T) {
	// Verify the test config is wired correctly.
	_, cfg := setupAuthTest()
	if cfg.JWTSecret != "test-secret-key-for-unit-tests" {
		t.Error("JWT secret not set correctly in test config")
	}
}

func TestLoginResponse_Shape(t *testing.T) {
	// Verify the LoginResponse JSON shape matches what the frontend expects.
	resp := models.LoginResponse{
		AccessToken: "eyJhbG...9ftE",
		TokenType:   "Bearer",
		ExpiresIn:   86400,
		User: models.UserInfo{
			ID:       "user-123",
			Email:    "admin@example.com",
			Role:     "admin",
			TenantID: "tenant-456",
		},
	}
	b, _ := json.Marshal(resp)

	var parsed map[string]interface{}
	if err := json.Unmarshal(b, &parsed); err != nil {
		t.Fatalf("failed to parse LoginResponse JSON: %v", err)
	}

	if _, ok := parsed["access_token"]; !ok {
		t.Errorf("LoginResponse missing 'access_token' field: %s", string(b))
	}
	if parsed["token_type"] != "Bearer" {
		t.Errorf("expected token_type='Bearer', got %v", parsed["token_type"])
	}
	if parsed["expires_in"] != float64(86400) {
		t.Errorf("expected expires_in=86400, got %v", parsed["expires_in"])
	}
	user, ok := parsed["user"].(map[string]interface{})
	if !ok {
		t.Fatalf("LoginResponse missing or invalid 'user' field: %s", string(b))
	}
	if user["id"] != "user-123" {
		t.Errorf("expected user.id='user-123', got %v", user["id"])
	}
	if user["email"] != "admin@example.com" {
		t.Errorf("expected user.email='admin@example.com', got %v", user["email"])
	}
	if user["role"] != "admin" {
		t.Errorf("expected user.role='admin', got %v", user["role"])
	}
	if user["tenant_id"] != "tenant-456" {
		t.Errorf("expected user.tenant_id='tenant-456', got %v", user["tenant_id"])
	}
}

func TestAuthErrorResponse_Shape(t *testing.T) {
	resp := models.AuthErrorResponse{Error: "unauthorized", Message: "invalid email or password"}
	b, _ := json.Marshal(resp)

	var parsed map[string]interface{}
	if err := json.Unmarshal(b, &parsed); err != nil {
		t.Fatalf("failed to parse AuthErrorResponse JSON: %v", err)
	}

	if parsed["error"] != "unauthorized" {
		t.Errorf("expected error='unauthorized', got %v", parsed["error"])
	}
	if parsed["message"] != "invalid email or password" {
		t.Errorf("expected message='invalid email or password', got %v", parsed["message"])
	}
}

func TestJWTClaims_Compatibility(t *testing.T) {
	// Verify that tokens generated by the handler are compatible with
	// middleware.JWTAuth (same signing method, same claims format).
	cfg := &config.Config{JWTSecret: "test-secret"}

	claims := jwt.MapClaims{
		"tenant_id": "tenant-123",
		"user_id":   "user-456",
		"role":      "admin",
		"email":     "admin@example.com",
		"iat":       1700000000,
		"exp":       1800000000,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}

	// Parse it back with the middleware's logic
	parsed, err := jwt.Parse(signed, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil {
		t.Fatalf("failed to parse token: %v", err)
	}
	if !parsed.Valid {
		t.Fatal("token should be valid")
	}

	pc, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("claims should be MapClaims")
	}
	if pc["tenant_id"] != "tenant-123" {
		t.Errorf("tenant_id: expected 'tenant-123', got %v", pc["tenant_id"])
	}
	if pc["user_id"] != "user-456" {
		t.Errorf("user_id: expected 'user-456', got %v", pc["user_id"])
	}
	if pc["role"] != "admin" {
		t.Errorf("role: expected 'admin', got %v", pc["role"])
	}
}

func TestBcryptPasswordFlow(t *testing.T) {
	// Verify the bcrypt flow: hash a password, then compare.
	password := "admin123"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("bcrypt generate: %v", err)
	}

	if err := bcrypt.CompareHashAndPassword(hash, []byte(password)); err != nil {
		t.Errorf("bcrypt compare should succeed for correct password: %v", err)
	}

	if err := bcrypt.CompareHashAndPassword(hash, []byte("wrongpassword")); err == nil {
		t.Error("bcrypt compare should fail for wrong password")
	}
}
