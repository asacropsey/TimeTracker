# Time Tracker

A simple personal app to track time on long-running projects (e.g. "WP-Examen", "Roman"),
with milestones and planned hours. Built to work on the phone (also offline) and on the computer.

The full plan is in [SPEC.md](SPEC.md).

**The app:** https://asacropsey.github.io/TimeTracker/

## Install on the phone (Android, once)
1. Open **Chrome** on the phone and go to https://asacropsey.github.io/TimeTracker/
2. Tap the **⋮** menu (top right) → **Add to home screen** → **Install**.
3. Open **Time Tracker** from the home screen (the crest icon). It now also works offline.

New versions install themselves: the next time the app is opened with internet, it updates.

## Current status: Phase 5 – timer

- ✅ Projects and milestones (create, rename, archive, planned hours, mark done, reorder)
- ✅ Logging time by hand (start & end time, or just a duration)
- ✅ History with filters, and "Correct this entry"
- ✅ Works offline
- ✅ Visual design from the crest (Phase 1b)
- ✅ Published online, installable on the phone (Phase 2)
- ✅ Microsoft sign-in, personal account, app folder only (Phase 3)
- ✅ Sync to `OneDrive › Apps › Time Tracker › timetracker.xlsx` with fingerprint chain, backups and "Verify data" (Phase 4)
- ✅ Timer: Begin / Rest on the Record tab, survives closing the app, asks after 8 hours (Phase 5)
- ⏳ Not yet: dashboard and charts (6), polish (7)

**How your data is kept:** every entry is saved on the device first, then copied to the Excel
file whenever the device is online and signed in. Phone and computer share the same data through
that file. Backups of the 30 previous versions are in the `backups` folder next to it.

**Never edit the Entries or ChangeLog sheets by hand.** If that happens, syncing stops and
Account › Verify data shows which rows changed. Undo it with OneDrive's version history
(right-click the file › Version history).

Every upload to GitHub runs the automated checks first; the app is only published if they all pass.

---

## How to start the app (on this computer)

You need **Node.js** and **Git** installed (done once, already done).

1. Open the **Start menu**, type `PowerShell` and open **Windows PowerShell**.
2. Copy and paste this line, then press **Enter**:

   ```
   cd C:\Users\asacr\Projects\TimeTracker; npm run dev
   ```

3. Wait until you see `Local: http://localhost:5173/`.
4. Open **http://localhost:5173** in your browser (Edge or Chrome).
5. To stop the app: click in the PowerShell window and press **Ctrl + C**.

The first time only (or if PowerShell says something is missing), run this first:

```
cd C:\Users\asacr\Projects\TimeTracker; npm install
```

### Testing that it works offline

`npm run dev` is the "workshop" version and does not work offline. To try the real, offline-capable
version, use this instead and open **http://localhost:4173/TimeTracker/**:

```
cd C:\Users\asacr\Projects\TimeTracker; npm run preview
```

### Running the automated checks

```
cd C:\Users\asacr\Projects\TimeTracker; npm test
```

Every line should be green and end with "passed".

---

## How the app keeps your data safe

- Every action (new entry, new project, rename, correction, …) is saved as a permanent record.
  Records are **only ever added – never changed or deleted**. The app has no "delete" button,
  and the code has no way to delete.
- A mistake is fixed with **Correct this entry** (on the History screen). The original stays
  visible, crossed out, and the correction is shown below it with your reason.
- Logged to the wrong project? Correct the entry to 0 and add a new entry for the right project.

## Where things are (for the curious)

| Folder / file | What it is |
|---|---|
| `src/db.ts` | The on-device database (add-only) |
| `src/events.ts` | Creates the records for each action |
| `src/state.ts` | Calculates projects, milestones and totals from the records |
| `src/validation.ts` | Checks what you type (end after start, nothing in the future, …) |
| `src/ui/` | The four screens: Record, Projects, History, Account |
| `src/auth.ts`, `src/config.ts` | Microsoft sign-in |
| `src/sync/` | Excel sync: rules (`engine.ts`), Excel file (`workbook.ts`), OneDrive (`onedrive.ts`), when to sync (`controller.ts`) |
| `src/ui/ornaments.ts` | Star, flame, shield, divider and ribbon banner from the crest |
| `src/style.css` | Colours, fonts and look (palette from the crest) |
| `design/` | The crest images the design is based on |
| `scripts/make-crest-assets.mjs` | Makes the app icons from the crest (`npm run crest`, only if the crest changes) |
| `tests/` | Automated checks |
