package response

import "github.com/gofiber/fiber/v2"

// Envelope is the standard API response format.
type Envelope struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
}

// Success sends a successful JSON response.
func Success(c *fiber.Ctx, data interface{}) error {
	return c.JSON(Envelope{
		Success: true,
		Data:    data,
	})
}

// SuccessWithMeta sends a successful JSON response with pagination/meta.
func SuccessWithMeta(c *fiber.Ctx, data interface{}, meta interface{}) error {
	return c.JSON(Envelope{
		Success: true,
		Data:    data,
		Meta:    meta,
	})
}

// Created sends a 201 created response.
func Created(c *fiber.Ctx, data interface{}) error {
	return c.Status(fiber.StatusCreated).JSON(Envelope{
		Success: true,
		Data:    data,
	})
}

// Error sends an error response with the given status code.
func Error(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(Envelope{
		Success: false,
		Error:   message,
	})
}

// BadRequest sends a 400 error.
func BadRequest(c *fiber.Ctx, message string) error {
	return Error(c, fiber.StatusBadRequest, message)
}

// Unauthorized sends a 401 error.
func Unauthorized(c *fiber.Ctx, message string) error {
	return Error(c, fiber.StatusUnauthorized, message)
}

// Forbidden sends a 403 error.
func Forbidden(c *fiber.Ctx, message string) error {
	return Error(c, fiber.StatusForbidden, message)
}

// NotFound sends a 404 error.
func NotFound(c *fiber.Ctx, message string) error {
	return Error(c, fiber.StatusNotFound, message)
}

// TooManyRequests sends a 429 error.
func TooManyRequests(c *fiber.Ctx, message string) error {
	return Error(c, fiber.StatusTooManyRequests, message)
}

// InternalError sends a 500 error (never expose internals).
func InternalError(c *fiber.Ctx) error {
	return Error(c, fiber.StatusInternalServerError, "An internal error occurred. Please try again later.")
}

// UpgradeRequired sends a 403 with upgrade info.
func UpgradeRequired(c *fiber.Ctx, requiredPlan string) error {
	return c.Status(fiber.StatusForbidden).JSON(Envelope{
		Success: false,
		Error:   "upgrade_required",
		Data: map[string]string{
			"required_plan": requiredPlan,
		},
	})
}

// PaginationMeta for list endpoints.
type PaginationMeta struct {
	Page       int   `json:"page"`
	PerPage    int   `json:"per_page"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}
