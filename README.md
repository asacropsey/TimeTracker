# Time Tracker

*Solus non solum.*

A personal app for tracking time on long-running projects (for example "WP-Examen" or "Roman"),
with milestones and planned hours. It works on the phone, even offline on the train, and on the
computer. Everything ends up in one Excel file in your OneDrive.

**Open the app:** https://asacropsey.github.io/TimeTracker/

---

## Contents
1. [Getting started on a device](#1-getting-started-on-a-device)
2. [Everyday use](#2-everyday-use)
3. [Your data and the Excel file](#3-your-data-and-the-excel-file)
4. [What the messages mean](#4-what-the-messages-mean)
5. [Looking after the app](#5-looking-after-the-app)
6. [For a helper or programmer](#6-for-a-helper-or-programmer)

---

## 1. Getting started on a device

### On the Android phone (once)
1. Open **Chrome** and go to https://asacropsey.github.io/TimeTracker/
2. Wait about 5 seconds; the app saves itself for offline use.
3. Tap **⋮** (top right) → **Add to home screen** → **Install**.
4. Open **Time Tracker** from the home screen (the crest icon).

### On the computer
Open https://asacropsey.github.io/TimeTracker/ in Edge or Chrome. You can also install it there:
click the small "install" icon at the right end of the address bar.

### Sign in (once per device)
1. Tap **Account** (the round seal, bottom right) → **Sign in with Microsoft**.
2. Use your **personal** Microsoft account (never a work account) and accept the request.
3. **First time on a device only:** if the device already has entries, the app asks once whether to
   keep them or **start fresh**. Keep real entries; start fresh only to clear test data. A new
   device with nothing on it starts syncing straight away.
4. The status line under the title shows **"All synced"**. Entries from your other device now
   appear as well.

Signing in again from time to time is normal; Microsoft limits how long web apps stay signed in.
Your entries are always saved on the device and wait until you sign in.

---

## 2. Everyday use

The app has four tabs at the bottom.

### Record: the timer and adding time by hand
- **Timer:** pick the project (and milestone, if you like), tap **Begin**. The flame glows and
  the clock runs, even if you close the app or restart the phone. Tap **Rest** to stop; the time is
  saved as an entry. You can type a note while it runs.
- **Forgot to stop?** Tap *"Forgot to stop? Choose the end time"* and enter when you really
  stopped. After 8 hours the app asks you by itself.
- **Add time by hand:** open the fold-out below the timer. Enter either a start and end time, or
  just a duration. The last-used project is already selected.
- The app refuses times in the future and an end before the start. It asks before saving more
  than 10 hours.

### Progress: how your projects are going
- **This week:** total hours since Monday, and per project.
- **Hours per week:** the last 12 weeks. Touch a bar for details; *Show as table* lists the numbers.
- **Each project:** *Time* (hours logged / planned) and *Milestones* (how many complete), shown
  side by side, because time spent is not the same as real progress. Anything **over 100 %** shows
  in copper-red.
- **Manage** (at the bottom of each project): rename, description, archive; and for each
  milestone: move up/down, rename, **planned hours**, mark complete. Add milestones here too.
- **New project:** at the bottom of the page.

### History: every entry
- Filter by project, milestone and dates.
- **Correct this entry** fixes a mistake: enter the correct total and a reason. The original stays
  visible (crossed out) with the correction below it. Nothing is ever deleted.
- **Logged to the wrong project?** Correct the entry to 0 and add a new entry for the right one.

### Account: sign-in and sync
- **Sync now:** syncing also happens by itself (on opening the app, after each entry, when the
  internet comes back), so this is rarely needed.
- **Verify data:** checks every row of the Excel file and reports anything that was changed.

---

## 3. Your data and the Excel file

**Where:** `OneDrive › Apps › Time Tracker › timetracker.xlsx`. The app can only see this folder,
nothing else in your OneDrive.

**The sheets**
| Sheet | What it is |
|---|---|
| Info | Explains the file in plain words |
| Projects, Milestones | Easy-to-read overviews, rebuilt at every sync |
| Entries | Every block of time and every correction: **the permanent record** |
| ChangeLog | Every change to projects and milestones: **the permanent record** |

**Rules that keep your data safe**
- Rows are only ever **added**, never changed or deleted, by the app or by you.
- **Never edit Entries or ChangeLog by hand.** Each row carries a fingerprint linked to the row
  above it. If anything is changed, syncing **stops** and *Verify data* shows the row. Your new
  entries stay safe on your devices meanwhile.
  To undo the change: in OneDrive, right-click `timetracker.xlsx` → **Version history** → restore
  the version from before the change.
- Before every upload, the previous version is copied to the **backups** folder next to the
  file; the last 30 are kept.
- Looking at the file in Excel is fine. While it is **open in the Excel program**, the app waits
  and shows a message; close Excel and it syncs within a minute.

---

## 4. What the messages mean

| You see | What it means | What to do |
|---|---|---|
| All synced | Everything is in the Excel file | Nothing |
| 3 entries waiting to sync | Saved on the device, not yet in Excel | Nothing, it syncs by itself |
| Offline – … | No internet; everything is saved on the device | Nothing, it syncs when you're back online |
| Not signed in / Please sign in again | Microsoft wants you to sign in | Account → **Sign in** |
| Syncing not started yet – see Account | First time on this device | Account → choose *keep* or *start fresh* |
| Please close timetracker.xlsx in Excel … | The file is open in the Excel program | Close Excel; it syncs within a minute |
| The other device is syncing … | Phone and computer synced at the same moment | Nothing, it retries by itself |
| Sync stopped: the Excel file was changed | A row in Entries/ChangeLog was edited or removed | Account → **Verify data**, then restore via OneDrive's Version history |
| Problem while … [Microsoft's reason] | Microsoft refused a step | Try **Sync now** later; if it stays, send a screenshot of the Account tab |
| Something unexpected went wrong … (Technical detail: …) | An error the app didn't expect | Close and reopen the app; if it stays, send a screenshot |

In every one of these cases, **your entries are safe on the device**.

---

## 5. Looking after the app

- **Updates install themselves.** After a new version is published, the next time you open the
  app with internet it updates (sometimes it takes closing and reopening twice).
- **A new phone:** install the app (section 1), sign in, and everything arrives from the Excel file.
- **Microsoft Azure emails:** your free Azure account exists only so the app may use Microsoft
  sign-in. When Microsoft asks whether to *upgrade* (after 30 days and after 12 months),
  **decline or ignore it**. Sign-in keeps working, and nothing costs money as long as you create
  nothing else in Azure.
- **The app registration** is called "Time Tracker" in the Azure portal (App registrations). Its
  Application (client) ID is in `src/config.ts`; it is not a secret.
- **Privacy:** the code (and the crest) are public on GitHub. Your entries never are: they live
  only on your devices and in your own OneDrive.

---

## 6. For a helper or programmer

The full specification and every decision taken along the way are in [SPEC.md](SPEC.md).

**Stack:** Vite + plain TypeScript, IndexedDB (`idb`), `@azure/msal-browser` (personal accounts,
`Files.ReadWrite.AppFolder` only), ExcelJS, Chart.js, `vite-plugin-pwa`, Vitest.
Hosted on GitHub Pages; `.github/workflows/deploy.yml` runs the tests and publishes on every push
to `main`.

**Run it on this computer** (Node.js and Git are installed; Git is at
`C:\Program Files\Git\cmd\git.exe`, it is not on the PATH):
```
cd C:\Users\asacr\Projects\TimeTracker; npm install
cd C:\Users\asacr\Projects\TimeTracker; npm run dev       # http://localhost:5173
cd C:\Users\asacr\Projects\TimeTracker; npm run preview   # offline-capable build, http://localhost:4173/TimeTracker/
cd C:\Users\asacr\Projects\TimeTracker; npm test          # automated checks, all must pass
```

**Design of the data**
- Every change is an append-only **event** with a UUID (`src/types.ts`, `src/events.ts`); the
  current state is rebuilt from the events (`src/state.ts`). `src/db.ts` offers no update or
  delete for events; the only exception is the guarded one-time `startFresh()`.
- Sync (`src/sync/engine.ts`): download → verify the SHA-256 hash chain → skip known event IDs →
  append with seq/hash → back up → upload with `If-Match` (retry on conflict) → import the other
  device's events. If the file was altered, sync stops (owner's decision).
- The tests in `tests/` run against a simulated OneDrive (`tests/fakes.ts`), never the real file.

**Where things are**
| Folder / file | What it is |
|---|---|
| `src/db.ts` | The on-device database (add-only) |
| `src/events.ts`, `src/state.ts` | Creating events; rebuilding projects, milestones and totals |
| `src/validation.ts` | Checks on what is typed |
| `src/timer.ts` | The timer |
| `src/progress.ts`, `src/ui/weeklyChart.ts` | Progress numbers and the weekly chart |
| `src/auth.ts`, `src/config.ts`, `src/graph.ts` | Microsoft sign-in and OneDrive access |
| `src/sync/` | Excel sync: rules, Excel file, OneDrive, when to sync |
| `src/errors.ts` | Turns any error into a plain-language message |
| `src/ui/` | The four screens, pop-up boxes (`dialog.ts`), ornaments from the crest |
| `src/style.css` | Colours, fonts and look (palette from the crest) |
| `design/`, `scripts/make-crest-assets.mjs` | Crest images; `npm run crest` remakes the icons |
| `tests/` | Automated checks |
