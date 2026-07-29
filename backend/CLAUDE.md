<stack>
  Node.js runtime (via tsx), Hono web framework, Zod validation.
</stack>

<structure>
  src/index.ts     — App entry, middleware, route mounting
  src/routes/      — Route modules (create as needed)
</structure>

<routes>
  Create routes in src/routes/ and mount them in src/index.ts.

  Example route file (src/routes/todos.ts):
  ```typescript
  import { Hono } from "hono";
  import { zValidator } from "@hono/zod-validator";
  import { z } from "zod";

  const todosRouter = new Hono();

  todosRouter.get("/", (c) => {
    return c.json({ todos: [] });
  });

  todosRouter.post(
    "/",
    zValidator("json", z.object({ title: z.string() })),
    (c) => {
      const { title } = c.req.valid("json");
      return c.json({ todo: { id: "1", title } });
    }
  );

  export { todosRouter };
  ```

  Mount in src/index.ts:
  ```typescript
  import { todosRouter } from "./routes/todos";
  app.route("/api/todos", todosRouter);
  ```

  IMPORTANT: Make sure all endpoints and routes are prefixed with `/api/`
</routes>

<shared_types>
  Define all API contracts in src/types.ts as Zod schemas.
  This file is the single source of truth — both backend and frontend import from here.
</shared_types>

<curl_testing>
  ALWAYS test APIs with cURL after implementing.
  Use $BACKEND_URL environment variable, never localhost.
  Verify response matches the Zod schema before telling frontend it's ready.
</curl_testing>

<database>
  Prisma + PostgreSQL (Neon). `DATABASE_URL` (pooled) and `DIRECT_URL` (unpooled,
  for migrations) come from the environment — see backend/.env.example.
  - Schema: prisma/schema.prisma (model WaitlistEntry, among many others)
  - Client: src/db.ts (singleton `prisma`)
  - Route: src/routes/waitlist.ts (POST /api/waitlist — validates with src/types.ts,
    idempotent on duplicate email, captures UTM/referrer attribution)
  Local dev after a schema edit: `npx prisma generate && npx prisma migrate dev`.
  Production deploys run `npx prisma migrate deploy` (see backend/render.yaml) —
  never `db push` against production data.
</database>