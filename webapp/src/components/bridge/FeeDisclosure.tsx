import { Info } from "lucide-react";
import { naira, longDate } from "@/lib/platform/format";
import { usePreferences } from "@/lib/prefs/PreferencesProvider";
import { ListenButton } from "@/components/prefs/ListenButton";

/**
 * The six numbers, before anything is confirmed.
 *
 *   1. Money available today
 *   2. Amount you are asking for
 *   3. Amount you will receive          ← goes into the bank account
 *   4. PayBridge fee
 *   5. Total taken on payday            ← 2 + 4
 *   6. Date it is taken
 *
 * THE FEE IS ADDED, NOT SUBTRACTED. Line 3 equals line 2 exactly, and line 5 is
 * where the fee appears. Netting the fee off the transfer is the industry's
 * favourite quiet unpleasantness: somebody asks for ₦50,000 to pay school fees,
 * ₦48,500 lands, and they are short on the day they needed to be exact. Here,
 * ₦50,000 asked for is ₦50,000 received and ₦51,500 taken on payday.
 *
 * EVERY LINE IS A FULL SENTENCE OF PLAIN LANGUAGE, from the translation
 * catalogue — "money you have earned", never "accrued earnings"; "total taken on
 * payday", never "settlement obligation". Somebody who cannot parse the phrase
 * cannot consent to the deal, whatever the arithmetic says.
 *
 * It reads as a <dl> so a screen reader pairs each label with its figure, and it
 * carries a Listen button because this is the screen that most needs to be
 * understood rather than skimmed.
 */
export function FeeDisclosure({
  available,
  amount,
  fee,
  paydayIso,
}: {
  available: number;
  amount: number;
  fee: number;
  paydayIso: string;
}) {
  const { t } = usePreferences();
  const total = amount + fee;
  const payday = longDate(paydayIso);

  const lines: { label: string; value: string; hint?: string; emphasis?: boolean }[] = [
    { label: t("employee.available_amount"), value: naira(available), hint: t("employee.available_amount_help") },
    { label: t("employee.bridge_amount"), value: naira(amount) },
    {
      label: t("employee.amount_received"),
      value: naira(amount),
      hint: t("employee.amount_received_help"),
      emphasis: true,
    },
    { label: t("employee.bridge_fee"), value: naira(fee), hint: t("employee.bridge_fee_help") },
    {
      label: t("employee.total_deduction"),
      value: naira(total),
      hint: t("employee.total_deduction_help"),
      emphasis: true,
    },
    { label: t("employee.repayment_date"), value: payday },
  ];

  /* What the Listen button says: the same six lines, as sentences. */
  const spoken = [
    `${t("employee.available_amount")}: ${naira(available)}.`,
    `${t("employee.bridge_amount")}: ${naira(amount)}.`,
    `${t("employee.amount_received")}: ${naira(amount)}. ${t("employee.amount_received_help")}`,
    `${t("employee.bridge_fee")}: ${naira(fee)}.`,
    `${t("employee.total_deduction")}: ${naira(total)}. ${t("employee.total_deduction_help")}`,
    `${t("employee.repayment_date")}: ${payday}.`,
    t("bridge.not_free_money"),
  ].join(" ");

  return (
    <div>
      <dl className="divide-y divide-border/70">
        {lines.map((line) => (
          <div key={line.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <dt className="min-w-0 flex-1">
              <span
                className={
                  line.emphasis
                    ? "text-sm font-bold text-foreground"
                    : "text-sm font-medium text-muted-foreground"
                }
              >
                {line.label}
              </span>
              {line.hint ? (
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{line.hint}</span>
              ) : null}
            </dt>
            <dd
              className={
                line.emphasis
                  ? "font-display text-lg font-extrabold text-foreground tnum"
                  : "font-display text-base font-bold text-foreground tnum"
              }
            >
              {line.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/[0.06] p-3.5 text-sm leading-relaxed text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          {t("bridge.fee_promise")} {t("bridge.not_free_money")}
        </span>
      </p>

      <ListenButton className="mt-3" text={spoken} />
    </div>
  );
}
