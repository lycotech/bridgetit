import { PageShell, LegalBlock } from "@/components/sections/PageShell";

/**
 * The privacy policy has to describe what the site ACTUALLY collects.
 *
 * Since registration became segmented, that is three different sets of answers
 * — employee, employer and capital partner — plus a general enquiry form, two
 * separate consents recorded with timestamps, and an internal dashboard the
 * team uses to follow up. The old single-waitlist wording no longer described
 * any of that, and a privacy policy that is out of date is worse than a short
 * one: it tells people something untrue about their own data.
 */
const Privacy = () => (
  <PageShell
    title="Privacy Policy"
    updated="27 July 2026"
    intro="PayBridge is being developed. This policy explains, in plain language, what we collect when you register your interest, why we hold it, and how you can have it removed."
  >
    <LegalBlock heading="Who we are">
      <p>
        PayBridge is a workforce-finance platform in development, operated by PennyVest Technologies
        Limited. This website exists to explain what we are building and to let employees, employers
        and capital partners register their interest ahead of activation.
      </p>
    </LegalBlock>

    <LegalBlock heading="What we collect">
      <p>
        It depends on which form you complete. Employees registering as Bridgers give us their name,
        email address, phone number, state or city, employer name, employment type, an optional
        salary band and what they hope PayBridge will do for them. Employers give us company and
        contact details, industry, workforce size, payroll band, payroll provider and frequency,
        their main employee financial-wellbeing challenge, and a preferred pilot timeline. Capital
        partners give us their name and organisation, country, indicative capital range, preferred
        participation structure, horizon, regulated status and a description of their mandate.
        General enquiries collect a name, email, optional phone number, enquiry type and message.
      </p>
      <p>
        Alongside your answers we record the date and time, the page you registered from, the form
        you used, and basic attribution such as referrer and campaign parameters.
      </p>
    </LegalBlock>

    <LegalBlock heading="What we deliberately do not collect">
      <p>
        This website never asks for your BVN, NIN, bank statements, identity documents, payroll
        files, incorporation documents, source-of-funds records or bank login details — and you
        should never send them to us by email. Where verification is eventually required, it will
        happen through a secure verification portal at activation, not through a public form.
      </p>
    </LegalBlock>

    <LegalBlock heading="Consent">
      <p>
        Registering requires you to acknowledge this policy. Agreeing to receive product updates is
        a separate, optional choice — one is never bundled into the other. Both are recorded with
        the date and time you gave them, so we can always show what you agreed to and when.
      </p>
    </LegalBlock>

    <LegalBlock heading="How we use it">
      <p>
        To acknowledge your registration, to keep you informed about pilot progress if you asked to
        be, to assess which organisations are suitable for an early pilot, and to understand which
        audiences we are reaching. Registering does not enrol you in anything, and it does not mean
        you have been verified, approved or accepted.
      </p>
    </LegalBlock>

    <LegalBlock heading="How we store and protect it">
      <p>
        Registrations are stored in a secured database. The connection between your browser and our
        servers is encrypted in transit. Access to registration data is limited to authorised
        PayBridge team members through an internal dashboard that requires a separate sign-in, and
        administrative actions are logged. We do not sell your personal information, and we do not
        share it with third parties except service providers who help us operate the platform.
      </p>
    </LegalBlock>

    <LegalBlock heading="How long we keep it">
      <p>
        We keep registration records while your interest remains relevant to the pilot programme,
        and we review them periodically. If a registration is no longer relevant — or you ask us to
        remove it — we delete it.
      </p>
    </LegalBlock>

    <LegalBlock heading="Your choices">
      <p>
        You can ask us at any time to see, correct or delete your details, or to stop sending you
        updates. Email{" "}
        <a
          href="mailto:hello@getpaybridge.com"
          className="text-primary underline-offset-4 hover:underline"
        >
          hello@getpaybridge.com
        </a>{" "}
        and we will act on it. Every update email also includes a way to opt out.
      </p>
    </LegalBlock>

    <LegalBlock heading="Contact and reporting a concern">
      <p>
        For any privacy question, or to report a suspected data breach or vulnerability, email{" "}
        <a
          href="mailto:hello@getpaybridge.com"
          className="text-primary underline-offset-4 hover:underline"
        >
          hello@getpaybridge.com
        </a>
        . We aim to respond to security reports within one working day.
      </p>
    </LegalBlock>
  </PageShell>
);

export default Privacy;
