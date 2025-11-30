# WeChat Automation (WeChat 4.0+)

This starter project demonstrates how to drive the WeChat 4.x desktop client using desktop automation tools instead of `wxauto`.
It uses:

- [`pyautogui`](https://pyautogui.readthedocs.io/) for mouse and keyboard actions.
- [`opencv-python`](https://pypi.org/project/opencv-python/) for template matching (locating buttons such as **Call**).
- [`uiautomation`](https://pypi.org/project/uiautomation/) to locate WeChat windows and UI elements in a stable way.
- [`APScheduler`](https://apscheduler.readthedocs.io/) to schedule recurring messages or calls.

## Project layout

```
wechat_automation/
├── README.md
├── requirements.txt
└── src/
    └── wechat_automation/
        ├── app.py
        └── config.py
```

## Quick start

1. Install Python 3.10+ and the dependencies:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Capture UI reference images for template matching:
   - Take screenshots of the **Call** button and any other buttons you want to target, and place them in `assets/` (you can create the folder next to `src/`).
   - Update the paths in `app.py` if you place them elsewhere.

3. Run a one-off message:

   ```bash
   python -m wechat_automation.app --contact "测试联系人" --message "早上好，今天的日报：..."
   ```

4. Schedule a recurring job (example schedules a daily 9:00 AM text and a 9:05 AM voice call):

   ```bash
   python -m wechat_automation.app --use-scheduler
   ```

   Edit the `DEFAULT_SCHEDULE` in `config.py` to match your own contacts and times.

## Notes and tips

- The sample code brings WeChat to the foreground using `uiautomation` and then uses `pyautogui` to drive the UI.
- Template matching uses grayscale normalized cross-correlation with a configurable threshold. Adjust `MATCH_THRESHOLD` in `app.py` based on your screenshots and display scaling.
- WeChat 4.x has slightly different layouts between languages. If matching fails, refresh your templates and verify DPI scaling is 100%.
- For safety, the script includes short delays between actions. Adjust them if your machine is slower/faster.
- When running headless or over remote desktop, automation libraries may fail; use a local desktop session when capturing templates and running automation.

## Limitations

This starter is not a complete production bot. To harden it:
- Add retries around calls to `pyautogui` and template matching.
- Extend `uiautomation` selectors for more deterministic navigation instead of relying solely on template matching.
- Add logging, metrics, and crash recovery.
