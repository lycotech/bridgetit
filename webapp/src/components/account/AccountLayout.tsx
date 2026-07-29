import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useSession, useSignOut } from "@/lib/account/session";
import { SkipLink } from "@/components/a11y/SkipLink";

/**
 * Shell for the signed-in customer area.
 *
 * Deliberately plain: it carries the brand, the account's own name and a sign-out
 * control, and nothing else. There is no navigation to financial features here,
 * because at every gate this layout is used for, the customer has none.
 */
export function AccountLayout({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const signOut = useSignOut();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <header className="border-b border-border">
        <div className="mx-auto flex h-20 max-w-4xl items-center justify-between gap-4 px-5 md:px-8">
          <Link to="/" aria-label="PayBridge home">
            <Logo className="h-9" />
          </Link>
          <div className="flex items-center gap-3">
            {session?.user ? (
              <span className="hidden text-sm text-muted-foreground sm:block">{session.user.email}</span>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut.mutateAsync().then(() => navigate("/", { replace: true }))}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main id="pb-main" tabIndex={-1} className="mx-auto max-w-4xl px-5 py-10 outline-none md:px-8 md:py-14">
        <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
        <div className="mt-8 space-y-6">{children}</div>
      </main>
    </div>
  );
}
