# Google OAuth Manual Test Plan

## Configuration Setup

### 1. Google Cloud Console Setup
1. Go to Google Cloud Console (console.cloud.google.com)
2. Create a new project or select existing Xeni project
3. Navigate to APIs & Services > Credentials
4. Create OAuth 2.0 Client ID credentials
5. Application type: Web application
6. Authorized redirect URIs:
   - Development: `http://localhost:8080/api/auth/google/callback`
   - Production: `https://your-domain.com/api/auth/google/callback`
7. Save the Client ID and Client Secret

### 2. Environment Variables
Set the following environment variables on your VPS:

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=https://your-domain.com/api/auth/google/callback
```

### 3. Xeni Service Startup
1. Ensure environment variables are set
2. Start the Xeni gateway service
3. Verify service is running on configured port (default: 8080)
4. Check service logs for Google OAuth initialization

## Manual Test Scenarios

### Test 1: Google OAuth Configuration Validation
**Purpose:** Verify Google OAuth is properly configured

**Steps:**
1. Check service startup logs
2. Verify no Google OAuth configuration errors
3. Confirm environment variables are loaded

**Expected Result:** Service starts successfully with Google OAuth enabled

### Test 2: Google Login Flow - New User
**Purpose:** Test complete Google authentication for new user

**Steps:**
1. Access `GET /api/auth/google/login`
2. Browser should redirect to Google OAuth consent screen
3. Verify Google login page appears with correct application name
4. Login with a Google account that has never been used
5. Grant required permissions (email, profile)
6. Verify redirect back to Xeni callback URL
7. Check browser URL fragment contains access_token and refresh_token
8. Verify redirect to frontend with tokens

**Expected Result:**
- User is created in Xeni database
- User has Google ID stored
- User email is marked as verified
- User status is active
- User receives default starter subscription
- Frontend receives valid Xeni JWT tokens

### Test 3: Google Login Flow - Existing Google User
**Purpose:** Test returning Google user authentication

**Steps:**
1. Ensure a Google user already exists in database
2. Access `GET /api/auth/google/login`
3. Complete Google OAuth flow with same Google account
4. Verify redirect back to Xeni callback URL
5. Check that new Xeni tokens are issued

**Expected Result:**
- Existing user is authenticated (no duplicate user created)
- New Xeni access/refresh tokens are issued
- Previous refresh tokens are rotated/revoked

### Test 4: Email Conflict Detection
**Purpose:** Test safe handling when email already exists with different auth provider

**Steps:**
1. Create a user with email/password authentication (test@example.com)
2. Attempt Google login with same email but different Google account
3. Verify error message about email conflict

**Expected Result:**
- Authentication is rejected
- Safe error message: "Email already registered. Please log in with your existing account and link Google in settings."
- No account takeover occurs

### Test 5: CSRF Protection
**Purpose:** Verify state parameter prevents CSRF attacks

**Steps:**
1. Access `GET /api/auth/google/login`
2. Note the state parameter in redirect URL
3. Attempt callback with modified/missing state parameter
4. Verify authentication fails

**Expected Result:**
- Invalid/missing state parameter is rejected
- Error message: "Invalid or expired state parameter"
- No authentication occurs

### Test 6: Invalid Authorization Code
**Purpose:** Test handling of invalid authorization codes

**Steps:**
1. Manually call `GET /api/auth/google/callback` with invalid code
2. Verify error handling

**Expected Result:**
- Error message: "Failed to authenticate with Google"
- No user authentication occurs
- No sensitive information exposed

### Test 7: Redirect URI Validation
**Purpose:** Ensure redirect URI security

**Steps:**
1. Attempt callback from unauthorized redirect URI
2. Verify Google rejects the request

**Expected Result:**
- Google OAuth rejects unauthorized redirect URIs
- Xeni receives no callback from unauthorized sources

### Test 8: Token Security
**Purpose:** Verify tokens are handled securely

**Steps:**
1. Complete successful Google authentication
2. Check service logs
3. Verify no Google tokens are logged
4. Verify no OTP values are logged
5. Check API response doesn't expose Google tokens

**Expected Result:**
- No Google access tokens in logs
- No Google refresh tokens in logs
- No sensitive credentials exposed
- Only Xeni JWT tokens in response

### Test 9: JWT Integration
**Purpose:** Verify Google auth produces standard Xeni JWT tokens

**Steps:**
1. Complete Google authentication
2. Extract handoff code from URL fragment
3. Call `POST /api/auth/exchange-handoff` with handoff code
4. Extract access_token from response
5. Validate JWT structure and claims
6. Verify token expiration
7. Test token with protected Xeni endpoint

**Expected Result:**
- Handoff code can be exchanged for Xeni JWT tokens
- Token follows Xeni JWT format
- Contains correct user_id, email, role claims
- Token expires according to Xeni configuration
- Token works with existing Xeni middleware
- Handoff code is one-time use (cannot be reused)

### Test 10: Refresh Token Flow
**Purpose:** Verify refresh token rotation works after Google auth

**Steps:**
1. Complete Google authentication
2. Exchange handoff code for tokens
3. Extract refresh_token from response
4. Use refresh token to get new access token via `POST /api/auth/refresh`
5. Verify new access token is issued
6. Verify previous refresh token is revoked

**Expected Result:**
- Refresh token rotation works identically to password auth
- New access token issued
- Previous refresh token invalidated

### Test 11: Handoff Code Security
**Purpose:** Verify secure handoff code mechanism

**Steps:**
1. Complete Google authentication
2. Verify redirect URL contains only handoff code (not tokens)
3. Verify URL fragment format: `#/auth/callback?code=...`
4. Attempt to reuse same handoff code
5. Verify second exchange fails

