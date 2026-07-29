import { cn } from "@/lib/utils";

/** Small uppercase eyebrow with a short leading rule. */
export function SectionLabel({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("eyebrow", className)}>
      <span className="h-px w-6 bg-primary/60" aria-hidden />
      {children}
    </div>
  );
}
