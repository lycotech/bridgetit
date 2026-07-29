-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "organisation" TEXT,
    "role" TEXT NOT NULL,
    "goal" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "communityName" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'New',
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "organisation" TEXT,
    "jobTitle" TEXT,
    "location" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "privacyAccepted" BOOLEAN NOT NULL DEFAULT false,
    "privacyAcceptedAt" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingConsentAt" TIMESTAMP(3),
    "consentText" TEXT,
    "sourcePage" TEXT,
    "formType" TEXT,
    "source" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "followUpStatus" TEXT NOT NULL DEFAULT 'Not started',
    "assignedTeam" TEXT,
    "assignedTo" TEXT,
    "pilotPriority" TEXT NOT NULL DEFAULT 'Unset',
    "pipelineStage" TEXT NOT NULL DEFAULT 'Interest Registered',
    "internalNotes" TEXT,
    "qualified" BOOLEAN,
    "lastContactAt" TIMESTAMP(3),
    "confirmationSentAt" TIMESTAMP(3),
    "notificationSentAt" TIMESTAMP(3),
    "emailDeliveryNote" TEXT,
    "demoInvitationStatus" TEXT NOT NULL DEFAULT 'Not invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationEvent" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "message" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoInvitation" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenHint" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "inviteeName" TEXT,
    "organisation" TEXT,
    "label" TEXT,
    "portal" TEXT NOT NULL DEFAULT 'employer',
    "demoType" TEXT NOT NULL DEFAULT 'full_platform',
    "internalNote" TEXT,
    "issuedBy" TEXT NOT NULL,
    "issuedByAdminId" TEXT,
    "registrationId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3),
    "extendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoAccessLog" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT,
    "email" TEXT,
    "method" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "path" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'employee',
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "suspendedReason" TEXT,
    "kycStatus" TEXT NOT NULL DEFAULT 'not_started',
    "kycSubmittedAt" TIMESTAMP(3),
    "kycReviewedAt" TIMESTAMP(3),
    "kycReviewedBy" TEXT,
    "kycRejectionReason" TEXT,
    "kycInternalNote" TEXT,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionEpoch" INTEGER NOT NULL DEFAULT 1,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'NG',
    "state" TEXT,
    "city" TEXT,
    "idType" TEXT NOT NULL,
    "idNumberEnc" TEXT NOT NULL,
    "dateOfBirthEnc" TEXT NOT NULL,
    "addressEnc" TEXT NOT NULL,
    "bvnEnc" TEXT,
    "idNumberLast4" TEXT,
    "employerName" TEXT,
    "occupation" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "tempPasswordExpiresAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "mfaSecretEnc" TEXT,
    "mfaEnabledAt" TIMESTAMP(3),
    "mfaBackupCodes" TEXT,
    "recoveryEmail" TEXT,
    "recoveryEmailVerifiedAt" TIMESTAMP(3),
    "policyAcceptedAt" TIMESTAMP(3),
    "policyVersion" TEXT,
    "sessionEpoch" INTEGER NOT NULL DEFAULT 1,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employer" (
    "id" TEXT NOT NULL,
    "registeredName" TEXT NOT NULL,
    "tradingName" TEXT,
    "cacNumber" TEXT,
    "incorporationDate" TIMESTAMP(3),
    "companyType" TEXT,
    "tin" TEXT,
    "registeredAddress" TEXT,
    "operationalAddress" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "subIndustry" TEXT,
    "employeeCount" INTEGER,
    "monthlyPayroll" DECIMAL(18,2),
    "monthlyRevenue" DECIMAL(18,2),
    "statesOfOperation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'onboarding',
    "restrictionReason" TEXT,
    "watchlistedAt" TIMESTAMP(3),
    "watchlistReason" TEXT,
    "currentScore" INTEGER,
    "currentTier" TEXT,
    "earlyWarningLevel" TEXT NOT NULL DEFAULT 'green',
    "nextReviewDate" TIMESTAMP(3),
    "relationshipManagerId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Employer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerContact" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "signingAuthority" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmployerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerUser" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'employer_admin',
    "status" TEXT NOT NULL DEFAULT 'invited',
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "sessionEpoch" INTEGER NOT NULL DEFAULT 1,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmployerUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Director" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT,
    "appointedAt" TIMESTAMP(3),
    "nationality" TEXT,
    "residentialAddress" TEXT,
    "dateOfBirthEnc" TEXT,
    "idType" TEXT,
    "idNumberEnc" TEXT,
    "idNumberLast4" TEXT,
    "bvnEnc" TEXT,
    "bvnLast4" TEXT,
    "pepDeclared" BOOLEAN NOT NULL DEFAULT false,
    "pepScreenedAt" TIMESTAMP(3),
    "pepResult" TEXT NOT NULL DEFAULT 'not_screened',
    "sanctionsScreenedAt" TIMESTAMP(3),
    "sanctionsResult" TEXT NOT NULL DEFAULT 'not_screened',
    "otherDirectorships" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Director_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficialOwner" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "ownershipPercent" DOUBLE PRECISION,
    "ownershipType" TEXT,
    "nationality" TEXT,
    "residentialAddress" TEXT,
    "idType" TEXT,
    "idNumberEnc" TEXT,
    "idNumberLast4" TEXT,
    "bvnEnc" TEXT,
    "bvnLast4" TEXT,
    "pepDeclared" BOOLEAN NOT NULL DEFAULT false,
    "pepScreenedAt" TIMESTAMP(3),
    "pepResult" TEXT NOT NULL DEFAULT 'not_screened',
    "sanctionsScreenedAt" TIMESTAMP(3),
    "sanctionsResult" TEXT NOT NULL DEFAULT 'not_screened',
    "relatedCompanies" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BeneficialOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'draft',
    "requestedLimit" DECIMAL(18,2),
    "desiredLaunchDate" TIMESTAMP(3),
    "expectedParticipants" INTEGER,
    "currentPayrollDate" TEXT,
    "payrollFrequency" TEXT,
    "reasonForRequest" TEXT,
    "payrollChallenges" TEXT,
    "existingProviders" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedBy" TEXT,
    "completedStages" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRequest" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "requestedAmount" DECIMAL(18,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerDocument" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "docType" TEXT NOT NULL,
    "requirement" TEXT NOT NULL DEFAULT 'required',
    "status" TEXT NOT NULL DEFAULT 'requested',
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "contentHash" TEXT,
    "storageKey" TEXT,
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacementReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmployerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVerification" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'manual',
    "provider" TEXT,
    "reviewerId" TEXT,
    "reviewerLabel" TEXT,
    "notes" TEXT,
    "fieldFindings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "consentType" TEXT NOT NULL,
    "wordingVersion" TEXT NOT NULL,
    "wordingHash" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "acceptedByName" TEXT,
    "acceptedByEmail" TEXT,
    "acceptedByUserId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT,
    "accountNumberEnc" TEXT,
    "accountNumberLast4" TEXT,
    "accountType" TEXT NOT NULL DEFAULT 'current',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "isPayrollAccount" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'csv_upload',
    "statementFrom" TIMESTAMP(3),
    "statementTo" TIMESTAMP(3),
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "valueDate" TIMESTAMP(3) NOT NULL,
    "narration" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2),
    "category" TEXT NOT NULL DEFAULT 'other',
    "isReturned" BOOLEAN NOT NULL DEFAULT false,
    "dedupeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialPeriod" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "inflows" DECIMAL(18,2),
    "outflows" DECIMAL(18,2),
    "openingBalance" DECIMAL(18,2),
    "closingBalance" DECIMAL(18,2),
    "lowestBalance" DECIMAL(18,2),
    "revenue" DECIMAL(18,2),
    "costOfSales" DECIMAL(18,2),
    "operatingExpenses" DECIMAL(18,2),
    "operatingProfit" DECIMAL(18,2),
    "payrollCost" DECIMAL(18,2),
    "debtService" DECIMAL(18,2),
    "taxRemitted" DECIMAL(18,2),
    "pensionRemitted" DECIMAL(18,2),
    "returnedPayments" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialMetric" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "displayValue" TEXT,
    "formula" TEXT NOT NULL,
    "benchmark" TEXT,
    "classification" TEXT NOT NULL,
    "dataSource" TEXT,
    "trend" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollCycle" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "expectedPayDate" TIMESTAMP(3) NOT NULL,
    "actualPayDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(18,2),
    "employeeCount" INTEGER,
    "timeliness" TEXT NOT NULL DEFAULT 'unknown',
    "delayDays" INTEGER,
    "paidFraction" DOUBLE PRECISION,
    "corrections" INTEGER NOT NULL DEFAULT 0,
    "reversals" INTEGER NOT NULL DEFAULT 0,
    "pensionRemittedAt" TIMESTAMP(3),
    "taxRemittedAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'payroll_upload',
    "bankEvidenceMismatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT,
    "staffRef" TEXT,
    "fullNameEnc" TEXT,
    "grossPay" DECIMAL(18,2) NOT NULL,
    "netPay" DECIMAL(18,2),
    "deductions" DECIMAL(18,2),
    "allowances" DECIMAL(18,2),
    "bonus" DECIMAL(18,2),
    "accountNumberEnc" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL DEFAULT 'paid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRecord" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "staffRef" TEXT NOT NULL,
    "fullNameEnc" TEXT,
    "identityHash" TEXT,
    "department" TEXT,
    "jobTitle" TEXT,
    "hiredAt" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "ewaEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringPolicyVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "weights" TEXT NOT NULL,
    "tiers" TEXT NOT NULL,
    "benchmarks" TEXT NOT NULL,
    "knockoutRules" TEXT NOT NULL,
    "limitRules" TEXT NOT NULL,
    "authorityMatrix" TEXT NOT NULL,
    "industryOverrides" TEXT,
    "changeReason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByLabel" TEXT,
    "publishedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoringPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployerScore" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "policyVersionId" TEXT NOT NULL,
    "totalScore" INTEGER,
    "tier" TEXT,
    "identityConfidence" INTEGER,
    "financialHealth" INTEGER,
    "payrollReliability" INTEGER,
    "behaviouralTrust" INTEGER,
    "compliance" INTEGER,
    "industryContext" INTEGER,
    "payrollClassification" TEXT,
    "earlyWarningLevel" TEXT NOT NULL DEFAULT 'green',
    "knockoutOutcome" TEXT NOT NULL DEFAULT 'clear',
    "payrollMonthsAvailable" INTEGER NOT NULL DEFAULT 0,
    "financialMonthsAvailable" INTEGER NOT NULL DEFAULT 0,
    "hasDataGaps" BOOLEAN NOT NULL DEFAULT false,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "calculatedBy" TEXT,
    "calculatedByLabel" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployerScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreComponent" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rawScore" INTEGER,
    "weight" DOUBLE PRECISION NOT NULL,
    "weightedScore" DOUBLE PRECISION NOT NULL,
    "classification" TEXT NOT NULL,
    "factors" TEXT,
    "explanation" TEXT,
    "dataInsufficient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnockoutEvaluation" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "consequence" TEXT,
    "overridable" BOOLEAN NOT NULL DEFAULT false,
    "detail" TEXT,
    "evidence" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "overriddenBy" TEXT,
    "overriddenByLabel" TEXT,
    "overrideReason" TEXT,
    "overrideSecondedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnockoutEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimitRecommendation" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "availabilityPercent" DOUBLE PRECISION,
    "aggregateLimit" DECIMAL(18,2),
    "employeeCap" DECIMAL(18,2),
    "cycleCap" DECIMAL(18,2),
    "maxTenorDays" INTEGER,
    "pricingTier" TEXT,
    "repaymentSource" TEXT,
    "securityRequired" TEXT,
    "reserveRequired" TEXT,
    "inputs" TEXT,
    "formula" TEXT,
    "bindingConstraint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LimitRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAssessment" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputSources" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "assessmentSummary" TEXT,
    "positiveFactors" TEXT,
    "riskFactors" TEXT,
    "inconsistencies" TEXT,
    "missingInformation" TEXT,
    "sectorContext" TEXT,
    "recommendedAnalystQuestions" TEXT,
    "earlyWarningSignals" TEXT,
    "confidenceLevel" INTEGER,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "outcome" TEXT NOT NULL DEFAULT 'valid',
    "validationError" TEXT,
    "rawResponse" TEXT,
    "latencyMs" INTEGER,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "requestedBy" TEXT NOT NULL,
    "requestedByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amendedBy" TEXT,
    "amendedByLabel" TEXT,
    "amendedAt" TIMESTAMP(3),
    "amendmentNote" TEXT,

    CONSTRAINT "AiAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalystReview" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "reviewType" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorLabel" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "justification" TEXT,
    "previousValue" TEXT,
    "newValue" TEXT,
    "scenario" TEXT,
    "confidential" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalystReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCheck" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'pending',
    "method" TEXT NOT NULL DEFAULT 'manual',
    "provider" TEXT,
    "subject" TEXT,
    "findings" TEXT,
    "summary" TEXT,
    "clearedBy" TEXT,
    "clearedByLabel" TEXT,
    "clearedAt" TIMESTAMP(3),
    "clearanceStatus" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BureauCheck" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectName" TEXT,
    "consentId" TEXT,
    "score" INTEGER,
    "scoreBand" TEXT,
    "totalExposure" DECIMAL(18,2),
    "activeFacilities" INTEGER,
    "delinquentFacilities" INTEGER,
    "worstDelinquencyDays" INTEGER,
    "undisclosedFacilities" TEXT,
    "rawSummary" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'no_record',
    "requestedBy" TEXT,
    "requestedByLabel" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BureauCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "actionsTaken" TEXT,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "dismissalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditDecision" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "scoreId" TEXT,
    "policyVersionId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "internalRationale" TEXT,
    "decidedBy" TEXT NOT NULL,
    "decidedByLabel" TEXT NOT NULL,
    "decidedByRole" TEXT NOT NULL,
    "authorityLevel" TEXT NOT NULL,
    "secondedBy" TEXT,
    "secondedByLabel" TEXT,
    "secondedAt" TIMESTAMP(3),
    "conditions" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideJustification" TEXT,
    "recommendedTier" TEXT,
    "recommendedLimit" DECIMAL(18,2),
    "approvedLimit" DECIMAL(18,2),
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalVote" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "voterLabel" TEXT NOT NULL,
    "voterRole" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "comment" TEXT,
    "conditions" TEXT,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLimit" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "applicationId" TEXT,
    "decisionId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "approvedAmount" DECIMAL(18,2) NOT NULL,
    "availableAmount" DECIMAL(18,2) NOT NULL,
    "availabilityPercent" DOUBLE PRECISION,
    "employeeCap" DECIMAL(18,2),
    "cycleCap" DECIMAL(18,2),
    "maxTenorDays" INTEGER,
    "pricingTier" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL DEFAULT 'active',
    "restrictionReason" TEXT,
    "restrictedBy" TEXT,
    "restrictedAt" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "termsAcknowledgedAt" TIMESTAMP(3),
    "termsAcknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisation" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "limitId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "participantCount" INTEGER,
    "cyclePeriodStart" TIMESTAMP(3),
    "drawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'outstanding',
    "outstandingAmount" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repayment" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "limitId" TEXT,
    "utilisationId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "timeliness" TEXT NOT NULL DEFAULT 'on_time',
    "daysLate" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT,
    "failed" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Covenant" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "limitId" TEXT,
    "covenantType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION,
    "comparator" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastTestedAt" TIMESTAMP(3),
    "lastTestResult" TEXT,
    "breachedAt" TIMESTAMP(3),
    "waivedBy" TEXT,
    "waivedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Covenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoringReview" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scoreAtReview" INTEGER,
    "tierAtReview" TEXT,
    "earlyWarningAtReview" TEXT,
    "outcome" TEXT,
    "summary" TEXT,
    "reviewerId" TEXT,
    "reviewerLabel" TEXT,
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoringReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIntelligence" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "headline" TEXT,
    "summary" TEXT,
    "summarisedBy" TEXT,
    "riskRelevance" TEXT NOT NULL DEFAULT 'none',
    "analystValidation" TEXT NOT NULL DEFAULT 'unvalidated',
    "validatedBy" TEXT,
    "validatedByLabel" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validationNote" TEXT,
    "affectsScore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "localeSource" TEXT NOT NULL DEFAULT 'default',
    "largeText" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "simpleView" BOOLEAN NOT NULL DEFAULT false,
    "readAloud" BOOLEAN NOT NULL DEFAULT false,
    "reduceMotion" BOOLEAN NOT NULL DEFAULT false,
    "supportChannel" TEXT NOT NULL DEFAULT 'whatsapp',
    "textOnly" BOOLEAN NOT NULL DEFAULT false,
    "assistedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "assistedRequestedAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "onboardingSkippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "channel" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "textOnly" BOOLEAN NOT NULL DEFAULT false,
    "assistedOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "callbackWindow" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "vulnerabilityFlag" BOOLEAN NOT NULL DEFAULT false,
    "vulnerabilityNote" TEXT,
    "assignedTo" TEXT,
    "assignedToLabel" TEXT,
    "assignedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT,
    "authorLabel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentVersion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "bodyUrl" TEXT,
    "bodyHash" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "ConsentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentVersionId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "readLocale" TEXT NOT NULL DEFAULT 'en',
    "ip" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAccessLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminLabel" TEXT NOT NULL,
    "adminRole" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "subjectUserId" TEXT,
    "action" TEXT NOT NULL DEFAULT 'read',
    "basis" TEXT,
    "ip" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "WaitlistEntry_role_idx" ON "WaitlistEntry"("role");

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");

