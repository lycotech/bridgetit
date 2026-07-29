import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { InfoNote } from "@/components/dashboard/Panel";
import { RadioCards } from "@/components/dashboard/forms";
import { LanguageSelector } from "@/components/prefs/LanguageSelector";
import { ListenButton } from "@/components/prefs/ListenButton";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import type { SupportChannel } from "../../../../backend/src/types";
import type { TranslationKey } from "@/i18n/translate";

/**
 * The six questions somebody answers the first time they open PayBridge.
 *
 * SKIPPABLE ON EVERY SCREEN, and the Skip button is a real button of the same
 * size as Next — not grey six-point text in a corner. Somebody who does not want
 * to answer questions about how they read is entitled to reach their money
 * without answering them, and every one of these settings is changeable later
 * under "How should PayBridge work for you?".
 *
 * ANSWERS APPLY IMMEDIATELY, before Next is pressed. Choosing "Big writing"
 * makes this very screen bigger. WHY: nobody can judge a setting from its name.
 * The person who needs it is the person who cannot preview it in their head, so
 * the preview is the whole screen, live. It also means skipping halfway through
 * keeps what was already chosen — skipping means "stop asking me", not "undo the
 * thing I could finally read".
 *
 * WHAT IT NEVER ASKS: why. There is no question about eyesight, hearing, hands or
 * health anywhere in this flow, and no field to store an answer in. See
 * backend/prisma/schema.prisma.
 *
 * NOT A MODAL. It is the page, with its own <h1>, so there is no focus trap to
 * get wrong, nothing behind it for a screen reader to wander into, and no
 * dismiss-by-clicking-outside for a shaky hand to trigger by accident.
 */

const TOTAL = 6;

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const SUPPORT_OPTIONS: { value: SupportChannel; label: TranslationKey; help: TranslationKey }[] = [
  { value: "whatsapp", label: "support.whatsapp", help: "support.whatsapp_help" },
  { value: "written", label: "support.write", help: "support.write_help" },
  { value: "callback", label: "support.callback", help: "support.callback_help" },
  { value: "phone", label: "support.call", help: "support.call_help" },
  { value: "email", label: "support.email", help: "support.email_help" },
];

