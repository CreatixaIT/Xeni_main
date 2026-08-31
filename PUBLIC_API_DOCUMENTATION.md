# Xeni Public Commerce API Documentation

## Overview

The Xeni Public Commerce API provides read-only access to marketplace data for E-Pic Marketplace integration. All endpoints are versioned under `/api/public/v1/` and require no authentication.

**Base URL**: `https://api.xeni.com/api/public/v1`

**Rate Limiting**: 100 requests per minute per IP address

**Response Format**: JSON with standard structure:
```json
{
  "success": true,
  "data": { ... },
  "meta": { ... } // for paginated endpoints
}
```

**Error Response Format**:
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Endpoints

### Products

#### List Products

**Endpoint**: `GET /api/public/v1/products`

**Purpose**: Retrieve a paginated list of active products with optional filtering and sorting.

**Authentication**: None required

**Query Parameters**:
- `page` (integer, optional): Page number (default: 1)
- `per_page` (integer, optional): Items per page, max 100 (default: 20)
- `search` (string, optional): Search in product name, Bangla name, or SKU
- `category` (string, optional): Filter by category slug
- `store_id` (string, optional): Filter by store UUID
- `sort` (string, optional): Sort field - `created_at`, `name`, `price`, `total_sold` (default: `created_at`)
- `order` (string, optional): Sort order - `asc`, `desc` (default: `desc`)

**Response Structure**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Product Name",
      "name_bn": "বাংলা নাম",
      "description": "Product description",
      "description_bn": "বাংলা বর্ণনা",
      "price": 299.99,
      "sku": "SKU-123",
      "current_stock": 50,
      "is_out_of_stock": false,
      "is_active": true,
      "images": ["https://example.com/image1.jpg"],
      "variants": [
        {
          "id": "uuid",
          "sku": "SKU-123-RED",
          "color": "red",
          "size": "M",
          "price_modifier": 0.00,
          "stock": 25,
          "is_active": true
        }
      ],
      "store": {
        "id": "uuid",
        "shop_name": "Store Name",
        "shop_description": "Store description",
        "shop_logo_url": "https://example.com/logo.jpg",
        "district": "Dhaka",
        "preferred_language": "bn"
      },
      "category": {
        "id": "uuid",
        "slug": "fashion",
        "name": "Fashion",
        "name_bn": "ফ্যাশন"
      },
      "categories": [
        {
          "id": "uuid",
          "slug": "fashion",
          "name": "Fashion",
          "name_bn": "ফ্যাশন"
        }
      ],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Database error

---

#### Get Product Details

**Endpoint**: `GET /api/public/v1/products/:identifier`

**Purpose**: Retrieve detailed information about a specific product.

**Authentication**: None required

**URL Parameters**:
- `identifier` (string, required): Product UUID

**Response Structure**: Same as individual product object in List Products

**Error Responses**:
- `400 Bad Request`: Invalid identifier format
- `404 Not Found`: Product not found or inactive
- `500 Internal Server Error`: Database error

---

### Stores

#### List Stores

**Endpoint**: `GET /api/public/v1/stores`

**Purpose**: Retrieve a paginated list of stores with optional filtering.

**Authentication**: None required

**Query Parameters**:
- `page` (integer, optional): Page number (default: 1)
- `per_page` (integer, optional): Items per page, max 100 (default: 20)
- `search` (string, optional): Search in store name or description
- `district` (string, optional): Filter by district

**Response Structure**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "shop_name": "Store Name",
      "shop_description": "Store description",
      "shop_logo_url": "https://example.com/logo.jpg",
      "district": "Dhaka",
      "preferred_language": "bn"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 50,
    "total_pages": 3
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Database error

---

#### Get Store Details

**Endpoint**: `GET /api/public/v1/stores/:identifier`

**Purpose**: Retrieve detailed information about a specific store including its products.

**Authentication**: None required

**URL Parameters**:
- `identifier` (string, required): Store UUID

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "store": {
      "id": "uuid",
      "shop_name": "Store Name",
      "shop_description": "Store description",
      "shop_logo_url": "https://example.com/logo.jpg",
      "district": "Dhaka",
      "preferred_language": "bn"
    },
    "products": [
      // Product objects (same structure as List Products)
    ],
    "product_count": 25
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid identifier format
- `404 Not Found`: Store not found
- `500 Internal Server Error`: Database error

