# Development guide

[← Back to the README](../README.md)

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

## Refresh the screenshots

Screenshots are captured from the real application with isolated, disposable demo data. The capture uses a fixed date so deadlines remain consistent, and the quote service is unavailable in the capture so the real built-in quote fallback is shown. No personal browser profile or task data is used.

After installing the browser-test dependencies described above, run:

```sh
npm run docs:screenshots
```

The capture script starts its own temporary local server and writes five PNG files to `docs/images/`: the light overview, dark Work list, list appearance editor, task editor/calendar, and mobile workspace. It fails if the app emits an uncaught JavaScript error. `CHROMIUM_PATH` works the same way as in the browser suite.

Capture files are committed so the README does not depend on an external screenshot host. The mobile screenshot frames the workspace; the responsive sidebar is above that area on the actual page.
