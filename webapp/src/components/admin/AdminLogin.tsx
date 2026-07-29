import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { AdminCredentialsForm } from "@/components/admin/AdminCredentialsForm";

/**
 * Full-page sign-in for the internal dashboard at /paybridge-admin.
 *
 * The form itself lives in AdminCredentialsForm, shared with the inline unlock
 * inside the Operations dashboard.
 */
export function AdminLogin() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-20 max-w-5xl items-center px-5 md:px-8">
          <Link to="/" aria-label="PayBridge home">
            <Logo className="h-9" />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl border border-border bg-card/70 p-7 shadow-2xl sm:p-9">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <ShieldCheck className="h-5 w-5" />
            </span>

            <h1 className="mt-6 font-display text-2xl font-extrabold text-foreground">
              PayBridge internal
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Authorised team members only. Sign-ins and actions taken here are recorded.
            </p>

            <div className="mt-8">
              <AdminCredentialsForm idPrefix="admin" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
