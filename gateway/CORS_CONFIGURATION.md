# CORS Configuration for Xeni Gateway

## Overview

Updated Xeni Gateway CORS configuration to support multiple trusted frontend origins for production E-Pic Marketplace deployment.

## Root Cause

The previous CORS configuration used a single `FrontendURL` string in the configuration, which was passed directly to the Fiber CORS middleware's `AllowOrigins` field. This did not support multiple production origins:
- `https://e-pic.co`
- `https://www.e-pic.co`

## Changes Made

### 1. Configuration Structure (`internal/config/config.go`)

**Before:**
```go
type AppConfig struct {
    Env         string
    Port        string
    FrontendURL string
}
```

**After:**
```go
type AppConfig struct {
    Env          string
    Port         string
    FrontendURL  string
    FrontendURLs []string // Multiple trusted frontend origins for CORS
}
```

### 2. Configuration Loading (`internal/config/config.go`)

Added `parseFrontendURLs()` function to parse comma-separated frontend URLs:
```go
func parseFrontendURLs(urls string) []string {
    if urls == "" {
        return []string{}
    }
    
    parts := strings.Split(urls, ",")
    result := make([]string, 0, len(parts))
    
    for _, part := range parts {
        trimmed := strings.TrimSpace(part)
        if trimmed != "" {
            result = append(result, trimmed)
        }
    }
    
    return result
}
```

Updated `Load()` function to parse `FRONTEND_URLS` environment variable:
```go
// Parse multiple frontend URLs for CORS
frontendURLs := parseFrontendURLs(getEnv("FRONTEND_URLS", ""))
if len(frontendURLs) == 0 {
    // Fallback to single FRONTEND_URL for backward compatibility
    frontendURLs = []string{getEnv("FRONTEND_URL", "http://localhost:3000")}
}

return &Config{
    App: AppConfig{
        Env:          getEnv("APP_ENV", "development"),
        Port:         getEnv("PORT", "8080"),
        FrontendURL:  getEnv("FRONTEND_URL", "http://localhost:3000"),
        FrontendURLs: frontendURLs,
    },
    // ... rest of config
}
```

### 3. CORS Middleware (`internal/router/router.go`)

**Before:**
```go
app.Use(cors.New(cors.Config{
    AllowOrigins:     cfg.App.FrontendURL,
    AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
    AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Request-ID",
    AllowCredentials: true,
}))
```

**After:**
```go
app.Use(cors.New(cors.Config{
    AllowOriginsFunc: func(origin string) bool {
        // Check if the origin is in the allowed list
        for _, allowedOrigin := range cfg.App.FrontendURLs {
            if origin == allowedOrigin {
                return true
            }
        }
        return false
    },
    AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
    AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Request-ID",
    AllowCredentials: true,
}))
```

**Key Change:** Replaced `AllowOrigins` (string) with `AllowOriginsFunc` (function) to enable dynamic origin validation against the list of trusted origins.

## Environment Configuration

### New Environment Variable

**FRONTEND_URLS** (optional): Comma-separated list of trusted frontend origins for CORS.

**Example:**
```bash
FRONTEND_URLS=https://e-pic.co,https://www.e-pic.co
```

### Backward Compatibility

The single `FRONTEND_URL` environment variable is still supported for backward compatibility:
- If `FRONTEND_URLS` is set, it takes precedence
- If `FRONTEND_URLS` is not set, `FRONTEND_URL` is used as a single-origin fallback
- If neither is set, defaults to `http://localhost:3000`

### Production Configuration

For production E-Pic Marketplace deployment:
```bash
FRONTEND_URLS=https://e-pic.co,https://www.e-pic.co
```

For development:
```bash
FRONTEND_URL=http://localhost:3000
# or
FRONTEND_URLS=http://localhost:3000,http://localhost:3001
```

## Security Properties

### Explicit Origin Whitelist

✅ **Only explicitly trusted origins are allowed**
- Origins are validated against the configured list
- No wildcard (`*`) is used
- No reflection of arbitrary Origin headers

### Credentials Support

✅ **Preserved credential support**
- `AllowCredentials: true` is maintained
- Required for cookie-based authentication (HttpOnly cookies)

### Existing Security Preserved

✅ **All existing security middleware is preserved**
- Security headers middleware
- Rate limiting
- Authentication middleware
- Request ID middleware

## Expected CORS Behavior

### Allowed Origins

For requests from:
- `https://e-pic.co`
- `https://www.e-pic.co`

