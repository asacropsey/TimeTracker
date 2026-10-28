// Reading and writing the Excel file timetracker.xlsx (with the ExcelJS library).
// This file only knows about sheets, rows and cells – the sync rules live in engine.ts.

import ExcelJS from 'exceljs';
import type { AppState } from '../types';

export const ENTRY_COLUMNS = [
  'seq', 'event_id', 'device', 'created_at', 'project_id', 'milestone_id', 'start', 'end',
  'duration_minutes', 'note', 'entry_type', 'corrects_event_id', 'synced_at', 'prev_hash', 'row_hash',
];
export const CHANGE_COLUMNS = [
  'seq', 'event_id', 'device', 'created_at', 'action', 'record_id', 'field', 'old_value', 'new_value',
  'prev_hash', 'row_hash',
];
const NUMBER_COLUMNS = new Set(['seq', 'duration_minutes']); // stored as numbers so Excel can add them up

export type LogSheet = 'Entries' | 'ChangeLog';
export const LOG_SHEETS: LogSheet[] = ['Entries', 'ChangeLog'];
export const columnsOf = (sheet: LogSheet) => (sheet === 'Entries' ? ENTRY_COLUMNS : CHANGE_COLUMNS);

/** One row as texts, by column name (numbers become texts like "90"). */
export type Row = Record<string, string>;

const INFO_TEXT = [
  'Time Tracker – data file',
  '',
  'This file is written by the Time Tracker app. Please read before changing anything.',
  '',
  'Entries – every block of time ever recorded, and every correction. Permanent record: DO NOT EDIT.',
  'ChangeLog – every change to projects and milestones. Permanent record: DO NOT EDIT.',
  'Projects – overview of the current projects. Rebuilt by the app on every sync.',
  'Milestones – overview of the current milestones. Rebuilt by the app on every sync.',
  '',
  'Rows are only ever added, never changed. Mistakes are fixed in the app with "Correct this entry".',
  'Each row carries a fingerprint (row_hash) linked to the row before it (prev_hash).',
  'If a row in Entries or ChangeLog is edited or removed, the app stops syncing and',
  '"Verify data" (Account tab) shows which row was affected. Your new entries stay safe on your devices.',
  '',
  'Sheet protection (no password) only prevents accidental typing.',
  'Backups of earlier versions are in the "backups" folder next to this file (the last 30 are kept).',
];

/** A new, empty file with all five sheets. */
export function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Time Tracker';
  const info = wb.addWorksheet('Info');
  info.getColumn(1).width = 110;
  INFO_TEXT.forEach((line, i) => {
    const cell = info.getCell(i + 1, 1);
    cell.value = line;
    if (i === 0) cell.font = { bold: true, size: 14 };
  });
  addSheet(wb, 'Projects', ['project_id', 'name', 'description', 'status']);
  addSheet(wb, 'Milestones', ['milestone_id', 'project_id', 'name', 'planned_hours', 'order', 'status', 'done_at']);
  addSheet(wb, 'Entries', ENTRY_COLUMNS);
  addSheet(wb, 'ChangeLog', CHANGE_COLUMNS);
  return wb;
}

function addSheet(wb: ExcelJS.Workbook, name: string, columns: string[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c, key: c, width: c.endsWith('_id') || c.endsWith('hash') ? 38 : 18 }));
  ws.getRow(1).font = { bold: true };
}

export async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb;
}

export async function workbookBytes(wb: ExcelJS.Workbook): Promise<Uint8Array> {
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

/** Turns whatever is in a cell into plain text, so it can be compared and fingerprinted. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'richText' in value) return value.richText.map((t) => t.text).join('');
  if (typeof value === 'object' && 'result' in value) return `=${String(value.result ?? '')}`; // a formula: never ours
  if (typeof value === 'object' && 'text' in value) return String(value.text);
  return JSON.stringify(value);
}

/** Reads a log sheet: the header row and all filled rows below it (with their Excel row numbers). */
export function readLog(wb: ExcelJS.Workbook, sheet: LogSheet): { header: string[]; rows: Row[]; rowNumbers: number[] } | null {
  const ws = wb.getWorksheet(sheet);
  if (!ws) return null;
  const columns = columnsOf(sheet);
  const header = columns.map((_, i) => cellText(ws.getRow(1).getCell(i + 1).value));
  const rows: Row[] = [];
  const rowNumbers: number[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const r: Row = {};
    columns.forEach((c, i) => (r[c] = cellText(row.getCell(i + 1).value)));
    rows.push(r);
    rowNumbers.push(n);
  });
  return { header, rows, rowNumbers };
}

/** Adds rows at the bottom of a log sheet. Existing rows are never touched. */
export function appendLogRows(wb: ExcelJS.Workbook, sheet: LogSheet, rows: Row[]) {
  const ws = wb.getWorksheet(sheet)!;
  for (const r of rows) {
    ws.addRow(columnsOf(sheet).map((c) => (NUMBER_COLUMNS.has(c) && r[c] !== '' ? Number(r[c]) : r[c])));
  }
}

/** Protects Entries and ChangeLog against accidental typing (no password). */
export async function protectLogSheets(wb: ExcelJS.Workbook) {
  for (const sheet of LOG_SHEETS) {
    await wb.getWorksheet(sheet)!.protect('', { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true });
  }
}

/** Rebuilds the easy-to-read Projects and Milestones sheets from the current state. */
export function writeOverviewSheets(wb: ExcelJS.Workbook, state: AppState) {
  const projects = wb.getWorksheet('Projects')!;
  projects.spliceRows(2, Math.max(projects.rowCount - 1, 0));
  for (const p of state.projects) projects.addRow([p.project_id, p.name, p.description, p.status]);

  const milestones = wb.getWorksheet('Milestones')!;
  milestones.spliceRows(2, Math.max(milestones.rowCount - 1, 0));
  for (const m of state.milestones) {
    milestones.addRow([m.milestone_id, m.project_id, m.name, m.planned_hours, m.order, m.status, m.done_at]);
  }
}
