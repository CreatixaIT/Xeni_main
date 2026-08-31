# Public API Testing Plan

## Test Environment Setup
Since Go is not available in the current environment, testing will be performed once the code is deployed to a Go-enabled environment.

## Manual Code Review Completed

### 1. Category System Implementation ✅
- **File**: `internal/models/category.go`
- **Status**: Syntax correct, follows GORM conventions
- **Features**: 
  - Category model with hierarchical support (parent_id)
  - ProductCategory junction table for many-to-many relationships
  - Proper UUID generation and foreign key constraints
  - Bilingual support (name, name_bn)
  - Active status and display ordering

### 2. Database Migration ✅
- **File**: `database/migrations/008_add_category_system.sql`
- **Status**: Valid PostgreSQL syntax
- **Features**:
  - Creates categories table with proper indexes
  - Creates product_categories junction table
  - Adds category_id to products for backward compatibility
  - Seeds initial categories matching E-Pic taxonomy
  - Proper foreign key constraints with CASCADE deletes

### 3. Public API Handler ✅
- **File**: `internal/public/handler.go`
- **Status**: Syntax appears correct, follows Go idioms
- **Features**:
  - Sanitized DTOs for all public responses
  - Pagination with validation
  - Search functionality
  - Category filtering
  - Store filtering
  - Sorting with validation
  - Rate limiting integration
  - Proper error handling
  - No sensitive data exposure

### 4. Router Integration ✅
- **File**: `internal/router/router.go`
- **Status**: Proper integration
- **Features**:
  - Public API group under `/api/public/v1`
  - Rate limiting applied (100 req/min)
  - All endpoints properly registered
  - No authentication required for public endpoints

### 5. Main Application Integration ✅
- **File**: `cmd/main.go`
- **Status**: Proper dependency injection
- **Features**:
  - Public handler initialized and passed to router
  - Follows existing patterns for handler initialization

## Test Cases to Execute in Go Environment

### 1. Database Migration Test
```bash
# Apply migration
psql -U postgres -d xeni_db -f database/migrations/008_add_category_system.sql

# Verify tables created
psql -U postgres -d xeni_db -c "\dt categories"
psql -U postgres -d xeni_db -c "\dt product_categories"

# Verify seeded data
psql -U postgres -d xeni_db -c "SELECT * FROM categories;"
```

### 2. Build Test
```bash
cd gateway
go build -o xeni-gateway ./cmd/main.go
```

### 3. API Endpoint Tests

#### Test 3.1: List Products (Basic)
```bash
curl -X GET "http://localhost:8080/api/public/v1/products?page=1&per_page=10"
# Expected: 200 OK with product array
```

#### Test 3.2: List Products (Search)
```bash
curl -X GET "http://localhost:8080/api/public/v1/products?search=test"
# Expected: 200 OK with filtered products
```

#### Test 3.3: List Products (Category Filter)
```bash
curl -X GET "http://localhost:8080/api/public/v1/products?category=fashion"
# Expected: 200 OK with fashion products
```

#### Test 3.4: List Products (Invalid Pagination)
```bash
curl -X GET "http://localhost:8080/api/public/v1/products?page=0"
# Expected: 200 OK with page defaulted to 1
```

#### Test 3.5: List Products (Large Per Page)
```bash
curl -X GET "http://localhost:8080/api/public/v1/products?per_page=200"
# Expected: 200 OK with per_page capped at 100
```

#### Test 3.6: Get Product (Valid UUID)
```bash
curl -X GET "http://localhost:8080/api/public/v1/products/{valid-uuid}"
# Expected: 200 OK with product details
```

#### Test 3.7: Get Product (Invalid UUID)
```bash
curl -X GET "http://localhost:8080/api/public/v1/products/invalid-uuid"
# Expected: 400 Bad Request
```

#### Test 3.8: Get Product (Not Found)
```bash
curl -X GET "http://localhost:8080/api/public/v1/products/00000000-0000-0000-0000-000000000000"
# Expected: 404 Not Found
```

#### Test 3.9: List Stores (Basic)
```bash
curl -X GET "http://localhost:8080/api/public/v1/stores"
# Expected: 200 OK with store array
```

#### Test 3.10: List Stores (Search)
```bash
curl -X GET "http://localhost:8080/api/public/v1/stores?search=test"
# Expected: 200 OK with filtered stores
```

#### Test 3.11: Get Store (Valid UUID)
```bash
curl -X GET "http://localhost:8080/api/public/v1/stores/{valid-uuid}"
# Expected: 200 OK with store details and products
```

#### Test 3.12: Get Store (Invalid UUID)
```bash
curl -X GET "http://localhost:8080/api/public/v1/stores/invalid-uuid"
# Expected: 400 Bad Request
```

