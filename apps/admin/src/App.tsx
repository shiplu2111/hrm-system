import {
  AuthProvider,
  PortalLoginPage,
  isAdminPortalUser,
  useAuth,
} from '@hrm/portal-ui';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { CompanyProvider } from '@/context/CompanyContext';
import { TenantProvider } from '@/context/TenantContext';
import { NavProvider } from '@/context/NavContext';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { CompanyProfilePage } from '@/pages/org/CompanyProfilePage';
import { DepartmentsPage } from '@/pages/org/DepartmentsPage';
import { DesignationsPage } from '@/pages/org/DesignationsPage';
import { JobLevelsPage } from '@/pages/org/JobLevelsPage';
import { EmploymentTypesPage } from '@/pages/org/EmploymentTypesPage';
import { TeamsPage } from '@/pages/org/TeamsPage';
import { CostCentresPage } from '@/pages/org/CostCentresPage';
import { OrgChartPage } from '@/pages/org/OrgChartPage';
import { RolesPage } from '@/pages/rbac/RolesPage';
import { PermissionMatrixPage } from '@/pages/rbac/PermissionMatrixPage';
import { EmployeeDirectoryPage } from '@/pages/people/EmployeeDirectoryPage';
import { EmployeeProfilePage } from '@/pages/people/EmployeeProfilePage';
import { LifecycleEventsPage } from '@/pages/people/LifecycleEventsPage';
import { ContractsPage } from '@/pages/people/ContractsPage';
import { ContractDetailPage } from '@/pages/people/ContractDetailPage';
import { RecruitmentPage } from '@/pages/people/RecruitmentPage';
import { CandidateProfilePage } from '@/pages/people/CandidateProfilePage';
import { OfferLetterPage } from '@/pages/people/OfferLetterPage';
import { OnboardingPage } from '@/pages/people/OnboardingPage';
import { OffboardingPage } from '@/pages/people/OffboardingPage';
import { DocumentTypesPage } from '@/pages/people/DocumentTypesPage';
import { EmployeeDocumentsPage } from '@/pages/people/EmployeeDocumentsPage';
import { CustomFieldBuilderPage } from '@/pages/people/CustomFieldBuilderPage';
import { AttendancePage } from '@/pages/attendance/AttendancePage';
import { RegularizationPage } from '@/pages/attendance/RegularizationPage';
import { ShiftsPage } from '@/pages/attendance/ShiftsPage';
import { RosterPage } from '@/pages/attendance/RosterPage';
import { ShiftSwapPage } from '@/pages/attendance/ShiftSwapPage';
import { LeaveTypesPage } from '@/pages/attendance/LeaveTypesPage';
import { LeaveRequestsPage } from '@/pages/attendance/LeaveRequestsPage';
import { LeaveBalancePage } from '@/pages/attendance/LeaveBalancePage';
import { HolidayCalendarPage } from '@/pages/attendance/HolidayCalendarPage';
import { OvertimePage } from '@/pages/attendance/OvertimePage';
import { OTRulesPage } from '@/pages/attendance/OTRulesPage';
import { TimesheetPage } from '@/pages/attendance/TimesheetPage';
import { GeofencePage } from '@/pages/attendance/GeofencePage';
import { DevicesPage } from '@/pages/attendance/DevicesPage';
import { AttendanceMethodsPage } from '@/pages/attendance/AttendanceMethodsPage';
import { PayrollRunWizardPage } from '@/pages/payroll/PayrollRunWizardPage';
import { PaySchedulePage } from '@/pages/payroll/PaySchedulePage';
import { SalaryComponentsPage } from '@/pages/payroll/SalaryComponentsPage';
import { SalaryStructurePage } from '@/pages/payroll/SalaryStructurePage';
import { FormulaBuilderPage } from '@/pages/payroll/FormulaBuilderPage';
import { PayslipPage } from '@/pages/payroll/PayslipPage';
import { PaymentBatchPage } from '@/pages/payroll/PaymentBatchPage';
import { TaxProfilesPage } from '@/pages/payroll/TaxProfilesPage';
import { BenefitsPage } from '@/pages/payroll/BenefitsPage';
import { LoansPage } from '@/pages/payroll/LoansPage';
import { ExpensesPage } from '@/pages/payroll/ExpensesPage';
import { BillingPage } from '@/pages/billing/BillingPage';
import { AssetManagementPage } from '@/pages/operations/AssetManagementPage';
import { AccountingIntegrationPage } from '@/pages/operations/AccountingIntegrationPage';
import { HelpCenterPage } from '@/pages/support/HelpCenterPage';
import {
  KnowledgeBaseAdminPage,
  SupportTicketsAdminPage,
} from '@/pages/support/SupportPages';
import { PerformanceManagementPage } from '@/pages/talent/PerformanceManagementPage';
import { TrainingCertificationPage } from '@/pages/talent/TrainingCertificationPage';
import { EmployeeRelationsPage } from '@/pages/talent/EmployeeRelationsPage';
import { EmployeeEngagementPage } from '@/pages/talent/EmployeeEngagementPage';
import { HealthSafetyPage } from '@/pages/talent/HealthSafetyPage';
import { VendorContractorPage } from '@/pages/talent/VendorContractorPage';
import { ReportsHubPage } from '@/pages/reports/ReportsHubPage';
import { WorkflowBuilderPage } from '@/pages/settings/WorkflowBuilderPage';
import { SettingsHubPage } from '@/pages/settings/SettingsHubPage';

function PageRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />

      <Route path="/employees/directory" element={<EmployeeDirectoryPage />} />
      <Route path="/employees/lifecycle" element={<LifecycleEventsPage />} />
      <Route path="/employees/contracts" element={<ContractsPage />} />
      <Route path="/employees/contracts/:contractId" element={<ContractDetailPage />} />
      <Route path="/employees/recruitment" element={<RecruitmentPage />} />
      <Route
        path="/employees/recruitment/candidates/:applicationId"
        element={<CandidateProfilePage />}
      />
      <Route
        path="/employees/recruitment/offer-letter/:applicationId"
        element={<OfferLetterPage />}
      />
      <Route path="/employees/onboarding" element={<OnboardingPage />} />
      <Route path="/employees/offboarding" element={<OffboardingPage />} />
      <Route path="/employees/document-types" element={<DocumentTypesPage />} />
      <Route path="/employees/documents" element={<EmployeeDocumentsPage />} />
      <Route path="/employees/custom-fields" element={<CustomFieldBuilderPage />} />
      <Route path="/employees/:employeeId" element={<EmployeeProfilePage />} />

      <Route path="/organization/profile" element={<CompanyProfilePage />} />
      <Route path="/organization/departments" element={<DepartmentsPage />} />
      <Route path="/organization/designations" element={<DesignationsPage />} />
      <Route path="/organization/job-levels" element={<JobLevelsPage />} />
      <Route path="/organization/employment-types" element={<EmploymentTypesPage />} />
      <Route path="/organization/teams" element={<TeamsPage />} />
      <Route path="/organization/cost-centres" element={<CostCentresPage />} />
      <Route path="/organization/chart" element={<OrgChartPage />} />

      <Route path="/attendance/daily" element={<AttendancePage />} />
      <Route path="/attendance/regularization" element={<RegularizationPage />} />
      <Route path="/attendance/shifts" element={<ShiftsPage />} />
      <Route path="/attendance/roster" element={<RosterPage />} />
      <Route path="/attendance/shift-swap" element={<ShiftSwapPage />} />
      <Route path="/attendance/overtime" element={<OvertimePage />} />
      <Route path="/attendance/ot-rules" element={<OTRulesPage />} />
      <Route path="/attendance/timesheets" element={<TimesheetPage />} />
      <Route path="/attendance/geofence" element={<GeofencePage />} />
      <Route path="/attendance/devices" element={<DevicesPage />} />
      <Route path="/attendance/methods" element={<AttendanceMethodsPage />} />

      <Route path="/leave/types" element={<LeaveTypesPage />} />
      <Route path="/leave/requests" element={<LeaveRequestsPage />} />
      <Route path="/leave/balances" element={<LeaveBalancePage />} />
      <Route path="/leave/holidays" element={<HolidayCalendarPage />} />

      <Route path="/payroll/runs" element={<PayrollRunWizardPage />} />
      <Route path="/payroll/schedules" element={<PaySchedulePage />} />
      <Route path="/payroll/salary-components" element={<SalaryComponentsPage />} />
      <Route path="/payroll/salary-structures" element={<SalaryStructurePage />} />
      <Route path="/payroll/formulas" element={<FormulaBuilderPage />} />
      <Route path="/payroll/payslips" element={<PayslipPage />} />
      <Route path="/payroll/payment-batches" element={<PaymentBatchPage />} />
      <Route path="/payroll/tax-profiles" element={<TaxProfilesPage />} />
      <Route path="/payroll/benefits" element={<BenefitsPage />} />
      <Route path="/payroll/loans" element={<LoansPage />} />
      <Route path="/payroll/expenses" element={<ExpensesPage />} />

      <Route path="/billing" element={<BillingPage />} />
      <Route path="/operations/assets" element={<AssetManagementPage />} />
      <Route path="/operations/accounting" element={<AccountingIntegrationPage />} />
      <Route path="/support/help" element={<HelpCenterPage />} />
      <Route path="/support/knowledge-base" element={<KnowledgeBaseAdminPage />} />
      <Route path="/support/tickets" element={<SupportTicketsAdminPage />} />

      <Route path="/talent/performance" element={<PerformanceManagementPage />} />
      <Route path="/talent/training" element={<TrainingCertificationPage />} />
      <Route path="/talent/employee-relations" element={<EmployeeRelationsPage />} />
      <Route path="/talent/engagement" element={<EmployeeEngagementPage />} />
      <Route path="/talent/health-safety" element={<HealthSafetyPage />} />
      <Route path="/talent/vendors-contractors" element={<VendorContractorPage />} />

      <Route path="/reports" element={<ReportsHubPage />} />
      <Route path="/reports/scheduled" element={<ReportsHubPage />} />
      <Route path="/reports/import" element={<ReportsHubPage />} />
      <Route path="/reports/export" element={<ReportsHubPage />} />

      <Route path="/settings" element={<SettingsHubPage />} />
      <Route path="/settings/notifications" element={<SettingsHubPage />} />
      <Route path="/settings/workflows" element={<WorkflowBuilderPage />} />
      <Route path="/settings/security" element={<SettingsHubPage />} />
      <Route path="/settings/integrations" element={<SettingsHubPage />} />
      <Route path="/settings/backup" element={<SettingsHubPage />} />
      <Route path="/settings/general" element={<SettingsHubPage />} />
      <Route path="/settings/roles" element={<RolesPage />} />
      <Route path="/settings/permission-matrix" element={<PermissionMatrixPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AdminApp() {
  const { isAuthenticated, login, logout, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user && !isAdminPortalUser(user)) {
      logout();
    }
  }, [isAuthenticated, user, logout]);

  if (!isAuthenticated) {
    return <PortalLoginPage portal="admin" onLogin={login} />;
  }

  return (
    <TenantProvider>
      <CompanyProvider>
        <BrowserRouter>
          <NavProvider>
            <AppShell onLogout={logout}>
              <PageRoutes />
            </AppShell>
          </NavProvider>
        </BrowserRouter>
      </CompanyProvider>
    </TenantProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider portal="admin">
        <AdminApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
