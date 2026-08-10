# PayBridge Website Copy Brief — Positioning Update

Received 2026-08-10. Status: **not yet implemented** — see `AGENTS.md` §8 for the grounded
punch list (which files each change touches) and for structural conflicts found while auditing
the brief against the live code. This file is the copy/positioning source of truth; implement
from the exact wording here, not from a paraphrase.

## Why this update exists

PayBridge must stop reading like a second payroll system. Two things have to be obvious on the
site:

1. PayBridge works **around** an employer's existing payroll — it does not replace or duplicate it.
2. Employees keep their existing bank account — PayBridge does not require abandoning it.

Brand line stays: **PayBridge Workforce — Financial wellbeing, built around work.**

## The five things a visitor must understand within two minutes

1. PayBridge is an employer-enabled financial wellbeing platform.
2. Employees can access part of verified earned income when eligible.
3. Employers should not have to run another payroll.
4. Employees can keep their existing bank relationship.
5. PayBridge extends beyond Access into Save, Invest and Learn.

If a page doesn't move the reader toward these five, it needs another pass.

## Hard rules — claims we must NOT publish yet

These may become true later once banking/legal infrastructure is signed and tested, but not now:

- "PayBridge automatically deducts from salary before releasing the balance."
- "PayBridge works with every payroll provider."
- "Your salary is automatically swept to your existing bank."
- "PayBridge guarantees 18% returns."
- "No credit assessment is required."
- "Employers cannot see employee activity." (also avoid the softer "Your employer sees nothing" — not operationally accurate)
- "No documents" (implies no KYC/employment verification — not true)

Use hedged language instead: **designed to**, **where supported**, **subject to eligibility**,
**through regulated partners**.

## Terminology rules

| Don't use publicly | Use instead |
|---|---|
| Bridgers (as a user/audience category) | Employees / Employers / Funding Partners |
| intermediate account / collection account / virtual salary wallet | PayBridge Account |
| No documents | Simple digital onboarding |
| "From Payroll to Prosperity" as the lead promise | Secondary expression only — primary is "Financial wellbeing, built around work." |

Exception: inside the authenticated app, the transaction itself can still be labeled **Bridge**
(e.g. "Bridge ₦50,000") — only the public *user category* "Bridgers" goes away.

## Section-by-section target copy

### 1. Homepage hero
Supporting copy:
> Financial wellbeing, built around work.
> Life does not always wait for payday.
> PayBridge helps eligible employees responsibly access part of their verified earned income
> when needed, while building stronger financial habits through savings, investments and
> practical financial education.

Two short audience statements:
- **For employees** — Greater financial flexibility without abandoning your existing bank.
- **For employers** — One payroll process, less salary-advance administration and a more
  structured approach to employee financial wellbeing.

Keep: **Access. Save. Invest. Learn.**
CTAs: **For Employees** / **For Employers** — do not lead with a waitlist CTA.

### 2. New employer section — "One payroll. No duplicate work."
> Your payroll stays where it is.
> PayBridge is designed to work around your existing payroll process rather than create another
> one.
> Eligible employees can activate PayBridge through their employer and receive access to the
> PayBridge financial ecosystem without requiring HR to run a second payroll or manually process
> individual salary-advance requests.
> PayBridge is being designed to automate eligibility, settlement and reconciliation within
> agreed employer rules.

Supporting line: *You run payroll once. PayBridge handles the rest around it.*
Say "designed to," not "fully automated" or "already integrated with all payroll systems."

### 3. New section — "How PayBridge fits into payroll" (4 steps)
1. **Employee activates PayBridge** — Eligible employees onboard following employer approval and
   complete the required verification.
2. **Employer runs payroll once** — The employer continues using its normal payroll process.
3. **PayBridge settlement** — Where the employee has used PayBridge Access, the approved
   settlement is processed through the PayBridge account infrastructure.
4. **Employee receives the balance** — The remaining salary can be transferred to the employee's
   nominated everyday bank account.

Bottom statement: *One payroll process. Minimal HR administration. Designed for automated
reconciliation.*

### 4. New product section — "Your PayBridge Account"
> Every verified PayBridge user can receive a dedicated account linked to their PayBridge
> profile through our regulated banking infrastructure.

Can be used to: receive eligible workplace payments · fund savings · fund investments · receive
transfers from other bank accounts · support PayBridge Access settlement where activated.

Employee message:
> You do not have to abandon your existing bank. Your existing bank can remain your everyday
> spending account. Where supported, balances remaining after settlement can be transferred
> automatically to your nominated bank account.

