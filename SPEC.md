# Time Tracker – Project Specification (v2: phone + computer, Microsoft OneDrive)

## Purpose
A simple personal time-tracking app for long-running projects (e.g. "WP-Examen", "Roman").
Track time, set milestones with planned hours, see progress. Must work on the **phone during the
train commute (often offline)** and on the **computer**, with all data ending up in **one Excel file
in the owner's personal OneDrive**.

The owner of this project is **not a programmer**. Therefore:
- Keep the code simple, well-commented, and as small as reasonable.
- Explain every step in plain language before doing it, and wait for approval.
- Never require the owner to edit code by hand. Give exact click-by-click instructions for anything
  done in a website (GitHub, Microsoft) and exact copy-paste commands for anything typed.
- After each phase, explain how to open the app on computer and phone and what to test.

## Architecture overview
- **Progressive Web App (PWA)**: one web app that runs in the browser on the computer and can be
  installed on the phone's home screen (iPhone: Safari → Share → "Add to Home Screen"; Android:
  Chrome → "Install app"). Works fully offline after first load.
- **Hosting**: GitHub Pages (free, HTTPS). The repository may be public: it contains only code,
  never any personal data or secrets.
- **Sign-in**: Microsoft personal account via MSAL.js (`@azure/msal-browser`), single-page-app
  flow with PKCE. Delegated permission `Files.ReadWrite.AppFolder` only (plus `offline_access`,
  `User.Read`). Decided by the owner in Phase 3: the app may only access its own OneDrive folder
  (`Apps/Time Tracker/`, Graph path `/me/drive/special/approot`), never any other file.
- **Local storage on each device**: IndexedDB. Call `navigator.storage.persist()` so the browser
  does not delete data.
- **Master record**: `timetracker.xlsx` in the app folder (`OneDrive/Apps/Time Tracker/`).
- **Important constraint**: The Microsoft Graph Excel *workbook* API (`/workbook/...`, table rows)
  is NOT supported on personal OneDrive. Do not use it. Instead use the plain file API:
  download the .xlsx, append rows in the browser with **ExcelJS**, upload it back.

### Suggested stack
Vite + plain TypeScript (no heavy framework), `@azure/msal-browser`, `exceljs`, `idb`, Chart.js,
`vite-plugin-pwa`, Vitest for tests, GitHub Actions to deploy to GitHub Pages.

## Data model

### Everything is an append-only event log
Every change (time entry, correction, project created, milestone planned hours changed, milestone
done, …) is an **event** with a globally unique `event_id` (UUID generated on the device).
This makes syncing between devices safe: events are only ever added, never edited, so two devices
can never overwrite each other.

### Excel file `timetracker.xlsx`
**Sheet `Entries`** (raw time log – append-only)
| seq | event_id | device | created_at | project_id | milestone_id | start | end | duration_minutes | note | entry_type (normal/correction) | corrects_event_id | synced_at | prev_hash | row_hash |

**Sheet `ChangeLog`** (append-only: all changes to projects and milestones)
| seq | event_id | device | created_at | action | record_id | field | old_value | new_value | prev_hash | row_hash |

**Sheet `Projects`** and **Sheet `Milestones`**: current-state views, *regenerated* by the app
from ChangeLog on every sync, for easy reading in Excel. They are not the source of truth.
- Projects: | project_id | name | description | status (active/archived) |
- Milestones: | milestone_id | project_id | name | planned_hours | order | status (open/done) | done_at |

**Sheet `Info`**: explains in plain words what each sheet is and that Entries/ChangeLog must not
be edited by hand.

Protect `Entries` and `ChangeLog` with Excel sheet protection (no password needed; it prevents
accidental edits). Sheet protection is not tamper-proof – the hash chain is what detects tampering.

### Hash chain
`seq` and the hash chain are assigned **at the moment rows are written into Excel** (not on the
device), so entries from phone and computer form one continuous chain:
`row_hash = SHA-256(seq + all row fields + prev_hash)`.

## Immutability rules (most important requirement)
1. The app only ever appends rows to `Entries` and `ChangeLog`. No edit or delete of an entry,
   anywhere in the UI or code.
2. Mistakes are fixed by a **correction** event (`entry_type = correction`, adjusting
   `duration_minutes`, `corrects_event_id` set, reason required in `note`). UI: "Correct this entry".
3. All totals = sum of normal + correction entries.
4. "Verify data" button: re-checks the full hash chain and lists any row altered or removed.
5. When writing, the app must **re-read existing rows and check they are unchanged** before
   appending (never rewrite existing rows from local data).

## Sync (core of the app – build and test carefully)
1. New events are saved instantly to IndexedDB on the device with status `pending`.
2. When online and signed in (on app start, after each new event, on regaining connection, and
   via a "Sync now" button):
   a. Download `timetracker.xlsx` and note its **eTag**.
   b. Skip any pending event whose `event_id` already exists in the file (makes sync safe to
      repeat if a previous upload succeeded but the phone lost connection).
   c. Append the remaining events with seq/hash, regenerate Projects/Milestones views.
   d. Upload with `If-Match: <eTag>`. If the file changed in the meantime (412), start again
      from (a). Retry with backoff; never lose pending events.
   e. Mark events as `synced`. Pull all events into IndexedDB so both devices show the same data.
3. If the file is locked (owner has it open in desktop Excel), show: "Please close
   timetracker.xlsx in Excel – your entries are safe and will sync automatically."
4. Before every upload, keep a backup copy in `backups/` inside the app folder (keep the last 30).
5. Always show sync status clearly: "All synced" / "3 entries waiting to sync" / "Offline".
6. If the file doesn't exist yet, create it.

