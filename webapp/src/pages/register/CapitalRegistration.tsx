import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Scale } from "lucide-react";
import { RegistrationLayout, AsideCard } from "@/components/registration/RegistrationLayout";
import {
  ConsentFields,
  HoneypotField,
  NoDocumentsNotice,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/registration/fields";
import { SubmitError, SuccessPanel } from "@/components/registration/SuccessPanel";
import { useRegistrationForm } from "@/components/registration/use-registration-form";
import {
  CAPITAL_PARTY_TYPES,
  CAPITAL_RANGES,
  INVESTMENT_HORIZONS,
  PARTICIPATION_STRUCTURES,
  REGULATED_STATUS,
  capitalFormSchema,
  type CapitalForm,
} from "@/lib/registrations";

/**
 * Capital partner registration.
 *
 * The regulatory disclaimer below is displayed BEFORE the form, not buried
 * under it, and is repeated on the success screen and in the confirmation
 * email. A public web page that collects capital interest without it reads as
 * a solicitation, which is precisely what this is not. The wording is fixed —
 * it should not be shortened for visual balance.
 */
const NOT_AN_OFFER =
  "Registration is an expression of interest only. It is not an offer, solicitation, investment application, acceptance of capital or guarantee of participation. Any future opportunity will be subject to legal, regulatory, due-diligence and suitability requirements.";

const CapitalRegistration = () => {
  const { mutation, markStarted, onInvalid } = useRegistrationForm<CapitalForm>("capital_partner");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CapitalForm>({
    resolver: zodResolver(capitalFormSchema),
    defaultValues: {
      fullName: "",
      companyName: "",
      jobTitle: "",
      email: "",
      phone: "",
      country: "",
      mandate: "",
      marketingConsent: false,
      website: "",
    },
  });

  const privacyAccepted = watch("privacyAccepted") === true;
  const marketingConsent = watch("marketingConsent") === true;

  return (
    <RegistrationLayout
      label="For capital partners"
      title="Power the Bridge Responsibly"
      intro="Register your interest in exploring structured capital partnerships supporting responsible payroll access and workforce financial wellbeing."
      aside={
        mutation.isSuccess ? null : (
          <>
            <AsideCard title="Important notice" tone="caution">
              <p>{NOT_AN_OFFER}</p>
            </AsideCard>
            <AsideCard title="What happens next">
              <p>
                The PayBridge capital team reviews every registration and responds to those that
                align with our current structure and stage.
              </p>
              <p>
                Any discussion that proceeds does so under the applicable legal, regulatory and
                suitability requirements.
              </p>
            </AsideCard>
          </>
        )
      }
    >
      {mutation.isSuccess ? (
        <SuccessPanel
          heading="Thank you for your interest in supporting PayBridge."
          inbox="capital@getpaybridge.com"
          body={
            <p>
              Our capital partnerships team will review your registration and respond accordingly.
            </p>
          }
          caveat={NOT_AN_OFFER}
        />
      ) : (
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values), onInvalid)}
          noValidate
          className="relative space-y-6"
        >
          <HoneypotField registration={register("website")} />

          {/* Displayed prominently, above the first field — not as a footnote. */}
          <div className="flex gap-3 rounded-2xl border border-gold/35 bg-gold/5 p-5">
            <Scale className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
            <p className="text-sm leading-relaxed text-foreground/85">{NOT_AN_OFFER}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="cap-fullName"
              label="Full name"
              placeholder="Your full name"
              autoComplete="name"
              error={errors.fullName?.message}
              registration={register("fullName", { onChange: markStarted })}
            />

            <Controller
              control={control}
              name="partyType"
              render={({ field }) => (
                <SelectField
                  id="cap-party"
                  label="Individual or institution"
                  options={CAPITAL_PARTY_TYPES}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.partyType?.message}
                />
              )}
            />

            <TextField
              id="cap-company"
              label="Company name"
              optional
              placeholder="If registering on behalf of an institution"
              autoComplete="organization"
              error={errors.companyName?.message}
              registration={register("companyName", { onChange: markStarted })}
            />

            <TextField
              id="cap-title"
              label="Job title"
              optional
              placeholder="Partner, Treasurer, Head of Credit…"
              autoComplete="organization-title"
              error={errors.jobTitle?.message}
              registration={register("jobTitle", { onChange: markStarted })}
            />

            <TextField
              id="cap-email"
              label="Work email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@institution.com"
              error={errors.email?.message}
              registration={register("email", { onChange: markStarted })}
            />

            <TextField
              id="cap-phone"
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+234 800 000 0000"
              error={errors.phone?.message}
              registration={register("phone", { onChange: markStarted })}
            />

            <TextField
              id="cap-country"
              label="Country of residence or incorporation"
              placeholder="Nigeria"
              autoComplete="country-name"
              className="sm:col-span-2"
              error={errors.country?.message}
              registration={register("country", { onChange: markStarted })}
            />

            <Controller
              control={control}
              name="capitalRange"
              render={({ field }) => (
                <SelectField
                  id="cap-range"
                  label="Indicative capital range"
                  hint="Indicative only. Nothing here is a commitment."
                  options={CAPITAL_RANGES}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.capitalRange?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="participationStructure"
              render={({ field }) => (
                <SelectField
                  id="cap-structure"
                  label="Preferred participation structure"
                  options={PARTICIPATION_STRUCTURES}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.participationStructure?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="investmentHorizon"
              render={({ field }) => (
                <SelectField
                  id="cap-horizon"
                  label="Expected investment horizon"
                  options={INVESTMENT_HORIZONS}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.investmentHorizon?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="regulatedStatus"
              render={({ field }) => (
                <SelectField
                  id="cap-regulated"
                  label="Are you a regulated or institutional party?"
                  options={REGULATED_STATUS}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.regulatedStatus?.message}
                />
              )}
            />

            <TextAreaField
              id="cap-mandate"
              label="Brief description of your investment mandate"
              className="sm:col-span-2"
              rows={5}
              placeholder="Sectors, geographies, ticket sizes, structures you typically participate in…"
              error={errors.mandate?.message}
              registration={register("mandate", { onChange: markStarted })}
            />
          </div>

          <ConsentFields
            idPrefix="cap"
            privacyAccepted={privacyAccepted}
            marketingConsent={marketingConsent}
            onPrivacyChange={(c) => setValue("privacyAccepted", c as true, { shouldValidate: true })}
            onMarketingChange={(c) => setValue("marketingConsent", c)}
            privacyError={errors.privacyAccepted?.message}
            marketingLabel="I consent to being contacted by the PayBridge capital partnerships team about structured discussions."
          />

          <NoDocumentsNotice variant="capital" />

          {mutation.isError ? <SubmitError /> : null}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full btn-brand px-6 py-4 text-base font-semibold shadow-[0_14px_44px_-12px_hsl(var(--primary)/0.8)] transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registering your interest…
              </>
            ) : (
              <>
                Register Capital Partnership Interest
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      )}
    </RegistrationLayout>
  );
};

export default CapitalRegistration;
