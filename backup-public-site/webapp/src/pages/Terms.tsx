import { PageShell, LegalBlock } from "@/components/sections/PageShell";

const Terms = () => (
  <PageShell
    title="Terms of Use"
    updated="23 July 2026"
    intro="These terms govern your use of this website while PayBridge is in development. They are written to be clear and honest about what PayBridge is today."
  >
    <LegalBlock heading="A product in development">
      <p>
        PayBridge is currently being developed. Features, eligibility, pricing and partner services
        described on this site are indicative and may change before launch. Nothing on this website
        is an offer of credit, a financial product or a guarantee of eligibility or access.
      </p>
    </LegalBlock>

    <LegalBlock heading="How PayBridge is intended to work">
      <p>
        The ability to bridge earned income will be subject to employer participation, verification,
        eligibility, approved limits, charges and applicable terms. PayBridge is designed to give
        eligible employees access to an approved portion of verified income already earned—not a
        full salary every day, and not unlimited funds.
      </p>
    </LegalBlock>

    <LegalBlock heading="Waitlist">
      <p>
        Joining the waitlist registers your interest. It does not create any account, entitlement
        or obligation, and it does not guarantee that PayBridge will be available to you.
      </p>
    </LegalBlock>

    <LegalBlock heading="Future investment features">
      <p>
        Investment products, where available in future, will be provided through appropriately
        regulated partners and remain subject to suitability requirements and risks. We do not
        promise guaranteed returns.
      </p>
    </LegalBlock>

    <LegalBlock heading="Use of this site">
      <p>
        Please use this website lawfully and do not attempt to disrupt or misuse it. The content is
        provided as-is for information purposes as PayBridge is developed.
      </p>
    </LegalBlock>

    <LegalBlock heading="Contact">
      <p>
        Questions about these terms? Email{" "}
        <a href="mailto:hello@getpaybridge.com" className="text-primary underline-offset-4 hover:underline">
          hello@getpaybridge.com
        </a>
        .
      </p>
    </LegalBlock>
  </PageShell>
);

export default Terms;