Engineering note: never call this "intermediate account," "collection account," or "virtual
salary wallet" publicly — always "PayBridge Account." Internally it may end up built on virtual
or dedicated account infrastructure from a regulated bank or PSP; that's an implementation
detail, not the public name.

### 5. Access product copy
Headline: **Access what you have earned. Responsibly.**
> PayBridge Access allows eligible employees to access an approved portion of verified earned
> income before payday.

Subject to: employer participation · employee eligibility · verified earnings · applicable
limits · transparent charges · settlement arrangements.

Add: *Access is available only to eligible employees whose employer participates in PayBridge
and whose salary arrangement supports PayBridge settlement.* Avoid language implying universal
or automatic access.

### 6. Remove "Bridgers" as a user category
Preferred public audiences: **Employees, Employers, Funding Partners**. Employees who use Access
remain employees — don't create a separate identity around needing early access to income.
In-app transaction label "Bridge ₦50,000" stays; the public label "Bridgers" goes.

### 7. HR privacy copy
Headline: **Financial support without unnecessary exposure.**
> Your employer does not need to know why you use PayBridge Access or what you do with your
> money. Employers receive only the information required for eligibility, payroll settlement,
> reconciliation and programme administration. Personal spending, savings choices, investment
> decisions and financial goals remain private.

Avoid "Your employer sees nothing" — not operationally accurate.

### 8. Employer administration copy
Prominent statement: **PayBridge does not require HR to approve every employee request.**
> Eligibility and access limits operate within pre-agreed employer parameters and PayBridge risk
> controls. The objective is to reduce manual salary-advance requests rather than create another
> approval process for HR.

### 9. Save copy
Headline: **Build a financial buffer.**
> Build savings gradually through regulated savings or investment products made available
> through PayBridge partners.

Do not advertise a fixed return (e.g. 18% p.a.) unless the product, provider, rate, liquidity
terms and disclosures are formally approved.

### 10. Invest copy
Headline: **Invest towards what comes next.**
> Explore investment options suited to your goals, investment horizon and risk profile through
> appropriately regulated investment providers. Investment products remain subject to
> eligibility, suitability, risk and applicable terms.

Don't imply PayBridge itself is the regulated fund manager.

### 11. Learn copy
Headline: **Make better financial decisions.**
> Practical financial education designed around real decisions employees make about income,
> savings, investment and financial planning.

Avoid generic "financial literacy courses." Don't promise AI-driven personalised advice unless
that capability is actually ready and regulated.

### 12. Replace "No documents"
Wherever the site currently says "No documents," replace with **Simple digital onboarding**.
> Identity, employment and account information can be verified digitally where supported.

Don't imply users skip KYC or employment verification.

### 13. "From Payroll to Prosperity"
Keep as a secondary brand expression only — never the principal product promise (it implies a
guaranteed financial outcome). Primary descriptor stays: **Financial wellbeing, built around
work.**

### 14. Employer value proposition — four benefits
1. **Reduce salary-advance administration** — replace informal requests, emails and manual
   approvals with a structured employee benefit.
2. **Keep payroll simple** — PayBridge is designed to work around existing payroll rather than
   create a second payroll process.
3. **Protect employee privacy** — HR receives only information necessary to administer and
   reconcile the programme.
4. **Support financial wellbeing** — give employees access to tools covering short-term
   liquidity, savings, investments and financial education.

### 15. Claims list — see "Hard rules" above (do not duplicate elsewhere).

### 16. Desired homepage flow
1. Brand — PayBridge Workforce / Financial wellbeing, built around work.
2. Core proposition — employees gain greater financial flexibility.
3. Four pillars — Access. Save. Invest. Learn.
4. Employer objection — One payroll. No duplicate work.
5. PayBridge Account — the infrastructure connecting salary and financial wellbeing.
6. Employee journey — how PayBridge works for employees.
7. Employer journey — how PayBridge works around existing payroll.
8. Privacy and trust — what employers can and cannot see.
9. Save / Invest / Learn — pathway from immediate flexibility to financial resilience.
10. Employer CTA — Talk to PayBridge.
11. Employee CTA — for now, "Learn how PayBridge works," not a promise of instant access.

## Final product principle

Build and write PayBridge around this: **PayBridge should remove work from HR, not create work
for HR.** And for employees: **PayBridge should sit around their financial life, not force them
to replace it.** This should guide both website copy and product architecture going forward.
