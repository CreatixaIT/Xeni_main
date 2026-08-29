package pages

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/xeni-ai/gateway/internal/config"
	"github.com/xeni-ai/gateway/internal/models"
	"github.com/xeni-ai/gateway/pkg/jwt"
	"github.com/xeni-ai/gateway/pkg/response"
)

// Handler holds Facebook pages dependencies.
type Handler struct {
	DB  *gorm.DB
	Cfg *config.Config
	JWT *jwt.Manager
}

// NewHandler creates a new pages handler.
func NewHandler(db *gorm.DB, cfg *config.Config, jwtManager *jwt.Manager) *Handler {
	return &Handler{DB: db, Cfg: cfg, JWT: jwtManager}
}

// ConnectPage handles POST /api/pages/connect — connect a Facebook Page.
func (h *Handler) ConnectPage(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	// Get user's shop
	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.BadRequest(c, "Create a shop first before connecting pages")
	}

	var req struct {
		PageID          string  `json:"page_id"`
		PageName        string  `json:"page_name"`
		PageAccessToken string  `json:"page_access_token"`
		PagePictureURL  *string `json:"page_picture_url"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.PageID == "" || req.PageName == "" || req.PageAccessToken == "" {
		return response.BadRequest(c, "page_id, page_name, and page_access_token are required")
	}

	// Check if page is already connected
	var existing models.ConnectedPage
	if err := h.DB.Where("page_id = ?", req.PageID).First(&existing).Error; err == nil {
		return response.BadRequest(c, "This page is already connected")
	}

	// In production: exchange short-lived token for long-lived, encrypt with AES-256
	// For now, store the token as-is (dev mode)
	page := models.ConnectedPage{
		ShopID:            shop.ID,
		PageID:            req.PageID,
		PageName:          req.PageName,
		PageAccessToken:   req.PageAccessToken,
		PagePictureURL:    req.PagePictureURL,
		WebhookSubscribed: true, // In production: call Graph API to subscribe
		IsActive:          true,
	}

	if err := h.DB.Create(&page).Error; err != nil {
		slog.Error("failed to connect page", "error", err)
		return response.InternalError(c)
	}

	slog.Info("Facebook page connected", "page_id", req.PageID, "shop_id", shop.ID)

	return response.Created(c, page)
}

// ListPages handles GET /api/pages — list all connected pages for the user's shop.
func (h *Handler) ListPages(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.Success(c, []models.ConnectedPage{})
	}

	var pages []models.ConnectedPage
	h.DB.Where("shop_id = ?", shop.ID).Order("connected_at DESC").Find(&pages)

	return response.Success(c, pages)
}

// DisconnectPage handles DELETE /api/pages/:id — disconnect a Facebook Page.
func (h *Handler) DisconnectPage(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)
	pageDBID := c.Params("id")

	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "Shop not found")
	}

	pid, err := uuid.Parse(pageDBID)
	if err != nil {
		return response.BadRequest(c, "Invalid page ID")
	}

	result := h.DB.Where("id = ? AND shop_id = ?", pid, shop.ID).Delete(&models.ConnectedPage{})
	if result.RowsAffected == 0 {
		return response.NotFound(c, "Page not found")
	}

	return response.Success(c, map[string]string{"message": "Page disconnected successfully"})
}

// PublishPost handles POST /api/pages/publish — publish content to a Facebook Page.
func (h *Handler) PublishPost(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	uid, _ := uuid.Parse(userID)

	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return response.NotFound(c, "Shop not found")
	}

	var req struct {
		PageID   string `json:"page_id"`
		Message  string `json:"message"`
		ImageURL string `json:"image_url"`
	}
	if err := c.BodyParser(&req); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}
	if req.PageID == "" || (req.Message == "" && req.ImageURL == "") {
		return response.BadRequest(c, "page_id and either message or image_url are required")
	}

	// Verify the page belongs to the shop and get its access token
	var page models.ConnectedPage
	if err := h.DB.Where("page_id = ? AND shop_id = ?", req.PageID, shop.ID).First(&page).Error; err != nil {
		return response.Forbidden(c, "Page not found or not connected to your shop")
	}

	// Publish to Facebook Graph API
	graphURL := fmt.Sprintf("https://graph.facebook.com/v21.0/%s", page.PageID)

	payload := map[string]string{
		"access_token": page.PageAccessToken,
	}

	if req.Message != "" {
		payload["message"] = req.Message
	}
	if req.ImageURL != "" {
		payload["url"] = req.ImageURL
		graphURL += "/photos" // POST to /photos for images
	} else {
		graphURL += "/feed" // POST to /feed for text only
	}

	jsonValue, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(graphURL, "application/json", bytes.NewBuffer(jsonValue))
	if err != nil {
		slog.Error("failed to publish to facebook", "error", err)
		return response.InternalError(c)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var fbError map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&fbError)
		slog.Error("facebook graph api error", "response", fbError, "status", resp.StatusCode)

		errMsg := "Failed to publish to Facebook"
		if errData, ok := fbError["error"].(map[string]interface{}); ok {
			if msg, ok := errData["message"].(string); ok {
				errMsg = msg
			}
		}
		return response.BadRequest(c, "Facebook Error: "+errMsg)
	}

	return response.Success(c, map[string]string{
		"message": "Successfully published to Facebook Page",
	})
}

// OAuthLogin redirects the user to the Facebook OAuth URL.
func (h *Handler) OAuthLogin(c *fiber.Ctx) error {
	tokenStr := c.Query("token")
	if tokenStr == "" {
		return c.Status(fiber.StatusUnauthorized).SendString("Token is required")
	}

	_, err := h.JWT.ValidateAccessToken(tokenStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).SendString("Invalid token")
	}

	redirectURI := c.BaseURL() + "/api/oauth/pages/facebook/callback"
	url := fmt.Sprintf("https://www.facebook.com/v21.0/dialog/oauth?client_id=%s&redirect_uri=%s&state=%s&scope=pages_show_list,pages_messaging,pages_manage_posts,pages_manage_metadata,pages_read_engagement&response_type=code&auth_type=rerequest",
		h.Cfg.Facebook.AppID, redirectURI, tokenStr)

	return c.Redirect(url)
}

// OAuthCallback handles the redirect from Facebook, exchanges the code for a token, and syncs pages.
func (h *Handler) OAuthCallback(c *fiber.Ctx) error {
	code := c.Query("code")
	stateToken := c.Query("state")

	if code == "" || stateToken == "" {
		return c.Redirect(h.Cfg.App.FrontendURL + "/en/dashboard/pages?error=missing_code_or_state")
	}

	claims, err := h.JWT.ValidateAccessToken(stateToken)
	if err != nil {
		return c.Redirect(h.Cfg.App.FrontendURL + "/en/dashboard/pages?error=invalid_state_token")
	}

	uid, _ := uuid.Parse(claims.UserID)
	var shop models.Shop
	if err := h.DB.Where("user_id = ?", uid).First(&shop).Error; err != nil {
		return c.Redirect(h.Cfg.App.FrontendURL + "/en/dashboard/pages?error=shop_not_found")
	}

	redirectURI := c.BaseURL() + "/api/oauth/pages/facebook/callback"

	// 1. Exchange code for access token
	tokenURL := fmt.Sprintf("https://graph.facebook.com/v21.0/oauth/access_token?client_id=%s&redirect_uri=%s&client_secret=%s&code=%s",
		h.Cfg.Facebook.AppID, redirectURI, h.Cfg.Facebook.AppSecret, code)

	resp, err := http.Get(tokenURL)
	if err != nil || resp.StatusCode != 200 {
		return c.Redirect(h.Cfg.App.FrontendURL + "/en/dashboard/pages?error=token_exchange_failed")
	}
	defer resp.Body.Close()

	var tokenRes struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenRes); err != nil {
		return c.Redirect(h.Cfg.App.FrontendURL + "/en/dashboard/pages?error=invalid_token_response")
	}

	// 2. Fetch pages using the long-lived access token
	// Debug: token
	slog.Info("full token", "token", tokenRes.AccessToken)

	pagesURL := fmt.Sprintf("https://graph.facebook.com/v21.0/me/accounts?access_token=%s", tokenRes.AccessToken)
	slog.Info("fetching pages", "url", pagesURL[:80])
	pagesResp, err := http.Get(pagesURL)
	if err != nil || pagesResp.StatusCode != 200 {
		return c.Redirect(h.Cfg.App.FrontendURL + "/en/dashboard/pages?error=failed_fetching_pages")
	}
	defer pagesResp.Body.Close()

	var accountsRes struct {
		Data []struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			AccessToken string `json:"access_token"`
		} `json:"data"`
	}

	slog.Info("pages from facebook", "count", len(accountsRes.Data))
	for _, p := range accountsRes.Data {
		slog.Info("page found", "id", p.ID, "name", p.Name)
	}

	if err := json.NewDecoder(pagesResp.Body).Decode(&accountsRes); err != nil {
		return c.Redirect(h.Cfg.App.FrontendURL + "/en/dashboard/pages?error=failed_parsing_pages")
	}

	// 3. Save all granted pages to the database
	for _, p := range accountsRes.Data {
		// Attempt to subscribe page to webhook automatically
		subURL := fmt.Sprintf("https://graph.facebook.com/v21.0/%s/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=%s", p.ID, p.AccessToken)
		if req, err := http.NewRequest("POST", subURL, nil); err == nil {
			client := &http.Client{}
			resp, err := client.Do(req)
			if err != nil {
				slog.Error("failed to call facebook subscription api", "page_id", p.ID, "error", err)
			} else {
				var res map[string]interface{}
				json.NewDecoder(resp.Body).Decode(&res)
				slog.Info("facebook subscription response", "page_id", p.ID, "status", resp.StatusCode, "response", res)
				resp.Body.Close()
			}
		}

		// Save/Update in DB
		var existing models.ConnectedPage
		if err := h.DB.Where("page_id = ?", p.ID).First(&existing).Error; err == nil {
			h.DB.Model(&existing).Updates(map[string]interface{}{
				"page_name":         p.Name,
				"page_access_token": p.AccessToken,
				"shop_id":           shop.ID,
			})
		} else {
			page := models.ConnectedPage{
				ShopID:            shop.ID,
				PageID:            p.ID,
				PageName:          p.Name,
				PageAccessToken:   p.AccessToken,
				WebhookSubscribed: true,
				IsActive:          true,
			}
			h.DB.Create(&page)
		}
	}

	return c.Redirect(h.Cfg.App.FrontendURL + "/en/dashboard/pages?oauth=success")
}
