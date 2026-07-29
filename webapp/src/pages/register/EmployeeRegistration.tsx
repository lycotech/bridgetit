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
  EMPLOYMENT_TYPES,
  SALARY_BANDS,
  employeeFormSchema,
  type EmployeeForm,
} from "@/lib/registrations";

/**
 * Employee registration — the Bridger waitlist.
 *
 * The field list is deliberately short and deliberately harmless. There is no
 * BVN, NIN, bank statement, identity document, payslip or bank login here, and
 * there must never be: this is a public, unauthenticated form and anything it
 * collects is collected before PayBridge knows who the person is. Verification
 * belongs to activation, in a secure portal, once an employer is live.
 */
const EmployeeRegistration = () => {
  const { mutation, markStarted, onInvalid } = useRegistrationForm<EmployeeForm>("employee");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      location: "",
      employerName: "",
      wants: "",
      marketingConsent: false,
      website: "",
    },
  });

  const privacyAccepted = watch("privacyAccepted") === true;
  const marketingConsent = watch("marketingConsent") === true;

  return (
    <RegistrationLayout
      label="For employees · Bridgers"
      title="Get on the Bridge"
      intro="Join the early PayBridge community and be among the first to experience a more responsible connection between work, income and financial wellbeing."
      aside={
        mutation.isSuccess ? null : (
          <>
            <AsideCard title="What happens next">
              <p>
                We add you to the Bridger community and keep you informed as we prepare the first
                pilot.
              </p>
              <p>
                PayBridge activates through employers. When your organisation joins, you will be
                invited to complete secure verification then — not before.
              </p>
            </AsideCard>
            <AsideCard title="What this is not" tone="caution">
              <p>
                This is not a loan application, a credit check or an account. Registering does not
                approve you for anything and creates no obligation on either side.
              </p>
            </AsideCard>
          </>
        )
      }
    >
      {mutation.isSuccess ? (
        <SuccessPanel
          heading="You're officially on the bridge."
          inbox="bridgers@getpaybridge.com"
          body={
            <p>
              Thank you for joining the early PayBridge community. We'll keep you informed as we
              prepare the first Bridger pilot.
            </p>
          }
          caveat="Registering today does not constitute approval or activation. Verification will only begin when your employer and PayBridge are ready to onboard your organisation securely."
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
              id="emp-fullName"
              label="Full name"
              placeholder="Your full name"
              autoComplete="name"
              className="sm:col-span-2"
              error={errors.fullName?.message}
              registration={register("fullName", { onChange: markStarted })}
            />

            <TextField
              id="emp-email"
              label="Email address"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              registration={register("email", { onChange: markStarted })}
            />

            <TextField
              id="emp-phone"
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+234 800 000 0000"
              error={errors.phone?.message}
              registration={register("phone", { onChange: markStarted })}
            />

            <TextField
              id="emp-location"
              label="State or city"
              placeholder="Lagos"
              autoComplete="address-level2"
              error={errors.location?.message}
              registration={register("location", { onChange: markStarted })}
            />

            <TextField
              id="emp-employer"
              label="Employer name"
              placeholder="Where you work"
              autoComplete="organization"
              error={errors.employerName?.message}
              registration={register("employerName", { onChange: markStarted })}
            />

            <Controller
              control={control}
              name="employmentType"
              render={({ field }) => (
                <SelectField
                  id="emp-type"
                  label="Employment type"
                  options={EMPLOYMENT_TYPES}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.employmentType?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="salaryBand"
              render={({ field }) => (
                <SelectField
                  id="emp-salary"
                  label="Approximate salary band"
                  optional
                  hint="Helps us design sensible limits. Leave it blank if you would rather not say."
                  options={SALARY_BANDS}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    markStarted();
                  }}
                  error={errors.salaryBand?.message}
                />
              )}
            />

            <TextAreaField
              id="emp-wants"
              label="What would you like PayBridge to help you with?"
              optional
              className="sm:col-span-2"
              placeholder="Emergency cover, saving consistently, avoiding informal lenders, planning ahead…"
              error={errors.wants?.message}
              registration={register("wants", { onChange: markStarted })}
            />
          </div>

          <ConsentFields
            idPrefix="emp"
            privacyAccepted={privacyAccepted}
            marketingConsent={marketingConsent}
            onPrivacyChange={(c) => setValue("privacyAccepted", c as true, { shouldValidate: true })}
            onMarketingChange={(c) => setValue("marketingConsent", c)}
            privacyError={errors.privacyAccepted?.message}
            marketingLabel="Send me PayBridge product updates, pilot invitations and financial wellbeing tips. I can unsubscribe at any time."
          />

          <NoDocumentsNotice variant="employee" />

          {mutation.isError ? <SubmitError /> : null}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full btn-brand px-6 py-4 text-base font-semibold shadow-[0_14px_44px_-12px_hsl(var(--primary)/0.8)] transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Building your bridge…
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

export default EmployeeRegistration;
