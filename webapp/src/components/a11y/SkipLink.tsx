import { useT } from "@/lib/prefs/PreferencesProvider";

/**
 * "Go straight to the main part" — the first thing in the tab order (WCAG 2.4.1).
 *
 * Invisible until focused, then a solid teal button at the top-left. It is a real
 * <a href="#pb-main">, not a scroll handler, so it also moves the screen reader's
 * cursor and not just the viewport — the difference between skipping the header
 * and merely scrolling past it.
 *
 * The target must be the page's <main id="pb-main" tabIndex={-1}>. Without the
 * negative tabindex, a browser scrolls to the element but leaves focus on the
 * link, so the next Tab goes back into the header the person just skipped.
 */
export function SkipLink({ targetId = "pb-main" }: { targetId?: string }) {
  const t = useT();
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:inline-flex focus:min-h-[44px] focus:items-center focus:rounded-xl focus:bg-primary focus:px-4 focus:text-sm focus:font-bold focus:text-primary-foreground focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[hsl(var(--ring))]"
    >
      {t("common.skip_to_content")}
    </a>
  );
}
