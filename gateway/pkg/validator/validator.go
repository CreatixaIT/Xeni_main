package validator

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"github.com/xeni-ai/gateway/pkg/response"
)

var validate *validator.Validate

func init() {
	validate = validator.New()
}

// ValidateStruct validates a struct and returns formatted errors.
func ValidateStruct(s interface{}) error {
	return validate.Struct(s)
}

// FormatValidationErrors formats validation errors into human-readable messages.
func FormatValidationErrors(err error) string {
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		var msgs []string
		for _, e := range validationErrors {
			field := e.Field()
			switch e.Tag() {
			case "required":
				msgs = append(msgs, fmt.Sprintf("%s is required", field))
			case "email":
				msgs = append(msgs, fmt.Sprintf("%s must be a valid email", field))
			case "min":
				msgs = append(msgs, fmt.Sprintf("%s must be at least %s characters", field, e.Param()))
			case "max":
				msgs = append(msgs, fmt.Sprintf("%s must be at most %s characters", field, e.Param()))
			case "oneof":
				msgs = append(msgs, fmt.Sprintf("%s must be one of: %s", field, e.Param()))
			case "len":
				msgs = append(msgs, fmt.Sprintf("%s must be exactly %s characters", field, e.Param()))
			default:
				msgs = append(msgs, fmt.Sprintf("%s failed validation (%s)", field, e.Tag()))
			}
		}
		return strings.Join(msgs, "; ")
	}
	return err.Error()
}

// ValidateBody is a Fiber middleware that parses and validates the request body.
func ValidateBody(dto interface{}) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if err := c.BodyParser(dto); err != nil {
			return response.BadRequest(c, "Invalid request body")
		}
		if err := ValidateStruct(dto); err != nil {
			return response.BadRequest(c, FormatValidationErrors(err))
		}
		c.Locals("body", dto)
		return c.Next()
	}
}
