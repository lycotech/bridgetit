import { Eye, HandHeart, Loader2, Lock, MessageSquare, ShieldCheck, Volume2 } from "lucide-react";
import { Panel, InfoNote, Divider } from "@/components/dashboard/Panel";
import { RadioCards, ToggleRow } from "@/components/dashboard/forms";
import { LanguageSelector } from "./LanguageSelector";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import type { SupportChannel } from "../../../../backend/src/types";

/**
 * "How should PayBridge work for you?" — the settings panel.
 *
 * WHAT THIS PANEL DOES NOT ASK, and has no field for: why. There is no question
 * about eyesight, hearing, hands, literacy or health anywhere in it, and no
 * column behind it to hold an answer. Every setting is phrased as a thing the
 * app should DO — bigger writing, stronger colours, do not call me — because
 * that is the only information PayBridge needs and the only information it is
 * entitled to. A person who wants larger text in bright sunlight and a person
 * with low vision tick the same box and are treated identically.
 *
 * WHO CAN SEE IT: the person themselves, and support staff who hold
 * `support.accessibility.view` and whose every read is logged. There is no
 * employer-facing endpoint that returns any of this. See the header of
 * backend/src/routes/admin-support.ts.
 *
 * Each change saves on the spot. There is no Save button, on purpose: a settings
 * page where the change only takes effect after finding and pressing a second
 * button is a page where somebody turns on large text, sees nothing happen, and
 * concludes it does not work.
 */

const CHANNELS: { value: SupportChannel; labelKey: "support.whatsapp" | "support.write" | "support.call" | "support.callback" | "support.email"; voice: boolean }[] = [
  { value: "whatsapp", labelKey: "support.whatsapp", voice: false },
  { value: "written", labelKey: "support.write", voice: false },
  { value: "email", labelKey: "support.email", voice: false },
  { value: "callback", labelKey: "support.callback", voice: true },
  { value: "phone", labelKey: "support.call", voice: true },
];

const VOICE_CHANNELS: SupportChannel[] = ["phone", "callback"];

export function PreferencesPanel() {
  const { prefs, update, t, saving, saveError, signedIn } = usePreferences();

  return (
    <Panel
      title={t("prefs.title")}
      description={t("prefs.intro")}
      footer={
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {saving ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t("prefs.saving")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {signedIn ? t("prefs.saved_to_account") : t("prefs.saved_on_device")}
            </span>
          )}
        </div>
      }
    >
      {/* A failed save is announced, because the person needs to know the setting
          is working here but has not been remembered yet. */}
      {saveError ? (
        <InfoNote tone="attention" role="alert" className="mb-4">
          {saveError}
        </InfoNote>
      ) : null}

      <div className="space-y-6">
        <LanguageSelector />

        <Divider />

        <section aria-labelledby="prefs-display">
          <h3
            id="prefs-display"
            className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground"
          >
            <Eye className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t("prefs.display_group")}
          </h3>
          <div className="mt-2 divide-y divide-border/70">
            <ToggleRow
              title={t("prefs.large_text")}
              description={t("prefs.large_text_help")}
              checked={prefs.largeText}
              onChange={(largeText) => update({ largeText })}
              stateLabels={[t("common.on"), t("common.off")]}
            />
            <ToggleRow
              title={t("prefs.high_contrast")}
              description={t("prefs.high_contrast_help")}
              checked={prefs.highContrast}
              onChange={(highContrast) => update({ highContrast })}
              stateLabels={[t("common.on"), t("common.off")]}
            />
            <ToggleRow
              title={t("prefs.simple_view")}
              description={t("prefs.simple_view_help")}
              checked={prefs.simpleView}
              onChange={(simpleView) => update({ simpleView })}
              stateLabels={[t("common.on"), t("common.off")]}
            />
            <ToggleRow
              title={t("prefs.reduce_motion")}
              description={t("prefs.reduce_motion_help")}
              checked={prefs.reduceMotion}
              onChange={(reduceMotion) => update({ reduceMotion })}
              stateLabels={[t("common.on"), t("common.off")]}
            />
          </div>
        </section>

        <Divider />

        <section aria-labelledby="prefs-audio">
          <h3
            id="prefs-audio"
            className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground"
          >
            <Volume2 className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t("listen.reading")}
          </h3>
          <div className="mt-2">
            <ToggleRow
              title={t("prefs.read_aloud")}
              description={t("prefs.read_aloud_help")}
              checked={prefs.readAloud}
              onChange={(readAloud) => update({ readAloud })}
              stateLabels={[t("common.on"), t("common.off")]}
            />
          </div>
        </section>

        <Divider />

        <section aria-labelledby="prefs-support" className="space-y-4">
          <h3
            id="prefs-support"
            className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground"
          >
            <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t("prefs.support_group")}
          </h3>

          <RadioCards<SupportChannel>
            legend={t("prefs.support_channel")}
            hint={t("prefs.support_channel_help")}
            value={prefs.supportChannel}
            onChange={(supportChannel) =>
              // Choosing a phone channel contradicts "do not call me", so the
              // contradiction is resolved here rather than left for support
              // staff to interpret from two fields that disagree.
              update(
                VOICE_CHANNELS.includes(supportChannel)
                  ? { supportChannel, textOnly: false }
                  : { supportChannel },
              )
            }
            name="paybridge-support-channel"
            columns={2}
            options={CHANNELS.map((channel) => ({
              value: channel.value,
              label: t(channel.labelKey),
            }))}
          />

          <div className="divide-y divide-border/70">
            <ToggleRow
              title={t("prefs.support_text_only")}
              description={t("prefs.support_text_only_help")}
              checked={prefs.textOnly}
              onChange={(textOnly) =>
                update(
                  // Turning this on while a phone channel is selected moves the
                  // channel to writing. Otherwise the person has asked not to be
                  // phoned and simultaneously asked to be phoned.
                  textOnly && VOICE_CHANNELS.includes(prefs.supportChannel)
                    ? { textOnly, supportChannel: "written" }
                    : { textOnly },
                )
              }
              stateLabels={[t("common.on"), t("common.off")]}
            />
            <ToggleRow
              title={t("prefs.assisted_onboarding")}
              description={t("prefs.assisted_onboarding_help")}
              checked={prefs.assistedOnboarding}
              onChange={(assistedOnboarding) => update({ assistedOnboarding })}
              stateLabels={[t("common.yes"), t("common.no")]}
            />
          </div>

          {prefs.assistedOnboarding ? (
            <InfoNote tone="success">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <HandHeart className="h-3.5 w-3.5" aria-hidden />
                {t("prefs.assisted_requested")}
              </span>
            </InfoNote>
          ) : null}
        </section>

        <InfoNote tone="primary">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {t("prefs.private_note")}
          </span>
        </InfoNote>
      </div>
    </Panel>
  );
}
