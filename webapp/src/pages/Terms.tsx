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

    <LegalBlock heading="Registering your interest">
      <p>
        Whether you register as an employee, an employer or a capital partner, you are expressing
        interest only. Registering does not create an account, an entitlement or an obligation on
        either side. It does not mean you have completed verification, been approved, received
        credit, invested funds or entered into a legally binding relationship, and it does not
        guarantee that PayBridge will be available to you. Verification begins only when activation
        begins.
      </p>
    </LegalBlock>

    <LegalBlock heading="Employer registrations">
      <p>
        An employer that registers has completed one step: interest registered. A pilot follows
        qualification, a discovery meeting, a payroll assessment and a written agreement. Until
        those are complete, no organisation is approved, onboarded or live on PayBridge.
      </p>
    </LegalBlock>

    <LegalBlock heading="Capital partnership interest">
      <p>
        Registration is an expression of interest only. It is not an offer, solicitation, investment
        application, acceptance of capital or guarantee of participation. Any future opportunity
        will be subject to legal, regulatory, due-diligence and suitability requirements, will be
        provided through appropriately regulated partners, and carries risk. We do not promise
        guaranteed returns.
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
