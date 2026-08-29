# XENI — Python AI Worker Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Expose port (overridden per worker via env)
EXPOSE 8001

# Run with uvicorn — use shell form so $PORT is expanded
CMD python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}
