import { PageShell, LegalBlock } from "@/components/sections/PageShell";

const Privacy = () => (
  <PageShell
    title="Privacy Policy"
    updated="23 July 2026"
    intro="PayBridge is being developed. This policy explains, in plain language, how we handle the information you share while joining our early community."
  >
    <LegalBlock heading="Who we are">
      <p>
        PayBridge is a workforce-finance platform in development. This website exists to explain what
        we are building and to let interested people join our waitlist.
      </p>
    </LegalBlock>

    <LegalBlock heading="Information we collect">
      <p>
        When you join the waitlist we collect the details you provide: your name, email address,
        phone number, optional organisation, the role you select and any optional message. We also
        record basic attribution information such as how you reached the site (referrer and
        campaign parameters) and the time you submitted.
      </p>
    </LegalBlock>

    <LegalBlock heading="How we use it">
      <p>
        We use your information to keep you updated about PayBridge pilot testing, product progress
        and launch announcements, and to understand which audiences are most interested so we can
        shape the product responsibly. We only send updates if you have agreed to receive them.
      </p>
    </LegalBlock>

    <LegalBlock heading="How we store it">
      <p>
        Waitlist information is stored securely and access is limited to the PayBridge team. We do
        not sell your personal information.
      </p>
    </LegalBlock>

    <LegalBlock heading="Your choices">
      <p>
        You can ask us to update or delete your details, or to stop sending you updates, at any
        time by contacting us. Every update email will also include a way to opt out.
      </p>
    </LegalBlock>

    <LegalBlock heading="Contact">
      <p>
        For any privacy question, email{" "}
        <a href="mailto:hello@getpaybridge.com" className="text-primary underline-offset-4 hover:underline">
          hello@getpaybridge.com
        </a>
        .
      </p>
    </LegalBlock>
  </PageShell>
);

export default Privacy;
