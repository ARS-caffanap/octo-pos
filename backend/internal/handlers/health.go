package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Health responds with a simple 200 OK for health checks.
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}
