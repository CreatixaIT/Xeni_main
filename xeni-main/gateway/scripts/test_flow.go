//go:build ignore
// +build ignore

package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	_ "github.com/lib/pq"
	_ "gorm.io/driver/postgres"
)

var baseURL = "http://localhost:8080/auth"
var email = "xeniassistant@gmail.com"
var dbURL = "postgresql://xeni:xeni_secret@localhost:5432/ai_os_db?sslmode=disable"

func postJSON(url string, payload map[string]interface{}) (int, string) {
	jsonData, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err.Error()
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(body)
}

func main() {
	fmt.Println("--- XENI API AUTHENTICATION TEST ---")

	fmt.Println("\n1. Registering User...")
	code, resp := postJSON(baseURL+"/register", map[string]interface{}{
		"name": "Xeni Assistant", "email": email, "password": "Xeni_2026", "role": "user",
	})
	fmt.Printf("Register Response [%d]: %s\n", code, resp)

	fmt.Println("\n--- STOPPING HERE FOR OTP INPUT ---")
	return
	code, resp = postJSON(baseURL+"/verify-email", map[string]interface{}{
		"email": email, "otp": otp.String,
	})
	fmt.Printf("Verify Response [%d]: %s\n", code, resp)

	fmt.Println("\n4. Testing Login...")
	code, resp = postJSON(baseURL+"/login", map[string]interface{}{
		"email": email, "password": "Xeni_2026",
	})
	fmt.Printf("Login Response [%d]: %s\n", code, resp)

	fmt.Println("\n5. Forgot Password...")
	code, resp = postJSON(baseURL+"/forgot-password", map[string]interface{}{
		"email": email,
	})
	fmt.Printf("Forgot Password Response [%d]: %s\n", code, resp)

	fmt.Println("\n6. Fetching Reset OTP from DB...")
	time.Sleep(3 * time.Second)
	var newOtp sql.NullString
	err = db.QueryRow("SELECT otp FROM users WHERE email = $1", email).Scan(&newOtp)
	if err != nil || !newOtp.Valid {
		fmt.Printf("FAILED TO FETCH NEW OTP!\n")
		return
	}
	fmt.Printf("Captured Reset OTP: %s\n", newOtp.String)

	fmt.Println("\n7. Reset Password...")
	code, resp = postJSON(baseURL+"/reset-password", map[string]interface{}{
		"email": email, "otp": newOtp.String, "new_password": "Xeni_2027",
	})
	fmt.Printf("Reset Password Response [%d]: %s\n", code, resp)

	fmt.Println("\n8. Testing New Login...")
	code, resp = postJSON(baseURL+"/login", map[string]interface{}{
		"email": email, "password": "Xeni_2027",
	})
	fmt.Printf("New Login Response [%d]: %s\n", code, resp)

	fmt.Println("\n--- TEST COMPLETE ---")
}
