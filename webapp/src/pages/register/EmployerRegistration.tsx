import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
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
  EMPLOYEE_COUNT_BANDS,
  PAYROLL_BANDS,
  PAYROLL_FREQUENCIES,
  PILOT_TIMELINES,
  SALARY_CONSISTENCY,
  employerFormSchema,
  type EmployerForm,
} from "@/lib/registrations";

/**
 * Employer registration — the early-interest form.
 *
 * This form completes exactly one stage of the employer pilot pipeline:
 * "Interest Registered". Everything after it — qualification, discovery,
 * payroll assessment, risk review, pilot design, agreement, technical setup —
 * happens internally, by hand. Nothing on this page may describe a registered
 * employer as approved, onboarded or live.
 *
 * No corporate documents are requested here. Incorporation certificates,
 * payroll files and bank details come later, through a secure channel, once a
 * pilot is actually agreed.
 */
const EmployerRegistration = () => {
  const { mutation, markStarted, onInvalid } = useRegistrationForm<EmployerForm>("employer");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EmployerForm>({
    resolver: zodResolver(employerFormSchema),
    defaultValues: {
      companyName: "",
      fullName: "",
      jobTitle: "",
      email: "",
      phone: "",
      industry: "",
      payrollProvider: "",
      wellbeingChallenge: "",
      location: "",
      marketingConsent: false,
      website: "",
    },
  });

  const privacyAccepted = watch("privacyAccepted") === true;
  const marketingConsent = watch("marketingConsent") === true;

  return (
    <RegistrationLayout
      label="For employers"
      title="Bring PayBridge to Your Workforce"
      intro="Help your employees navigate financial pressure without turning your organisation into a lender. PayBridge connects responsible income access, payroll participation and financial wellbeing through a structured employer partnership."
      aside={
        mutation.isSuccess ? null : (
          <>
            <AsideCard title="How a pilot begins">
              <p>
                Registering completes the first step only: <strong>Interest Registered</strong>.
              </p>
              <p>
                From there our partnerships team runs qualification, a discovery meeting and a
                payroll assessment before any pilot is designed. Nothing is committed on either side
                until an agreement is signed.
              </p>
            </AsideCard>
            <AsideCard title="Simple digital onboarding" tone="caution">
              <p>
                We do not ask for incorporation documents, payroll files or bank details at this
                stage — and we never request them by email. Company and payroll verification
                happens digitally, through a secure channel, once a pilot is agreed.
              </p>
            </AsideCard>
          </>
        )
      }
    >
      {mutation.isSuccess ? (
        <SuccessPanel
          heading="Thank you. Your interest has been received."
          inbox="partners@getpaybridge.com"
          body={
            <p>
              A member of the PayBridge partnerships team will contact you to discuss your workforce
              needs and pilot options.
            </p>
          }
          caveat="This registration is an expression of interest and does not create a contract, an approved partnership or an obligation on either side. A pilot only begins after qualification, payroll assessment and a signed agreement."
        />
      ) : (
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values), onInvalid)}
          noValidate
          className="relative space-y-6"
        >
          <HoneypotField registration={register("website")} />

          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your organisation
            </legend>

            <TextField
              id="er-company"
              label="Company name"
              placeholder="Registered or trading name"
              autoComplete="organization"
              className="sm:col-span-2"
              error={errors.companyName?.message}
              registration={register("companyName", { onChange: markStarted })}
            />

            <TextField
              id="er-industry"
              label="Industry"
              placeholder="Manufacturing, retail, healthcare…"
              error={errors.industry?.message}
              registration={register("industry", { onChange: markStarted })}
            />

            <TextField
              id="er-location"
              label="City or operating location"
              placeholder="Lagos"
              autoComplete="address-level2"
              error={errors.location?.message}
              registration={register("location", { onChange: markStarted })}
            />

            <Controller
              control={control}
              name="employeeCount"
              render={({ field }) => (
                <SelectField
                  id="er-headcount"
                  label="Number of employees"
                  options={EMPLOYEE_COUNT_BANDS}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.employeeCount?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="payrollBand"
              render={({ field }) => (
                <SelectField
                  id="er-payroll-band"
                  label="Monthly payroll band"
                  options={PAYROLL_BANDS}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.payrollBand?.message}
                />
              )}
            />
          </fieldset>

          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Your contact details
            </legend>

            <TextField
              id="er-contact"
              label="Contact person"
              placeholder="Full name"
              autoComplete="name"
              error={errors.fullName?.message}
              registration={register("fullName", { onChange: markStarted })}
            />

            <TextField
              id="er-title"
              label="Job title"
              placeholder="Head of People, CFO, Payroll Manager…"
              autoComplete="organization-title"
              error={errors.jobTitle?.message}
              registration={register("jobTitle", { onChange: markStarted })}
            />

            <TextField
              id="er-email"
              label="Official work email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@yourcompany.com"
              error={errors.email?.message}
              registration={register("email", { onChange: markStarted })}
            />

            <TextField
              id="er-phone"
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+234 800 000 0000"
              error={errors.phone?.message}
              registration={register("phone", { onChange: markStarted })}
            />
          </fieldset>

          <fieldset className="grid gap-5 sm:grid-cols-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              How payroll works today
            </legend>

            <TextField
              id="er-provider"
              label="Current payroll bank or provider"
              placeholder="Bank, bureau or payroll software"
              error={errors.payrollProvider?.message}
              registration={register("payrollProvider", { onChange: markStarted })}
            />

            <Controller
              control={control}
              name="payrollFrequency"
              render={({ field }) => (
                <SelectField
                  id="er-frequency"
                  label="Payroll frequency"
                  options={PAYROLL_FREQUENCIES}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.payrollFrequency?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="salaryConsistency"
              render={({ field }) => (
                <SelectField
                  id="er-consistency"
                  label="Are salaries paid consistently?"
                  options={SALARY_CONSISTENCY}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.salaryConsistency?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="pilotTimeline"
              render={({ field }) => (
                <SelectField
                  id="er-timeline"
                  label="Preferred pilot timeline"
                  options={PILOT_TIMELINES}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.pilotTimeline?.message}
                />
              )}
            />

            <TextAreaField
              id="er-challenge"
              label="Primary employee financial-wellbeing challenge"
              className="sm:col-span-2"
              placeholder="Salary advances requested before payday, informal lending, staff turnover, absenteeism…"
              error={errors.wellbeingChallenge?.message}
              registration={register("wellbeingChallenge", { onChange: markStarted })}
            />
          </fieldset>

          <ConsentFields
            idPrefix="er"
            privacyAccepted={privacyAccepted}
            marketingConsent={marketingConsent}
            onPrivacyChange={(c) => setValue("privacyAccepted", c as true, { shouldValidate: true })}
            onMarketingChange={(c) => setValue("marketingConsent", c)}
            privacyError={errors.privacyAccepted?.message}
            marketingLabel="I am happy to be contacted about PayBridge pilots, employer research and workforce financial wellbeing insights."
          />

          <NoDocumentsNotice variant="employer" />

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
                Get on the Bridge
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      )}
    </RegistrationLayout>
  );
};

export default EmployerRegistration;
