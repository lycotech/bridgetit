/**
 * File upload validation.
 *
 * WHAT WAS WRONG
 * The upload control accepted whatever the user dropped. Its only filter was
 * the HTML `accept` attribute — which is a file-picker *hint*, not a control:
 * it is bypassed entirely by drag-and-drop, by choosing "All files" in the OS
 * dialog, and by any scripted call. The UI advertised "up to 10MB" while
 * nothing enforced a size at all.
 *
 * WHY THIS MATTERS ON THIS PRODUCT SPECIFICALLY
 * The dropzone is used for payroll files, buffer documents and KYC evidence —
 * the three highest-value ingestion points in the platform. The realistic
 * attacks are:
 *
 *   - Malware relay: an .exe/.js/.html renamed to payroll.csv, stored by us and
 *     later downloaded by an operations reviewer. We become the distribution
 *     channel and the trusted source.
 *   - Stored XSS by upload: an uploaded .html or .svg served back from our own
 *     origin executes with our cookies. SVG is the one people forget — it is an
 *     image format that can carry <script>.
 *   - Decompression / oversize DoS: a multi-gigabyte "CSV" that exhausts memory
 *     during parsing.
 *   - Path traversal via filename: "../../etc/passwd" or a name containing NUL
 *     or newline characters, which breaks naive server-side path joins.
 *
 * DESIGN DECISIONS
 *
 * 1. Allowlist extensions AND declared MIME types. Never a denylist — a
 *    denylist has to predict every dangerous extension (.phtml, .cshtml, .svgz)
 *    and will always be one entry behind.
 *
 * 2. Check the DECLARED type here, but state plainly that it is not
 *    authoritative. `file.type` comes from the browser's guess based on the
 *    extension; an attacker controls it. Real content-type verification means
 *    reading the leading bytes (magic numbers) server-side, which is where the
 *    file is actually stored. This module does the cheap client-side pass so
 *    users get instant feedback; the server must repeat every check.
 *
 * 3. Sanitise the filename to a safe basename. The name is user input that ends
 *    up in a path, a Content-Disposition header and a UI label — three separate
 *    injection surfaces.
 *
 * 4. Explicit per-file and per-batch size caps, matching what the UI promises.
 */

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — matches the UI copy
export const MAX_BATCH_BYTES = 40 * 1024 * 1024;
export const MAX_BATCH_FILES = 10;

/** Extension → the MIME types we are willing to see declared for it. */
const ALLOWED: Record<string, string[]> = {
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", ""],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ""],
  xls: ["application/vnd.ms-excel", ""],
  pdf: ["application/pdf", ""],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
};

/**
 * Extensions that are refused no matter what the allowlist says.
 *
 * WHY keep a denylist as well as an allowlist: defence in depth against a
 * double extension ("payroll.csv.html"). The allowlist reads the LAST
 * extension, so this is belt and braces for the case where someone later
 * widens the allowlist without thinking it through. SVG is listed explicitly
 * because it is the image format that executes script.
 */
const ALWAYS_BLOCKED = [
  "exe", "dll", "bat", "cmd", "com", "scr", "msi", "ps1", "sh", "bash",
  "js", "mjs", "jsx", "vbs", "jar", "app", "dmg", "deb", "rpm",
  "html", "htm", "xhtml", "svg", "svgz", "xml", "xsl", "phtml", "php",
  "asp", "aspx", "jsp", "cshtml", "hta", "lnk", "iso",
];

export interface FileRejection {
  fileName: string;
  reason: string;
}

export interface UploadValidation {
  accepted: File[];
  rejected: FileRejection[];
}

/**
 * Reduce a user-supplied filename to a safe display/storage basename.
 *
 * Strips any directory component (both / and \ so a Windows path cannot slip
 * through), removes control characters, collapses the characters commonly used
 * for traversal and injection, and caps the length.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

export function sanitiseFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .replace(CONTROL_CHARS, "")
    .replace(/[<>:"|?*]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "")
    .trim();
  const safe = cleaned.length ? cleaned : "file";
  return safe.length > 120 ? `${safe.slice(0, 110)}…${safe.slice(-8)}` : safe;
}

function extensionOf(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function validateFiles(
  list: FileList | File[],
  options?: { allowedExtensions?: string[]; maxFileBytes?: number },
): UploadValidation {
  const files = Array.from(list);
  const maxFile = options?.maxFileBytes ?? MAX_FILE_BYTES;
  const allowedExts = options?.allowedExtensions ?? Object.keys(ALLOWED);

  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  let batchBytes = 0;

  for (const file of files) {
    const name = sanitiseFileName(file.name);
    const ext = extensionOf(name);

    if (accepted.length >= MAX_BATCH_FILES) {
      rejected.push({ fileName: name, reason: `Only ${MAX_BATCH_FILES} files at a time` });
      continue;
    }
    if (!ext) {
      rejected.push({ fileName: name, reason: "File has no extension" });
      continue;
    }
    if (ALWAYS_BLOCKED.includes(ext)) {
      rejected.push({ fileName: name, reason: "This file type is not allowed for security reasons" });
      continue;
    }
    if (!allowedExts.includes(ext)) {
      rejected.push({ fileName: name, reason: `Only ${allowedExts.join(", ").toUpperCase()} files` });
      continue;
    }

    // Declared MIME must be consistent with the extension. Not authoritative
    // (the browser derives it from the extension), but it costs nothing and
    // catches the lazy rename.
    const permittedTypes = ALLOWED[ext];
    if (permittedTypes && !permittedTypes.includes(file.type)) {
      rejected.push({ fileName: name, reason: "File content does not match its extension" });
      continue;
    }

    if (file.size === 0) {
      rejected.push({ fileName: name, reason: "File is empty" });
      continue;
    }
    if (file.size > maxFile) {
      rejected.push({
        fileName: name,
        reason: `File is larger than ${Math.round(maxFile / (1024 * 1024))}MB`,
      });
      continue;
    }
    if (batchBytes + file.size > MAX_BATCH_BYTES) {
      rejected.push({ fileName: name, reason: "Total upload size is too large" });
      continue;
    }

    batchBytes += file.size;
    accepted.push(file);
  }

  return { accepted, rejected };
}
