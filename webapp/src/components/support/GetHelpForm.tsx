import { useState } from "react";
import { Send } from "lucide-react";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { InfoNote } from "@/components/dashboard/Panel";
import {
  CheckboxField,
  RadioCards,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/dashboard/forms";
import { LanguageSelector } from "@/components/prefs/LanguageSelector";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { useCreateTicket } from "@/lib/support/customer";
import type { CreateSupportTicketInput, SupportChannel, SupportTicketView } from "../../../../backend/src/types";
import type { TranslationKey } from "@/i18n/translate";

/**
 * The one form behind all five ways of asking for help.
 *
 * WHY EVERY CHANNEL GOES THROUGH IT, including "call us" and "WhatsApp": each one
 * has to leave a ticket. A support model where the phone calls exist only in the
 * memory of whoever picked up is a model where "I called three times and nobody
 * helped me" cannot be checked — and the person it fails is the one with the
 * least ability to escalate. So the request is written down first, the reference
 * is shown, and only then does the WhatsApp link or the phone number appear.
 *
 * THE FIELDS ARE PREFILLED FROM THE PERSON'S SETTINGS: their language, their
 * chosen channel, "do not phone me", and whether they want help being set up.
 * Somebody who has already said "reply in Pidgin, in writing" should not have to
 * say it again every time they need something — and support staff should not have
 * to guess.
 *
 * WHAT IT NEVER ASKS: why they need help in that form. No health question, no
 * disability field. See backend/src/routes/support.ts.
 */

const TOPICS: { value: string; key: TranslationKey }[] = [
  { value: "bridge", key: "support.topic_bridge" },
  { value: "transaction", key: "support.topic_transaction" },
  { value: "bank", key: "support.topic_bank" },
  { value: "payday", key: "support.topic_payday" },
  { value: "using_app", key: "support.topic_using_app" },
  { value: "other", key: "support.topic_other" },
];

const CHANNELS: { value: SupportChannel; label: TranslationKey; help: TranslationKey }[] = [
  { value: "whatsapp", label: "support.whatsapp", help: "support.whatsapp_help" },
  { value: "written", label: "support.write", help: "support.write_help" },
  { value: "callback", label: "support.callback", help: "support.callback_help" },
  { value: "phone", label: "support.call", help: "support.call_help" },
  { value: "email", label: "support.email", help: "support.email_help" },
];

const NEEDS_PHONE: SupportChannel[] = ["whatsapp", "phone", "callback"];

export function GetHelpForm({
  defaultName,
  defaultEmail,
  defaultPhone,
  onCreated,
}: {
  defaultName: string;
  defaultEmail: string;
  defaultPhone: string;
  onCreated: (ticket: SupportTicketView) => void;
}) {
  const { prefs, locale, t } = usePreferences();
  const create = useCreateTicket();

  const [channel, setChannel] = useState<SupportChannel>(prefs.supportChannel);
  const [topic, setTopic] = useState(TOPICS[0].value);
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [callbackWindow, setCallbackWindow] = useState("");
  const [body, setBody] = useState("");
  const [textOnly, setTextOnly] = useState(prefs.textOnly);
  const [assisted, setAssisted] = useState(prefs.assistedOnboarding);
  const [showErrors, setShowErrors] = useState(false);

  const subject = t(TOPICS.find((entry) => entry.value === topic)?.key ?? "support.topic_other");
  const needsPhone = NEEDS_PHONE.includes(channel);

  const errors = {
    name: name.trim().length < 2 ? t("common.required") : undefined,
    email: /.+@.+\..+/.test(email.trim()) ? undefined : t("common.required"),
    phone: needsPhone && phone.trim().length < 7 ? t("common.required") : undefined,
    body: body.trim().length < 5 ? t("common.required") : undefined,
  };
  const valid = !errors.name && !errors.email && !errors.phone && !errors.body;

  const submit = () => {
    setShowErrors(true);
    if (!valid || create.isPending) return;
    const input: CreateSupportTicketInput = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      channel,
      // Their language travels with the ticket, so the reply comes back in it.
      locale,
      textOnly,
      assistedOnboarding: assisted,
      callbackWindow: channel === "callback" ? callbackWindow.trim() : "",
      subject,
      body: body.trim(),
    };
    create.mutate(input, { onSuccess: (result) => onCreated(result.ticket) });
  };

  return (
    <div className="space-y-5">
      <RadioCards<SupportChannel>
        legend={t("support.choose_channel")}
        value={channel}
        onChange={(next) => {
          setChannel(next);
          // Choosing a phone route contradicts "please do not call me", so the
          // tick clears rather than being sent alongside it.
          if (next === "phone" || next === "callback") setTextOnly(false);
        }}
        options={CHANNELS.map((entry) => ({
          value: entry.value,
          label: t(entry.label),
          description: t(entry.help),
        }))}
        columns={2}
        name="support-channel"
      />

      <SelectField
        label={t("support.subject")}
        value={topic}
        onChange={setTopic}
        options={TOPICS.map((entry) => ({ value: entry.value, label: t(entry.key) }))}
      />

      <TextAreaField
        label={t("support.message")}
        value={body}
        onChange={setBody}
        rows={5}
        hint={t("support.message_hint")}
        error={showErrors ? errors.body : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("support.your_name")}
          value={name}
          onChange={setName}
          required
          error={showErrors ? errors.name : undefined}
        />
        <TextField
          label={t("support.your_email")}
          value={email}
          onChange={setEmail}
          inputMode="email"
          required
          error={showErrors ? errors.email : undefined}
        />
      </div>

      {needsPhone ? (
        <TextField
          label={t("support.your_phone")}
          value={phone}
          onChange={setPhone}
          inputMode="tel"
          hint={t("support.your_phone_hint")}
          required
          error={showErrors ? errors.phone : undefined}
        />
      ) : null}

      {channel === "callback" ? (
        <TextField
          label={t("support.callback_window")}
          value={callbackWindow}
          onChange={setCallbackWindow}
          hint={t("support.callback_window_hint")}
        />
      ) : null}

      {/* The language the reply must come back in. Prefilled from their setting,
          changeable here, and carried on the ticket for the agent to see. */}
      <LanguageSelector legend={t("support.preferred_language")} columns={2} />

      <div className="divide-y divide-border/70">
        <CheckboxField
          checked={textOnly}
          onChange={(next) => {
            setTextOnly(next);
            if (next && (channel === "phone" || channel === "callback")) setChannel("written");
          }}
          label={t("support.text_only")}
        />
        <CheckboxField checked={assisted} onChange={setAssisted} label={t("support.assisted")} />
      </div>

      <InfoNote tone="attention">{t("support.no_secrets")}</InfoNote>

      {create.isError ? (
        <InfoNote tone="attention" role="alert">
          {create.error instanceof Error ? create.error.message : t("common.something_went_wrong")}
        </InfoNote>
      ) : null}

      <ActionButton
        size="lg"
        fullWidth
        loading={create.isPending}
        icon={<Send className="h-4 w-4" />}
        onClick={submit}
      >
        {t("support.submit")}
      </ActionButton>
    </div>
  );
}
