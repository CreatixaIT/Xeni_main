"""XENI AI Workers — FastAPI application + RabbitMQ consumer entrypoint."""

import threading
import logging

from fastapi import FastAPI
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from app.config import settings
from app.agents import AGENT_REGISTRY

logger = logging.getLogger("xeni.worker")

# Create FastAPI app
app = FastAPI(
    title=f"XENI Worker: {settings.AGENT_TYPE}",
    description=f"AI Worker for {settings.AGENT_TYPE} tasks",
    version="1.0.0",
)


@app.get("/health")
async def health():
    return {"status": "ok", "agent_type": settings.AGENT_TYPE, "queue": settings.TASK_QUEUE}


@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.on_event("startup")
async def startup():
    """Start the RabbitMQ consumer in a background thread."""
    agent_class = AGENT_REGISTRY.get(settings.AGENT_TYPE)
    if not agent_class:
        logger.error(f"Unknown agent type: {settings.AGENT_TYPE}")
        return

    worker = agent_class()
    consumer_thread = threading.Thread(target=worker.start_consuming, daemon=True)
    consumer_thread.start()
    logger.info(f"[{settings.AGENT_TYPE}] RabbitMQ consumer started in background thread")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
