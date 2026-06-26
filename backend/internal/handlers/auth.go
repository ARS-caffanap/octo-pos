package handlers

import (
	"net/http"
	"time"

	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
	"github.com/ARS-caffanap/octo-pos/backend/internal/database"
	"github.com/ARS-caffanap/octo-pos/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	cfg      *config.Config
	userRepo *database.UserRepo
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(cfg *config.Config, userRepo *database.UserRepo) *AuthHandler {
	return &AuthHandler{cfg: cfg, userRepo: userRepo}
}

// Login godoc
//
//	@Summary		Authenticate user
//	@Description	Authenticates a user by email and password, returning a JWT token.
//	@Tags			Auth
//	@Accept			json
//	@Produce		json
//	@Param			request	body		models.LoginRequest	true	"Login credentials"
//	@Success		200		{object}	models.LoginResponse
//	@Failure	401		{object}	models.AuthErrorResponse
//	@Router			/api/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusUnauthorized, models.AuthErrorResponse{
			Error:   "unauthorized",
			Message: "invalid email or password",
		})
		return
	}

	// Validate password length AFTER binding to prevent information disclosure.
	// If we validated at the struct-tag level, Gin would return a different
	// error (400 vs 401), leaking password policy to attackers.
	if len(req.Password) < 6 {
		c.JSON(http.StatusUnauthorized, models.AuthErrorResponse{
			Error:   "unauthorized",
			Message: "invalid email or password",
		})
		return
	}

	user, err := h.userRepo.FindByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.AuthErrorResponse{
			Error:   "internal_error",
			Message: "failed to look up user",
		})
		return
	}
	if user == nil {
		c.JSON(http.StatusUnauthorized, models.AuthErrorResponse{
			Error:   "unauthorized",
			Message: "invalid email or password",
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, models.AuthErrorResponse{
			Error:   "unauthorized",
			Message: "invalid email or password",
		})
		return
	}

	now := time.Now()
	claims := jwt.MapClaims{
		"tenant_id": user.TenantID,
		"user_id":   user.ID,
		"role":      user.Role,
		"email":     user.Email,
		"iat":       now.Unix(),
		"exp":       now.Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(h.cfg.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.AuthErrorResponse{
			Error:   "internal_error",
			Message: "failed to generate token",
		})
		return
	}

	c.JSON(http.StatusOK, models.LoginResponse{
		AccessToken: signed,
		TokenType:   "Bearer",
		ExpiresIn:   86400,
		User: models.UserInfo{
			ID:       user.ID,
			Email:    user.Email,
			Role:     user.Role,
			TenantID: user.TenantID,
		},
	})
}
