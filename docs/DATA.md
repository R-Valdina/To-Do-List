# Data, backups, and privacy

[← Back to the README](../README.md)

## Where your data lives

Lists, task order, deadlines, appearance, app theme, and sidebar sorting are serialized as versioned JSON in `localStorage`, under `todo-list:state:v1`.

This is browser-managed storage on your device—not a standalone JSON/YAML file that the application automatically writes to your Documents folder. Browser security prevents a normal static webpage from silently writing arbitrary PC files. There is no automatic sync, server backup, encryption layer, account, or collaboration service. Treat a browser profile as a single-writer workspace: simultaneous edits in multiple tabs use the last saved state.

- Export JSON downloads a portable backup file wherever your browser saves downloads.
- Import JSON validates a backup and asks for confirmation before replacing current lists/settings. Cancel leaves data unchanged. Import also accepts a list array from the latest standalone mockup.
- Clearing site data, changing browsers/profiles/origins, or using private browsing can make local data unavailable. Export backups regularly. Backup files contain your task text; handle them as personal files.
- A corrupted or unreadable saved state is not overwritten. A persistent error explains that saving is paused. Export recovers the original stored text when available; importing a valid backup explicitly replaces it. Unsaved edits remain in the current tab when writes fail.
- Backups support up to 100 lists, 5,000 tasks total, 70-character list names, 250-character task descriptions, and a 2 MB import size.

### Existing data

When the new storage key is absent, the app migrates `todo-lists-mockup-v3` first, or the original repository's `todos` key. Mockup list order, task completion, priorities, dates, and supported themes are preserved. Original Personal and Business tasks become Personal and Work lists. Legacy keys remain untouched. Existing usernames are also left untouched in their old key; the new design does not display a name field.

Migration only finds data available on the same browser origin. A mockup saved in an HTML playground or on a different host/port is not accessible to this app; export/import is the bridge. Invalid legacy entries are reported and retained rather than silently discarded.

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

