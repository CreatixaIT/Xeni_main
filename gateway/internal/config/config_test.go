package config

import (
	"os"
	"testing"
)

func TestParseFrontendURLs(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: []string{},
		},
		{
			name:     "single URL",
			input:    "https://e-pic.co",
			expected: []string{"https://e-pic.co"},
		},
		{
			name:     "multiple URLs",
			input:    "https://e-pic.co,https://www.e-pic.co",
			expected: []string{"https://e-pic.co", "https://www.e-pic.co"},
		},
		{
			name:     "multiple URLs with spaces",
			input:    "https://e-pic.co, https://www.e-pic.co , http://localhost:3000",
			expected: []string{"https://e-pic.co", "https://www.e-pic.co", "http://localhost:3000"},
		},
		{
			name:     "URLs with trailing commas",
			input:    "https://e-pic.co,https://www.e-pic.co,",
			expected: []string{"https://e-pic.co", "https://www.e-pic.co"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseFrontendURLs(tt.input)
			if len(result) != len(tt.expected) {
				t.Errorf("parseFrontendURLs() returned %d URLs, expected %d", len(result), len(tt.expected))
			}
			for i, url := range result {
				if url != tt.expected[i] {
					t.Errorf("parseFrontendURLs()[%d] = %s, expected %s", i, url, tt.expected[i])
				}
			}
		})
	}
}

func TestLoadConfigWithFrontendURLs(t *testing.T) {
	// Set environment variable for testing
	os.Setenv("FRONTEND_URLS", "https://e-pic.co,https://www.e-pic.co")
	defer os.Unsetenv("FRONTEND_URLS")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() failed: %v", err)
	}

	if len(cfg.App.FrontendURLs) != 2 {
		t.Errorf("Expected 2 frontend URLs, got %d", len(cfg.App.FrontendURLs))
	}

	expectedURLs := []string{"https://e-pic.co", "https://www.e-pic.co"}
	for i, url := range cfg.App.FrontendURLs {
		if url != expectedURLs[i] {
			t.Errorf("FrontendURLs[%d] = %s, expected %s", i, url, expectedURLs[i])
		}
	}
}

func TestLoadConfigWithSingleFrontendURL(t *testing.T) {
	// Ensure FRONTEND_URLS is not set
	os.Unsetenv("FRONTEND_URLS")
	os.Setenv("FRONTEND_URL", "https://e-pic.co")
	defer os.Unsetenv("FRONTEND_URL")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() failed: %v", err)
	}

	if len(cfg.App.FrontendURLs) != 1 {
		t.Errorf("Expected 1 frontend URL, got %d", len(cfg.App.FrontendURLs))
	}

	if cfg.App.FrontendURLs[0] != "https://e-pic.co" {
		t.Errorf("FrontendURLs[0] = %s, expected https://e-pic.co", cfg.App.FrontendURLs[0])
	}
}
