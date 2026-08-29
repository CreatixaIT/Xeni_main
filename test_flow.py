import httpx
import psycopg2
import time

BASE_URL = "http://localhost:8080/api"
EMAIL = "xeniassistant@gmail.com"
DB_URL = "postgresql://xeni:xeni_secret@localhost:5432/xeni_db"

print("--- END-TO-END AUTHENTICATION TEST ---")

print("\n1. Registering User...")
# Registration endpoint might be /api/auth/register or just /auth/register depending on gateway router.go.
# We will use /auth/register since the router uses `api.Group("/auth")` without `/api` prefix, wait.
# The gateway is on :8080. If frontend config uses `/api`, the router maps `/api` globally to Echo.
# Let's check router.go: e.Group("/api")? Usually `api.Group("/auth")` is inside an `api` group. Let's assume `/api/auth/register`.
# Let's use `/api/auth/register`. If it fails, I'll switch.
res = httpx.post(
    "http://localhost:8080/api/auth/register",
    json={"name":"Xeni Assistant", "email":EMAIL, "password":"Xeni_2026", "role":"user"},
    timeout=10.0
)
if res.status_code == 404:
    BASE_URL = "http://localhost:8080"
    res = httpx.post(
        "http://localhost:8080/auth/register",
        json={"name":"Xeni Assistant", "email":EMAIL, "password":"Xeni_2026", "role":"user"},
        timeout=10.0
    )

print("Register Response:", res.status_code, res.text)

print("\n2. Fetching OTP from DB...")
time.sleep(1) # wait for DB insert
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("SELECT otp FROM users WHERE email = %s", (EMAIL,))
row = cur.fetchone()
otp = row[0] if row else None
conn.close()
if not otp:
    print("FAILED TO FETCH OTP! Aborting.")
    exit(1)
print(f"Captured OTP: {otp}")

print("\n3. Verifying Email...")
res = httpx.post(f"{BASE_URL}/auth/verify-email", json={"email":EMAIL, "otp":otp})
print("Verify Response:", res.status_code, res.text)

print("\n4. Testing Login...")
res = httpx.post(f"{BASE_URL}/auth/login", json={"email":EMAIL, "password":"Xeni_2026"})
print("Login Response:", res.status_code, res.text)

print("\n5. Forgot Password...")
res = httpx.post(f"{BASE_URL}/auth/forgot-password", json={"email":EMAIL})
print("Forgot Password Response:", res.status_code, res.text)

print("\n6. Fetching Reset OTP from DB...")
time.sleep(1)
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("SELECT otp FROM users WHERE email = %s", (EMAIL,))
new_otp = cur.fetchone()[0]
conn.close()
print(f"Captured Reset OTP: {new_otp}")

print("\n7. Reset Password...")
res = httpx.post(f"{BASE_URL}/auth/reset-password", json={"email":EMAIL, "otp":new_otp, "new_password":"Xeni_2027"})
print("Reset Password Response:", res.status_code, res.text)

print("\n8. Testing New Login...")
res = httpx.post(f"{BASE_URL}/auth/login", json={"email":EMAIL, "password":"Xeni_2027"})
print("New Login Response:", res.status_code, res.text)

print("\n--- TEST COMPLETE ---")
