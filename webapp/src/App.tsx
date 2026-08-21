import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Index from "./pages/Index";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import Brand from "./pages/Brand";
import Security from "./pages/Security";
import NotFound from "./pages/NotFound";
import GetOnTheBridge from "./pages/register/GetOnTheBridge";
import EmployeeRegistration from "./pages/register/EmployeeRegistration";
import EmployerRegistration from "./pages/register/EmployerRegistration";
import CapitalRegistration from "./pages/register/CapitalRegistration";
import PrivateDemo from "./pages/PrivateDemo";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPortalLogin from "./pages/admin/AdminPortalLogin";
import AdminPortal from "./pages/admin/AdminPortal";
import PortalOverview from "./pages/admin/portal/PortalOverview";
import RegisteredUsers from "./pages/admin/portal/RegisteredUsers";
import KycReview from "./pages/admin/portal/KycReview";
import Employers from "./pages/admin/portal/Employers";
import CreditRisk from "./pages/admin/portal/CreditRisk";
import AdminReports from "./pages/admin/portal/Reports";
import DemoInvitations from "./pages/admin/portal/DemoInvitations";
import SupportRequests from "./pages/admin/portal/SupportRequests";
import AdminUsers from "./pages/admin/portal/AdminUsers";
import AuditLogs from "./pages/admin/portal/AuditLogs";
import SecuritySettings from "./pages/admin/portal/SecuritySettings";
import OutgoingMail from "./pages/admin/portal/OutgoingMail";
import { RequireDemoAccess } from "@/components/demo/RequireDemoAccess";
import { AuthProvider } from "@/lib/auth/auth-context";
import {
  RedirectIfSignedIn,
  RequireAuth,
  RequirePermission,
  NotFoundInPortal,
} from "@/lib/auth/RequireAuth";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import CreateAccount from "./pages/account/CreateAccount";
import CustomerSignIn from "./pages/account/SignIn";
import VerifyEmail from "./pages/account/VerifyEmail";
import VerifyIdentity from "./pages/account/VerifyIdentity";
import AccountHome from "./pages/account/AccountHome";
import LinkEmployer from "./pages/account/LinkEmployer";
import { RequireGate, RedirectIfSignedIn as RedirectIfCustomerSignedIn } from "@/components/account/AccountGate";
import EmployerPortalRegister from "./pages/employer-portal/Register";
import EmployerPortalLogin from "./pages/employer-portal/Login";
import EmployerPortalHome from "./pages/employer-portal/Home";
import EmployerPortalAcceptInvite from "./pages/employer-portal/AcceptInvite";
import EmployerPortalPayroll from "./pages/employer-portal/Payroll";
import ForgotPassword from "./pages/auth/ForgotPassword";
import Verify from "./pages/auth/Verify";
import SelectRole from "./pages/auth/SelectRole";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import EmployeeOverviewPage from "./pages/employee/Overview";
import EmployeeBridgePage from "./pages/employee/Bridge";
import EmployeePayPage from "./pages/employee/Pay";
import EmployeeTransactionsPage from "./pages/employee/Transactions";
import EmployeeGrowPage from "./pages/employee/Grow";
import EmployeeSavePage from "./pages/employee/Savings";
import EmployeeInvestPage from "./pages/employee/Invest";
import EmployeeProfilePage from "./pages/employee/Profile";
import EmployeeReferPage from "./pages/employee/Refer";
import EmployeeSupportPage from "./pages/employee/Support";
import EmployerOverviewPage from "./pages/employer/Overview";
import EmployerEmployeesPage from "./pages/employer/Employees";
import EmployerPayrollPage from "./pages/employer/Payroll";
import PayrollCommandCentrePage from "./pages/employer/payroll/CommandCentre";
import PayrollExceptionsPage from "./pages/employer/payroll/Exceptions";
import PayrollRecordsPage from "./pages/employer/payroll/Records";
import PayrollIntegrationsPage from "./pages/employer/payroll/Integrations";
import EmployerSalaryBufferPage from "./pages/employer/SalaryBuffer";
import SalaryAccountRequestsPage from "./pages/employer/SalaryAccountRequests";
import SalaryAccountRequestReviewPage from "./pages/employer/SalaryAccountRequestReview";
import PayBridgePayrollPage from "./pages/employer/PayBridgePayroll";
import EmployerBridgeActivityPage from "./pages/employer/BridgeActivity";
import EmployerRepaymentsPage from "./pages/employer/Repayments";
import EmployerReportsPage from "./pages/employer/Reports";
import EmployerSettingsPage from "./pages/employer/Settings";
import InvestorOverviewPage from "./pages/investor/Overview";
import InvestorInvestPage from "./pages/investor/Invest";
import InvestorPerformancePage from "./pages/investor/Performance";
import InvestorTransactionsPage from "./pages/investor/Transactions";
import InvestorStatementsPage from "./pages/investor/Statements";
import InvestorWithdrawalsPage from "./pages/investor/Withdrawals";
import InvestorDocumentsPage from "./pages/investor/Documents";
import InvestorProfilePage from "./pages/investor/Profile";
import OpsOverviewPage from "./pages/operations/Overview";
import OpsEmployersPage from "./pages/operations/Employers";
import OpsEmployeesPage from "./pages/operations/Employees";
import OpsInvestorsPage from "./pages/operations/Investors";
import OpsTransactionsPage from "./pages/operations/Transactions";
import OpsFundingPage from "./pages/operations/Funding";
import OpsPayrollPage from "./pages/operations/PayrollOps";
import OpsPortfoliosPage from "./pages/operations/Portfolios";
import OpsReconciliationPage from "./pages/operations/Reconciliation";
import OpsRiskPage from "./pages/operations/Risk";
import OpsCompliancePage from "./pages/operations/Compliance";
import OpsReportsPage from "./pages/operations/Reports";
import OpsSupportPage from "./pages/operations/Support";
import OpsSettingsPage from "./pages/operations/Settings";
import OpsDemoAccessPage from "./pages/operations/DemoAccess";
import { PreferencesProvider } from "@/lib/prefs/PreferencesProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* Inside BrowserRouter and outside every route: the display settings and
            the chosen language have to be applied on whichever screen the person
            lands on, including the sign-in page they must read before the server
            knows who they are. */}
        <PreferencesProvider>
        <AuthProvider>
          <Routes>
            {/* Public website */}
            <Route path="/" element={<Index />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/brand" element={<Brand />} />
            <Route path="/security" element={<Security />} />

            {/* Segmented registration — the only public conversion path.
                Every principal CTA on the site leads to /get-on-the-bridge. */}
            <Route path="/get-on-the-bridge" element={<GetOnTheBridge />} />
            <Route path="/get-on-the-bridge/employee" element={<EmployeeRegistration />} />
            <Route path="/employers" element={<EmployerRegistration />} />
            <Route path="/capital-partners" element={<CapitalRegistration />} />
            {/* Older campaign paths people may already have. */}
            <Route path="/employees" element={<Navigate to="/get-on-the-bridge/employee" replace />} />
            <Route path="/investors" element={<Navigate to="/capital-partners" replace />} />

            {/* ----------------------------------------------------------------
                PUBLIC CUSTOMER ACCOUNTS — route 1 of 3.

                Real accounts against the real API: register, confirm your email,
                verify your identity, then see your account. Every screen the
                customer reaches is chosen by the gate the SERVER computed, and
                no regulated feature is reachable from here until that gate is
                `active`.

                These are NOT the demonstration sign-in pages (those live at
                /demo/* below, behind an invitation) and NOT the admin portal.
               ---------------------------------------------------------------- */}
            <Route
              path="/register"
              element={
                <RedirectIfCustomerSignedIn>
                  <CreateAccount />
                </RedirectIfCustomerSignedIn>
              }
            />
            <Route
              path="/sign-in"
              element={
                <RedirectIfCustomerSignedIn>
                  <CustomerSignIn />
                </RedirectIfCustomerSignedIn>
              }
            />
            <Route
              path="/verify-email"
              element={
                <RequireGate allow={["verify_contact"]}>
                  <VerifyEmail />
                </RequireGate>
              }
            />
            <Route
              path="/verify-identity"
              element={
                <RequireGate allow={["kyc_required", "kyc_rejected"]}>
                  <VerifyIdentity />
                </RequireGate>
              }
            />
            <Route
              path="/account"
              element={
                <RequireGate allow={["kyc_pending", "kyc_rejected", "active", "suspended", "closed"]}>
                  <AccountHome />
                </RequireGate>
              }
            />
            {/* Reached from the "you've been added to payroll" email. Handles
                its own auth state (anonymous vs signed in) rather than being
                wrapped in RequireGate, since it must work for someone who is
                not signed in yet. */}
            <Route path="/link-employer" element={<LinkEmployer />} />

            {/* ----------------------------------------------------------------
                EMPLOYER PORTAL — a company's own multi-seat login.

                Deliberately a different namespace from /employer/* below, which
                is the demonstration dashboard (mock data, behind the private
                demo gate). These four routes are real: they create and sign
                into an actual Employer company record via /api/employer/*.
               ---------------------------------------------------------------- */}
            <Route path="/employer-portal/register" element={<EmployerPortalRegister />} />
            <Route path="/employer-portal/login" element={<EmployerPortalLogin />} />
            <Route path="/employer-portal/accept-invite" element={<EmployerPortalAcceptInvite />} />
            <Route path="/employer-portal" element={<EmployerPortalHome />} />
            <Route path="/employer-portal/payroll" element={<EmployerPortalPayroll />} />

            {/* The gate in front of the private demonstration environment. */}
            <Route path="/private-demo" element={<PrivateDemo />} />

            {/* Internal dashboard. Unlinked, disallowed in robots.txt, absent
                from the sitemap, and empty until the server confirms an admin
                session. Never link to this from a public page. */}
            <Route path="/paybridge-admin" element={<AdminDashboard />} />

            {/* ----------------------------------------------------------------
                ADMINISTRATOR PORTAL

                A separate route from every customer and demo entrance, and
                deliberately absent from the public navigation, the footer, the
                sitemap and robots.txt. Knowing the URL is not access: /admin
                renders nothing until the server confirms a signed administrator
                session, and refuses every section endpoint until first-run setup
                — password change, authenticator, recovery address, policy — is
                complete.
                ---------------------------------------------------------------- */}
            <Route path="/admin/login" element={<AdminPortalLogin />} />
            <Route path="/admin" element={<AdminPortal />}>
              <Route index element={<PortalOverview />} />
              <Route path="users" element={<RegisteredUsers />} />
              <Route path="kyc" element={<KycReview />} />
              <Route path="employers" element={<Employers />} />
              <Route path="risk" element={<CreditRisk />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="invitations" element={<DemoInvitations />} />
              <Route path="support" element={<SupportRequests />} />
              <Route path="admins" element={<AdminUsers />} />
              <Route path="audit" element={<AuditLogs />} />
              <Route path="security" element={<SecuritySettings />} />
              <Route path="mail" element={<OutgoingMail />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>

            {/* ----------------------------------------------------------------
                PRIVATE DEMONSTRATION ENVIRONMENT

                Everything below — the sign-in screens and all four portals — is
                the demo. It has not been deleted; it is simply no longer public.
                Nothing here is linked from the website, listed in the sitemap or
                indexable, and none of it renders without a demo session issued
                against an invitation link or an access code.
               ---------------------------------------------------------------- */}
            <Route
              element={
                <RequireDemoAccess>
                  <Outlet />
                </RequireDemoAccess>
              }
            >
              {/* Demonstration sign-in.
                  These moved from /login and /register to /demo/* so the real
                  customer routes above can own the obvious paths. A visitor who
                  types /register must reach registration, not a demo gate. */}
              <Route
                path="/demo/login"
                element={
                  <RedirectIfSignedIn>
                    <Login />
                  </RedirectIfSignedIn>
                }
              />
              <Route
                path="/demo/register"
                element={
                  <RedirectIfSignedIn>
                    <Register />
                  </RedirectIfSignedIn>
                }
              />
              <Route path="/demo/select-role" element={<SelectRole />} />
              <Route path="/demo/forgot-password" element={<ForgotPassword />} />
              <Route path="/demo/verify" element={<Verify />} />
              {/* Older demo paths people may have bookmarked. */}
              <Route path="/login" element={<Navigate to="/demo/login" replace />} />
              <Route path="/select-role" element={<Navigate to="/demo/select-role" replace />} />
              <Route path="/forgot-password" element={<Navigate to="/demo/forgot-password" replace />} />
              <Route path="/verify" element={<Navigate to="/demo/verify" replace />} />

              {/* Employee portal */}
              <Route
                path="/employee"
                element={
                  <RequireAuth portal="employee">
                    <DashboardShell portal="employee" />
                  </RequireAuth>
                }
              >
                <Route index element={<EmployeeOverviewPage />} />
                <Route path="bridge" element={<EmployeeBridgePage />} />
                <Route path="pay" element={<EmployeePayPage />} />
                <Route path="transactions" element={<EmployeeTransactionsPage />} />
                <Route path="savings" element={<EmployeeSavePage />} />
                <Route path="invest" element={<EmployeeInvestPage />} />
                <Route path="grow" element={<EmployeeGrowPage />} />
                {/* Wellbeing became Grow — keep old links working. */}
                <Route path="wellbeing" element={<Navigate to="/employee/grow" replace />} />
                <Route path="refer" element={<EmployeeReferPage />} />
                <Route path="profile" element={<EmployeeProfilePage />} />
                <Route path="support" element={<EmployeeSupportPage />} />
                <Route path="*" element={<NotFoundInPortal home="/employee" />} />
              </Route>

              {/* Employer portal */}
              <Route
                path="/employer"
                element={
                  <RequireAuth portal="employer">
                    <DashboardShell portal="employer" />
                  </RequireAuth>
                }
              >
                {/*
                  The overview is the only employer route left open to every
                  employer role, because each of them needs a landing page.
                  Everything below it is gated: an executive viewer holding
                  `employer.reports.view` alone reaches company totals and
                  reports, and nothing that lists a named individual.
                */}
                <Route index element={<EmployerOverviewPage />} />
                <Route
                  path="employees"
                  element={
                    <RequirePermission permission="employer.employees.manage" moduleName="Employee records">
                      <EmployerEmployeesPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="salary-account-requests"
                  element={
                    <RequirePermission permission="employer.employees.manage" moduleName="Salary Account requests">
                      <SalaryAccountRequestsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="salary-account-requests/:id"
                  element={
                    <RequirePermission permission="employer.employees.manage" moduleName="Salary Account requests">
                      <SalaryAccountRequestReviewPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="paybridge-payroll"
                  element={
                    <RequirePermission permission="employer.settings.manage" moduleName="PayBridge Payroll">
                      <PayBridgePayrollPage />
                    </RequirePermission>
                  }
                />
                <Route path="payroll" element={<PayrollCommandCentrePage />} />
                <Route
                  path="payroll/exceptions"
                  element={
                    <RequirePermission
                      permission="employer.payroll.exceptions.manage"
                      moduleName="The exceptions inbox"
                    >
                      <PayrollExceptionsPage />
                    </RequirePermission>
                  }
                />
                {/* Per-employee payroll rows — named salaries. An executive
                    viewer has no business in here. */}
                <Route
                  path="payroll/records"
                  element={
                    <RequirePermission permission="employer.employees.manage" moduleName="Payroll records">
                      <PayrollRecordsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="payroll/runs"
                  element={
                    <RequirePermission permission="employer.payroll.upload" moduleName="Payroll files and funding">
                      <EmployerPayrollPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="payroll/integrations"
                  element={
                    <RequirePermission
                      permission="employer.payroll.integrations.manage"
                      moduleName="Payroll integrations"
                    >
                      <PayrollIntegrationsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="salary-buffer"
                  element={
                    <RequirePermission permission="employer.buffer.request" moduleName="Salary Buffer">
                      <EmployerSalaryBufferPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="bridge-activity"
                  element={
                    <RequirePermission permission="employer.reports.view" moduleName="Company Bridge activity">
                      <EmployerBridgeActivityPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="repayments"
                  element={
                    <RequirePermission permission="employer.reports.view" moduleName="Settlement and reconciliation">
                      <EmployerRepaymentsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <RequirePermission permission="employer.reports.view" moduleName="Reporting and downloads">
                      <EmployerReportsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <RequirePermission permission="employer.settings.manage" moduleName="Company settings">
                      <EmployerSettingsPage />
                    </RequirePermission>
                  }
                />
                <Route path="*" element={<NotFoundInPortal home="/employer" />} />
              </Route>

              {/* Investor portal */}
              <Route
                path="/investor"
                element={
                  <RequireAuth portal="investor">
                    <DashboardShell portal="investor" />
                  </RequireAuth>
                }
              >
                <Route index element={<InvestorOverviewPage />} />
                <Route path="invest" element={<InvestorInvestPage />} />
                <Route path="performance" element={<InvestorPerformancePage />} />
                <Route path="transactions" element={<InvestorTransactionsPage />} />
                <Route path="statements" element={<InvestorStatementsPage />} />
                <Route path="withdrawals" element={<InvestorWithdrawalsPage />} />
                <Route path="documents" element={<InvestorDocumentsPage />} />
                <Route path="profile" element={<InvestorProfilePage />} />
                <Route path="*" element={<NotFoundInPortal home="/investor" />} />
              </Route>

              {/* Operations portal — internal only, never linked from the public site */}
              <Route
                path="/operations"
                element={
                  <RequireAuth portal="operations">
                    <DashboardShell portal="operations" />
                  </RequireAuth>
                }
              >
                <Route index element={<OpsOverviewPage />} />
                <Route
                  path="employers"
                  element={
                    <RequirePermission permission="ops.employers.review" moduleName="Employers">
                      <OpsEmployersPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="employees"
                  element={
                    <RequirePermission permission="ops.employees.review" moduleName="Employees">
                      <OpsEmployeesPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="investors"
                  element={
                    <RequirePermission permission="ops.investors.review" moduleName="Investors">
                      <OpsInvestorsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="transactions"
                  element={
                    <RequirePermission permission="ops.transactions.manage" moduleName="Transactions">
                      <OpsTransactionsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="funding"
                  element={
                    <RequirePermission permission="ops.funding.manage" moduleName="The funding queue">
                      <OpsFundingPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="payroll"
                  element={
                    <RequirePermission permission="ops.employers.review" moduleName="Payroll monitoring">
                      <OpsPayrollPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="portfolios"
                  element={
                    <RequirePermission permission="ops.portfolios.manage" moduleName="Portfolios">
                      <OpsPortfoliosPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="reconciliation"
                  element={
                    <RequirePermission permission="ops.reconciliation.manage" moduleName="Reconciliation">
                      <OpsReconciliationPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="risk"
                  element={
                    <RequirePermission permission="ops.risk.manage" moduleName="Risk">
                      <OpsRiskPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="compliance"
                  element={
                    <RequirePermission permission="ops.compliance.manage" moduleName="Compliance">
                      <OpsCompliancePage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <RequirePermission permission="ops.reports.view" moduleName="Reports">
                      <OpsReportsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="support"
                  element={
                    <RequirePermission permission="ops.support.manage" moduleName="Support">
                      <OpsSupportPage />
                    </RequirePermission>
                  }
                />
                <Route path="settings" element={<OpsSettingsPage />} />
                {/*
                  Demonstration access. The permission keeps the page to super
                  admins; the page itself then demands PayBridge staff
                  credentials, because every role inside this portal is already
                  a demo guest and a guest must not be able to invite the next.
                */}
                <Route
                  path="demo-access"
                  element={
                    <RequirePermission permission="ops.demo.invite" moduleName="Demo access">
                      <OpsDemoAccessPage />
                    </RequirePermission>
                  }
                />
                <Route path="*" element={<NotFoundInPortal home="/operations" />} />
              </Route>
            </Route>
            {/* --------- end of the private demonstration environment --------- */}

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
        </PreferencesProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
