"""XENI AI Workers — Base Worker with RabbitMQ consumer, MongoDB, and notification utilities."""

import json
import logging
import time
import traceback
from datetime import datetime, timezone
from typing import Any

import pika
from pymongo import MongoClient
from pymongo.collection import Collection

from app.config import settings

logger = logging.getLogger("xeni.worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")

# Map agent types to their MongoDB collection names
AGENT_COLLECTION_MAP = {
    "conversation": "conversation_outputs",
    "order": "order_outputs",
    "inventory": "order_outputs",  # inventory shares order collection
    "creative": "creative_outputs",
    "intelligence": "intelligence_outputs",
}


class BaseWorker:
    """Base class for all XENI AI workers. Handles RabbitMQ consumption, MongoDB writes, and result publishing."""

    def __init__(self):
        self.agent_type = settings.AGENT_TYPE
        self.task_queue = settings.TASK_QUEUE
        self.result_queue = settings.RESULT_QUEUE
        self.dlq_name = settings.DLQ_NAME
        self.max_retries = settings.MAX_RETRIES

        # MongoDB
        self.mongo_client = MongoClient(settings.MONGO_URI)
        self.mongo_db = self.mongo_client["xeni_outputs"]
        collection_name = AGENT_COLLECTION_MAP.get(self.agent_type, "conversation_outputs")
        self.results_collection: Collection = self.mongo_db[collection_name]

        # RabbitMQ
        self.connection: pika.BlockingConnection | None = None
        self.channel: pika.channel.Channel | None = None

    def connect_rabbitmq(self):
        """Establish RabbitMQ connection."""
        params = pika.URLParameters(settings.RABBITMQ_URI)
        params.heartbeat = 600
        params.blocked_connection_timeout = 300
        self.connection = pika.BlockingConnection(params)
        self.channel = self.connection.channel()
        self.channel.basic_qos(prefetch_count=1)
        logger.info(f"Connected to RabbitMQ, consuming from {self.task_queue}")

    def process_task(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Override in subclass — run the agent's LangChain/CrewAI logic."""
        raise NotImplementedError("Subclasses must implement process_task()")

    def _handle_message(self, ch, method, properties, body):
        """Handle incoming RabbitMQ message."""
        start_time = time.time()
        task_data = json.loads(body)
        task_id = task_data.get("task_id", "unknown")
        user_id = task_data.get("user_id", "unknown")
        retry_count = task_data.get("retry_count", 0)

        logger.info(f"Processing task {task_id} for user {user_id} (retry: {retry_count})")

        try:
            result = self.process_task(task_data.get("payload", {}))
            duration_ms = int((time.time() - start_time) * 1000)

            # Save to MongoDB
            mongo_doc = {
                "task_id": task_id,
                "user_id": user_id,
                "agent_type": self.agent_type,
                "status": "completed",
                "input": task_data.get("payload", {}),
                "result": result,
                "s3_report_url": None,
                "created_at": datetime.now(timezone.utc),
                "completed_at": datetime.now(timezone.utc),
            }
            inserted = self.results_collection.insert_one(mongo_doc)
            mongo_doc_id = str(inserted.inserted_id)

            # Publish result to Go gateway
            result_msg = {
                "task_id": task_id,
                "user_id": user_id,
                "agent_type": self.agent_type,
                "status": "completed",
                "mongo_doc_id": mongo_doc_id,
                "summary": result.get("summary", "Task completed successfully."),
                "error": None,
                "duration_ms": duration_ms,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "data": result,
            }
            self._publish_result(result_msg)
            ch.basic_ack(delivery_tag=method.delivery_tag)
            logger.info(f"Task {task_id} completed in {duration_ms}ms")

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            logger.error(f"Task {task_id} failed: {error_msg}\n{traceback.format_exc()}")

            if retry_count < self.max_retries:
                # Re-queue with incremented retry count
                task_data["retry_count"] = retry_count + 1
                self.channel.basic_publish(
                    exchange="xeni.tasks",
                    routing_key=self.agent_type,
                    body=json.dumps(task_data),
                    properties=pika.BasicProperties(delivery_mode=2),
                )
                ch.basic_ack(delivery_tag=method.delivery_tag)
                logger.info(f"Task {task_id} re-queued (retry {retry_count + 1}/{self.max_retries})")
            else:
                # Move to DLQ — publish failure result
                result_msg = {
                    "task_id": task_id,
                    "user_id": user_id,
                    "agent_type": self.agent_type,
                    "status": "failed",
                    "mongo_doc_id": "",
                    "summary": "Task failed after maximum retries.",
                    "error": error_msg,
                    "duration_ms": duration_ms,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
                self._publish_result(result_msg)
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                logger.error(f"Task {task_id} moved to DLQ after {self.max_retries} retries")

    def _publish_result(self, result: dict):
        """Publish result message back to Go gateway via xeni.results exchange."""
        if self.channel:
            self.channel.basic_publish(
                exchange="xeni.results",
                routing_key="task_result",
                body=json.dumps(result),
                properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
            )

    def start_consuming(self):
        """Start the RabbitMQ consumer loop."""
        self.connect_rabbitmq()
        self.channel.basic_consume(queue=self.task_queue, on_message_callback=self._handle_message)
        logger.info(f"[{self.agent_type}] Worker started, waiting for tasks...")
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            self.channel.stop_consuming()
        finally:
            if self.connection:
                self.connection.close()