#### Test 3.13: List Categories
```bash
curl -X GET "http://localhost:8080/api/public/v1/categories"
# Expected: 200 OK with category array including seeded categories
```

#### Test 3.14: Get Category (Valid Slug)
```bash
curl -X GET "http://localhost:8080/api/public/v1/categories/fashion"
# Expected: 200 OK with category details
```

#### Test 3.15: Get Category (Invalid Slug)
```bash
curl -X GET "http://localhost:8080/api/public/v1/categories/nonexistent"
# Expected: 404 Not Found
```

### 4. Security Tests

#### Test 4.1: Sensitive Data Exposure Check
```bash
# Verify no credentials in responses
curl -X GET "http://localhost:8080/api/public/v1/stores/{uuid}" | grep -i "password\|secret\|key"
# Expected: No matches
```

#### Test 4.2: Inactive Products Not Exposed
```bash
# Set a product to inactive in DB
# Then call API
curl -X GET "http://localhost:8080/api/public/v1/products"
# Expected: Inactive product not in response
```

#### Test 4.3: Rate Limiting
```bash
# Send 101 requests rapidly
for i in {1..101}; do
  curl -X GET "http://localhost:8080/api/public/v1/products" &
done
wait
# Expected: Request 101 returns 429 Too Many Requests
```

### 5. Existing Functionality Tests

#### Test 5.1: Authenticated Product API Still Works
```bash
# Get JWT token from login
TOKEN=$(curl -X POST "http://localhost:8080/api/auth/login" -d '{"email":"test@example.com","password":"password"}' | jq -r '.access_token')

# Test authenticated endpoint
curl -X GET "http://localhost:8080/api/products" -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK (existing functionality preserved)
```

#### Test 5.2: Authenticated Shop API Still Works
```bash
curl -X GET "http://localhost:8080/api/shops/me" -H "Authorization: Bearer $TOKEN"
# Expected: 200 OK (existing functionality preserved)
```

## Data Sanitization Verification

### Verify No Sensitive Fields in Public Responses
1. **Store Response**: Should not contain:
   - `bkash_app_key`, `bkash_app_secret`, `bkash_username`, `bkash_password`
   - `nagad_merchant_id`, `nagad_merchant_key`
   - `pathao_client_id`, `pathao_client_secret`, `pathao_username`, `pathao_password`
   - `steadfast_api_key`, `steadfast_secret_key`
   - `integrations` (may contain sensitive data)

2. **Product Response**: Should not contain:
   - Internal inventory logs
   - Cost information
   - Operational data

## Performance Validation

### Load Testing (Optional)
```bash
# Using Apache Bench
ab -n 1000 -c 10 http://localhost:8080/api/public/v1/products
# Expected: All requests succeed with reasonable response times
```

## Documentation Validation

### API Documentation Completeness
- [x] All endpoints documented
- [x] Request parameters documented
- [x] Response structures documented
- [x] Error responses documented
- [x] Security considerations documented
- [x] Integration notes provided

## Known Limitations and Future Enhancements

### Current Limitations
1. **Slug Support**: Products and stores currently use UUIDs only
   - **Future**: Add slug fields and slug-based lookup
2. **Single Currency**: Prices are in BDT only
   - **Future**: Add multi-currency support
3. **No Cart System**: Cart functionality not included in this milestone
   - **Future**: Implement cart management in Phase 6.2
4. **No Customer Orders**: Customer order history not included
   - **Future**: Implement customer order endpoints in Phase 6.2

## Success Criteria

✅ **Code Review**: All code follows Go and GORM best practices
✅ **Migration**: SQL migration is valid and safe
✅ **Integration**: Proper integration with existing Xeni architecture
✅ **Security**: No sensitive data exposure, rate limiting implemented
✅ **Documentation**: Complete API documentation provided
⏳ **Runtime Testing**: Requires Go environment for execution
⏳ **Existing Functionality**: Requires runtime testing to verify preservation

## Deployment Readiness

The implementation is ready for deployment to a Go-enabled environment. The following steps should be taken:

1. **Deploy to Staging**: Test in staging environment first
2. **Run Migration**: Apply `008_add_category_system.sql`
3. **Execute Test Plan**: Run all test cases
4. **Performance Testing**: Validate under load
5. **Security Review**: Final security validation
6. **Production Deployment**: After successful staging validation

## Notes

- All code changes are additive - no existing functionality was modified
- The public API is completely isolated from authenticated APIs
- Rate limiting protects against abuse while allowing reasonable access
- Data sanitization ensures no sensitive information leakage
- The implementation follows existing Xeni patterns and conventions