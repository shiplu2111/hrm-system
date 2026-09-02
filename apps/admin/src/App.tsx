import { ThemeProvider } from '@/context/ThemeContext';
import { NavProvider, useNav } from '@/context/NavContext';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { CompanyProfilePage } from '@/pages/org/CompanyProfilePage';
import { DepartmentsPage } from '@/pages/org/DepartmentsPage';
import { DesignationsPage } from '@/pages/org/DesignationsPage';
import { EmploymentTypesPage } from '@/pages/org/EmploymentTypesPage';
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
import { AuthPage } from '@/pages/auth/AuthPage';
import { ESSPortalPage } from '@/pages/ess/ESSPortalPage';
import { PlatformControlPanelPage } from '@/pages/platform/PlatformControlPanelPage';
import { AssetManagementPage } from '@/pages/operations/AssetManagementPage';
import { AccountingIntegrationPage } from '@/pages/operations/AccountingIntegrationPage';
import { HelpCenterPage } from '@/pages/support/HelpCenterPage';
import { HelpWidget } from '@/components/support/HelpWidget';
import { PerformanceManagementPage } from '@/pages/talent/PerformanceManagementPage';
import { TrainingCertificationPage } from '@/pages/talent/TrainingCertificationPage';
import { EmployeeRelationsPage } from '@/pages/talent/EmployeeRelationsPage';
import { EmployeeEngagementPage } from '@/pages/talent/EmployeeEngagementPage';
import { HealthSafetyPage } from '@/pages/talent/HealthSafetyPage';
import { VendorContractorPage } from '@/pages/talent/VendorContractorPage';

function PageRouter() {
  const { current } = useNav();

  switch (current) {
    case 'dashboard': return <DashboardPage />;
    case 'org-profile': return <CompanyProfilePage />;
    case 'org-departments': return <DepartmentsPage />;
    case 'org-designations': return <DesignationsPage />;
    case 'org-employment-types': return <EmploymentTypesPage />;
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
    // Payroll & Billing
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

function AppRouter() {
  const { current, navigate } = useNav();

  if (current === 'auth') {
    return (
      <AuthPage
        onSuccess={(destination) => {
          if (destination === 'employee') navigate('ess');
          else if (destination === 'platform') navigate('platform-admin');
          else navigate('dashboard');
        }}
      />
    );
  }

  if (current === 'ess') {
    return (
      <>
        <ESSPortalPage />
        <HelpWidget />
      </>
    );
  }
  if (current === 'platform-admin') return <PlatformControlPanelPage />;

  return (
    <AppShell>
      <PageRouter />
    </AppShell>
  );
}

function App() {
  return (
    <ThemeProvider>
      <NavProvider>
        <AppRouter />
      </NavProvider>
    </ThemeProvider>
  );
}

export default App;
