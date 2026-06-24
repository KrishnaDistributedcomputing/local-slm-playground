from __future__ import annotations
import logging
from temporalio import activity

logger = logging.getLogger(__name__)


@activity.defn
def compose_greeting(name: str) -> str:
    """Return a friendly greeting for the given name."""
    logger.info("compose_greeting for %s", name)
    return f"Hello, {name}!"
