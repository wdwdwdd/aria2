import argparse
import logging
import time as time_module
from pathlib import Path
from typing import Iterable, Tuple

import cv2
import numpy as np
import pyautogui
import uiautomation as auto
from apscheduler.schedulers.blocking import BlockingScheduler

from .config import DEFAULT_SCHEDULE

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
)

logger = logging.getLogger(__name__)

pyautogui.FAILSAFE = True
MATCH_THRESHOLD = 0.8
TYPING_INTERVAL = 0.02
ACTION_DELAY = 0.5


class WeChatAutomation:
    """Automation primitives for WeChat 4.0+ desktop client."""

    def __init__(self, screenshot_dir: Path) -> None:
        self.screenshot_dir = screenshot_dir

    def focus_wechat(self) -> None:
        logger.info("Activating WeChat window…")
        app = auto.WindowControl(searchDepth=1, ClassName="WeChatMainWndForPC")
        if not app.Exists(0.5):
            raise RuntimeError("WeChat window not found. Launch WeChat and log in first.")
        app.SetActive()
        app.Maximize()
        time_module.sleep(ACTION_DELAY)

    def _search_contact(self, contact: str) -> None:
        logger.info("Searching for contact: %s", contact)
        search_box = auto.EditControl(searchDepth=5, AutomationId="SearchEdit")
        if not search_box.Exists(1):
            raise RuntimeError("Search box not found. Is WeChat 4.x UI loaded?")
        search_box.Click()
        pyautogui.hotkey("ctrl", "f")
        pyautogui.typewrite(contact, interval=TYPING_INTERVAL)
        time_module.sleep(ACTION_DELAY)
        pyautogui.press("enter")
        time_module.sleep(ACTION_DELAY)

    def send_text(self, contact: str, message: str) -> None:
        self.focus_wechat()
        self._search_contact(contact)
        logger.info("Sending message to %s", contact)
        pyautogui.typewrite(message, interval=TYPING_INTERVAL)
        pyautogui.press("enter")
        time_module.sleep(ACTION_DELAY)

    def start_call(self, contact: str, voice: bool = True) -> None:
        self.focus_wechat()
        self._search_contact(contact)
        logger.info("Starting %s call with %s", "voice" if voice else "video", contact)
        self._click_button_template("call_button.png")
        if not voice:
            self._click_button_template("video_toggle.png")
        pyautogui.press("enter")
        time_module.sleep(ACTION_DELAY)

    def _click_button_template(self, filename: str) -> None:
        template_path = self.screenshot_dir / filename
        if not template_path.exists():
            raise FileNotFoundError(
                f"Template '{filename}' not found in {self.screenshot_dir}. Capture a screenshot first."
            )
        logger.debug("Matching template %s", template_path)
        match = self._locate_on_screen(template_path)
        if match is None:
            raise RuntimeError(f"Could not find template {filename} on screen. Adjust threshold or DPI.")
        x, y = match
        pyautogui.moveTo(x, y, duration=0.2)
        pyautogui.click()
        time_module.sleep(ACTION_DELAY)

    def _locate_on_screen(self, template_path: Path) -> Tuple[int, int] | None:
        screenshot = pyautogui.screenshot()
        screen_bgr = cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
        template = cv2.imread(str(template_path), cv2.IMREAD_GRAYSCALE)
        screen_gray = cv2.cvtColor(screen_bgr, cv2.COLOR_BGR2GRAY)
        result = cv2.matchTemplate(screen_gray, template, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
        logger.debug("Template match score: %.3f", max_val)
        if max_val < MATCH_THRESHOLD:
            return None
        h, w = template.shape
        return max_loc[0] + w // 2, max_loc[1] + h // 2


def build_scheduler(jobs: Iterable[dict], automation: WeChatAutomation) -> BlockingScheduler:
    scheduler = BlockingScheduler(timezone="Asia/Shanghai")
    for job_cfg in jobs:
        job_type = job_cfg.get("type")
        contact = job_cfg.get("contact")
        cron_kwargs = job_cfg.get("cron", {})
        if job_type == "message":
            message = job_cfg.get("message", "")
            scheduler.add_job(
                lambda c=contact, m=message: automation.send_text(c, m),
                trigger="cron",
                **cron_kwargs,
                name=f"message-{contact}",
            )
            logger.info("Scheduled message to %s with cron %s", contact, cron_kwargs)
        elif job_type in {"voice_call", "video_call"}:
            scheduler.add_job(
                lambda c=contact, v=job_type == "voice_call": automation.start_call(c, voice=v),
                trigger="cron",
                **cron_kwargs,
                name=f"call-{contact}",
            )
            logger.info("Scheduled %s to %s with cron %s", job_type, contact, cron_kwargs)
        else:
            logger.warning("Unknown job type: %s", job_type)
    return scheduler


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="WeChat automation for messaging and calling.")
    parser.add_argument("--contact", help="Contact or group name to target")
    parser.add_argument("--message", help="Message text to send")
    parser.add_argument("--voice", action="store_true", help="Place a voice call instead of video")
    parser.add_argument("--video", action="store_true", help="Place a video call (default is voice)")
    parser.add_argument("--use-scheduler", action="store_true", help="Run the APScheduler jobs defined in config.py")
    parser.add_argument(
        "--assets",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "assets",
        help="Directory containing UI templates like call_button.png",
    )
    parser.add_argument("--match-threshold", type=float, default=MATCH_THRESHOLD, help="Template match threshold")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    global MATCH_THRESHOLD
    MATCH_THRESHOLD = args.match_threshold

    automation = WeChatAutomation(args.assets)

    if args.use_scheduler:
        scheduler = build_scheduler(DEFAULT_SCHEDULE, automation)
        logger.info("Starting scheduler with %d job(s)…", len(DEFAULT_SCHEDULE))
        scheduler.start()
        return

    if args.contact and args.message:
        automation.send_text(args.contact, args.message)
    elif args.contact and (args.voice or args.video):
        automation.start_call(args.contact, voice=not args.video)
    else:
        raise SystemExit("Provide --contact with --message, --voice, or --video, or use --use-scheduler")


if __name__ == "__main__":
    main()
