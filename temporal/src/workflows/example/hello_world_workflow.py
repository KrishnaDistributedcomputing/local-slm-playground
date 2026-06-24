from __future__ import annotations
import datetime
from temporalio import workflow

# Activities must be imported through the sandbox-safe passthrough.
with workflow.unsafe.imports_passed_through():
    from ...activities.greeting import compose_greeting


@workflow.defn
class HelloWorldWorkflow:
    @workflow.run
    async def run(self, name: str = "World") -> str:
        return await workflow.execute_activity(
            compose_greeting,
            name,
            start_to_close_timeout=datetime.timedelta(seconds=10),
        )