---

### Categories

#### List Categories

**Endpoint**: `GET /api/public/v1/categories`

**Purpose**: Retrieve all active categories in hierarchical structure.

**Authentication**: None required

**Response Structure**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "slug": "fashion",
      "name": "Fashion",
      "name_bn": "ফ্যাশন",
      "parent_id": null,
      "is_active": true,
      "description": "Fashion and clothing items",
      "display_order": 1,
      "children": [
        {
          "id": "uuid",
          "slug": "mens-clothing",
          "name": "Men's Clothing",
          "name_bn": "পুরুষদের পোশাক",
          "parent_id": "uuid",
          "is_active": true,
          "description": "Clothing for men",
          "display_order": 1,
          "children": []
        }
      ]
    }
  ]
}
```

**Error Responses**:
- `500 Internal Server Error`: Database error

---

#### Get Category Details

**Endpoint**: `GET /api/public/v1/categories/:slug`

**Purpose**: Retrieve detailed information about a specific category including its children.

**Authentication**: None required

**URL Parameters**:
- `slug` (string, required): Category slug

**Response Structure**: Same as individual category object in List Categories

**Error Responses**:
- `404 Not Found`: Category not found or inactive
- `500 Internal Server Error`: Database error

---

## Security Considerations

### Data Exposure Prevention
The public API explicitly excludes sensitive information:
- **Never exposed**: Internal IDs, merchant credentials, API keys, payment integration secrets, courier credentials, internal configuration
- **Sanitized responses**: All responses use public DTOs that exclude sensitive fields
- **Active records only**: Only `is_active = true` records are returned

### Rate Limiting
- **Limit**: 100 requests per minute per IP address
- **Enforcement**: Redis-based rate limiting
- **Response**: `429 Too Many Requests` when limit exceeded

### Input Validation
- **Pagination**: Page numbers must be ≥ 1, per_page between 1-100
- **UUID validation**: Identifier parameters are validated as UUIDs
- **Sort validation**: Only allowed sort fields are accepted
- **SQL injection prevention**: Parameterized queries throughout

### CORS Configuration
Public endpoints inherit the global CORS configuration from the main application, configured to allow requests from authorized domains.

---

## Integration Notes for E-Pic

### Currency Handling
- Xeni stores prices as decimal values in the database
- Current implementation assumes single currency (BDT)
- Future enhancement: Add multi-currency support to Product model

### Category Mapping
E-Pic categories map to Xeni categories as follows:
- `fashion` → Fashion
- `technology` → Technology  
- `home` → Home
- `beauty` → Beauty
- `lifestyle` → Lifestyle

### Identifier Strategy
- Currently using UUIDs for product and store identification
- Future enhancement: Add SEO-friendly slugs to Product and Shop models
- Slug support will be added in subsequent milestones

### Availability Mapping
Xeni availability maps to E-Pic as follows:
- `current_stock > 0` → `"in-stock"`
- `current_stock > 0 && current_stock <= low_stock_threshold` → `"low-stock"`
- `current_stock <= 0 || is_out_of_stock == true` → `"out-of-stock"`

---

## Versioning

API versioning follows the URL pattern `/api/public/v{version}/`. Current version is `v1`.

Breaking changes will result in a new version number. Backward-compatible changes will not increment the version.

---

## Testing Examples

### Get all products
```bash
curl "https://api.xeni.com/api/public/v1/products?page=1&per_page=10"
```

### Search products
```bash
curl "https://api.xeni.com/api/public/v1/products?search=lamp"
```

### Filter by category
```bash
curl "https://api.xeni.com/api/public/v1/products?category=fashion"
```

### Get specific product
```bash
curl "https://api.xeni.com/api/public/v1/products/uuid-here"
```

### Get all stores
```bash
curl "https://api.xeni.com/api/public/v1/stores"
```

### Get store with products
```bash
curl "https://api.xeni.com/api/public/v1/stores/uuid-here"
```

### Get categories
```bash
curl "https://api.xeni.com/api/public/v1/categories"
```

---

## Support

For API integration issues, contact the Xeni development team or refer to the main Xeni documentation.