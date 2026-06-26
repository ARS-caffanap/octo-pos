package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// SecurityHeaders returns a Gin middleware that injects security-related HTTP
// response headers on every response.
//
// Headers set:
//   - Strict-Transport-Security (HSTS) — 2 years, includeSubDomains
//   - X-Content-Type-Options: nosniff
//   - X-Frame-Options: DENY
//   - Referrer-Policy: strict-origin-when-cross-origin
//
// For paths containing "/auth/" the middleware also sets Cache-Control: no-store
// so that authentication tokens are never cached by intermediate proxies or the
// browser.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		if strings.Contains(c.Request.URL.Path, "/auth/") {
			c.Header("Cache-Control", "no-store")
		}

		c.Next()
	}
}
