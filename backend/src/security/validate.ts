import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";

/**
 * `zValidator` with our error envelope and without the stack-trace-shaped body.
 *
 * WHY not use `zValidator` directly: its default failure response is the raw
 * `ZodError`, serialised. That is a JSON dump of every rule that failed,
 * including each field's regex source and internal Zod codes. Two problems with
 * shipping it to a browser:
 *
 *   1. It breaks the response contract. Every other error in this API is
 *      `{ error: { message, code } }`, so a client needs a second code path just
 *      for validation failures — and the SPA's error handler, which reads
 *      `error.message`, silently shows nothing.
 *   2. It is free reconnaissance. `"pattern": "/[A-Z]/"` tells an attacker the
 *      exact password composition rules; the field paths enumerate the schema.
 *      None of that helps a real user, who needs one sentence about what to fix.
 *
 * So: the first message is returned, with the field it belongs to, and nothing
 * else. The messages in src/types.ts are written to be read by a person for
 * exactly this reason.
 */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (result.success) return;

    const first = result.error.issues[0];
    const field = first?.path.filter((p) => typeof p !== "symbol").join(".") || undefined;

    return c.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: first?.message ?? "Check the details you entered and try again.",
          field,
        },
      },
      400,
    );
  });
}
