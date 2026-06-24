package middleware

import (
	"net/http"
	"strings"

	"github.com/ARS-caffanap/octo-pos/backend/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// context keys
const (
	ContextKeyTenantID = "tenant_id"
	ContextKeyUserID   = "user_id"
	ContextKeyUserRole = "user_role"
)

// JWTAuth returns a Gin middleware that validates JWT tokens and extracts
// the tenant_id, user_id, and role from claims.
func JWTAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "missing Authorization header",
			})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "invalid Authorization header format, expected 'Bearer <token>'",
			})
			return
		}

		tokenStr := parts[1]

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(cfg.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "invalid or expired token",
			})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "invalid token claims",
			})
			return
		}

		tenantID, _ := claims["tenant_id"].(string)
		if tenantID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "token missing tenant_id claim",
			})
			return
		}

		userID, _ := claims["user_id"].(string)
		role, _ := claims["role"].(string)

		c.Set(ContextKeyTenantID, tenantID)
		c.Set(ContextKeyUserID, userID)
		c.Set(ContextKeyUserRole, role)

		c.Next()
	}
}

// GetTenantID extracts the tenant_id from the Gin context.
func GetTenantID(c *gin.Context) string {
	v, _ := c.Get(ContextKeyTenantID)
	s, _ := v.(string)
	return s
}

// GetUserID extracts the user_id from the Gin context.
func GetUserID(c *gin.Context) string {
	v, _ := c.Get(ContextKeyUserID)
	s, _ := v.(string)
	return s
}
