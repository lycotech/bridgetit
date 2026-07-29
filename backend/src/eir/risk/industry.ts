/**
 * INDUSTRY CONTEXT ENGINE.
 *
 * The same balance sheet means different things in different sectors. A private
 * school with three months of near-zero inflows is not distressed — it is
 * August. A construction contractor with the same pattern may be waiting on a
 * payment certificate that will never come. A generic model reads both as
 * "volatile cash flow" and gets one of them badly wrong.
 *
 * So each sector carries:
 *   - a baseline context score, reflecting how well payroll lending fits the
 *     sector's structure;
 *   - the specific risks a reviewer must look at, which become the diligence
 *     checklist on the employer profile;
 *   - seasonality, so a quiet month is not scored as a collapse;
 *   - the receivable/counterparty concentration typical of the sector, which is
 *     what makes a concentration figure interpretable rather than alarming.
 *
 * Administrators can adjust weights and add sector questions (the policy's
 * `industryOverrides`); this file is the shipped starting point, not a ceiling.
 */

export interface IndustryTemplate {
  key: string;
  label: string;
  /**
   * 0–100 baseline suitability for payroll-backed products, before any
   * employer-specific adjustment. Not a judgement of the sector's worth — a
   * statement about how predictable its payroll funding is.
   */
  baseScore: number;
  /** One-line reading of the sector for the credit paper. */
  summary: string;
  /** What a reviewer must specifically examine. Becomes a checklist. */
  considerations: string[];
  /** Documents this sector needs beyond the standard set. */
  additionalDocuments: string[];
  /**
   * Months where inflows are structurally low. Used to suppress volatility and
   * revenue-trend penalties that are really just the sector's calendar.
   * 1 = January.
   */
  lowSeasonMonths: number[];
  /**
   * Expected largest-counterparty share of receivables. A hospital at 60% HMO
   * is normal; a retailer at 60% one customer is not. Concentration is scored
   * against this, not against an absolute.
   */
  expectedConcentration: number;
  /** True where revenue depends on public-sector budget cycles. */
  governmentExposed: boolean;
  /** True where the sector is excluded by policy — trips the knockout rule. */
  prohibited: boolean;
}

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    key: "professional_services",
    label: "Professional services",
    baseScore: 84,
    summary:
      "Fee income against retainers and billable work. Payroll is the dominant cost, so salary coverage tracks collections closely.",
    considerations: [
      "Retainer versus project mix, and how much of revenue recurs",
      "Debtor days on client invoices",
      "Partner or principal drawings taken ahead of salaries",
      "Client concentration among the top three accounts",
      "Staff attrition, since revenue leaves with the people",
    ],
    additionalDocuments: ["Top client contracts or retainer agreements", "Debtor ageing schedule"],
    lowSeasonMonths: [],
    expectedConcentration: 0.35,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "financial_services",
    label: "Financial services",
    baseScore: 78,
    summary:
      "Regulated income, generally stable payroll, but the licence is the business. Regulatory standing outweighs most financial metrics.",
    considerations: [
      "Licence category, validity and any regulatory sanction",
      "Regulatory capital adequacy and any breach history",
      "Whether client funds are segregated from operating accounts",
      "Exposure to a single funding counterparty",
      "Whether PayBridge exposure would be to the operating entity or a fund",
    ],
    additionalDocuments: ["Regulatory licence", "Most recent regulatory returns", "Capital adequacy computation"],
    lowSeasonMonths: [],
    expectedConcentration: 0.3,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "education",
    label: "Education",
    baseScore: 74,
    summary:
      "School-fee collection is lumpy and termly while payroll is monthly. The mismatch — not the annual total — is the risk being underwritten.",
    considerations: [
      "Fee collection rate per term and the ageing of unpaid fees",
      "Enrolment trend across the last three sessions",
      "Whether staff are paid through the long holiday, and from what",
      "Concentration of income in the first weeks of each term",
      "Fee increases already announced versus parental resistance",
      "Whether the school owns or leases its premises",
    ],
    additionalDocuments: [
      "Enrolment history by session",
      "Fee schedule and collection report by term",
      "Lease or title for the premises",
    ],
    /* Nigerian school calendar: the long vacation and the December break are
     * structurally quiet. Scoring those months as deterioration would penalise
     * every school in the portfolio for existing. */
    lowSeasonMonths: [7, 8, 12],
    expectedConcentration: 0.2,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "healthcare",
    label: "Healthcare",
    baseScore: 76,
    summary:
      "Recurring demand and stable payroll, offset by HMO receivables that settle slowly and concentrate with a handful of payers.",
    considerations: [
      "HMO receivable ageing and the share beyond ninety days",
      "Mix of HMO, corporate, and out-of-pocket patient payment",
      "Concentration with the largest two or three HMOs",
      "Supplier and consumable obligations, and any credit stops",
      "Facility licence and professional registrations currency",
      "Whether claim rejections are material and rising",
    ],
    additionalDocuments: [
      "HMO receivable ageing schedule",
      "Facility operating licence",
      "Top HMO contracts",
    ],
    lowSeasonMonths: [],
    expectedConcentration: 0.55,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "construction",
    label: "Construction",
    baseScore: 62,
    summary:
      "Project-concentrated and certificate-driven. Payroll continues while a valuation is disputed, which is exactly when a buffer is drawn and hardest to repay.",
    considerations: [
      "Order book by project, and what share the largest represents",
      "Payment certificates issued but unpaid, with ageing",
      "Retention sums held and when they are releasable",
      "Percentage completion versus billing on live projects",
      "Public-sector share of the order book and its payment record",
      "Whether subcontractors are owed, since they rank alongside payroll",
      "Performance bonds and any calls made on them",
    ],
    additionalDocuments: [
      "Order book and project schedule",
      "Payment certificates and valuation history",
      "Retention schedule",
      "Major contracts",
    ],
    lowSeasonMonths: [],
    expectedConcentration: 0.6,
    governmentExposed: true,
    prohibited: false,
  },
  {
    key: "real_estate",
    label: "Real estate",
    baseScore: 68,
    summary:
      "Asset-rich, frequently cash-poor. Rental income can be reliable, but development activity swallows liquidity and payroll competes with construction draws.",
    considerations: [
      "Split between recurring rental income and development sales",
      "Occupancy and rent collection rates",
      "Development commitments falling due in the facility period",
      "Whether assets are already encumbered to other lenders",
      "Off-plan pre-sales and buyer default exposure",
    ],
    additionalDocuments: ["Rent roll", "Schedule of properties and encumbrances", "Development commitments"],
    lowSeasonMonths: [],
    expectedConcentration: 0.45,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "oil_gas_services",
    label: "Oil and gas services",
    baseScore: 64,
    summary:
      "Large contracts, long payment cycles and foreign-currency cost exposure. Individual receivables are big enough that one delay is a payroll event.",
    considerations: [
      "Dependence on a single international or NNPC-linked counterparty",
      "Foreign-exchange exposure between costs and revenue currency",
      "Receivable ageing, which routinely exceeds ninety days",
      "Contract renewal dates falling inside the facility period",
      "Local-content compliance status",
      "Sector capital-expenditure cycle and rig or project activity",
    ],
    additionalDocuments: [
      "Major service contracts",
      "Receivable ageing by counterparty",
      "Local content compliance certificate",
    ],
    lowSeasonMonths: [],
    expectedConcentration: 0.65,
    governmentExposed: true,
    prohibited: false,
  },
  {
    key: "manufacturing",
    label: "Manufacturing",
    baseScore: 72,
    summary:
      "Working-capital intensive with real assets. Input costs and power are the swing factors, and both are currency-exposed.",
    considerations: [
      "Capacity utilisation and its trend",
      "Raw-material import dependence and currency exposure",
      "Inventory days and any obsolescence",
      "Energy cost as a share of production cost",
      "Distributor concentration and credit terms extended",
      "Existing asset finance and whether plant is encumbered",
    ],
    additionalDocuments: ["Production and capacity report", "Inventory schedule", "Asset finance schedule"],
    lowSeasonMonths: [],
    expectedConcentration: 0.4,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "retail",
    label: "Retail",
    baseScore: 70,
    summary:
      "Daily cash conversion is a genuine strength for payroll timing; thin margins and seasonality are the offsetting weakness.",
    considerations: [
      "Like-for-like sales trend per outlet",
      "Gross margin stability against input-cost inflation",
      "Seasonal concentration, particularly the December quarter",
      "Lease obligations and the number of outlets",
      "Supplier credit terms and any stop-supply history",
      "Share of takings that is card or transfer versus cash",
    ],
    additionalDocuments: ["Sales report by outlet", "Lease schedule"],
    lowSeasonMonths: [1, 2],
    expectedConcentration: 0.2,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "logistics",
    label: "Logistics",
    baseScore: 71,
    summary:
      "Contract haulage produces predictable revenue; fuel and fleet maintenance produce unpredictable costs.",
    considerations: [
      "Contract versus spot revenue mix",
      "Fuel cost as a share of revenue and any pass-through mechanism",
      "Fleet age, maintenance spend and downtime",
      "Customer concentration on the top two accounts",
      "Insurance and claims history",
      "Existing fleet finance obligations",
    ],
    additionalDocuments: ["Fleet schedule", "Haulage contracts", "Insurance certificates"],
    lowSeasonMonths: [],
    expectedConcentration: 0.5,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "technology",
    label: "Technology",
    baseScore: 80,
    summary:
      "Recurring subscription revenue supports payroll well. The risk is that payroll IS the cost base, so a revenue stall is immediately a payroll problem.",
    considerations: [
      "Recurring versus one-off revenue, and net revenue retention",
      "Customer churn and contract lengths",
      "Runway if the business is investor-funded rather than profitable",
      "Whether the last funding round is disclosed and verifiable",
      "Payroll as a share of total cost, typically very high",
      "Foreign-currency revenue against naira payroll, or the reverse",
    ],
    additionalDocuments: ["Recurring revenue schedule", "Funding evidence where loss-making"],
    lowSeasonMonths: [],
    expectedConcentration: 0.35,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "hospitality",
    label: "Hospitality",
    baseScore: 63,
    summary:
      "Highly seasonal, largely cash-converting, and the first sector to feel a discretionary-spending squeeze.",
    considerations: [
      "Occupancy or covers trend and seasonal pattern",
      "Revenue per available room or per cover",
      "Event and group booking concentration",
      "Lease or mortgage obligations on the property",
      "Casual and seasonal staff share of payroll",
      "Discretionary-spending sensitivity in the current environment",
    ],
    additionalDocuments: ["Occupancy report", "Lease or mortgage documentation"],
    lowSeasonMonths: [2, 5, 9],
    expectedConcentration: 0.25,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "agriculture",
    label: "Agriculture",
    baseScore: 60,
    summary:
      "Harvest-cycle income against continuous payroll, plus weather and price exposure the employer does not control.",
    considerations: [
      "Crop or livestock cycle and where the facility period sits in it",
      "Offtake agreements and their enforceability",
      "Weather and yield exposure, and any insurance",
      "Commodity price exposure and hedging, if any",
      "Whether payroll is permanent or seasonal labour",
      "Access to intervention or development finance already drawn",
    ],
    additionalDocuments: ["Offtake agreements", "Production and yield history", "Insurance cover"],
    lowSeasonMonths: [3, 4, 5],
    expectedConcentration: 0.55,
    governmentExposed: false,
    prohibited: false,
  },
  {
    key: "government_contractor",
    label: "Government contractor",
    baseScore: 56,
    summary:
      "Counterparty credit is strong in principle and slow in practice. Payment timing, not payment ability, is what is being underwritten.",
    considerations: [
      "Contract award verification against the awarding authority",
      "Historical payment record on completed contracts, in days",
      "Receivable ageing, including any prior-budget-year balances",
      "Budget line and appropriation status for current contracts",
      "Political and budget-cycle risk over the facility period",
      "Whether mobilisation was received and how it was applied",
      "Certificate-to-cash conversion time",
    ],
    additionalDocuments: [
      "Contract award letters",
      "Payment certificates and history",
      "Receivable ageing by ministry or agency",
    ],
    lowSeasonMonths: [1],
    expectedConcentration: 0.75,
    governmentExposed: true,
    prohibited: false,
  },
  {
    key: "non_profit",
    label: "Non-profit organisation",
    baseScore: 66,
    summary:
      "Grant-funded payroll can be very reliable while the grant runs and stops abruptly when it does not. The grant calendar is the credit question.",
    considerations: [
      "Donor and grant concentration",
      "Grant periods and expiry dates against the facility period",
      "Whether grant terms permit interest or financing costs",
      "Restricted versus unrestricted funds, and which pays salaries",
      "Reporting compliance history with major donors",
      "Reserve policy and unrestricted reserve level",
    ],
    additionalDocuments: ["Grant agreements", "Donor schedule", "Audited fund accounting"],
    lowSeasonMonths: [],
    expectedConcentration: 0.6,
    governmentExposed: false,
    prohibited: false,
  },
];

