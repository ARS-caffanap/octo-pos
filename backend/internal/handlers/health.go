package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Health godoc
// @Summary      Health check
// @Description  Returns 200 OK when the service is running. Used by load balancers and monitoring tools.
// @Tags         Health
// @Produce      json
// @Success      200  {object}  map[string]string  "status: ok"
// @Router       /health [get]
func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}
