import { useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Check, ChevronDown, Loader2, PartyPopper, Plus } from "lucide-react";
import { SectionLabel } from "@/components/brand/SectionLabel";
import { Reveal } from "@/components/motion/Reveal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { track, captureAttribution } from "@/lib/analytics";
import {
  WAITLIST_ROLES,
  waitlistFormSchema,
  submitWaitlist,
  type WaitlistForm,
} from "@/lib/waitlist";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-destructive">{message}</p>;
}

export function Waitlist() {
  const startedRef = useRef(false);
  const [submittedName, setSubmittedName] = useState("");
  const [showMore, setShowMore] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<WaitlistForm>({
    resolver: zodResolver(waitlistFormSchema),
    defaultValues: { fullName: "", email: "", phone: "", organisation: "", goal: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: WaitlistForm) => submitWaitlist(values, captureAttribution()),
    onSuccess: () => track("form_submit_success"),
    onError: () => track("form_error", { stage: "submit" }),
  });

  const markStarted = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      track("form_start");
    }
  };

  const onSubmit = (values: WaitlistForm) => {
    track("form_complete", { role: values.role });
    setSubmittedName(values.fullName.split(" ")[0] ?? "");
    mutation.mutate(values);
  };

  const onInvalid = () => track("form_error", { stage: "validation" });

  const inputClass =
    "h-12 rounded-xl border-border bg-secondary/40 text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-primary";

  const success = mutation.isSuccess;

  const roleOptions = useMemo(() => WAITLIST_ROLES, []);

  return (
    <section id="waitlist" className="section relative overflow-hidden border-t border-border scroll-mt-20">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full blur-[130px]"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.16), transparent)" }}
        />
      </div>

      <div className="relative mx-auto max-w-2xl px-5 md:px-8">
        <div className="text-center">
          <Reveal>
            <div className="flex justify-center">
              <SectionLabel>Be early</SectionLabel>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              Get on the Bridge.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Join the PayBridge waitlist for pilot invitations, product updates and launch
              announcements.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="mt-12 rounded-3xl border border-border bg-card/70 p-6 shadow-2xl backdrop-blur-sm sm:p-9">
            {success ? (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <PartyPopper className="h-7 w-7" />
                </span>
                <h3 className="mt-6 font-display text-3xl font-extrabold text-foreground">
                  You are on the Bridge.
                </h3>
                <p className="mt-4 max-w-md text-muted-foreground">
                  Thank you for joining the PayBridge early community
                  {submittedName ? `, ${submittedName}` : ""}. We will keep you updated as we move
                  toward pilot testing and launch.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="wl-fullName" className="text-sm text-foreground">
                      Full name
                    </Label>
                    <Input
                      id="wl-fullName"
                      autoComplete="name"
                      placeholder="Your full name"
                      className={cn("mt-2", inputClass)}
                      aria-invalid={!!errors.fullName}
                      {...register("fullName", { onChange: markStarted })}
                    />
                    <FieldError message={errors.fullName?.message} />
                  </div>

                  <div>
                    <Label htmlFor="wl-email" className="text-sm text-foreground">
                      Email address
                    </Label>
                    <Input
                      id="wl-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={cn("mt-2", inputClass)}
                      aria-invalid={!!errors.email}
                      {...register("email", { onChange: markStarted })}
                    />
                    <FieldError message={errors.email?.message} />
                  </div>

                  <div>
                    <Label htmlFor="wl-phone" className="text-sm text-foreground">
                      Phone number
                    </Label>
                    <Input
                      id="wl-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+234 800 000 0000"
                      className={cn("mt-2", inputClass)}
                      aria-invalid={!!errors.phone}
                      {...register("phone", { onChange: markStarted })}
                    />
                    <FieldError message={errors.phone?.message} />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="wl-role" className="text-sm text-foreground">
                      I am joining as
                    </Label>
                    <Controller
                      control={control}
                      name="role"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            markStarted();
                            track("role_select", { role: v });
                          }}
                        >
                          <SelectTrigger
                            id="wl-role"
                            className={cn("mt-2", inputClass)}
                            aria-invalid={!!errors.role}
                          >
                            <SelectValue placeholder="Choose one" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptions.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <FieldError message={errors.role?.message} />
                  </div>

                  {/* Optional details — collapsed to reduce completion friction */}
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => setShowMore((v) => !v)}
                      aria-expanded={showMore}
                      aria-controls="wl-more"
                      className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      {showMore ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Add more details
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </button>

                    {showMore ? (
                      <div id="wl-more" className="mt-4 space-y-5">
                        <div>
                          <Label htmlFor="wl-org" className="text-sm text-foreground">
                            Organisation
                          </Label>
                          <Input
                            id="wl-org"
                            autoComplete="organization"
                            placeholder="Where you work"
                            className={cn("mt-2", inputClass)}
                            {...register("organisation", { onChange: markStarted })}
                          />
                        </div>

                        <div>
                          <Label htmlFor="wl-goal" className="text-sm text-foreground">
                            What would you like PayBridge to help you solve?
                          </Label>
                          <Textarea
                            id="wl-goal"
                            rows={3}
                            placeholder="Tell us what matters most to you"
                            className={cn(
                              "mt-2 rounded-xl border-border bg-secondary/40 text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-primary",
                              "min-h-[92px]",
                            )}
                            {...register("goal", { onChange: markStarted })}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <Controller
                    control={control}
                    name="consent"
                    render={({ field }) => (
                      <Checkbox
                        id="wl-consent"
                        checked={field.value === true}
                        onCheckedChange={(c) => field.onChange(c === true)}
                        className="mt-0.5 border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        aria-invalid={!!errors.consent}
                      />
                    )}
                  />
                  <Label htmlFor="wl-consent" className="text-sm font-normal leading-relaxed text-muted-foreground">
                    I agree to receive PayBridge pilot, product and launch updates.
                  </Label>
                </div>
                <FieldError message={errors.consent?.message} />

                {mutation.isError ? (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                    <p className="font-display text-sm font-bold text-destructive">
                      We could not complete this yet.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Please check your details and try again.
                    </p>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-[0_14px_44px_-12px_hsl(var(--primary)/0.8)] transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building your bridge...
                    </>
                  ) : (
                    <>
                      Get on the Bridge
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </>
                  )}
                </button>

                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  Early access · Pilot updates · Launch announcements
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
