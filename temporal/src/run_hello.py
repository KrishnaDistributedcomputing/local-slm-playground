"""Trigger the Hello World workflow.

Usage (inside the temporal-worker container or any env with deps installed):
    python -m src.run_hello            # greets "World"
    python -m src.run_hello Ada        # greets "Ada"
"""
from __future__ import annotations
import asyncio
import sys
import uuid

from temporalio.client import Client

from .config import settings
from .workflows.example.hello_world_workflow import HelloWorldWorkflow


async def main() -> None:
    name = sys.argv[1] if len(sys.argv) > 1 else "World"
    client = await Client.connect(
        settings.temporal_address, namespace=settings.temporal_namespace
    )

    workflow_id = f"hello-world-{name.lower()}-{uuid.uuid4().hex[:8]}"
    handle = await client.start_workflow(
        HelloWorldWorkflow.run,
        name,
        id=workflow_id,
        task_queue=settings.temporal_task_queue,
    )
    print(f"Started workflow: {workflow_id}")
    result = await handle.result()
    print(f"Workflow result: {result}")


if __name__ == "__main__":
    asyncio.run(main())
