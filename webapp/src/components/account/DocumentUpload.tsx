import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadKycDocument } from "@/lib/account/session";
import { KYC_DOC_LABELS, type KycDocType, type KycDocumentSummary } from "../../../../backend/src/types";

/**
 * A real document upload — one control per document type.
 *
 * Distinct from `UploadDropzone` in components/dashboard/forms.tsx, which
 * simulates uploads for the demonstration dashboards. This one posts the bytes
 * to the server, which checks the file's magic bytes before accepting it: the
 * browser-supplied type on the `accept` attribute below is a convenience for the
 * file picker, not a control.
 */

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MAX_BYTES = 8 * 1024 * 1024;

function sizeLabel(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUpload({
  docType,
  required,
  existing,
  disabled,
}: {
  docType: KycDocType;
  required: boolean;
  existing?: KycDocumentSummary;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const upload = useUploadKycDocument();
  const [error, setError] = useState<string | null>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Checked here as well as on the server so an 8 MB upload is not sent only
    // to be refused. The server's limit is the one that counts.
    if (file.size > MAX_BYTES) {
      setError("That file is larger than 8 MB. Please upload a smaller photo or PDF.");
      return;
    }
    try {
      await upload.mutateAsync({ docType, file });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be uploaded.");
    }
  };

  const done = Boolean(existing);

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        done ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-background",
        error && "border-destructive/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {KYC_DOC_LABELS[docType]}
            {required ? null : <span className="text-xs font-medium text-muted-foreground">Optional</span>}
          </p>
          {existing ? (
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{existing.fileName}</span>
              <span className="shrink-0">· {sizeLabel(existing.sizeBytes)}</span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP or PDF · up to 8 MB</p>
          )}
        </div>
        {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : null}
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          // Reset so re-picking the same file fires a change event again.
          event.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={disabled || upload.isPending}
        onClick={() => input.current?.click()}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-55"
      >
        {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
        {upload.isPending ? "Uploading…" : done ? "Replace file" : "Choose file"}
      </button>

      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {existing?.rejectionReason ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {existing.rejectionReason}
        </p>
      ) : null}
    </div>
  );
}
