import { SegmentChooser } from "@/components/registration/SegmentChooser";

/**
 * The homepage conversion section. It replaces the old single waitlist form.
 *
 * WHY the change: one undifferentiated form cannot tag a segment, cannot route
 * to the right inbox and cannot say the right thing back to the person who
 * filled it in. An employee, an HR lead and a capital partner need different
 * questions and different answers, so the fork happens before the form.
 *
 * The `waitlist` id is kept as an anchor so existing /#waitlist links, emails
 * and adverts still land in the right place.
 */
export function GetOnTheBridgeSection() {
  return (
    <section
      id="get-on-the-bridge"
      className="section relative overflow-hidden border-t border-border scroll-mt-20"
    >
      <span id="waitlist" className="sr-only" aria-hidden />

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full blur-[130px]"
          style={{
            background: "radial-gradient(closest-side, hsl(var(--primary) / 0.16), transparent)",
          }}
        />
        {/* This is the section where you actually cross, so the warm companion
            sits low and to the right — the far bank of the same fold. */}
        <div
          className="absolute -bottom-24 right-[-6rem] h-[440px] w-[520px] rounded-full blur-[140px]"
          style={{
            background: "radial-gradient(closest-side, hsl(var(--gold) / 0.14), transparent)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 md:px-8">
        <SegmentChooser />
      </div>
    </section>
  );
}
