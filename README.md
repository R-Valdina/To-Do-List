# To-Do List

A local-first list and task manager built with HTML, CSS, and native JavaScript modules. The app uses the approved navy, teal, cyan, mint, and ice-white palette. Individual lists can use their own colors and textures.

## Run locally

Requirements: **Python 3** for the static server. **Node.js 20+** is needed for the optional npm commands and unit tests.

```sh
npm run dev
```

Or, without Node.js:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open the app on port 8000 in your browser. Serve the repository root over HTTP: opening `index.html` directly with `file://` will not reliably load JavaScript modules. No application dependency installation, build step, API keys, database, or backend is required. Use the same host and port to retain access to that browser's saved data.

## Features

- Create and edit lists with a name, optional deadline, color, and texture.
- Per-list progress; All lists view; scoped search; A–Z/Z–A list sorting.
- Add and edit tasks with priorities and optional task deadlines.
- Red High, yellow Medium, and green Low priorities.
- Mouse/touch drag grips and keyboard reordering. Focus a grip and press Up/Down; Escape cancels dragging. Clear search to reorder the complete list.
- Complete tasks and undo the most recent deletion until it is dismissed or another task is deleted.
- Custom themed calendars with arrow-key navigation and responsive scrollable dialogs.
- Deadline warnings use shapes and text as well as color: yellow triangle within 3 days, red octagon today/tomorrow, and red clock with a soft red background after the due date. Completed tasks/lists suppress warnings. Empty lists remain incomplete.
- Individual list appearance is repeated in the sidebar. White lists keep white borders, neutral gray text/progress, and white backgrounds in either app theme. Explicit overdue warnings take precedence over a list's background color.
- 24 list colors, grouped into Coastal & classics and Earth & autumn. The autumn palette adds Sandstone, Clay, Terracotta, Rust, Pumpkin, Golden Ochre, Olive, Moss, Evergreen, Cocoa, Burgundy, and Autumn Plum.
- 10 local background styles: Plain, Dots, Grid, Stripes, Cross dots, Gingham, Chevron, Triangles, Notebook, and Linen. Pattern previews use the selected color and the same repeat size/offsets as sidebar tiles and list cards. Task rows remain on solid surfaces for readability.
- JSON export/import, automatic legacy migration, and browser-storage error recovery.
- Sidebar Help dialog with reordering, storage, backup, editing, and deadline guidance.
- Sidebar motivational/humorous quotes, rotating every five minutes with Next and Pause/Resume controls. Hidden tabs stop automatic rotation.
- No external fonts, images, or trackers. The optional quote card contacts Quotable; lists and tasks work without it. Palette colors inspired by the supplied images are approximations rather than official paint values.

## Where your data lives

Lists, task order, deadlines, appearance, app theme, and sidebar sorting are serialized as **versioned JSON in `localStorage`**, under `todo-list:state:v1`.

This is browser-managed storage on your device—not a standalone JSON/YAML file that the application automatically writes to your Documents folder. Browser security prevents a normal static webpage from silently writing arbitrary PC files. There is no automatic sync, server backup, encryption layer, account, or collaboration service. Treat a browser profile as a single-writer workspace: simultaneous edits in multiple tabs use the last saved state.

- **Export JSON** downloads a portable backup file wherever your browser saves downloads.
- **Import JSON** validates a backup and asks for confirmation before replacing current lists/settings. Cancel leaves data unchanged. Import also accepts a list array from the latest standalone mockup.
- Clearing site data, changing browsers/profiles/origins, or using private browsing can make local data unavailable. Export backups regularly. Backup files contain your task text; handle them as personal files.
- A corrupted or unreadable saved state is not overwritten. A persistent error explains that saving is paused. Export recovers the original stored text when available; importing a valid backup explicitly replaces it. Unsaved edits remain in the current tab when writes fail.
- Backups support up to 100 lists, 5,000 tasks total, 70-character list names, 250-character task descriptions, and a 2 MB import size.

### Existing data

When the new storage key is absent, the app migrates `todo-lists-mockup-v3` first, or the original repository's `todos` key. Mockup list order, task completion, priorities, dates, and supported themes are preserved. Original Personal and Business tasks become Personal and Work lists. Legacy keys remain untouched. Existing usernames are also left untouched in their old key; the new design does not display a name field.

Migration only finds data available on the **same browser origin**. A mockup saved in an HTML playground or on a different host/port is not accessible to this app; export/import is the bridge. Invalid legacy entries are reported and retained rather than silently discarded.

### Optional sidebar quotes

