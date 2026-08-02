import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AcceptEmployeeLinkInput,
  BridgeDrawView,
  ChangeEmailInput,
  ConfirmVerificationInput,
  CreateInvestmentCommitmentInput,
  CreateSavingsGoalInput,
  EligibilityView,
  InvestmentCommitmentView,
  KycStatusView,
  KycSubmissionInput,
  PortfolioSnapshotView,
  RegisterAccountInput,
  RequestBridgeDrawInput,
  SavingsGoalView,
  SavingsTransactionInput,
  SavingsTransactionView,
  SessionGate,
  SessionState,
  SignInInput,
  VerificationDispatch,
} from "../../../../backend/src/types";

/**
 * The real customer account layer.
 *
 * This is deliberately separate from `src/lib/auth/auth-context.tsx`, which is
 * the prototype in-browser session that drives the demonstration dashboards.
 * WHY both still exist: they serve two of the three access routes in the spec,
 * and they must not be merged. This module talks to a server that holds the
 * password hashes and decides the gate; that one fabricates a session locally so
 * an invited guest can walk through the product. Merging them would mean the
 * demonstration's client-side session logic sits on the same code path as real
 * customer authentication.
 *
 * NOTHING here decides what a customer may see. `SessionState.gate` and
 * `financialAccess` are computed by the backend on every request and are simply
 * rendered. See backend/src/security/account-gate.ts.
 */

export const SESSION_KEY = ["account", "session"] as const;
export const KYC_KEY = ["account", "kyc"] as const;

const ANONYMOUS: SessionState = { gate: "anonymous", user: null, financialAccess: false };

/**
 * Current session. Refetched on window focus, so an administrator suspending an
 * account or approving KYC is reflected in an open tab without a reload.
 */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => api.get<SessionState>("/api/auth/session"),
    // The endpoint answers 200 with gate "anonymous" rather than 401, so a
    // signed-out visitor is a normal result and not a retry loop.
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: ANONYMOUS,
  });
}

/** Register and verify-send responses carry the session plus the dispatch note. */
type SessionWithDispatch = SessionState & { verification: VerificationDispatch };

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterAccountInput) =>
      api.post<SessionWithDispatch>("/api/auth/register", input),
    onSuccess: (data) => {
      qc.setQueryData(SESSION_KEY, { gate: data.gate, user: data.user, financialAccess: data.financialAccess });
    },
  });
}

/**
 * Correct the address on an account that has not verified it yet.
 *
 * Requires the password, and the server refuses once the address is confirmed.
 * Exists so a typo at registration is recoverable instead of a dead account.
 */
export function useChangeEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeEmailInput) => api.post<SessionWithDispatch>("/api/auth/email", input),
    onSuccess: (data) => {
      qc.setQueryData(SESSION_KEY, { gate: data.gate, user: data.user, financialAccess: data.financialAccess });
    },
  });
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignInInput) => api.post<SessionState>("/api/auth/login", input),
    onSuccess: (data) => qc.setQueryData(SESSION_KEY, data),
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SessionState>("/api/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(SESSION_KEY, ANONYMOUS);
      // Everything cached was fetched as the previous account. Dropping it all
      // is the only way to be sure no fragment of one customer's data is on
      // screen after another signs in on the same device.
      qc.clear();
    },
  });
}

export function useSendVerification() {
  return useMutation({
    mutationFn: (channel: "email" | "phone") =>
      api.post<VerificationDispatch>("/api/auth/verify/send", { channel }),
  });
}

export function useConfirmVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfirmVerificationInput) => api.post<SessionState>("/api/auth/verify/confirm", input),
    onSuccess: (data) => qc.setQueryData(SESSION_KEY, data),
  });
}

export function useKycStatus(enabled = true) {
  return useQuery({
    queryKey: KYC_KEY,
    queryFn: () => api.get<KycStatusView>("/api/auth/kyc"),
    enabled,
    retry: false,
  });
}

export function useSubmitKyc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: KycSubmissionInput) =>
      api.post<KycStatusView & { submitted: boolean; message?: string; session?: SessionState }>(
        "/api/auth/kyc",
        input,
      ),
    onSuccess: (data) => {
      qc.setQueryData(KYC_KEY, data);
      if (data.session) qc.setQueryData(SESSION_KEY, data.session);
    },
  });
}

/**
 * Document upload. Uses `api.raw` because this is multipart, not JSON — the
 * normal helper sets a JSON Content-Type, and setting it manually on a FormData
 * body strips the multipart boundary the server needs to parse it.
 */
