import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionButton } from "./PageHeader";

/**
 * Lightweight modal. Kept in-house (rather than a Radix dialog) so the sheet
 * behaviour on mobile — bottom-anchored, full width — stays predictable.
 *
 * WHAT THIS DOES THAT THE FIRST VERSION DID NOT, all of it WCAG 2.1.2 / 2.4.3:
 *
 *   • Escape closes it. A person navigating by keyboard had no way out before.
 *   • Focus MOVES INTO the dialog when it opens and RETURNS to the control that
 *     opened it when it closes. Without the return, focus falls back to the top
 *     of the document and somebody re-tabs through the whole page to get back to
 *     where they were.
 *   • Tab is trapped inside. A screen-reader user could otherwise tab out into
 *     the page behind, which `aria-modal` tells them is not there — the worst
 *     kind of bug, because the words being read no longer match the reality.
 *   • The backdrop is an inert <div>, not a <button>. It was previously the FIRST
 *     tab stop, labelled "Close", so the first thing anybody keyboarding into a
 *     dialog met was an invisible full-screen dismiss button.
 *   • The heading is the accessible name via aria-labelledby, and the description
 *     is announced with it, rather than being duplicated into an aria-label.
 *   • The page behind cannot scroll while it is open, so a dropped touch does not
 *     move the content underneath.
 */

/** Everything reachable by Tab, in DOM order. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "default" | "wide";
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  /* Remember who opened this, move focus in, and give it back on the way out. */
  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement as HTMLElement | null;

    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    // The dialog itself if there is nothing inside to focus: the title is then
    // read, which beats focus staying on a button behind the backdrop.
    (first ?? dialogRef.current)?.focus();

    return () => {
      const target = returnFocusTo.current;
      // Only if it is still on the page — the control that opened the dialog may
      // have been the row that this dialog just deleted.
      if (target && document.contains(target)) target.focus();
    };
  }, [open]);

  /* Nothing behind it scrolls while it is open. */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (item) => item.offsetParent !== null || item === document.activeElement,
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      // Wrap at both ends. Shift+Tab from the first goes to the last, not out.
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
      {/* Inert: dismisses on a press but is not a tab stop and is not announced.
          The close button in the header is the accessible way out. */}
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card shadow-2xl outline-none sm:rounded-3xl",
          size === "wide" ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-bold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children ? <div className="px-5 py-4">{children}</div> : null}
        {footer ? (
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2.5 border-t border-border/70 bg-card px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading,
  tone = "primary",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: "primary" | "danger";
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <ActionButton variant="secondary" onClick={onClose}>
            {cancelLabel}
          </ActionButton>
          <ActionButton variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </ActionButton>
        </>
      }
    >
      {children}
    </Modal>
  );
}
