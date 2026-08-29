// ============================================================
// XENI AI — Autonomous E-Commerce Command Center
// MongoDB Initialization
// ============================================================
// Runs automatically via docker-entrypoint-initdb.d
// Creates the xeni_outputs database with 4 domain-specific
// collections, schema validation, and indexes.
// ============================================================

// Switch to the xeni_outputs database
db = db.getSiblingDB("xeni_outputs");

// ──────────────────────────────────────────────────────────
// 1. CONVERSATION OUTPUTS — AI conversation logs
// ──────────────────────────────────────────────────────────

db.createCollection("conversation_outputs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["task_id", "shop_id", "customer_psid", "created_at"],
      properties: {
        task_id: {
          bsonType: "string",
          description: "UUID — correlates with PostgreSQL agent_tasks.task_id",
        },
        shop_id: {
          bsonType: "string",
          description: "UUID of the shop",
        },
        customer_psid: {
          bsonType: "string",
          description: "Facebook Page-Scoped ID of the customer",
        },
        intent_detected: {
          bsonType: "string",
          description:
            "Classified intent: product_inquiry | price | availability | order_status | complaint | greeting | other",
        },
        confidence_score: {
          bsonType: "double",
          description: "LLM confidence 0.0–1.0",
        },
        input_message: {
          bsonType: "string",
          description: "Original customer message text",
        },
        reply_sent: {
          bsonType: "string",
          description: "AI-generated reply text",
        },
        escalated_to_human: {
          bsonType: "bool",
          description: "Whether the message was escalated to seller",
        },
        products_mentioned: {
          bsonType: "array",
          description: "Product IDs mentioned in the conversation",
        },
        action_taken: {
          bsonType: "string",
          enum: ["replied", "escalated", "order_initiated"],
          description: "What action the agent took",
        },
        created_at: {
          bsonType: "date",
        },
      },
    },
  },
  validationLevel: "moderate",
  validationAction: "warn",
});

db.conversation_outputs.createIndex({ task_id: 1 }, { unique: true });
db.conversation_outputs.createIndex({ shop_id: 1, created_at: -1 });
db.conversation_outputs.createIndex({ customer_psid: 1, created_at: -1 });
db.conversation_outputs.createIndex({
  shop_id: 1,
  intent_detected: 1,
  created_at: -1,
});

// ──────────────────────────────────────────────────────────
// 2. ORDER OUTPUTS — Order processing logs
// ──────────────────────────────────────────────────────────

db.createCollection("order_outputs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["task_id", "order_id", "created_at"],
      properties: {
        task_id: {
          bsonType: "string",
          description:
            "UUID — correlates with PostgreSQL agent_tasks.task_id",
        },
        order_id: {
          bsonType: "string",
          description: "UUID of the order in PostgreSQL",
        },
        ocr_extracted_data: {
          bsonType: "object",
          description:
            "Extracted data from payment screenshot: sender_number, amount, trx_id, timestamp",
        },
        payment_verified: {
          bsonType: "bool",
          description:
            "Whether payment was verified via bKash/Nagad API",
        },
        verification_method: {
          bsonType: "string",
          enum: ["bkash_api", "nagad_api", "ocr_only", "manual"],
          description: "How payment was verified",
        },
        courier_response: {
          bsonType: "object",
          description: "Raw courier booking API response",
        },
        courier_used: {
          bsonType: "string",
          enum: ["pathao", "steadfast", "none"],
          description: "Which courier service was used",
        },
        tracking_number: {
          bsonType: ["string", "null"],
          description: "Courier tracking number",
        },
        created_at: {
          bsonType: "date",
        },
      },
    },
  },
  validationLevel: "moderate",
  validationAction: "warn",
});

db.order_outputs.createIndex({ task_id: 1 }, { unique: true });
db.order_outputs.createIndex({ order_id: 1 });
db.order_outputs.createIndex({ created_at: -1 });

