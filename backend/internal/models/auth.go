package models

// LoginRequest is the payload for POST /api/auth/login.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginResponse is returned on successful authentication.
type LoginResponse struct {
	Token string `json:"token"`
}

// AuthErrorResponse is a generic auth error response.
type AuthErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}
