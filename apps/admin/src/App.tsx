import {
  AuthProvider,
  PortalLoginPage,
  useAuth,
} from '@hrm/portal-ui';
import { ThemeProvider } from '@/context/ThemeContext';
import { CompanyProvider } from '@/context/CompanyContext';
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
import { ConstructionPage } from '@/pages/ConstructionPage';
import { AssetManagementPage } from '@/pages/operations/AssetManagementPage';
import { AccountingIntegrationPage } from '@/pages/operations/AccountingIntegrationPage';
import { HelpCenterPage } from '@/pages/support/HelpCenterPage';
import { PerformanceManagementPage } from '@/pages/talent/PerformanceManagementPage';
import { TrainingCertificationPage } from '@/pages/talent/TrainingCertificationPage';
import { EmployeeRelationsPage } from '@/pages/talent/EmployeeRelationsPage';
import { EmployeeEngagementPage } from '@/pages/talent/EmployeeEngagementPage';
import { HealthSafetyPage } from '@/pages/talent/HealthSafetyPage';
import { VendorContractorPage } from '@/pages/talent/VendorContractorPage';
import { useNav } from '@/context/NavContext';

function PageRouter() {
  const { current } = useNav();

  switch (current) {
    case 'dashboard': return <DashboardPage />;
    case 'org-profile': return <CompanyProfilePage />;
    case 'org-departments': return <DepartmentsPage />;
    case 'org-designations': return <DesignationsPage />;
    case 'org-job-levels': return <JobLevelsPage />;
    case 'org-employment-types': return <EmploymentTypesPage />;
    case 'org-teams': return <TeamsPage />;
    case 'org-cost-centres': return <CostCentresPage />;
    case 'org-chart': return <OrgChartPage />;
    case 'rbac-roles': return <RolesPage />;
    case 'rbac-matrix': return <PermissionMatrixPage />;
    case 'emp-directory': return <EmployeeDirectoryPage />;
    case 'emp-profile': return <EmployeeProfilePage />;
    case 'emp-lifecycle': return <LifecycleEventsPage />;
    case 'emp-contracts': return <ContractsPage />;
    case 'emp-contract-detail': return <ContractDetailPage />;
    case 'recruitment': return <RecruitmentPage />;
    case 'candidate-profile': return <CandidateProfilePage />;
    case 'offer-letter': return <OfferLetterPage />;
    case 'onboarding': return <OnboardingPage />;
    case 'offboarding': return <OffboardingPage />;
    case 'doc-types': return <DocumentTypesPage />;
    case 'emp-documents': return <EmployeeDocumentsPage />;
    case 'field-builder': return <CustomFieldBuilderPage />;
    case 'attendance': return <AttendancePage />;
    case 'attendance-regularization': return <RegularizationPage />;
    case 'shifts': return <ShiftsPage />;
    case 'roster': return <RosterPage />;
    case 'shift-swap': return <ShiftSwapPage />;
    case 'leave-types': return <LeaveTypesPage />;
    case 'leave-requests': return <LeaveRequestsPage />;
    case 'leave-balance': return <LeaveBalancePage />;
    case 'holidays': return <HolidayCalendarPage />;
    case 'overtime': return <OvertimePage />;
    case 'ot-rules': return <OTRulesPage />;
    case 'timesheet': return <TimesheetPage />;
    case 'geofence': return <GeofencePage />;
    case 'devices': return <DevicesPage />;
    case 'attendance-methods': return <AttendanceMethodsPage />;
    case 'payroll-runs': return <PayrollRunWizardPage />;
    case 'pay-schedules': return <PaySchedulePage />;
    case 'salary-components': return <SalaryComponentsPage />;
    case 'salary-structures': return <SalaryStructurePage />;
    case 'payroll-formulas': return <FormulaBuilderPage />;
    case 'payslips': return <PayslipPage />;
    case 'payment-batches': return <PaymentBatchPage />;
    case 'tax-profiles': return <TaxProfilesPage />;
    case 'benefits': return <BenefitsPage />;
    case 'loans': return <LoansPage />;
    case 'expenses': return <ExpensesPage />;
    case 'billing': return <BillingPage />;
    case 'assets': return <AssetManagementPage />;
    case 'accounting': return <AccountingIntegrationPage />;
    case 'help-center': return <HelpCenterPage />;
    case 'performance': return <PerformanceManagementPage />;
    case 'training': return <TrainingCertificationPage />;
    case 'employee-relations': return <EmployeeRelationsPage />;
    case 'engagement': return <EmployeeEngagementPage />;
    case 'health-safety': return <HealthSafetyPage />;
    case 'vendors-contractors': return <VendorContractorPage />;
    default: return <ConstructionPage />;
  }
}

function AdminApp() {
  const { isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <PortalLoginPage portal="admin" onLogin={login} />;
  }

  return (
    <CompanyProvider>
      <NavProvider>
        <AppShell onLogout={logout}>
          <PageRouter />
        </AppShell>
      </NavProvider>
    </CompanyProvider>
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