const BY_KEY = new Map(INDUSTRY_TEMPLATES.map((t) => [t.key, t]));

export function industryTemplate(key: string | null | undefined): IndustryTemplate | null {
  return key ? (BY_KEY.get(key) ?? null) : null;
}

export const INDUSTRY_OPTIONS = INDUSTRY_TEMPLATES.map((t) => ({ value: t.key, label: t.label }));

/**
 * Whether a month is structurally quiet for a sector.
 *
 * Used by the financial module to damp volatility and trend penalties. Without
 * it, every school in the portfolio scores as deteriorating each August and
 * recovering each September, and a reviewer learns to ignore the metric — which
 * is worse than not having it.
 */
export function isLowSeason(industry: string | null, month: number): boolean {
  const template = industryTemplate(industry);
  return template ? template.lowSeasonMonths.includes(month) : false;
}

/** The industry component score, plus the factors that explain it. */
export interface IndustryContextResult {
  score: number;
  classification: "strong" | "acceptable" | "watch" | "weak" | "critical" | "insufficient_data";
  summary: string;
  considerations: string[];
  factors: { factor: string; effect: "positive" | "negative" | "neutral"; detail: string }[];
}

/**
 * Score the industry component.
 *
 * Starts from the sector baseline and adjusts for the employer's own position
 * within it — public-sector dependence beyond what the sector already implies,
 * concentration materially worse than the sector norm, and business age, since
 * a young company in a cyclical sector has not yet been through a cycle.
 */
