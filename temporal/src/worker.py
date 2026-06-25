from __future__ import annotations
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from temporalio.client import Client
from temporalio.worker import Worker

from .config import settings
from .activities import (
    supabase_core,
    notifications,
    greeting,
    chess_store,
    crm_store,
    ticket_store,
    recruit_store,
)
from .workflows.example.approval_workflow import ApprovalWorkflow
from .workflows.example.hello_world_workflow import HelloWorldWorkflow
from .workflows.example.chess_workflow import ChessGameWorkflow
from .workflows.example.crm_workflow import CrmLeadWorkflow
from .workflows.example.ticket_workflow import SupportTicketWorkflow
from .workflows.example.recruit_workflow import RecruitCandidateWorkflow

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main() -> None:
    logger.info("Connecting to Temporal", extra={"address": settings.temporal_address, "namespace": settings.temporal_namespace})
    client = await Client.connect(settings.temporal_address, namespace=settings.temporal_namespace)

    activity_executor = ThreadPoolExecutor(max_workers=20)
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[
            ApprovalWorkflow,
            HelloWorldWorkflow,
            ChessGameWorkflow,
            CrmLeadWorkflow,
            SupportTicketWorkflow,
            RecruitCandidateWorkflow,
        ],
        activities=[
            supabase_core.create_entity,
            supabase_core.update_entity_scd2,
            supabase_core.get_entity,
            supabase_core.append_event,
            supabase_core.create_relationship,
            notifications.send_email,
            notifications.send_notification,
            greeting.compose_greeting,
            chess_store.record_chess_game,
            chess_store.get_recent_games,
            crm_store.upsert_contact,
            crm_store.record_activity,
            crm_store.list_contacts,
            crm_store.get_activities,
            ticket_store.upsert_ticket,
            ticket_store.record_ticket_event,
            ticket_store.list_tickets,
            ticket_store.get_ticket_events,
            recruit_store.upsert_candidate,
            recruit_store.record_candidate_event,
            recruit_store.list_candidates,
            recruit_store.get_candidate_events,
        ],
        activity_executor=activity_executor,
    )

    logger.info("Worker started", extra={"task_queue": settings.temporal_task_queue})
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