**Expected Response Headers:**
```
Access-Control-Allow-Origin: <matching origin>
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Origin,Content-Type,Accept,Authorization,X-Request-ID
```

### Rejected Origins

For requests from untrusted origins (e.g., `https://evil.example`):

**Expected Behavior:**
- NO `Access-Control-Allow-Origin` header
- NO `Access-Control-Allow-Credentials: true` header
- Browser blocks the CORS request
- Request fails with CORS error

### Preflight (OPTIONS)

Example preflight request:
```http
OPTIONS https://api.e-pic.co/api/auth/login
Origin: https://e-pic.co
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type,Authorization
```

**Expected Response:**
```
Access-Control-Allow-Origin: https://e-pic.co
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Origin,Content-Type,Accept,Authorization,X-Request-ID
```

## Tests Added

### Configuration Tests (`internal/config/config_test.go`)

1. **TestParseFrontendURLs**: Tests parsing of comma-separated URLs
   - Empty string
   - Single URL
   - Multiple URLs
   - URLs with spaces
   - URLs with trailing commas

2. **TestLoadConfigWithFrontendURLs**: Tests loading config with FRONTEND_URLS
3. **TestLoadConfigWithSingleFrontendURL**: Tests backward compatibility with FRONTEND_URL

### Middleware Tests (`internal/middleware/middleware_test.go`)

1. **TestCORSTrustedOrigins**: Documents trusted production origins
2. **TestCORSAllowedOrigins**: Documents expected behavior for allowed origins
3. **TestCORSRejectedOrigins**: Documents expected behavior for rejected origins

## Test Results

### Go Tests
```bash
go test ./internal/config/...
# PASS (0.689s)

go test ./internal/middleware/...
# PASS (0.383s)
```

### Go Vet
```bash
go vet ./internal/config/...
# PASS

go vet ./internal/middleware/...
# PASS
```

### Go Build
```bash
go build ./...
# PASS
```

## Files Changed

1. **internal/config/config.go**
   - Added `FrontendURLs []string` to `AppConfig`
   - Added `parseFrontendURLs()` function
   - Updated `Load()` to parse `FRONTEND_URLS` environment variable

2. **internal/router/router.go**
   - Changed CORS middleware from `AllowOrigins` to `AllowOriginsFunc`
   - Added origin validation logic

3. **internal/config/config_test.go** (new)
   - Added configuration parsing tests

4. **internal/middleware/middleware_test.go**
   - Added CORS documentation tests

## Deployment Notes

### Required Environment Changes

Set the new environment variable in production:
```bash
FRONTEND_URLS=https://e-pic.co,https://www.e-pic.co
```

### No Database Migrations Required

This change is purely configuration and middleware. No database schema changes are required.

### No JebKharch Changes

JebKharch remains completely unchanged.

### Service Restart Required

After deploying the new code and environment variables, the Xeni Gateway service must be restarted for the new CORS configuration to take effect.

## Verification Steps

After deployment, verify CORS behavior:

1. **Test allowed origin:**
   ```bash
   curl -H "Origin: https://e-pic.co" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS https://api.e-pic.co/api/auth/login
   ```
   Expected: `Access-Control-Allow-Origin: https://e-pic.co`

2. **Test rejected origin:**
   ```bash
   curl -H "Origin: https://evil.example" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS https://api.e-pic.co/api/auth/login
   ```
   Expected: NO `Access-Control-Allow-Origin` header

3. **Test both production origins:**
   - Test with `https://e-pic.co`
   - Test with `https://www.e-pic.co`
   - Both should receive correct CORS headers

## Security Considerations

### No Weakening of Security

✅ **Security is not weakened:**
- Explicit origin whitelist maintained
- No wildcard origins
- No reflection of arbitrary origins
- Credentials support preserved
- All existing security middleware preserved

### Configuration Safety

✅ **Configuration is safe:**
- Environment variable-based configuration
- No hard-coded production URLs
- Backward compatibility maintained
- Default to localhost for development

## Commit Hash

Commit will be created after this documentation is finalized.

## Summary

The CORS configuration has been successfully updated to support multiple trusted frontend origins for production E-Pic Marketplace deployment. The implementation:

- Uses explicit origin whitelisting (no wildcards)
- Preserves credential support for cookie-based authentication
- Maintains backward compatibility with single-origin configuration
- Passes all Go tests, vet checks, and build
- Requires environment variable configuration for production
- Does not require database migrations
- Does not modify JebKharch

The change is narrowly scoped to CORS configuration and does not modify authentication security logic or other unrelated services.
