import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 text-center text-foreground">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 40%, hsl(var(--primary) / 0.12), transparent)" }}
        aria-hidden
      />
      <div className="relative">
        <Logo markClassName="h-12" className="mx-auto scale-110" />
        <p className="mt-10 font-display text-7xl font-extrabold tracking-tight text-primary">404</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-foreground">
          This path does not connect.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          The page you are looking for is not here. Let us bridge you back to solid ground.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to PayBridge
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
