# PayBridge (BridgeIT) — Engineering PRD (v1)

Status: pre-launch, in active development. This PRD describes the intended product and
architecture. For a factual line on what is actually built today versus still to be built
against every service and flow named here, see **[AGENTS.md](AGENTS.md)**.

---

## Product Vision

PayBridge is a workforce finance platform that enables employees to access a portion of wages
they have already earned before payday through employer-integrated payroll. The platform also
provides savings and investment products, while enabling employers to offer financial
wellbeing benefits without funding loans themselves. Capital providers fund the liquidity and
receive portfolio reporting.

**North Star: Build Africa's Workforce Finance Infrastructure.**

## Core Users

**Employee**
- Register and complete KYC
- View earned wages
- Request a Bridge
- Repay automatically through payroll
- Save and invest
- View transactions and manage profile

**Employer**
- Manage employee eligibility
- Upload or sync payroll
- Monitor utilisation
- Reconcile payroll deductions
- Access reports

**Capital Partner**
- Commit capital
- Monitor portfolio performance
- Receive statements
- Request withdrawals

**Operations**
- Underwrite employers
- Review KYC
- Monitor risk
- Manage treasury, funding and reconciliation
- Support customers

**Admin**
- Manage users and roles
- Audit all activity
- Manage demo invitations
- Configure platform settings

## Core Product Modules

The platform consists of five primary applications:

1. Employee App
2. Employer Portal
3. Investor Portal
4. Operations Console
5. Admin Portal

These applications share the same backend services and database.

## Core Business Flow

```
Employer onboarded
        ↓
Payroll uploaded/synchronised
        ↓
Employees invited
        ↓
Employee completes KYC
        ↓
Eligibility calculated
        ↓
Employee requests Bridge
        ↓
Risk validation
        ↓
Treasury approves funding
        ↓
Funds disbursed
        ↓
Payroll deduction
        ↓
Repayment completed
```

## Business Rules

An employee can only request a Bridge if:
- Employer is active
- Payroll has been synced
- Employment is verified
- KYC is approved
- Requested amount does not exceed available earned wages
- Risk checks pass
- Treasury liquidity is available

Every transaction must have a complete audit trail.
No manual changes to financial records are permitted without logging.

## Core Services

The backend should expose services for:

- Authentication
- Employer Management
- Employee Management
- Payroll Engine
- Eligibility Engine
- Bridge Engine
- Treasury
- Repayments
- Savings
- Investments
- Risk & Compliance
- Notifications
- Reporting
- Admin

Each service should expose REST APIs and enforce role-based permissions.

## Non-Negotiable Requirements

- Employer-integrated payroll model only (no direct consumer lending)
- Mandatory KYC before any funds move
- Role-based access control across all portals
- MFA for staff and administrators
- End-to-end audit logging
- Encrypted sensitive data
- Fully traceable money movement
- Idempotent financial operations
- Secure API-first architecture

## MVP Deliverables

The first production release must support:

- Employer onboarding
- Employee registration and KYC
- Payroll upload/synchronisation
- Eligibility calculation
- Bridge request workflow
- Risk approval
- Treasury funding
- Payroll repayment
- Employer dashboard
- Employee dashboard
- Operations dashboard
- Admin console
- Basic investor dashboard

**Success is defined by completing the entire employer → employee → Bridge → payroll
repayment lifecycle for a live pilot employer with secure, auditable, and reliable
operations.**