The card uses [Quotable](https://github.com/lukePeavey/quotable), a free, open-source quote API whose project declares the MIT license. Its documented request is `https://api.quotable.io/quotes/random?tags=motivational%7Cinspirational%7Chumorous&maxLength=180&limit=20`. Quotes retain author attribution and a source link. No API key is needed.

The browser fetches a batch once and caches validated quotes for 24 hours under `todo-list:quotes:v1`. Automatic rotation runs every five minutes while the tab is visible and the user is not interacting with the card. Next changes the quote immediately; Pause stops automatic rotation until resumed or the page is reloaded. Automatic changes are not announced to screen readers; manual actions are. The app supplies original lighthearted encouragement if the API is blocked, times out, or returns invalid data. There are no repeated background fetches during that page session.

Only the public quote request goes to `api.quotable.io`: no task text, browser-storage contents, cookies, or referrer are included. As with any remote request, the provider receives normal connection metadata such as your IP address. A restricted hosting environment must allow that hostname. During implementation the cloud proxy blocked live API requests; the documented contract was verified from the upstream project and success/failure behavior was tested with controlled API responses. Live service availability is not guaranteed, and the offline quotes keep the card usable.

### Backup format

```json
{
  "schemaVersion": 1,
  "lists": [
    {
      "id": "list-example",
      "name": "Work",
      "due": "2026-11-01",
      "appearance": { "color": "teal", "texture": "grid" },
      "tasks": [
        {
          "id": "task-example",
          "text": "Prepare proposal",
          "priority": "High",
          "due": "2026-10-30",
          "done": false
        }
      ]
    }
  ],
  "settings": { "theme": "light", "sort": "asc" }
}
```

Dates are local calendar days (`YYYY-MM-DD`), not UTC timestamps. Array order is the saved task order. List names and all IDs must be unique. Unknown appearance choices fall back to White/Plain; unsupported schema versions or invalid task data are rejected.

## Project structure

```text
index.html                 Semantic page and form markup
styles/
  tokens.css               App palette and neutral white-list overrides
  app.css                  Layout, components, responsive and focus styles
src/
  app.js                   App state, actions, and backup orchestration
  model.js                 Schema validation and list/task operations
  storage.js               Persistence, legacy migration, backup decoding
  quotes.js                Quote API client, validation, cache, offline copy
  dates.js                 Local date validation and deadline calculations
  themes.js                List colors, textures, and appearance application
  patterns.js              Local gradient patterns adapted from pattern.css
  ui/
    dom.js                 Safe DOM helpers and warning icons
    render.js              Navigation, list, and task rendering
    editors.js             List/task draft forms and dialogs
    calendar.js            Reusable themed date picker
    drag.js                Pointer and keyboard task reordering
    quote-card.js          Quote rotation, pause/resume, attribution
tests/
  *.test.js                Unit tests using Node's built-in runner
  test_app_browser.py      Playwright end-to-end browser automation
.github/workflows/test.yml Unit and browser test CI
THIRD_PARTY_NOTICES.md     Attribution and MIT license for adapted patterns
```

The app intentionally has no framework or bundler. Modules isolate responsibilities without adding a build pipeline. User-entered text uses DOM text/value properties, never HTML interpolation. Static SVG icon markup is application-owned. The model and storage modules can be tested independently of the DOM, and persistence can be replaced later if a backend or desktop app is introduced.

## Tests

Unit tests require Node.js 20+ and no installed npm packages:

```sh
npm test
TZ=America/New_York npm test
```

Browser automation uses Python 3.10+ and Playwright. Install test-only dependencies in a virtual environment:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
npm run test:browser
```

On Linux, Playwright may require system browser dependencies (`python -m playwright install --with-deps chromium`). Windows activation uses `.venv\Scripts\activate` instead.

The browser suite starts its own server on an available loopback port and creates a fresh browser context for each test. It does not touch your normal browser data. It uses a system `chromium` executable when available, or Playwright's installed Chromium. Set `CHROMIUM_PATH` to select another Chromium executable.

Tests cover validation, schema errors, migrations, storage failures, calendar-day/DST boundaries, per-list progress, task order integrity, list/task CRUD, scoped search, sorting, custom calendars, mobile dialogs, literal task text, white-list styling, warnings, mouse/touch/keyboard reordering, reload persistence, actual JSON downloads, import cancellation, and recovery from corrupt storage. Theme tests check heading contrast against base tints, all autumn color/pattern backup combinations, and matching pattern previews/sidebar cards in both app themes. Quote tests cover response validation, caching, timeouts, five-minute rotation, pause/resume, offline fallback, attribution, and safe rendering. Browser tests stub the quote service and fail on uncaught JavaScript errors or unexpected external requests; CI does not depend on a live public API.

GitHub Actions runs the unit suite and Chromium automation on pushes and pull requests. CI dependencies are test-only; deploying the application requires only serving the repository's static application files.

## Credits and license

The original app was inspired by [Learn to Build a Todo List App in 2022](https://www.youtube.com/watch?v=6eFwtaZf6zc). Background formulas are adapted from [pattern.css 1.0.0](https://github.com/bansal-io/pattern.css) by bansal-io (MIT); see [third-party notices](THIRD_PARTY_NOTICES.md) for source and license details. No CDN or installed pattern library is needed. This revision retains the repository's [MIT license](LICENSE).