-- CreateIndex
CREATE INDEX "Registration_segment_idx" ON "Registration"("segment");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "Registration"("status");

-- CreateIndex
CREATE INDEX "Registration_createdAt_idx" ON "Registration"("createdAt");

-- CreateIndex
CREATE INDEX "Registration_email_idx" ON "Registration"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_segment_email_key" ON "Registration"("segment", "email");

-- CreateIndex
CREATE INDEX "RegistrationEvent_registrationId_createdAt_idx" ON "RegistrationEvent"("registrationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DemoInvitation_tokenHash_key" ON "DemoInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "DemoInvitation_email_idx" ON "DemoInvitation"("email");

-- CreateIndex
CREATE INDEX "DemoInvitation_expiresAt_idx" ON "DemoInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "DemoInvitation_createdAt_idx" ON "DemoInvitation"("createdAt");

-- CreateIndex
CREATE INDEX "DemoAccessLog_createdAt_idx" ON "DemoAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "DemoAccessLog_invitationId_idx" ON "DemoAccessLog"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "VerificationCode_userId_channel_idx" ON "VerificationCode"("userId", "channel");

-- CreateIndex
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KycProfile_userId_key" ON "KycProfile"("userId");

-- CreateIndex
CREATE INDEX "KycProfile_country_idx" ON "KycProfile"("country");

-- CreateIndex
CREATE INDEX "KycDocument_userId_docType_idx" ON "KycDocument"("userId", "docType");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_role_idx" ON "AdminUser"("role");

-- CreateIndex
CREATE INDEX "AdminUser_status_idx" ON "AdminUser"("status");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_idx" ON "AuditEvent"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Employer_cacNumber_key" ON "Employer"("cacNumber");

-- CreateIndex
CREATE INDEX "Employer_status_idx" ON "Employer"("status");

-- CreateIndex
CREATE INDEX "Employer_currentTier_idx" ON "Employer"("currentTier");

-- CreateIndex
CREATE INDEX "Employer_industry_idx" ON "Employer"("industry");

-- CreateIndex
CREATE INDEX "Employer_earlyWarningLevel_idx" ON "Employer"("earlyWarningLevel");

-- CreateIndex
CREATE INDEX "Employer_relationshipManagerId_idx" ON "Employer"("relationshipManagerId");

-- CreateIndex
CREATE INDEX "Employer_nextReviewDate_idx" ON "Employer"("nextReviewDate");

-- CreateIndex
CREATE INDEX "EmployerContact_employerId_contactType_idx" ON "EmployerContact"("employerId", "contactType");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerUser_email_key" ON "EmployerUser"("email");

-- CreateIndex
CREATE INDEX "EmployerUser_employerId_status_idx" ON "EmployerUser"("employerId", "status");

-- CreateIndex
CREATE INDEX "Director_employerId_idx" ON "Director"("employerId");

-- CreateIndex
CREATE INDEX "BeneficialOwner_employerId_idx" ON "BeneficialOwner"("employerId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_reference_key" ON "Application"("reference");

-- CreateIndex
CREATE INDEX "Application_employerId_stage_idx" ON "Application"("employerId", "stage");

-- CreateIndex
CREATE INDEX "Application_stage_idx" ON "Application"("stage");

-- CreateIndex
CREATE INDEX "Application_submittedAt_idx" ON "Application"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRequest_applicationId_product_key" ON "ProductRequest"("applicationId", "product");

-- CreateIndex
CREATE INDEX "EmployerDocument_employerId_docType_idx" ON "EmployerDocument"("employerId", "docType");

-- CreateIndex
CREATE INDEX "EmployerDocument_employerId_status_idx" ON "EmployerDocument"("employerId", "status");

-- CreateIndex
CREATE INDEX "EmployerDocument_expiresAt_idx" ON "EmployerDocument"("expiresAt");

-- CreateIndex
CREATE INDEX "DocumentVerification_documentId_createdAt_idx" ON "DocumentVerification"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "Consent_employerId_consentType_idx" ON "Consent"("employerId", "consentType");

-- CreateIndex
CREATE INDEX "BankAccount_employerId_idx" ON "BankAccount"("employerId");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_valueDate_idx" ON "BankTransaction"("bankAccountId", "valueDate");

-- CreateIndex
CREATE INDEX "BankTransaction_bankAccountId_category_idx" ON "BankTransaction"("bankAccountId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_bankAccountId_dedupeHash_key" ON "BankTransaction"("bankAccountId", "dedupeHash");

-- CreateIndex
CREATE INDEX "FinancialPeriod_employerId_periodStart_idx" ON "FinancialPeriod"("employerId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialPeriod_employerId_periodStart_source_key" ON "FinancialPeriod"("employerId", "periodStart", "source");

-- CreateIndex
CREATE INDEX "FinancialMetric_scoreId_metric_idx" ON "FinancialMetric"("scoreId", "metric");

-- CreateIndex
CREATE INDEX "PayrollCycle_employerId_expectedPayDate_idx" ON "PayrollCycle"("employerId", "expectedPayDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollCycle_employerId_periodStart_key" ON "PayrollCycle"("employerId", "periodStart");

-- CreateIndex
CREATE INDEX "PayrollRecord_cycleId_idx" ON "PayrollRecord"("cycleId");

-- CreateIndex
CREATE INDEX "PayrollRecord_employeeId_idx" ON "PayrollRecord"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeRecord_employerId_status_idx" ON "EmployeeRecord"("employerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeRecord_employerId_staffRef_key" ON "EmployeeRecord"("employerId", "staffRef");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringPolicyVersion_version_key" ON "ScoringPolicyVersion"("version");

-- CreateIndex
CREATE INDEX "ScoringPolicyVersion_status_idx" ON "ScoringPolicyVersion"("status");

-- CreateIndex
CREATE INDEX "EmployerScore_employerId_calculatedAt_idx" ON "EmployerScore"("employerId", "calculatedAt");

-- CreateIndex
CREATE INDEX "EmployerScore_applicationId_idx" ON "EmployerScore"("applicationId");

-- CreateIndex
CREATE INDEX "EmployerScore_tier_idx" ON "EmployerScore"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreComponent_scoreId_component_key" ON "ScoreComponent"("scoreId", "component");

-- CreateIndex
CREATE INDEX "KnockoutEvaluation_scoreId_result_idx" ON "KnockoutEvaluation"("scoreId", "result");

-- CreateIndex
CREATE UNIQUE INDEX "LimitRecommendation_scoreId_product_key" ON "LimitRecommendation"("scoreId", "product");

-- CreateIndex
CREATE INDEX "AiAssessment_employerId_createdAt_idx" ON "AiAssessment"("employerId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssessment_applicationId_idx" ON "AiAssessment"("applicationId");

-- CreateIndex
CREATE INDEX "AnalystReview_employerId_createdAt_idx" ON "AnalystReview"("employerId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalystReview_applicationId_reviewType_idx" ON "AnalystReview"("applicationId", "reviewType");

-- CreateIndex
CREATE INDEX "ComplianceCheck_employerId_checkType_idx" ON "ComplianceCheck"("employerId", "checkType");

-- CreateIndex
CREATE INDEX "ComplianceCheck_employerId_clearanceStatus_idx" ON "ComplianceCheck"("employerId", "clearanceStatus");

-- CreateIndex
CREATE INDEX "ComplianceCheck_expiresAt_idx" ON "ComplianceCheck"("expiresAt");

-- CreateIndex
CREATE INDEX "BureauCheck_employerId_checkedAt_idx" ON "BureauCheck"("employerId", "checkedAt");

-- CreateIndex
CREATE INDEX "Alert_employerId_status_idx" ON "Alert"("employerId", "status");

-- CreateIndex
CREATE INDEX "Alert_severity_status_idx" ON "Alert"("severity", "status");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "CreditDecision_employerId_decidedAt_idx" ON "CreditDecision"("employerId", "decidedAt");

-- CreateIndex
CREATE INDEX "CreditDecision_applicationId_idx" ON "CreditDecision"("applicationId");

-- CreateIndex
CREATE INDEX "CreditDecision_decision_idx" ON "CreditDecision"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalVote_decisionId_voterId_key" ON "ApprovalVote"("decisionId", "voterId");

-- CreateIndex
CREATE INDEX "CreditLimit_employerId_status_idx" ON "CreditLimit"("employerId", "status");

-- CreateIndex
CREATE INDEX "CreditLimit_reviewDueAt_idx" ON "CreditLimit"("reviewDueAt");

-- CreateIndex
CREATE INDEX "Utilisation_employerId_drawnAt_idx" ON "Utilisation"("employerId", "drawnAt");

-- CreateIndex
CREATE INDEX "Utilisation_limitId_status_idx" ON "Utilisation"("limitId", "status");

-- CreateIndex
CREATE INDEX "Repayment_employerId_dueAt_idx" ON "Repayment"("employerId", "dueAt");

-- CreateIndex
CREATE INDEX "Repayment_limitId_idx" ON "Repayment"("limitId");

-- CreateIndex
CREATE INDEX "Covenant_employerId_status_idx" ON "Covenant"("employerId", "status");

-- CreateIndex
CREATE INDEX "MonitoringReview_employerId_dueAt_idx" ON "MonitoringReview"("employerId", "dueAt");

-- CreateIndex
CREATE INDEX "MonitoringReview_status_dueAt_idx" ON "MonitoringReview"("status", "dueAt");

-- CreateIndex
CREATE INDEX "ExternalIntelligence_employerId_retrievedAt_idx" ON "ExternalIntelligence"("employerId", "retrievedAt");

-- CreateIndex
CREATE INDEX "ExternalIntelligence_employerId_analystValidation_idx" ON "ExternalIntelligence"("employerId", "analystValidation");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_reference_key" ON "SupportTicket"("reference");

-- CreateIndex
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedTo_status_idx" ON "SupportTicket"("assignedTo", "status");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_status_idx" ON "SupportTicket"("priority", "status");

-- CreateIndex
CREATE INDEX "SupportTicketMessage_ticketId_createdAt_idx" ON "SupportTicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsentVersion_slug_effectiveFrom_idx" ON "ConsentVersion"("slug", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentVersion_slug_version_locale_key" ON "ConsentVersion"("slug", "version", "locale");

-- CreateIndex
CREATE INDEX "UserConsent_userId_acceptedAt_idx" ON "UserConsent"("userId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserConsent_userId_consentVersionId_key" ON "UserConsent"("userId", "consentVersionId");

-- CreateIndex
CREATE INDEX "SupportAccessLog_adminId_createdAt_idx" ON "SupportAccessLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportAccessLog_subjectUserId_createdAt_idx" ON "SupportAccessLog"("subjectUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportAccessLog_resource_createdAt_idx" ON "SupportAccessLog"("resource", "createdAt");

-- AddForeignKey
ALTER TABLE "RegistrationEvent" ADD CONSTRAINT "RegistrationEvent_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoInvitation" ADD CONSTRAINT "DemoInvitation_issuedByAdminId_fkey" FOREIGN KEY ("issuedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoInvitation" ADD CONSTRAINT "DemoInvitation_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoAccessLog" ADD CONSTRAINT "DemoAccessLog_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "DemoInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycProfile" ADD CONSTRAINT "KycProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerContact" ADD CONSTRAINT "EmployerContact_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerUser" ADD CONSTRAINT "EmployerUser_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Director" ADD CONSTRAINT "Director_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficialOwner" ADD CONSTRAINT "BeneficialOwner_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerDocument" ADD CONSTRAINT "EmployerDocument_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerDocument" ADD CONSTRAINT "EmployerDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVerification" ADD CONSTRAINT "DocumentVerification_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "EmployerDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPeriod" ADD CONSTRAINT "FinancialPeriod_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialMetric" ADD CONSTRAINT "FinancialMetric_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "EmployerScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCycle" ADD CONSTRAINT "PayrollCycle_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PayrollCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRecord" ADD CONSTRAINT "EmployeeRecord_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerScore" ADD CONSTRAINT "EmployerScore_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerScore" ADD CONSTRAINT "EmployerScore_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployerScore" ADD CONSTRAINT "EmployerScore_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "ScoringPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreComponent" ADD CONSTRAINT "ScoreComponent_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "EmployerScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnockoutEvaluation" ADD CONSTRAINT "KnockoutEvaluation_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "EmployerScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LimitRecommendation" ADD CONSTRAINT "LimitRecommendation_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "EmployerScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAssessment" ADD CONSTRAINT "AiAssessment_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAssessment" ADD CONSTRAINT "AiAssessment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalystReview" ADD CONSTRAINT "AnalystReview_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalystReview" ADD CONSTRAINT "AnalystReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceCheck" ADD CONSTRAINT "ComplianceCheck_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BureauCheck" ADD CONSTRAINT "BureauCheck_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDecision" ADD CONSTRAINT "CreditDecision_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDecision" ADD CONSTRAINT "CreditDecision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDecision" ADD CONSTRAINT "CreditDecision_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "EmployerScore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDecision" ADD CONSTRAINT "CreditDecision_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "ScoringPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalVote" ADD CONSTRAINT "ApprovalVote_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "CreditDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLimit" ADD CONSTRAINT "CreditLimit_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLimit" ADD CONSTRAINT "CreditLimit_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLimit" ADD CONSTRAINT "CreditLimit_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "CreditDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisation" ADD CONSTRAINT "Utilisation_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisation" ADD CONSTRAINT "Utilisation_limitId_fkey" FOREIGN KEY ("limitId") REFERENCES "CreditLimit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repayment" ADD CONSTRAINT "Repayment_limitId_fkey" FOREIGN KEY ("limitId") REFERENCES "CreditLimit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Covenant" ADD CONSTRAINT "Covenant_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Covenant" ADD CONSTRAINT "Covenant_limitId_fkey" FOREIGN KEY ("limitId") REFERENCES "CreditLimit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoringReview" ADD CONSTRAINT "MonitoringReview_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIntelligence" ADD CONSTRAINT "ExternalIntelligence_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_consentVersionId_fkey" FOREIGN KEY ("consentVersionId") REFERENCES "ConsentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