**Expected Result:**
- Redirect URL contains only handoff code
- No access tokens in URL
- No refresh tokens in URL
- Handoff code can be exchanged for tokens
- Handoff code cannot be reused (one-time use)
- Handoff code expires in 5 minutes

### Test 12: Unverified Google Email
**Purpose:** Test handling of unverified Google emails (if applicable)

**Steps:**
1. Create Google account with unverified email
2. Attempt Google authentication
3. Verify authentication is rejected

**Expected Result:**
- Error message: "Email must be verified by Google"
- No user creation occurs

### Test 13: Google OAuth Not Configured
**Purpose:** Test graceful degradation when Google OAuth is not configured

**Steps:**
1. Remove or unset Google OAuth environment variables
2. Restart Xeni service
3. Attempt `GET /api/auth/google/login`

**Expected Result:**
- Error message: "Google OAuth is not configured"
- Service continues to function for other authentication methods
- No service crash

## Security Verification Checklist

- [ ] State parameter is generated and validated
- [ ] Authorization code is exchanged server-side
- [ ] Google tokens are never logged
- [ ] Google tokens are never exposed in API responses
- [ ] Client secret is never exposed
- [ ] Redirect URI is validated by Google
- [ ] Email conflict is detected safely
- [ ] Account takeover is prevented
- [ ] CSRF protection is effective
- [ ] Xeni tokens are NOT placed in URL fragment
- [ ] Handoff code is used instead of direct token transfer
- [ ] Handoff code is one-time use
- [ ] Handoff code expires in 5 minutes
- [ ] Handoff code cannot be reused
- [ ] JWT tokens follow Xeni standard format
- [ ] Refresh token rotation works correctly
- [ ] No secret credentials in logs

## Troubleshooting

### Common Issues

**Issue:** "Google OAuth is not configured"
**Solution:** Verify GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URL are set

**Issue:** "Invalid or expired state parameter"
**Solution:** Ensure state parameter is passed correctly and Redis is functioning

**Issue:** "Failed to authenticate with Google"
**Solution:** Check Google Cloud Console credentials and redirect URI configuration

**Issue:** "Email already registered"
**Solution:** This is expected security behavior when email conflicts exist

## Post-Deployment Verification

1. Monitor service logs for Google authentication attempts
2. Verify successful Google user creations in database
3. Check token issuance rates match authentication attempts
4. Monitor for any authentication errors
5. Verify Redis state management is working
6. Confirm no sensitive data in logs

## Success Criteria

- All manual tests pass
- No security vulnerabilities detected
- Google authentication works for new and existing users
- Email conflicts are handled safely
- Token security is maintained
- Service remains stable during Google auth flows
- No sensitive data exposure in logs or responses
