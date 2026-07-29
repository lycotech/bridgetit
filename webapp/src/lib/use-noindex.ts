import { useEffect } from "react";

/**
 * Marks the current view as non-indexable for as long as it is mounted.
 *
 * WHY a hook and not a line in index.html: the public marketing site MUST stay
 * indexable and the demo MUST NOT be, and they are the same document in a
 * single-page app. Adding the tag on mount and removing it on unmount is the
 * only way to have both.
 *
 * WHY this is not the whole defence: a crawler that does not execute JavaScript
 * never sees the tag. The real exclusions are robots.txt, the absence of the
 * route from sitemap.xml, the absence of any public link to it, and — above all
 * — the fact that the server will not serve demo data without a session.
 */
export function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex, nofollow, noarchive, nosnippet, noimageindex");
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
}