## Features

### 1. Projects & milestones
- Create, rename, archive projects. Example: "WP-Examen", "Roman".
- Ordered milestones per project with name + planned hours (e.g. "Steuerrecht – 120 h").
- Change planned hours, mark milestone done. All changes go through ChangeLog events.

### 2. Logging time
- **Timer**: pick project (+ optional milestone), Start/Stop. The running timer is stored in
  IndexedDB and survives closing the app or restarting the phone. A timer belongs to the device
  where it was started. Warn if a timer has been running more than 8 hours.
- **Manual entry**: date, start/end or duration, optional note.
- Validation: end after start, nothing in the future, warn (don't block) on entries > 10 h.
- Phone UI first: big buttons, usable with one thumb, last-used project preselected.

### 3. Progress & dashboard
- Per milestone: logged vs planned hours, **% = logged / planned** (may exceed 100 %, show
  overruns in a different color).
- Per project: total logged, total planned, overall %, milestones done / total.
- Show both time-based % and milestone-based % (time spent ≠ real progress).
- Charts: hours per week per project; progress bars per milestone.

### 4. Entry history
- Read-only list of all entries with filters (project, milestone, date range); corrections shown
  linked to the original; device shown (phone/computer).

## Visual design
Reference images: `design/crest-portrait.jpg` and `design/crest-landscape.jpg` (the owner's own
coat of arms). **Look at both images before designing.** The app should feel like it belongs to
this crest: a dark woven tapestry with gold embroidery, heraldic, calm and dignified, not playful.

### Palette (derived from the crest – fine-tune against the images)
| Role | Colour | Use |
|---|---|---|
| Background | deep midnight navy ~ `#0E1726` | app background |
| Surface | navy ~ `#16233A` | cards, panels (like the shield) |
| Gold | antique gold ~ `#C9A04E` | borders, headings, icons, key numbers |
| Flame | bright warm gold ~ `#F2C46B` | primary buttons, running timer, highlights |
| Oak green | muted olive ~ `#5E6B3A` | progress bars, "done" states |
| Parchment | ~ `#E3CF9F` | body text on dark, banner labels |
| Silver-grey | ~ `#9A9A9A` | secondary text (the fox) |
| Ember | muted copper-red ~ `#B5653A` | overruns > 100 %, warnings |

Dark theme only. All text must meet WCAG AA contrast on its background.

### Typography
- Headings: a classical inscription serif in small caps, e.g. **Cinzel** (Google Fonts).
- Body and numbers: a highly readable serif, e.g. **EB Garamond** or **Cormorant Garamond**
  (min. 16 px on phone); use tabular figures for times and hours.
- Bundle the fonts with the app so they work offline.

### Ornament & motifs (use sparingly – readability first)
- Thin double gold rule borders around cards, like the tapestry frame.
- **Eight-pointed star** as the divider and small accent icon.
- **Flame** = the timer: when a timer is running, show a softly glowing flame (subtle CSS
  animation, respects "reduce motion").
- **Shield shape** for project cards / project icons.
- **Ribbon banner** for page titles and for milestone names when complete.
- ~~Oak-leaf sprigs as corner ornaments on the dashboard only.~~ Tried in Phase 6 and removed
  by the owner ("don't look good") – do not add oak-leaf ornaments.
- Motto "SOLUS NON SOLUM" on the start/sign-in screen.
- Very subtle woven-fabric texture on the background (CSS or a tiny tiled image, keep the app
  fast on mobile data).
- App icon (home screen) and splash screen made from the crest (shield + flame, cropped square).

### Tone of text
Short, calm, slightly formal labels ("Begin", "Rest", "Record time", "Milestones").
Plain-language error messages stay plain – clarity beats style.

## One-time setup the owner must do (guide them click by click)
1. Create a free GitHub account (if needed) and the repository.
2. Register the app in the Microsoft Entra admin center / Azure portal with the owner's
   **personal** Microsoft account: account type "Personal Microsoft accounts only", platform
   "Single-page application", redirect URIs for the GitHub Pages URL and `http://localhost:5173`.
   (Microsoft may require creating a free Azure/Entra directory first – explain if so.)
3. Put the Application (client) ID into the config file (it is not a secret).
4. Install the app on the phone's home screen and sign in once on each device.

Use only a **personal** Microsoft account – never a work or employer account.

## Out of scope (for now)
Multiple users, editing past entries, invoicing, native app-store apps, push notifications.

## Build plan – work in phases, stop after each for the owner to test
1. **Skeleton & local-only app**: project setup, README for non-programmers, PWA installable,
   IndexedDB event store, projects/milestones, manual entries, history, corrections – all offline,
   no Microsoft yet. Tests for append-only rules.
1b. **Visual design**: apply the "Visual design" section to all screens built so far; create a
   small set of reusable styles/components so later phases use them automatically. Show the
   owner screenshots on phone and desktop size before moving on.
2. **Deploy to GitHub Pages** and install on the phone (still local-only data).
3. **Microsoft sign-in** (guide through app registration).
4. **Sync to Excel**: file creation, hash chain, eTag handling, de-duplication, backups, verify
   button. Extensive automated tests incl. simulated offline, double upload and conflicts.
5. **Timer**.
6. **Dashboard & charts**.
7. **Polish**: error messages in plain language, final README walkthrough.

## Working agreement for Claude Code
- Explain the plan for each phase in plain language first and wait for approval.
- Use git; commit after each working phase.
- Run the tests after every change.
- Tests must use a separate test file / mock, never the real `timetracker.xlsx`.
- Never store tokens, passwords or personal data in the repository.