// ──────────────────────────────────────────────────────────
// 3. CREATIVE OUTPUTS — AI-generated content
// ──────────────────────────────────────────────────────────

db.createCollection("creative_outputs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["task_id", "shop_id", "product_id", "created_at"],
      properties: {
        task_id: {
          bsonType: "string",
          description:
            "UUID — correlates with PostgreSQL agent_tasks.task_id",
        },
        shop_id: {
          bsonType: "string",
          description: "UUID of the shop",
        },
        product_id: {
          bsonType: "string",
          description: "UUID of the product",
        },
        image_s3_url: {
          bsonType: ["string", "null"],
          description: "S3 URL of the generated product image",
        },
        image_prompt_used: {
          bsonType: ["string", "null"],
          description: "The DALL-E / Stability AI prompt used",
        },
        caption_bn: {
          bsonType: ["string", "null"],
          description: "Generated Bangla caption",
        },
        caption_en: {
          bsonType: ["string", "null"],
          description: "Generated English caption",
        },
        hashtags: {
          bsonType: "array",
          description: "Generated hashtags for social media",
        },
        facebook_post_id: {
          bsonType: ["string", "null"],
          description:
            "Facebook post ID if auto-posted to page",
        },
        schedule_time: {
          bsonType: ["date", "null"],
          description: "Scheduled posting time if applicable",
        },
        created_at: {
          bsonType: "date",
        },
      },
    },
  },
  validationLevel: "moderate",
  validationAction: "warn",
});

db.creative_outputs.createIndex({ task_id: 1 }, { unique: true });
db.creative_outputs.createIndex({ shop_id: 1, created_at: -1 });
db.creative_outputs.createIndex({ shop_id: 1, product_id: 1 });

// ──────────────────────────────────────────────────────────
// 4. INTELLIGENCE REPORTS — Sales analysis
// ──────────────────────────────────────────────────────────

db.createCollection("intelligence_reports", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["task_id", "shop_id", "created_at"],
      properties: {
        task_id: {
          bsonType: "string",
          description:
            "UUID — correlates with PostgreSQL agent_tasks.task_id",
        },
        shop_id: {
          bsonType: "string",
          description: "UUID of the shop",
        },
        period_start: {
          bsonType: "date",
          description: "Analysis period start date",
        },
        period_end: {
          bsonType: "date",
          description: "Analysis period end date",
        },
        top_products: {
          bsonType: "array",
          description:
            "Array of top products: [{product_id, name, revenue, units_sold}]",
        },
        revenue_total: {
          bsonType: "double",
          description: "Total revenue in BDT for the period",
        },
        order_count: {
          bsonType: "int",
          description: "Total number of orders in the period",
        },
        peak_hours: {
          bsonType: "array",
          description:
            "Array of peak selling hours: [{hour, order_count}]",
        },
        day_of_week_patterns: {
          bsonType: "array",
          description:
            "Sales by day of week: [{day, order_count, revenue}]",
        },
        recommendations: {
          bsonType: "array",
          description:
            "AI-generated recommendations: [{type, product_id, reason, suggested_action}]",
        },
        best_posting_time: {
          bsonType: ["string", "null"],
          description: "Recommended best time to post on social media",
        },
        created_at: {
          bsonType: "date",
        },
      },
    },
  },
  validationLevel: "moderate",
  validationAction: "warn",
});

db.intelligence_reports.createIndex({ task_id: 1 }, { unique: true });
db.intelligence_reports.createIndex({ shop_id: 1, created_at: -1 });
db.intelligence_reports.createIndex({
  shop_id: 1,
  period_start: 1,
  period_end: 1,
});

print(
  "✅ MongoDB initialized: xeni_outputs database with 4 collections created"
);
print("   - conversation_outputs (AI conversation logs)");
print("   - order_outputs (order processing logs)");
print("   - creative_outputs (AI-generated content)");
print("   - intelligence_reports (sales analysis)");
