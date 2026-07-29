import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Menu, ArrowLeft } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";

/**
 * Internal brand preview for the refined PayBridge mark — the "continuous
 * path". Shows the selected symbol across the contexts it must survive:
 * mobile header, app icon, favicon sizes, social avatar, light/navy
 * backgrounds and single-colour (monochrome) use.
 */
function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-card/60 p-6">
        {children}
      </div>
    </div>
  );
}

export default function Brand() {
  return (
    <div className="min-h-screen bg-background px-5 py-16 text-foreground md:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to site
        </Link>

        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Brand mark
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          An arched bridge deck spanning four upright pillars, with the second pillar in gold —
          continuity and support expressed as one calm, balanced structure. Shown here across the
          contexts it must survive: mobile header, app icon, favicon sizes, social avatar,
          light/navy backgrounds and single-colour use.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Mobile header */}
          <Tile label="Mobile header">
            <div className="flex w-full items-center justify-between rounded-xl bg-[#0A1B2E] px-4 py-3">
              <Logo markClassName="h-7" />
              <Menu className="h-5 w-5 text-[#F4F1EA]" />
            </div>
          </Tile>

          {/* App icon */}
          <Tile label="App icon">
            <div className="flex h-24 w-24 items-center justify-center rounded-[22px] bg-[#0A1B2E] text-[#F4F1EA] shadow-lg">
              <LogoMark className="h-12" />
            </div>
          </Tile>

          {/* Social avatar */}
          <Tile label="Social avatar">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#0A1B2E] text-[#F4F1EA] shadow-lg">
              <LogoMark className="h-11" />
            </div>
          </Tile>

          {/* Favicon sizes */}
          <Tile label="Favicon · 16 / 32 px">
            <div className="flex items-end gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0A1B2E] text-[#F4F1EA]">
                <LogoMark className="h-5" />
              </div>
              <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#0A1B2E] text-[#F4F1EA]">
                <LogoMark className="h-2.5" />
              </div>
            </div>
          </Tile>

          {/* White background */}
          <Tile label="White background">
            <div className="flex h-24 w-full items-center justify-center rounded-xl bg-white text-[#0A1B2E]">
              <Logo markClassName="h-8" className="[&_span]:text-[#0A1B2E]" />
            </div>
          </Tile>

          {/* Navy background */}
          <Tile label="Navy background">
            <div className="flex h-24 w-full items-center justify-center rounded-xl bg-[#0A1B2E] text-[#F4F1EA]">
              <Logo markClassName="h-8" />
            </div>
          </Tile>

          {/* Monochrome — light */}
          <Tile label="Monochrome · light">
            <div className="flex h-24 w-full items-center justify-center rounded-xl bg-white text-[#0A1B2E]">
              <LogoMark className="h-10" monochrome />
            </div>
          </Tile>

          {/* Monochrome — dark */}
          <Tile label="Monochrome · dark">
            <div className="flex h-24 w-full items-center justify-center rounded-xl bg-[#0A1B2E] text-[#F4F1EA]">
              <LogoMark className="h-10" monochrome />
            </div>
          </Tile>

          {/* Reversed / single accent */}
          <Tile label="Single colour · green">
            <div className="flex h-24 w-full items-center justify-center rounded-xl bg-white text-primary">
              <LogoMark className="h-10" monochrome />
            </div>
          </Tile>
        </div>
      </div>
    </div>
  );
}
