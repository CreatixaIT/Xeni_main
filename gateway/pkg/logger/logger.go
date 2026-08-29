package logger

import (
	"log/slog"
	"os"
)

var Log *slog.Logger

// Init initializes the structured logger.
func Init(env string) {
	var handler slog.Handler

	if env == "production" {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		})
	} else {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelDebug,
		})
	}

	Log = slog.New(handler)
	slog.SetDefault(Log)
}

// WithRequestID returns a logger with request_id attribute.
func WithRequestID(requestID string) *slog.Logger {
	return Log.With("request_id", requestID)
}

// WithUserID returns a logger with user_id attribute.
func WithUserID(userID string) *slog.Logger {
	return Log.With("user_id", userID)
}
