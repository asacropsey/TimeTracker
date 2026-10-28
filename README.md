# Time Tracker

A simple personal app to track time on long-running projects (e.g. "WP-Examen", "Roman"),
with milestones and planned hours. Built to work on the phone (also offline) and on the computer.

The full plan is in [SPEC.md](SPEC.md).

## Current status: Phase 1 – works on this computer only

- ✅ Projects and milestones (create, rename, archive, planned hours, mark done, reorder)
- ✅ Logging time by hand (start & end time, or just a duration)
- ✅ History with filters, and "Correct this entry"
- ✅ Works offline
- ⏳ Not yet: phone (Phase 2), Microsoft sign-in (3), Excel sync (4), timer (5), charts (6)

**Your data is currently stored only in the browser on this computer.** It is not yet copied to
Excel or OneDrive. Treat Phase 1 as a test: don't log important time yet.

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
version, use this instead and open **http://localhost:4173**:

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
| `src/ui/` | The three screens: Log time, Projects, History |
| `tests/` | Automated checks |
