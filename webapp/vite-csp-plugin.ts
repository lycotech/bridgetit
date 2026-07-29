import { createHash } from "node:crypto";
import type { Plugin } from "vite";

/**
 * Content Security Policy for the PayBridge web app.
 *
 * WHY A CSP AT ALL
 * A CSP is the last line of defence against cross-site scripting. React escapes
 * interpolated text, so this app has no obvious XSS today — but "no XSS today"
 * is a statement about the current 200 files, not about the next dependency
 * upgrade, the next `dangerouslySetInnerHTML`, or a compromised npm package in
 * a build with 34 known-vulnerable transitive dependencies. CSP is what turns
 * "an attacker got script into the page" into "the browser refused to run it".
 *
 * WHY EACH DIRECTIVE IS SET THE WAY IT IS — including where we compromised.
 *
 * default-src 'self'
 *   Deny-by-default for anything not named below. Every relaxation after this
 *   line is a deliberate, listed exception.
 *
 * script-src 'self' + sha256 hashes of our own inline scripts
 *   The important one. No 'unsafe-inline', no 'unsafe-eval' in production, so
 *   an injected <script> or an inline event handler will not execute. The only
 *   inline script we ship is the JSON-LD organisation block in index.html; this
 *   plugin hashes it at build time so it keeps working without opening the
 *   directive up. Hashes are computed from the built output, so they cannot
 *   drift from the content.
 *
 * style-src 'self' 'unsafe-inline'  ← DELIBERATE COMPROMISE, documented
 *   We cannot drop 'unsafe-inline' for styles without breaking the product:
 *   shadcn's chart component injects a <style> element at runtime for CSS
 *   variables, Radix positions popovers/tooltips via inline styles, and
 *   Framer Motion animates through the style attribute. Hashes cannot cover
 *   styles generated at runtime.
 *   Residual risk accepted: CSS injection can be used for data exfiltration by
 *   attribute selectors, and for UI redressing. Both require an injection point
 *   the script-src directive would already have to have let through, and both
 *   are far less severe than script execution. Revisit if the chart component
 *   is replaced.
 *
 * img-src 'self' data: https:
 *   Avatars, generated data: URIs, and remote imagery (Unsplash). Images cannot
 *   execute, so a broad image policy is low risk. `blob:` is included for
 *   client-side chart/CSV downloads.
 *
 * connect-src 'self' + the Vibecode API hosts
 *   Restricts where fetch/XHR/WebSocket may go. This is the directive that
 *   limits data EXFILTRATION: even if script somehow runs, it cannot POST the
 *   payroll data it just read to an attacker's collector.
 *
 * font-src 'self' data: https://fonts.gstatic.com
 * frame-src 'none' / object-src 'none'
 *   No plugins, no nested browsing contexts. `object-src 'none'` closes the
 *   legacy Flash/PDF-embed script vectors.
 *
 * base-uri 'none'
 *   Stops an injected <base href="https://evil.example/"> silently re-pointing
 *   every relative script and asset URL on the page. Commonly forgotten, and it
 *   defeats an otherwise-correct script-src.
 *
 * form-action 'self'
 *   An injected <form action="https://evil.example"> cannot post credentials
 *   off-site.
 *
 * frame-ancestors — NOT SETTABLE IN A META TAG
 *   Browsers ignore frame-ancestors when it arrives via <meta>. It must be an
 *   HTTP response header, which is why public/_headers exists alongside this
 *   plugin. That file is also where X-Frame-Options and HSTS live.
 */

export interface CspOptions {
  /** Development needs 'unsafe-inline'/'unsafe-eval' for Vite HMR and React Refresh. */
  dev: boolean;
}

function buildCsp(hashes: string[], options: CspOptions): string {
  const scriptSrc = options.dev
    ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Vite dev client + React Refresh
    : ["'self'", ...hashes];

  const connectSrc = options.dev
    ? ["'self'", "ws:", "wss:", "http:", "https:"] // HMR websocket + proxy
    : // Production API calls are relative (/api/...), proxied to the Render
      // backend by webapp/vercel.json — same-origin from the browser's view,
      // so 'self' is sufficient.
      ["'self'"];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(options.dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Vite plugin: hash our inline scripts and inject the policy as a meta tag.
 *
 * WHY a meta tag AND public/_headers: the meta tag travels with the HTML, so
 * the policy applies even on a static host that ignores custom headers — no
 * silent "we thought CSP was on" failure. The headers file adds the directives
 * a meta tag cannot express (frame-ancestors, HSTS) and takes precedence where
 * the host supports it.
 */
export function cspPlugin(options: CspOptions): Plugin {
  return {
    name: "paybridge-csp",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        // Hash every inline <script> that survives into the built HTML.
        const hashes: string[] = [];
        const scriptRe = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;
        let match: RegExpExecArray | null;
        while ((match = scriptRe.exec(html)) !== null) {
          const body = match[1];
          if (!body.trim()) continue;
          hashes.push(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
        }

        return {
          html,
          tags: [
            {
              tag: "meta",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content: buildCsp(hashes, options),
              },
              injectTo: "head-prepend",
            },
            /*
             * Referrer-Policy as a meta tag.
             * WHY: dashboard URLs contain employer and employee identifiers.
             * The browser default (strict-origin-when-cross-origin) still sends
             * our origin to third parties; "same-origin" sends nothing at all
             * off-site, which is the correct posture for a payroll product.
             */
            {
              tag: "meta",
              attrs: { name: "referrer", content: "same-origin" },
              injectTo: "head-prepend",
            },
          ],
        };
      },
    },
    /** Serve the same policy as real headers in dev, so violations surface early. */
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader("Content-Security-Policy", buildCsp([], { dev: true }));
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "same-origin");
        next();
      });
    },
  };
}

export { buildCsp };
