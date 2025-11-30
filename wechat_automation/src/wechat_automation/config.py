from dataclasses import dataclass
from datetime import time
from typing import Callable, Dict, List, Optional


@dataclass
class ScheduledJob:
    """Represents a scheduled action (send message or start a call)."""

    contact: str
    action: Callable[[], None]
    cron: Dict[str, str]
    description: str


@dataclass
class MessageTask:
    contact: str
    message: str
    at: Optional[time] = None


@dataclass
class CallTask:
    contact: str
    voice: bool = True
    at: Optional[time] = None


DEFAULT_SCHEDULE: List[Dict[str, str]] = [
    # Example: send a text at 09:00 every weekday
    {
        "type": "message",
        "contact": "测试联系人",
        "message": "早上好，今天的提醒：喝水、开会、写日报。",
        "cron": {"day_of_week": "mon-fri", "hour": "9", "minute": "0"},
    },
    # Example: start a voice call at 09:05 every weekday
    {
        "type": "voice_call",
        "contact": "测试联系人",
        "cron": {"day_of_week": "mon-fri", "hour": "9", "minute": "5"},
    },
]