export function useUploadKycDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { docType: string; file: File }) => {
      const body = new FormData();
      body.append("docType", input.docType);
      body.append("file", input.file);
      const response = await api.raw("/api/auth/kyc/documents", { method: "POST", body });
      const json = (await response.json().catch(() => null)) as
        | { data?: KycStatusView; error?: { message?: string } }
        | null;
      if (!response.ok) throw new Error(json?.error?.message ?? "That file could not be uploaded.");
      return json?.data as KycStatusView;
    },
    onSuccess: (data) => qc.setQueryData(KYC_KEY, data),
  });
}

/** The eligibility checklist from PRD.md's Business Rules — see routes/employee-link.ts. */
export function useEligibility(enabled: boolean) {
  return useQuery({
    queryKey: ["account", "eligibility"] as const,
    queryFn: () => api.get<EligibilityView>("/api/auth/eligibility"),
    enabled,
    staleTime: 30_000,
  });
}

export function useBridgeDraws(enabled: boolean) {
  return useQuery({
    queryKey: ["account", "bridge", "draws"] as const,
    queryFn: () => api.get<{ items: BridgeDrawView[] }>("/api/bridge/draws"),
    enabled,
  });
}

export function useRequestBridgeDraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RequestBridgeDrawInput) => api.post<BridgeDrawView>("/api/bridge/request", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["account", "bridge", "draws"] });
      void qc.invalidateQueries({ queryKey: ["account", "eligibility"] });
    },
  });
}

/* ------------------------------------------------------------- SAVINGS */

export function useSavingsGoals(enabled: boolean) {
  return useQuery({
    queryKey: ["account", "savings", "goals"] as const,
    queryFn: () => api.get<{ items: SavingsGoalView[] }>("/api/savings/goals"),
    enabled,
  });
}

export function useCreateSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSavingsGoalInput) => api.post<SavingsGoalView>("/api/savings/goals", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["account", "savings", "goals"] }),
  });
}

export function useSavingsTransactions(goalId: string | null) {
  return useQuery({
    queryKey: ["account", "savings", "transactions", goalId ?? ""] as const,
    queryFn: () => api.get<{ items: SavingsTransactionView[] }>(`/api/savings/goals/${goalId}/transactions`),
    enabled: Boolean(goalId),
  });
}

export function useSavingsDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, ...input }: SavingsTransactionInput & { goalId: string }) =>
      api.post<SavingsTransactionView>(`/api/savings/goals/${goalId}/deposit`, input),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ["account", "savings", "goals"] });
      void qc.invalidateQueries({ queryKey: ["account", "savings", "transactions", variables.goalId] });
    },
  });
}

export function useSavingsWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, ...input }: SavingsTransactionInput & { goalId: string }) =>
      api.post<SavingsTransactionView>(`/api/savings/goals/${goalId}/withdraw`, input),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: ["account", "savings", "goals"] });
      void qc.invalidateQueries({ queryKey: ["account", "savings", "transactions", variables.goalId] });
    },
  });
}

/* ---------------------------------------------------------- INVESTMENTS */

export function useInvestmentCommitments(enabled: boolean) {
  return useQuery({
    queryKey: ["account", "investments", "commitments"] as const,
    queryFn: () => api.get<{ items: InvestmentCommitmentView[] }>("/api/investments/commitments"),
    enabled,
  });
}

export function useCreateInvestmentCommitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvestmentCommitmentInput) =>
      api.post<InvestmentCommitmentView>("/api/investments/commitments", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["account", "investments", "commitments"] });
      void qc.invalidateQueries({ queryKey: ["account", "investments", "portfolio"] });
    },
  });
}

export function useWithdrawInvestmentCommitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<InvestmentCommitmentView>(`/api/investments/commitments/${id}/withdraw`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["account", "investments", "commitments"] });
      void qc.invalidateQueries({ queryKey: ["account", "investments", "portfolio"] });
    },
  });
}

export function usePortfolioSnapshot(enabled: boolean) {
  return useQuery({
    queryKey: ["account", "investments", "portfolio"] as const,
    queryFn: () => api.get<PortfolioSnapshotView>("/api/investments/portfolio"),
    enabled,
  });
}

export function useLinkEmployer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AcceptEmployeeLinkInput) => api.post<{ linked: boolean }>("/api/auth/link", input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["account", "eligibility"] }),
  });
}

/** Where a given gate should land the customer. Single source for redirects. */
export const GATE_ROUTE: Record<SessionGate, string> = {
  anonymous: "/sign-in",
  verify_contact: "/verify-email",
  kyc_required: "/verify-identity",
  kyc_pending: "/account",
  kyc_rejected: "/account",
  active: "/account",
  suspended: "/account",
  closed: "/account",
};
