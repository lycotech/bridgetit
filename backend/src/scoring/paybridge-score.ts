/**
 * PAYBRIDGE SCORE — deterministic, no AI. Real counterpart of the demo-only
 * mock employee "credit score" (AGENTS.md §10), which was `random(300,850)`
 * with zero computation behind it.
 *
 * WHY THIS STARTS FROM A FLOOR, NOT A NEUTRAL BASE (unlike
 * eir/risk/behavioural.ts, whose employer score starts at a neutral 60):
 * that engine has negative signals to weigh (late responses, missed
 * repayments) because real conduct history exists for employers. Nothing in
 * this codebase tracks an individual's repayment conduct yet — Disbursement
 * and Repayment are both unbuilt (see AGENTS.md, "Disbursement/Repayment").
 * With no negative signal available, starting neutral and only ever adding
 * would make every score converge upward with no floor to fall from, which
 * is not a score, it is a countdown. Starting at the floor and only earning
 * upward means the number means something specific: "how much of what we
 * can currently observe is present," not "how trustworthy is this person" —
 * a claim this data cannot support yet.
 *
 * WHY THE CEILING IS ~680, SHORT OF "EXCELLENT" (750): repayment conduct is
 * the strongest real predictor available anywhere else in this codebase (see
 * behavioural.ts's own comment on it carrying "the widest swing"). Until
 * that exists for individuals, nobody should be able to reach the top band
 * from KYC + tenure + savings activity alone — those are real but weaker
 * signals, and the ceiling says so.
 */

const FLOOR = 300;
const CEILING = 850;

export interface PayBridgeScoreInput {
  kycStatus: string;
  /** Months since EmployeeRecord.createdAt, or null if never linked to an employer. */
  tenureMonths: number | null;
  hasActiveSavingsGoal: boolean;
  savingsDepositCount: number;
}

export interface PayBridgeScoreSignal {
  key: string;
  label: string;
  points: number;
  detail: string;
}

export type PayBridgeScoreBand = "Excellent" | "Good" | "Fair" | "Building";

export interface PayBridgeScoreResult {
  score: number;
  band: PayBridgeScoreBand;
  signals: PayBridgeScoreSignal[];
}

export function computePayBridgeScore(input: PayBridgeScoreInput): PayBridgeScoreResult {
  const signals: PayBridgeScoreSignal[] = [];
  const signal = (key: string, label: string, points: number, detail: string) => {
    if (points === 0) return;
    signals.push({ key, label, points: Math.round(points), detail });
  };

  const kycPoints = input.kycStatus === "approved" ? 120 : input.kycStatus === "pending" ? 40 : 0;
  signal(
    "kyc_status",
    "Identity verification",
    kycPoints,
    input.kycStatus === "approved"
      ? "Identity verified."
      : input.kycStatus === "pending"
        ? "Identity verification submitted and under review."
        : "Identity not yet verified.",
  );

  if (input.tenureMonths !== null) {
    const tenurePoints = Math.min(12, input.tenureMonths) * 12.5;
    signal(
      "employer_tenure",
      "Employer relationship",
      tenurePoints,
      `Linked to an employer for ${input.tenureMonths} month${input.tenureMonths === 1 ? "" : "s"}.`,
    );
  }

  if (input.hasActiveSavingsGoal) {
    signal("savings_active", "Active savings goal", 30, "Has at least one active savings goal.");
  }
  if (input.savingsDepositCount > 0) {
    signal("savings_started", "Savings activity", 30, "Has made at least one savings deposit.");
    const depositBonus = Math.min(5, input.savingsDepositCount) * 10;
    signal(
      "savings_regularity",
      "Savings regularity",
      depositBonus,
      `${input.savingsDepositCount} savings deposit${input.savingsDepositCount === 1 ? "" : "s"} recorded.`,
    );
  }

  const delta = signals.reduce((sum, s) => sum + s.points, 0);
  const score = Math.max(FLOOR, Math.min(CEILING, FLOOR + delta));

  const band: PayBridgeScoreBand = score >= 750 ? "Excellent" : score >= 650 ? "Good" : score >= 550 ? "Fair" : "Building";

  return { score, band, signals };
}
