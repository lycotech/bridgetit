import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Mail, Linkedin, Instagram, Music2 } from "lucide-react";
import { RegistrationLayout, AsideCard } from "@/components/registration/RegistrationLayout";
import {
  ConsentFields,
  HoneypotField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/registration/fields";
import { SubmitError, SuccessPanel } from "@/components/registration/SuccessPanel";
import { useRegistrationForm } from "@/components/registration/use-registration-form";
import { ENQUIRY_TYPES, contactFormSchema, type ContactForm } from "@/lib/registrations";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SOCIALS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/mypaybridge", icon: Linkedin },
  { label: "Instagram", href: "https://www.instagram.com/mypaybridge", icon: Instagram },
  { label: "X", href: "https://x.com/mypaybridge", icon: XIcon },
  { label: "TikTok", href: "https://www.tiktok.com/@mypaybridge", icon: Music2 },
];

/**
 * General enquiries — the unsegmented inbox.
 *
 * Everything here lands with the PayBridge Team at hello@getpaybridge.com. The
 * server additionally copies the right segment inbox when the enquiry type
 * clearly belongs to employers, employees or capital, so a partnership message
 * sent to the general address does not sit unread while the partnerships team
 * waits for it elsewhere.
 */
const Contact = () => {
  const { mutation, markStarted, onInvalid } = useRegistrationForm<ContactForm>("general");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContactForm>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      message: "",
      marketingConsent: false,
      website: "",
    },
  });

  const privacyAccepted = watch("privacyAccepted") === true;
  const marketingConsent = watch("marketingConsent") === true;

  return (
    <RegistrationLayout
      label="Contact"
      title="Talk to PayBridge"
      intro="We would love to hear from employees, employers, HR and payroll teams, capital and financial partners, and anyone who believes payday can work better."
      aside={
        <>
          <AsideCard title="Email us directly">
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <a
                href="mailto:hello@getpaybridge.com"
                className="font-medium text-foreground hover:text-primary"
              >
                hello@getpaybridge.com
              </a>
            </p>
            <p>
              Employer partnerships: partners@getpaybridge.com · Capital partnerships:
              capital@getpaybridge.com · Bridger community: bridgers@getpaybridge.com
            </p>
          </AsideCard>

          <AsideCard title="Follow">
            <div className="flex flex-wrap items-center gap-2">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              ))}
            </div>
            <p>@mypaybridge · getpaybridge.com</p>
          </AsideCard>

          <AsideCard title="Please do not email documents" tone="caution">
            <p>
              Never send your BVN, NIN, identity documents, bank statements, payroll files or
              incorporation documents by email. When verification is needed, we will direct you to a
              secure portal.
            </p>
          </AsideCard>
        </>
      }
    >
      {mutation.isSuccess ? (
        <SuccessPanel
          heading="Thank you for contacting PayBridge."
          inbox="hello@getpaybridge.com"
          body={<p>Your message has been received and the right team will respond shortly.</p>}
          caveat="This message is an enquiry only. It does not create an account, an application or any agreement with PayBridge."
        />
      ) : (
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values), onInvalid)}
          noValidate
          className="relative space-y-6"
        >
          <HoneypotField registration={register("website")} />

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="ct-name"
              label="Full name"
              placeholder="Your name"
              autoComplete="name"
              error={errors.fullName?.message}
              registration={register("fullName", { onChange: markStarted })}
            />

            <TextField
              id="ct-email"
              label="Email address"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              registration={register("email", { onChange: markStarted })}
            />

            <TextField
              id="ct-phone"
              label="Phone number"
              optional
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+234 800 000 0000"
              error={errors.phone?.message}
              registration={register("phone", { onChange: markStarted })}
            />

            <Controller
              control={control}
              name="enquiryType"
              render={({ field }) => (
                <SelectField
                  id="ct-type"
                  label="Enquiry type"
                  options={ENQUIRY_TYPES}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.enquiryType?.message}
                />
              )}
            />

            <TextAreaField
              id="ct-message"
              label="Message"
              className="sm:col-span-2"
              rows={6}
              placeholder="How can we help?"
              error={errors.message?.message}
              registration={register("message", { onChange: markStarted })}
            />
          </div>

          <ConsentFields
            idPrefix="ct"
            privacyAccepted={privacyAccepted}
            marketingConsent={marketingConsent}
            onPrivacyChange={(c) => setValue("privacyAccepted", c as true, { shouldValidate: true })}
            onMarketingChange={(c) => setValue("marketingConsent", c)}
            privacyError={errors.privacyAccepted?.message}
            marketingLabel="Keep me updated on PayBridge news and product announcements."
          />

          {mutation.isError ? <SubmitError /> : null}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full btn-brand px-6 py-4 text-base font-semibold shadow-[0_14px_44px_-12px_hsl(var(--primary)/0.8)] transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending your message…
              </>
            ) : (
              <>
                Send message
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      )}
    </RegistrationLayout>
  );
};

export default Contact;
