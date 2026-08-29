# E2E Checklist Fulfillment Plan

Based on the latest server logs and your recent testing, I have marked off the successfully verified items in our `e2e_testing_checklist.md` (Authentication, SSLCommerz, Facebook Connect/Webhook, Product/Order creation, Creative Agent). 

There are **3 major items remaining** on the checklist that have not been fully implemented in the code yet. Here is my plan to build them out so we can achieve 100% completion passing:

## 1. Courier API Integration (Steadfast / Pathao)
Currently, `gateway/internal/orders/handler.go` only does CRUD. We need a "Dispatch" feature.
- **Backend:** Create a new `POST /api/orders/:id/dispatch` endpoint in Go.
  - This endpoint will call the **Steadfast API** (e.g., `https://portal.packzy.com/api/v1/create_order`) with the customer's details and the shop's Steadfast API Key/Secret.
  - It will receive a Consignment ID and tracking URL, and save them to the Order model.
  - It will update the `DeliveryStatus` to `processing`.
- **Frontend:** Update `frontend/src/app/[locale]/dashboard/orders` to add a "Send to Courier" button in the order details modal, which calls the new dispatch endpoint and visually tracks the parcel.

## 2. Product Image Cloud Uploading
- **Backend:** The `UploadImage` handler in `products/handler.go` is written for DigitalOcean Spaces, but we need to verify `ENV_PRODUCTION` has the correct `SPACES_KEY`, `SPACES_SECRET`, etc.
- **Frontend:** Add a file input picker in the `Add Product` UI. When selected, it uploads the image via `formData` to `/api/products/upload`, retrieves the CDN URL, and attaches it when saving.

## 3. Sales Intelligence Agent (Analytics)
- Currently, `/api/orders/stats` returns hardcoded counts from Postgres.
- **Goal:** We will create a `POST /api/agents/intelligence/run` endpoint that pushes a task to RabbitMQ. The Python Sales Worker will read the past 30 days of orders, pass the data directly into OpenAI (GPT-4o), and generate a "Store Performance Report" text string showing real business insights and recommendations, displaying it beautifully on the Frontend Overview timeline.

## Open Questions
> [!IMPORTANT]
> **Steadfast Credentials:** Do you want me to mock the Steadfast Courier API for now, or do you have a specific Sandbox/Test Account API Key you want me to use in `.env`?

## Verification Plan
1. Start Gateway + Workers locally or remotely.
2. Click "Send to Courier" on a manual order and verify Consignment ID generation.
3. Click "Generate Report" on Dashboard to test the Sales Intelligence Agent.
4. Check off the final boxes in `e2e_testing_checklist.md`.
