package whatsapp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// Client handles communication with the Meta WhatsApp Cloud API.
type Client struct {
	AccessToken   string
	PhoneNumberID string
	APIVersion    string
}

// NewClient creates a new WhatsApp client.
func NewClient(token, phoneID, version string) *Client {
	if version == "" {
		version = "v21.0"
	}
	return &Client{
		AccessToken:   token,
		PhoneNumberID: phoneID,
		APIVersion:    version,
	}
}

// TemplateComponent represents a component in a WhatsApp template.
type TemplateComponent struct {
	Type       string        `json:"type"`
	Parameters []interface{} `json:"parameters"`
}

// Parameter represents a parameter in a WhatsApp template component.
type Parameter struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// SendTemplate sends a template-based message to a recipient.
func (c *Client) SendTemplate(to, templateName, langCode string, bodyParams []string) error {
	url := fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", c.APIVersion, c.PhoneNumberID)

	params := make([]interface{}, len(bodyParams))
	for i, p := range bodyParams {
		params[i] = Parameter{
			Type: "text",
			Text: p,
		}
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                to,
		"type":              "template",
		"template": map[string]interface{}{
			"name": templateName,
			"language": map[string]string{
				"code": langCode,
			},
			"components": []TemplateComponent{
				{
					Type:       "body",
					Parameters: params,
				},
			},
		},
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(data))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+c.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		var errorResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&errorResp); err != nil {
			return fmt.Errorf("whatsapp api returned status %d", resp.StatusCode)
		}
		return fmt.Errorf("whatsapp api error: %v", errorResp)
	}

	return nil
}