export function FirstUseOnboarding({ onDone }: { onDone: () => void }) {
  const { prefs, t, update, settleOnboarding } = usePreferences();
  const [step, setStep] = useState<Step>(1);
  const [finished, setFinished] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /*
   * Focus the new question when the step changes. Without this, a keyboard or
   * screen-reader user presses Next and their focus stays on a button that has
   * just been re-labelled, with a whole new question above it that was never
   * announced. -1 keeps it out of the tab order afterwards.
   */
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, finished]);

  const finish = () => {
    settleOnboarding("completed");
    setFinished(true);
  };

  const skip = () => {
    settleOnboarding("skipped");
    onDone();
  };

  if (finished) {
    return (
      <Frame>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl font-extrabold text-foreground outline-none sm:text-3xl"
        >
          {t("onboarding.done_title")}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{t("onboarding.done_body")}</p>
        <div className="mt-4">
          <ListenButton text={`${t("onboarding.done_title")}. ${t("onboarding.done_body")}`} />
        </div>
        <div className="mt-6">
          <ActionButton size="lg" fullWidth icon={<Check className="h-4 w-4" />} onClick={onDone}>
            {t("common.done")}
          </ActionButton>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary tnum">
        {t("onboarding.step", { current: String(step), total: String(TOTAL) })}
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
        {t("onboarding.title")}
      </h1>
      <p className="mt-2 text-base leading-relaxed text-muted-foreground">{t("onboarding.subtitle")}</p>

      {/* The bar repeats what the words above already said, so it is decoration
          and hidden from assistive technology rather than read twice. */}
      <div aria-hidden className="mt-5 flex gap-1.5">
        {Array.from({ length: TOTAL }, (_, index) => (
          <span
            key={index}
            className={index < step ? "h-1.5 flex-1 rounded-full bg-primary" : "h-1.5 flex-1 rounded-full bg-border"}
          />
        ))}
      </div>

      {/* The focus target when the step changes. A labelled section rather than a
          second heading, so the question is not printed on screen twice: it is
          already the legend of the group of choices below. */}
      <section ref={headingRef} tabIndex={-1} aria-label={t(QUESTION_LABEL[step])} className="mt-6 outline-none">
        {step === 1 ? <LanguageSelector legend={t("onboarding.q_language")} columns={2} /> : null}

        {step === 2 ? (
          <RadioCards<"standard" | "simple">
            legend={t("onboarding.q_view")}
            value={prefs.simpleView ? "simple" : "standard"}
            onChange={(value) => update({ simpleView: value === "simple" })}
            options={[
              {
                value: "standard",
                label: t("onboarding.q_view_standard"),
                description: t("onboarding.q_view_standard_help"),
              },
              {
                value: "simple",
                label: t("onboarding.q_view_simple"),
                description: t("onboarding.q_view_simple_help"),
              },
            ]}
            name="onboarding-view"
          />
        ) : null}

        {step === 3 ? (
          <RadioCards<"normal" | "large">
            legend={t("onboarding.q_text")}
            value={prefs.largeText ? "large" : "normal"}
            onChange={(value) => update({ largeText: value === "large" })}
            options={[
              { value: "normal", label: t("onboarding.q_text_normal") },
              { value: "large", label: t("onboarding.q_text_large") },
            ]}
            name="onboarding-text"
          />
        ) : null}

        {step === 4 ? (
          <RadioCards<"standard" | "high">
            legend={t("onboarding.q_contrast")}
            value={prefs.highContrast ? "high" : "standard"}
            onChange={(value) => update({ highContrast: value === "high" })}
            options={[
              { value: "standard", label: t("onboarding.q_contrast_standard") },
              { value: "high", label: t("onboarding.q_contrast_high") },
            ]}
            name="onboarding-contrast"
          />
        ) : null}

        {step === 5 ? (
          <>
            <RadioCards<"yes" | "no">
              legend={t("onboarding.q_read_aloud")}
              value={prefs.readAloud ? "yes" : "no"}
              onChange={(value) => update({ readAloud: value === "yes" })}
              options={[
                { value: "yes", label: t("onboarding.q_read_aloud_yes") },
                { value: "no", label: t("onboarding.q_read_aloud_no") },
              ]}
              name="onboarding-read-aloud"
            />
            {/* Present from the moment they say yes, so the answer is a
                demonstration rather than a promise. */}
            <div className="mt-4">
              <ListenButton text={t("employee.available_amount_help")} />
            </div>
          </>
        ) : null}

        {step === 6 ? (
          <RadioCards<SupportChannel>
            legend={t("onboarding.q_support")}
            value={prefs.supportChannel}
            onChange={(supportChannel) =>
              // Picking a voice route clears "please do not call me" rather than
              // storing two answers that contradict each other.
              update(
                supportChannel === "phone" || supportChannel === "callback"
                  ? { supportChannel, textOnly: false }
                  : { supportChannel },
              )
            }
            options={SUPPORT_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.label),
              description: t(option.help),
            }))}
            columns={2}
            name="onboarding-support"
          />
        ) : null}
      </section>

      <InfoNote className="mt-6">{t("prefs.private_note")}</InfoNote>

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
        {step === TOTAL ? (
          <ActionButton size="lg" fullWidth icon={<Check className="h-4 w-4" />} onClick={finish}>
            {t("onboarding.finish")}
          </ActionButton>
        ) : (
          <ActionButton size="lg" fullWidth onClick={() => setStep((current) => (current + 1) as Step)}>
            {t("common.next")}
          </ActionButton>
        )}

        {/* Skip is as easy to hit as Next, on every screen, and says what it
            does. It is not a link hidden under the fold. */}
        <ActionButton size="lg" fullWidth variant="secondary" onClick={skip}>
          {t("common.skip")}
        </ActionButton>

        {step > 1 ? (
          <ActionButton
            size="lg"
            fullWidth
            variant="ghost"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => setStep((current) => (current - 1) as Step)}
          >
            {t("common.back")}
          </ActionButton>
        ) : null}
      </div>
    </Frame>
  );
}

const QUESTION_LABEL: Record<Step, TranslationKey> = {
  1: "onboarding.q_language",
  2: "onboarding.q_view",
  3: "onboarding.q_text",
  4: "onboarding.q_contrast",
  5: "onboarding.q_read_aloud",
  6: "onboarding.q_support",
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-lg sm:p-8">{children}</div>
    </main>
  );
}
