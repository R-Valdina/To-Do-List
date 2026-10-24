"""End-to-end checks against the actual static app in isolated browser contexts."""
import functools
import json
import os
from pathlib import Path
import shutil
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
STORAGE_KEY = "todo-list:state:v1"
QUOTE_API_PREFIX = "https://api.quotable.io/quotes/random?"
QUOTE_FIXTURE = [
    {"content": "A small step still counts.", "author": "Example author"},
    {"content": "Even your to-do list deserves a snack break.", "author": "Another author"},
    {"content": "Progress, with a side of coffee.", "author": "Third author"},
]


def task(task_id, text, done=False, due="", priority="Medium"):
    return {"id": task_id, "text": text, "done": done, "due": due, "priority": priority}


def list_data(list_id, name, tasks=None, color="white", texture="plain", due=""):
    return {"id": list_id, "name": name, "due": due,
            "appearance": {"color": color, "texture": texture}, "tasks": tasks or []}


def state(lists):
    return {"schemaVersion": 1, "lists": lists, "settings": {"theme": "light", "sort": "asc"}}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class AppBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(QuietHandler, directory=str(ROOT))
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"
        cls.playwright = sync_playwright().start()
        executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
        cls.browser = cls.playwright.chromium.launch(
            executable_path=executable, headless=True, args=["--no-sandbox"])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 900},
                                                timezone_id="America/New_York")
        self.page = self.context.new_page()
        self.page.clock.install()
        self.page.route("https://api.quotable.io/**", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(QUOTE_FIXTURE)))
        self.page.set_default_timeout(5000)
        self.errors = []
        self.requests = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("request", lambda request: self.requests.append(request.url))
        self.page.goto(self.url)
        expect(self.page.locator("#new-list")).to_be_visible()
        self.page.wait_for_function("document.querySelector('#navigation button') !== null")

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [], "JavaScript runtime errors")
            self.assertTrue(all(url.startswith(self.url) or url.startswith(QUOTE_API_PREFIX)
                                for url in self.requests),
                            "Only the optional public quote API may be requested externally")
        finally:
            self.context.close()

    def seed(self, lists):
        self.page.evaluate("([key,value]) => localStorage.setItem(key, JSON.stringify(value))",
                           [STORAGE_KEY, state(lists)])
        self.page.reload()
        self.page.wait_for_function("document.querySelector('#navigation button') !== null")

    def saved(self):
        return self.page.evaluate("key => JSON.parse(localStorage.getItem(key))", STORAGE_KEY)

    def titles(self):
        return self.page.locator("#lists .task-title").all_text_contents()

    def create_list(self, name):
        self.page.locator("#new-list").click()
        self.page.locator("#list-name").fill(name)
        self.page.locator("#list-form button[type=submit]").click()
        expect(self.page.locator("#list-dialog")).not_to_be_visible()

    def add_task(self, text):
        self.page.locator("#top-add-task").click()
        self.page.locator("#task-text").fill(text)
        self.page.locator("#task-form button[type=submit]").click()
        expect(self.page.locator("#task-dialog")).not_to_be_visible()

    def test_list_and_task_lifecycle_persists_safe_text(self):
        self.create_list("Personal")
        self.page.locator("#top-add-task").click()
        literal = 'say "hello" <img src=x onerror=alert(1)>'
        self.page.locator("#task-text").fill(literal)
        self.page.locator('[data-priority="High"]').click()
        self.page.locator("#task-date-picker .date-toggle").click()
        self.page.locator("#task-date-picker .calendar-actions").get_by_text("Today", exact=True).click()
        self.page.locator("#task-form button[type=submit]").click()
        expect(self.page.locator(".task-title")).to_have_text(literal)
        self.assertEqual(self.page.locator("#lists img").count(), 0)
        expect(self.page.locator(".priority-high").first).to_be_visible()
        self.page.locator('.task [data-action="edit"]').click()
        self.page.locator("#task-text").fill("Edited task")
        self.page.locator('[data-priority="Low"]').click()
        self.page.locator("#task-text").press("Enter")
        self.page.locator(".check").check()
        expect(self.page.locator(".list-count")).to_have_text("1 of 1 done")
        expect(self.page.locator(".task .badge.complete")).to_be_visible()
        self.page.reload()
        expect(self.page.locator(".task-title")).to_have_text("Edited task")
        expect(self.page.locator(".check")).to_be_checked()
        self.page.locator(".task .danger").click()
        expect(self.page.locator(".task")).to_have_count(0)
        self.page.locator("#undo").click()
        expect(self.page.locator(".task-title")).to_have_text("Edited task")
        self.assertEqual(self.saved()["lists"][0]["tasks"][0]["priority"], "Low")

    def test_edit_list_updates_name_deadline_color_texture_and_cancel_is_safe(self):
        self.seed([list_data("list-a", "Work", [task("task-a", "Proposal")])])
        self.page.locator(".list-card summary").click()
        self.page.get_by_role("button", name="Edit list", exact=True).click()
        self.page.locator("#list-name").fill("Studio")
        self.page.locator('[data-color="teal"]').click()
        self.page.locator('[data-texture="grid"]').click()
        self.page.locator("#list-date-picker .date-toggle").click()
        self.page.locator("#list-date-picker .calendar-actions").get_by_text("Today", exact=True).click()
        self.page.locator("#list-form button[type=submit]").click()
        expect(self.page.locator(".list-card h2")).to_have_text("Studio")
        expect(self.page.locator(".list-deadline .urgent")).to_be_visible()
        saved = self.saved()["lists"][0]
        self.assertEqual(saved["appearance"], {"color": "teal", "texture": "grid"})
        self.assertTrue(saved["due"])
        self.page.locator(".list-card summary").click()
        self.page.get_by_role("button", name="Edit list", exact=True).click()
        self.page.locator("#list-name").fill("Unsaved")
        self.page.locator("#list-dialog").get_by_role("button", name="Cancel").click()
        self.page.reload()
        expect(self.page.locator(".list-card h2")).to_have_text("Studio")

    def test_search_scope_sorting_and_category_progress(self):
        self.seed([list_data("z", "Zulu", [task("tz", "Common", True)]),
                   list_data("a", "Alpha", [task("ta", "Common"), task("tb", "Other")])])
        self.assertEqual(self.page.locator(".nav-name").all_text_contents(), ["All lists", "Alpha", "Zulu"])
        self.page.locator("#sort-lists").click()
        self.assertEqual(self.page.locator(".nav-name").all_text_contents(), ["All lists", "Zulu", "Alpha"])
        self.page.locator('#navigation [data-list-id="a"]').click()
        expect(self.page.locator("#search")).to_have_attribute("placeholder", "Search tasks in Alpha…")
        self.page.locator("#search").fill("Common")
        self.assertEqual(self.titles(), ["Common"])
        expect(self.page.locator(".list-count")).to_have_text("0 of 2 done")
        expect(self.page.locator(".drag-handle")).to_be_disabled()
        self.page.get_by_role("button", name="All lists 2", exact=True).click()
        self.page.locator("#search").fill("Common")
        self.assertEqual(self.titles(), ["Common", "Common"])
        expect(self.page.locator("#top-add-task")).not_to_be_visible()
        self.page.reload()
        self.assertEqual(self.saved()["settings"]["sort"], "desc")

    def test_white_lists_and_preview_remain_neutral_in_dark_mode(self):
        self.seed([list_data("white", "White list", [task("tw", "Neutral")]),
                   list_data("teal", "Teal list", color="teal", texture="grid")])
        self.page.locator("#theme").click()
        card = self.page.locator('.list-card[data-list-id="white"]')
        styles = card.evaluate("el => ({bg:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderTopColor,ink:getComputedStyle(el.querySelector('h2')).color,progress:getComputedStyle(el).getPropertyValue('--list-progress').trim()})")
        self.assertEqual(styles, {"bg": "rgb(255, 255, 255)", "border": "rgb(255, 255, 255)",
                                  "ink": "rgb(52, 52, 52)", "progress": "#A6A6A6"})
        tile = self.page.locator('#navigation [data-list-id="teal"]')
        self.assertNotEqual(tile.evaluate("el => getComputedStyle(el).backgroundImage"), "none")
        card.locator("summary").click()
        self.page.get_by_role("button", name="Edit list", exact=True).click()
        self.assertEqual(self.page.locator("#list-preview").evaluate("el=>getComputedStyle(el).borderTopColor"), "rgb(255, 255, 255)")
        self.page.locator('[data-color="teal"]').click()
        self.assertNotEqual(self.page.locator("#list-preview").evaluate("el=>getComputedStyle(el).backgroundColor"), "rgb(255, 255, 255)")
        self.page.locator("#list-form button[type=submit]").click()
        self.page.reload()
        expect(self.page.locator("body")).to_have_class("dark")

    def test_mouse_drag_keyboard_reordering_and_escape_cancel(self):
        self.seed([list_data("a", "Personal", [task("a1", "First"), task("a2", "Second"), task("a3", "Third")])])
        source = self.page.locator('.task[data-task-id="a1"] .drag-handle').bounding_box()
        destination = self.page.locator('.task[data-task-id="a3"]').bounding_box()
        self.page.mouse.move(source["x"] + 15, source["y"] + 15)
        self.page.mouse.down()
        self.page.mouse.move(source["x"] + 15, destination["y"] + destination["height"] - 3, steps=15)
        self.page.mouse.up()
        self.assertEqual(self.titles(), ["Second", "Third", "First"])
        self.page.reload()
        self.assertEqual(self.titles(), ["Second", "Third", "First"])
        handle = self.page.locator('.task[data-task-id="a1"] .drag-handle')
        handle.focus()
        handle.press("ArrowUp")
        self.assertEqual(self.titles(), ["Second", "First", "Third"])
        source = handle.bounding_box()
        first = self.page.locator(".task").first.bounding_box()
        self.page.mouse.move(source["x"] + 15, source["y"] + 15)
        self.page.mouse.down()
        self.page.mouse.move(source["x"] + 15, first["y"] + 3, steps=10)
        self.page.keyboard.press("Escape")
        self.page.mouse.up()
        self.assertEqual(self.titles(), ["Second", "First", "Third"])
        self.assertEqual(self.page.locator(".drag-ghost").count(), 0)

    def test_touch_drag_reorders_tasks(self):
        self.seed([list_data("a", "Touch", [task("t1", "First"), task("t2", "Second"), task("t3", "Third")])])
        session = self.context.new_cdp_session(self.page)
        session.send("Emulation.setTouchEmulationEnabled", {"enabled": True})
        source = self.page.locator(".drag-handle").first.bounding_box()
        target = self.page.locator(".task").last.bounding_box()
        x, y = source["x"] + 15, source["y"] + 15
        end_y = target["y"] + target["height"] - 3
        session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        for step in range(1, 13):
            session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y + (end_y-y)*step/12}]})
            self.page.wait_for_timeout(20)
        session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        self.assertEqual(self.titles(), ["Second", "Third", "First"])
        self.assertEqual([item["text"] for item in self.saved()["lists"][0]["tasks"]], self.titles())

    def test_deadline_warning_shapes_and_completed_suppression(self):
        dates = self.page.evaluate("[0,1,2,-1].map(offset => {const d=new Date(); d.setDate(d.getDate()+offset); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')})")
        self.seed([list_data("soon", "Soon", [task("s", "Soon task")], due=dates[2]),
                   list_data("urgent", "Urgent", [task("u", "Today", due=dates[0])], due=dates[1]),
                   list_data("late", "Late", [task("l", "Late task", due=dates[3])], due=dates[3])])
        expect(self.page.locator('.list-card[data-list-id="soon"] .list-deadline .warning')).to_be_visible()
        expect(self.page.locator('.list-card[data-list-id="urgent"] .list-deadline .urgent')).to_be_visible()
        late = self.page.locator('.list-card[data-list-id="late"]')
        expect(late).to_have_class("list-card is-overdue white-list")
        late.locator(".check").check()
        expect(late).not_to_have_class("list-card is-overdue white-list")
        expect(late.locator(".list-deadline .complete")).to_be_visible()
        self.assertEqual(late.locator(".task.is-overdue").count(), 0)

    def test_responsive_modals_calendar_and_validation(self):
        self.page.set_viewport_size({"width": 375, "height": 667})
        self.create_list("Mobile")
        self.page.locator("#top-add-task").click()
        self.page.locator("#task-text").fill("   ")
        self.page.locator("#task-form button[type=submit]").click()
        expect(self.page.locator("#task-form-error")).to_be_visible()
        self.page.locator("#task-text").fill("Mobile task")
        self.page.locator('[data-priority="High"]').click()
        self.page.locator("#task-date-picker .date-toggle").click()
        self.page.locator("#task-date-picker .calendar-heading").get_by_role("button", name="Next month").click()
        self.page.locator("#task-date-picker .calendar-days button").first.click()
        self.page.locator("#task-form button[type=submit]").click()
        expect(self.page.locator(".task-title")).to_have_text("Mobile task")
        self.assertLessEqual(self.page.evaluate("document.documentElement.scrollWidth"), 375)
        self.page.locator(".list-card summary").click()
        self.page.get_by_role("button", name="Edit list", exact=True).click()
        self.page.locator('[data-texture="stripes"]').click()
        self.page.locator("#list-form button[type=submit]").click()
        expect(self.page.locator("#list-dialog")).not_to_be_visible()

    def test_backup_export_import_confirmation_cancel_and_invalid_file(self):
        self.seed([list_data("a", "Backup", [task("t", "Keep me")])])
        with self.page.expect_download() as info:
            self.page.locator("#export").click()
        backup = Path(info.value.path()).read_text()
        self.assertEqual(json.loads(backup)["lists"][0]["name"], "Backup")
        self.page.locator("#import-file").set_input_files({"name": "bad.json", "mimeType": "application/json", "buffer": b"{broken"})
        expect(self.page.locator("#status")).to_contain_text("Import cancelled")
        self.assertEqual(self.titles(), ["Keep me"])
        replacement = state([list_data("b", "Restored", [task("r", "Restored task")])])
        payload = {"name": "backup.json", "mimeType": "application/json", "buffer": json.dumps(replacement).encode()}
        self.page.locator("#import-file").set_input_files(payload)
        expect(self.page.locator("#import-dialog")).to_be_visible()
        self.page.locator("#import-dialog").get_by_role("button", name="Cancel").click()
        self.assertEqual(self.titles(), ["Keep me"])
        self.page.locator("#import-file").set_input_files(payload)
        self.page.locator("#import-dialog").get_by_role("button", name="Replace lists").click()
        self.page.reload()
        expect(self.page.locator(".task-title")).to_have_text("Restored task")

    def test_corrupt_data_is_not_overwritten_and_can_be_recovered(self):
        self.page.evaluate("key => localStorage.setItem(key, '{broken')", STORAGE_KEY)
        self.page.reload()
        expect(self.page.locator("#storage-error")).to_contain_text("not been overwritten")
        self.create_list("Temporary")
        self.assertEqual(self.page.evaluate("key=>localStorage.getItem(key)", STORAGE_KEY), "{broken")
        with self.page.expect_download() as info:
            self.page.locator("#export").click()
        self.assertEqual(Path(info.value.path()).read_text(), "{broken")
        self.page.locator("#import-file").set_input_files({"name": "fixed.json", "mimeType": "application/json",
            "buffer": json.dumps(state([list_data("fixed", "Recovered")])).encode()})
        self.page.locator("#import-dialog").get_by_role("button", name="Replace lists").click()
        expect(self.page.locator("#storage-error")).not_to_be_visible()
        self.assertEqual(self.saved()["lists"][0]["name"], "Recovered")

    def test_original_app_data_migrates_without_deleting_source(self):
        original = [{"content": 'Original "task"', "category": "personal", "done": True}]
        self.page.evaluate("value=>localStorage.setItem('todos',JSON.stringify(value))", original)
        self.page.reload()
        expect(self.page.locator(".task-title")).to_have_text('Original "task"')
        expect(self.page.locator(".check")).to_be_checked()
        self.assertEqual(self.saved()["lists"][0]["name"], "Personal")
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('todos'))"), original)

    def test_help_replaces_footer_and_restores_focus_on_close(self):
        self.assertEqual(self.page.locator("main footer").count(), 0)
        self.assertEqual(self.page.locator("#search-scope").count(), 0)
        expect(self.page.locator("#lists .empty")).to_have_text("Create your first list to get started.")
        self.page.locator("#help").click()
        dialog = self.page.get_by_role("dialog", name="Help", exact=True)
        expect(dialog).to_be_visible()
        expect(dialog.get_by_role("heading", name="Reorder tasks")).to_be_visible()
        expect(dialog.get_by_role("heading", name="Keep a backup")).to_be_visible()
        dialog.get_by_role("button", name="Close", exact=True).click()
        expect(dialog).not_to_be_visible()
        expect(self.page.locator("#help")).to_be_focused()
        self.page.set_viewport_size({"width": 375, "height": 667})
        self.page.locator("#help").click()
        dialog.get_by_role("button", name="Close", exact=True).click()
        expect(self.page.locator("#help")).to_be_focused()
        self.page.locator("#help").click()
        self.page.keyboard.press("Escape")
        expect(dialog).not_to_be_visible()
        expect(self.page.locator("#help")).to_be_focused()

    def test_mockup_data_migrates_with_white_theme_and_settings(self):
        mockup = [list_data("mock", "Mockup", [task("m", "Preserved")], color="creamy")]
        self.page.evaluate("value=>{localStorage.setItem('todo-lists-mockup-v3',JSON.stringify(value));localStorage.setItem('todo-lists-theme','dark')}", mockup)
        self.page.reload()
        expect(self.page.locator(".task-title")).to_have_text("Preserved")
        expect(self.page.locator("body")).to_have_class("dark")
        self.assertEqual(self.saved()["lists"][0]["appearance"]["color"], "white")

    def test_quotes_rotate_pause_resume_and_cache_without_changing_task_data(self):
        card = self.page.locator("#quote-card")
        expect(card.locator("[data-quote-credit]")).to_be_visible()
        first = card.locator("[data-quote-text]").inner_text()
        calls = len([url for url in self.requests if url.startswith(QUOTE_API_PREFIX)])
        self.page.clock.fast_forward(300001)
        expect(card.locator("[data-quote-text]")).not_to_have_text(first)
        card.locator("[data-quote-pause]").click()
        paused = card.locator("[data-quote-text]").inner_text()
        self.page.locator("#search").focus()
        self.page.clock.fast_forward(600001)
        expect(card.locator("[data-quote-text]")).to_have_text(paused)
        card.locator("[data-quote-next]").click()
        expect(card.locator("[data-quote-text]")).not_to_have_text(paused)
        current = card.locator("[data-quote-text]").inner_text()
        card.locator("[data-quote-pause]").click()
        self.page.locator("#search").focus()
        self.page.clock.fast_forward(300001)
        expect(card.locator("[data-quote-text]")).not_to_have_text(current)
        self.assertIsNone(self.saved())
        self.page.reload()
        expect(card.locator("[data-quote-credit]")).to_be_visible()
        self.assertEqual(len([url for url in self.requests if url.startswith(QUOTE_API_PREFIX)]), calls)

    def test_quote_api_failure_keeps_sidebar_functional_and_quote_text_is_safe(self):
        self.page.evaluate("localStorage.removeItem('todo-list:quotes:v1')")
        self.page.unroute("https://api.quotable.io/**")
        self.page.route("https://api.quotable.io/**", lambda route: route.fulfill(status=503, body="Unavailable"))
        self.page.reload()
        expect(self.page.locator("[data-quote-author]")).to_have_text("— To-Do List")
        expect(self.page.locator("[data-quote-credit]")).not_to_be_visible()
        self.create_list("Works offline")
        self.add_task("Still saved")
        self.assertEqual(self.saved()["lists"][0]["tasks"][0]["text"], "Still saved")
        self.page.unroute("https://api.quotable.io/**")
        self.page.route("https://api.quotable.io/**", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps([
                {"content": '<img src=x onerror="alert(1)">', "author": "<b>Author</b>"}])))
        self.page.reload()
        expect(self.page.locator("[data-quote-text]")).to_have_text('<img src=x onerror="alert(1)">')
        self.assertEqual(self.page.locator("#quote-card img, #quote-card b").count(), 0)


if __name__ == "__main__":
    unittest.main()