export function scoreIndustryContext(input: {
  industry: string | null;
  /** Largest counterparty share of receivables, 0–1, where known. */
  observedConcentration: number | null;
  /** Months since incorporation, where known. */
  businessAgeMonths: number | null;
  /** Declared share of revenue from public-sector counterparties, 0–1. */
  governmentRevenueShare: number | null;
}): IndustryContextResult {
  const template = industryTemplate(input.industry);

  if (!template) {
    return {
      score: 50,
      classification: "insufficient_data",
      /*
       * A neutral 50 rather than a zero or a pass. An unclassified industry is
       * an information gap, and the honest treatment of a gap is the middle of
       * the range plus a visible instruction to fix it — not a penalty that
       * looks like a finding, and not a free pass that hides one.
       */
      summary: "Industry not classified. Assign a sector before this component can be assessed.",
      considerations: ["Assign the employer to an industry template so sector risks are assessed."],
      factors: [
        {
          factor: "Industry not set",
          effect: "neutral",
          detail: "Scored at the midpoint pending classification. Not a finding either way.",
        },
      ],
    };
  }

  let score = template.baseScore;
  const factors: IndustryContextResult["factors"] = [
    {
      factor: `Sector baseline: ${template.label}`,
      effect: template.baseScore >= 75 ? "positive" : template.baseScore >= 65 ? "neutral" : "negative",
      detail: template.summary,
    },
  ];

  if (template.governmentExposed) {
    score -= 4;
    factors.push({
      factor: "Public-sector payment cycle",
      effect: "negative",
      detail:
        "Sector revenue depends on public-sector payment timing, which is slower and less predictable than the payroll calendar it must fund.",
    });
  }

  if (input.governmentRevenueShare !== null && input.governmentRevenueShare > 0.5) {
    score -= 6;
    factors.push({
      factor: "Majority public-sector revenue",
      effect: "negative",
      detail: `${Math.round(input.governmentRevenueShare * 100)}% of revenue is from public-sector counterparties, above the 50% policy attention threshold.`,
    });
  }

  if (input.observedConcentration !== null) {
    const excess = input.observedConcentration - template.expectedConcentration;
    if (excess > 0.15) {
      score -= 8;
      factors.push({
        factor: "Concentration worse than sector norm",
        effect: "negative",
        detail: `Largest counterparty is ${Math.round(input.observedConcentration * 100)}% of receivables against a sector norm of ${Math.round(template.expectedConcentration * 100)}%.`,
      });
    } else if (excess < -0.15) {
      score += 5;
      factors.push({
        factor: "Better diversified than sector norm",
        effect: "positive",
        detail: `Largest counterparty is ${Math.round(input.observedConcentration * 100)}% of receivables against a sector norm of ${Math.round(template.expectedConcentration * 100)}%.`,
      });
    }
  }

  if (input.businessAgeMonths !== null) {
    if (input.businessAgeMonths < 24) {
      score -= 8;
      factors.push({
        factor: "Business under two years old",
        effect: "negative",
        detail: `${input.businessAgeMonths} months since incorporation. The company has not yet traded through a full sector cycle.`,
      });
    } else if (input.businessAgeMonths >= 120) {
      score += 5;
      factors.push({
        factor: "Ten or more years of trading",
        effect: "positive",
        detail: `${Math.round(input.businessAgeMonths / 12)} years since incorporation, through more than one economic cycle.`,
      });
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const classification =
    score >= 80 ? "strong" : score >= 68 ? "acceptable" : score >= 55 ? "watch" : score >= 40 ? "weak" : "critical";

  return {
    score,
    classification,
    summary: template.summary,
    considerations: template.considerations,
    factors,
  };
}
