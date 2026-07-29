import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { adminApi, adminKeys } from "@/lib/admin";
import { ApiError } from "@/lib/api";

/**
 * The staff username/password form on its own, with no surrounding page.
 *
 * Extracted so the full-page sign-in at /paybridge-admin and the inline unlock
 * inside the Operations dashboard are the SAME form. If they were two copies,
 * the day someone adds a second factor is the day one of the two entrances
 * silently keeps working without it.
 *
 * Deliberately plain: no "forgot password", no hint about what is behind it, and
 * one identical failure message for a wrong username, a wrong password and an
 * unconfigured deployment. The server rate-limits to five attempts per fifteen
 * minutes; the UI reports what the server says rather than inventing a counter.
 */
export function AdminCredentialsForm({ idPrefix = "admin" }: { idPrefix?: string }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () => adminApi.login(username.trim(), password),
    onSuccess: async () => {
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: adminKeys.session });
    },
  });

  const error = login.error;
  const message =
    error instanceof ApiError
      ? error.status === 429
        ? "Too many attempts. Wait a few minutes and try again."
        : error.status === 503
          ? "Admin access is not configured on this deployment."
          : "Those details were not recognised."
      : error
        ? "We could not sign you in. Please try again."
        : null;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (username.trim() && password) login.mutate();
      }}
    >
      <div>
        <Label htmlFor={`${idPrefix}-username`}>Username</Label>
        <Input
          id={`${idPrefix}-username`}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          spellCheck={false}
          className="mt-2 h-11 rounded-xl bg-secondary/40"
        />
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-password`}>Password</Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mt-2 h-11 rounded-xl bg-secondary/40"
        />
      </div>

      {message ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {message}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={login.isPending || !username.trim() || !password}
        className="h-11 w-full rounded-full btn-brand text-sm font-semibold"
      >
        {login.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
