"""Capture the real app with disposable demo data; never use a personal browser profile."""
import functools
import json
import os
from pathlib import Path
import shutil
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "images"
DEMO_TIME = datetime(2026, 10, 24, 16, 0, tzinfo=timezone.utc)


def task(task_id, text, priority="Medium", due="", done=False):
    return {"id": task_id, "text": text, "priority": priority, "due": due, "done": done}


def demo_state():
    return {
        "schemaVersion": 1,
        "settings": {"theme": "light", "sort": "asc"},
        "lists": [
            {"id": "meal-prep", "name": "Meal prepping", "due": "2026-10-27",
             "appearance": {"color": "moss", "texture": "linen"}, "tasks": [
                 task("recipes", "Choose recipes for the week", done=True),
                 task("groceries", "Pick up fresh ingredients", "High", "2026-10-25"),
                 task("lunches", "Prepare lunches for Monday", "Low", "2026-10-26"),
             ]},
            {"id": "personal", "name": "Personal", "due": "",
             "appearance": {"color": "white", "texture": "plain"}, "tasks": [
                 task("plants", "Water the plants", "Low", done=True),
                 task("walk", "Take a walk and get some fresh air", "Low"),
                 task("book", "Read a chapter before bed", "Medium"),
                 task("dentist", "Book a dentist appointment", "High", "2026-10-28"),
             ]},
            {"id": "work", "name": "Work", "due": "2026-10-25",
             "appearance": {"color": "teal", "texture": "grid"}, "tasks": [
                 task("proposal", "Send the project proposal", "High", "2026-10-24"),
                 task("feedback", "Review the design feedback", "Medium", done=True),
                 task("plan", "Plan next week's priorities", "Low", done=True),
             ]},
        ],
    }


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}"
    errors = []
    try:
        with sync_playwright() as playwright:
            executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
            browser = playwright.chromium.launch(executable_path=executable, headless=True, args=["--no-sandbox"])
            context = browser.new_context(viewport={"width": 1440, "height": 1080},
                                          device_scale_factor=1, timezone_id="America/New_York")
            # Exercise the real built-in fallback; no fake API quotes or authors appear in docs.
            context.route("https://api.quotable.io/**", lambda route: route.fulfill(status=503, body="Offline demo"))
            context.add_init_script("Math.random = () => 0")
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.clock.install(time=DEMO_TIME)
            page.goto(url)
            expect(page.locator("#navigation button")).to_have_count(1)
            page.evaluate("state=>localStorage.setItem('todo-list:state:v1',JSON.stringify(state))", demo_state())
            page.reload()
            expect(page.locator(".list-card")).to_have_count(3)
            page.mouse.move(0, 0)
            page.screenshot(path=str(OUTPUT / "overview-light.png"), full_page=True)

            page.locator('#navigation [data-list-id="work"]').click()
            page.locator("#theme").click()
            expect(page.locator("body")).to_have_class("dark")
            page.mouse.move(0, 0)
            page.screenshot(path=str(OUTPUT / "work-dark.png"))

            page.locator("#theme").click()
            page.locator('#navigation [data-list-id="personal"]').click()
            page.locator('.task[data-task-id="dentist"] [data-action="edit"]').click()
            page.locator("#task-date-picker .date-toggle").click()
            page.mouse.move(0, 0)
            page.locator("#task-dialog").screenshot(path=str(OUTPUT / "task-editor.png"))
            page.locator("#task-dialog").get_by_role("button", name="Cancel").click()

            # A taller viewport shows the complete palette and texture picker without clipping.
            page.set_viewport_size({"width": 1440, "height": 1600})
            page.locator('#navigation [data-list-id="meal-prep"]').click()
            page.locator(".list-card summary").click()
            page.get_by_role("button", name="Edit list", exact=True).click()
            page.locator('[data-color="terracotta"]').click()
            page.locator('[data-texture="chevron"]').click()
            page.locator("#list-dialog .modal-body").evaluate("el=>el.scrollTop=0")
            page.mouse.move(0, 0)
            page.locator("#list-dialog").screenshot(path=str(OUTPUT / "list-themes.png"))
            page.locator("#list-dialog").get_by_role("button", name="Cancel").click()

            page.set_viewport_size({"width": 390, "height": 844})
            page.locator('#navigation [data-list-id="work"]').click()
            page.locator("#main").scroll_into_view_if_needed()
            # Frame the actual mobile workspace; sidebar remains available above it.
            page.evaluate("window.scrollTo(0,document.querySelector('#main').offsetTop)")
            page.mouse.move(0, 0)
            page.locator("#main").screenshot(path=str(OUTPUT / "mobile-work.png"))
            context.close()
            browser.close()
        if errors:
            raise RuntimeError("Application errors during screenshots: " + "; ".join(errors))
        for path in sorted(OUTPUT.glob("*.png")):
            print(f"Captured {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)")
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    main()
