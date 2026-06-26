package handlers

import (
	"net/http"
	"time"

	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
	"github.com/ARS-caffanap/octo-pos/backend/internal/database"
	"github.com/ARS-caffanap/octo-pos/backend/internal/models"
	"github.com/ARS-caffanap/octo-pos/backend/internal/ratelimit"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Rate limit windows and thresholds.
const (
	emailMaxAttempts = 5
	emailWindow      = 15 * time.Minute
	ipMaxAttempts    = 20
	ipWindow         = 15 * time.Minute
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	cfg           *config.Config
	userRepo      *database.UserRepo
	emailLimiter  *ratelimit.Limiter
	ipLimiter     *ratelimit.Limiter
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(cfg *config.Config, userRepo *database.UserRepo) *AuthHandler {
	return &AuthHandler{
		cfg:          cfg,
		userRepo:     userRepo,
		emailLimiter: ratelimit.NewLimiter(emailMaxAttempts, emailWindow),
		ipLimiter:    ratelimit.NewLimiter(ipMaxAttempts, ipWindow),
	}
}

// Login godoc
//
//	@Summary		Authenticate user
//	@Description	Authenticates a user by email and password, returning a JWT token. Rate-limited: 5 failed attempts per email per 15 minutes, 20 per IP per 15 minutes.
//	@Tags			Auth
//	@Accept			json
//	@Produce		json
//	@Param			request	body		models.LoginRequest	true	"Login credentials"
//	@Success		200		{object}	models.LoginResponse
//	@Failure		401		{object}	models.AuthErrorResponse
//	@Failure		429		{object}	models.AuthErrorResponse
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

	clientIP := c.ClientIP()

	// Check IP-based rate limit first (broader scope).
	if allowed, retryAfter := h.ipLimiter.Allow(clientIP); !allowed {
		c.Header("Retry-After", itoa(retryAfter))
		c.JSON(http.StatusTooManyRequests, models.AuthErrorResponse{
			Error:      "too_many_attempts",
			Message:    "too many login attempts from this IP address",
			RetryAfter: retryAfter,
		})
		return
	}

	// Check email-based rate limit.
	if allowed, retryAfter := h.emailLimiter.Allow(req.Email); !allowed {
		c.Header("Retry-After", itoa(retryAfter))
		c.JSON(http.StatusTooManyRequests, models.AuthErrorResponse{
			Error:      "too_many_attempts",
			Message:    "too many login attempts for this email address",
			RetryAfter: retryAfter,
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

	// Successful login — reset the email counter.
	h.emailLimiter.Reset(req.Email)

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

// itoa is a simple int-to-string helper (avoids importing strconv or fmt).
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	negative := n < 0
	if negative {
		n = -n
	}
	var buf [12]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if negative {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
