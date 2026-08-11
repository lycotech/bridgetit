import { useEffect } from "react";
import { Navbar } from "@/components/sections/Navbar";
import { Hero } from "@/components/sections/Hero";
import { PaydayGap } from "@/components/sections/PaydayGap";
import { BridgeIt } from "@/components/sections/BridgeIt";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { WhoItServes } from "@/components/sections/WhoItServes";
import { BeyondBridge } from "@/components/sections/BeyondBridge";
import { OnePayroll } from "@/components/sections/OnePayroll";
import { PayrollFit } from "@/components/sections/PayrollFit";
import { PayBridgeAccount } from "@/components/sections/PayBridgeAccount";
import { EmployerStory } from "@/components/sections/EmployerStory";
import { HrPrivacy } from "@/components/sections/HrPrivacy";
import { Manifesto } from "@/components/sections/Manifesto";
import { Trust } from "@/components/sections/Trust";
import { GetOnTheBridgeSection } from "@/components/sections/GetOnTheBridgeSection";
import { Faqs } from "@/components/sections/Faqs";
import { Footer } from "@/components/sections/Footer";
import { StickyCta } from "@/components/sections/StickyCta";
import { captureAttribution, initScrollDepthTracking } from "@/lib/analytics";
import { SkipLink } from "@/components/a11y/SkipLink";

const Index = () => {
  useEffect(() => {
    captureAttribution();
    const cleanup = initScrollDepthTracking();

    // Support deep links like /#waitlist from other pages.
    if (window.location.hash) {
      const id = window.location.hash;
      window.setTimeout(() => {
        document.querySelector(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }

    return cleanup;
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <Navbar />
      <main id="pb-main" tabIndex={-1} className="outline-none">
        <Hero />
        <PaydayGap />
        <BridgeIt />
        <HowItWorks />
        <WhoItServes />
        <BeyondBridge />
        <OnePayroll />
        <PayrollFit />
        <PayBridgeAccount />
        <EmployerStory />
        <HrPrivacy />
        <Manifesto />
        <Trust />
        <GetOnTheBridgeSection />
        <Faqs />
      </main>
      <Footer />
      <StickyCta />
    </div>
  );
};

export default Index;
