"""XENI AI Workers — Prometheus metrics."""

from prometheus_client import Counter, Histogram, Gauge

# Task metrics
tasks_received = Counter(
    "tasks_received_total",
    "Total number of tasks received",
    ["agent_type"],
)

tasks_processed = Counter(
    "tasks_processed_total",
    "Total number of tasks processed (completed + failed)",
    ["agent_type", "status"],
)

tasks_completed = Counter(
    "tasks_completed_total",
    "Total number of tasks completed successfully",
    ["agent_type"],
)

tasks_failed = Counter(
    "tasks_failed_total",
    "Total number of tasks that failed",
    ["agent_type"],
)

task_duration = Histogram(
    "task_duration_seconds",
    "Duration of task processing in seconds",
    ["agent_type"],
    buckets=[0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0],
)

# Queue metrics
tasks_in_progress = Gauge(
    "tasks_in_progress",
    "Number of tasks currently being processed",
    ["agent_type"],
)

# Worker health
worker_up = Gauge(
    "worker_up",
    "Whether the worker is up and consuming",
    ["agent_type"],
)
