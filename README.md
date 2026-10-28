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

## Current status: Phase 2 – online, but each device keeps its own data

- ✅ Projects and milestones (create, rename, archive, planned hours, mark done, reorder)
- ✅ Logging time by hand (start & end time, or just a duration)
- ✅ History with filters, and "Correct this entry"
- ✅ Works offline
- ✅ Visual design from the crest (Phase 1b)
- ✅ Published online, installable on the phone (Phase 2)
- ⏳ Not yet: Microsoft sign-in (3), Excel sync (4), timer (5), charts (6)

**Your data is currently stored only on each device (phone and computer separately).** It is not
yet copied to Excel or OneDrive. Treat this as a test: don't log important time yet.

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
| `src/ui/` | The three screens: Record, Projects, History |
| `src/ui/ornaments.ts` | Star, flame, shield, divider and ribbon banner from the crest |
| `src/style.css` | Colours, fonts and look (palette from the crest) |
| `design/` | The crest images the design is based on |
| `scripts/make-crest-assets.mjs` | Makes the app icons from the crest (`npm run crest`, only if the crest changes) |
| `tests/` | Automated checks |
