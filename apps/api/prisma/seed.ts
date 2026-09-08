/**
 * Local development seed — see docs/ENV_SETUP.md §5 and docs/ROLES_PERMISSIONS.md §1.
 *
 * Idempotent: uses fixed UUIDs and upserts so `npm run seed` is safe to re-run.
 */
import {
  CountryRuleType,
  LeaveAccrualType,
  PermissionAction,
  PrismaClient,
} from '@prisma/client';
import { PAY_FORMULA_LOAN_INSTALLMENT } from '@hrm/shared-types';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** Fixed IDs so re-seeding upserts the same records. */
const ID = {
  tenant: '10000000-0000-4000-8000-000000000001',
  country: '10000000-0000-4000-8000-000000000002',
  taxBracket: '10000000-0000-4000-8000-000000000003',
  countryRuleLeave: '10000000-0000-4000-8000-000000000004',
  countryRuleOt: '10000000-0000-4000-8000-000000000005',
  countryRulePublicHoliday: '10000000-0000-4000-8000-000000000006',
  countryRuleSocialSecurity: '10000000-0000-4000-8000-000000000008',
  countryRuleHealthSafety: '10000000-0000-4000-8000-000000000009',
  stateRuleNswHoliday: '10000000-0000-4000-8000-000000000007',
  companyHoliday: '10000000-0000-4000-8000-000000000071',
  branchHoliday: '10000000-0000-4000-8000-000000000072',
  payComponentBasic: '10000000-0000-4000-8000-000000000080',
  payComponentHra: '10000000-0000-4000-8000-000000000081',
  payComponentTax: '10000000-0000-4000-8000-000000000082',
  payComponentLoan: '10000000-0000-4000-8000-000000000083',
  salaryStructureBasic: '10000000-0000-4000-8000-000000000090',
  salaryStructureHra: '10000000-0000-4000-8000-000000000091',
  salaryStructureTax: '10000000-0000-4000-8000-000000000092',
  salaryStructureLoan: '10000000-0000-4000-8000-000000000093',
  employeeLoanStaff: '10000000-0000-4000-8000-0000000000a0',
  employeeLoanPending: '10000000-0000-4000-8000-0000000000a1',
  expenseCategoryTravel: '10000000-0000-4000-8000-0000000000b0',
  expenseCategoryMeals: '10000000-0000-4000-8000-0000000000b1',
  expenseCategorySoftware: '10000000-0000-4000-8000-0000000000b2',
  workflowExpenseStandard: '10000000-0000-4000-8000-0000000000c0',
  workflowExpenseHighValue: '10000000-0000-4000-8000-0000000000c1',
  expenseClaimPending: '10000000-0000-4000-8000-0000000000d0',
  expenseClaimApproved: '10000000-0000-4000-8000-0000000000d1',
  expenseClaimWorkflowPending: '10000000-0000-4000-8000-0000000000e0',
  timesheetProjectPlatform: '10000000-0000-4000-8000-0000000000f0',
  timesheetProjectInternal: '10000000-0000-4000-8000-0000000000f1',
  workflowTimesheetStandard: '10000000-0000-4000-8000-0000000000f2',
  timesheetEntryPending: '10000000-0000-4000-8000-0000000000f3',
  timesheetEntryApproved: '10000000-0000-4000-8000-0000000000f4',
  timesheetEntryWorkflowPending: '10000000-0000-4000-8000-0000000000f5',
  jobRequisitionEngineer: '10000000-0000-4000-8000-000000000100',
  jobRequisitionDesigner: '10000000-0000-4000-8000-000000000101',
  jobPostingEngineer: '10000000-0000-4000-8000-000000000102',
  workflowJobRequisitionStandard: '10000000-0000-4000-8000-000000000103',
  candidateJennifer: '10000000-0000-4000-8000-000000000110',
  candidateCarlos: '10000000-0000-4000-8000-000000000111',
  candidateAisha: '10000000-0000-4000-8000-000000000112',
  candidateMei: '10000000-0000-4000-8000-000000000113',
  candidateHannah: '10000000-0000-4000-8000-000000000114',
  candidateOliver: '10000000-0000-4000-8000-000000000115',
  applicationJennifer: '10000000-0000-4000-8000-000000000120',
  applicationCarlos: '10000000-0000-4000-8000-000000000121',
  applicationAisha: '10000000-0000-4000-8000-000000000122',
  applicationMei: '10000000-0000-4000-8000-000000000123',
  applicationHannah: '10000000-0000-4000-8000-000000000124',
  applicationOliver: '10000000-0000-4000-8000-000000000125',
  interviewRoundMeiTechnical: '10000000-0000-4000-8000-000000000130',
  interviewRoundMeiHr: '10000000-0000-4000-8000-000000000131',
  interviewRoundMeiManagement: '10000000-0000-4000-8000-000000000132',
  interviewRoundMeiFinal: '10000000-0000-4000-8000-000000000133',
  interviewRoundHannahTechnical: '10000000-0000-4000-8000-000000000134',
  interviewRoundHannahHr: '10000000-0000-4000-8000-000000000135',
  interviewRoundHannahManagement: '10000000-0000-4000-8000-000000000136',
  interviewRoundHannahFinal: '10000000-0000-4000-8000-000000000137',
  workflowOfferLetterStandard: '10000000-0000-4000-8000-000000000140',
  offerLetterHannah: '10000000-0000-4000-8000-000000000141',
  documentTypeNationalId: '10000000-0000-4000-8000-000000000150',
  documentTypeBankDetails: '10000000-0000-4000-8000-000000000151',
  documentTypeHandbook: '10000000-0000-4000-8000-000000000152',
  documentTypeCodeOfConduct: '10000000-0000-4000-8000-000000000153',
  onboardingTemplateDefault: '10000000-0000-4000-8000-000000000160',
  onboardingTemplateItemId: '10000000-0000-4000-8000-000000000161',
  onboardingTemplateItemBank: '10000000-0000-4000-8000-000000000162',
  onboardingTemplateItemHandbook: '10000000-0000-4000-8000-000000000163',
  onboardingTemplateItemConduct: '10000000-0000-4000-8000-000000000164',
  onboardingTemplateItemLaptop: '10000000-0000-4000-8000-000000000165',
  onboardingTemplateItemEmail: '10000000-0000-4000-8000-000000000166',
  employeeOnboardingStaff: '10000000-0000-4000-8000-000000000170',
  employeeDocumentStaffId: '10000000-0000-4000-8000-000000000171',
  assetLaptopManager: '10000000-0000-4000-8000-000000000172',
  assetAssignmentManager: '10000000-0000-4000-8000-000000000173',
  assetLaptopStaff: '10000000-0000-4000-8000-000000000174',
  offboardingTemplateDefault: '10000000-0000-4000-8000-000000000180',
  offboardingTemplateItemExitSchedule: '10000000-0000-4000-8000-000000000181',
  offboardingTemplateItemExitComplete: '10000000-0000-4000-8000-000000000182',
  offboardingTemplateItemLaptopReturn: '10000000-0000-4000-8000-000000000183',
  offboardingTemplateItemAccessRevoke: '10000000-0000-4000-8000-000000000184',
  offboardingTemplateItemClearance: '10000000-0000-4000-8000-000000000185',
  offboardingTemplateItemSettlement: '10000000-0000-4000-8000-000000000186',
  employeeOffboardingManager: '10000000-0000-4000-8000-000000000190',
  payrollPeriodAug2026: '10000000-0000-4000-8000-0000000001a0',
  payrollRunManagerAug2026: '10000000-0000-4000-8000-0000000001a1',
  benefitPlanHealthGold: '10000000-0000-4000-8000-0000000001b0',
  benefitPlanLife: '10000000-0000-4000-8000-0000000001b1',
  benefitOpenEnrollment2026: '10000000-0000-4000-8000-0000000001b2',
  benefitEnrollmentStaffHealth: '10000000-0000-4000-8000-0000000001b3',
  benefitEnrollmentStaffLife: '10000000-0000-4000-8000-0000000001b4',
  benefitDependentStaffSpouse: '10000000-0000-4000-8000-0000000001b5',
  glAccountSalariesPayable: '10000000-0000-4000-8000-0000000001c0',
  glAccountBasicSalary: '10000000-0000-4000-8000-0000000001c1',
  glAccountAllowances: '10000000-0000-4000-8000-0000000001c2',
  glAccountTaxPayable: '10000000-0000-4000-8000-0000000001c3',
  glAccountLoanPayable: '10000000-0000-4000-8000-0000000001c4',
  glAccountSuperExpense: '10000000-0000-4000-8000-0000000001c5',
  glAccountSuperPayable: '10000000-0000-4000-8000-0000000001c6',
  glAccountBenefitsPayable: '10000000-0000-4000-8000-0000000001c7',
  glMappingBasic: '10000000-0000-4000-8000-0000000001d0',
  glMappingHra: '10000000-0000-4000-8000-0000000001d1',
  glMappingTax: '10000000-0000-4000-8000-0000000001d2',
  glMappingLoan: '10000000-0000-4000-8000-0000000001d3',
  glMappingNetPay: '10000000-0000-4000-8000-0000000001d4',
  glMappingSuperExpense: '10000000-0000-4000-8000-0000000001d5',
  glMappingSuperLiability: '10000000-0000-4000-8000-0000000001d6',
  company: '10000000-0000-4000-8000-000000000010',
  location: '10000000-0000-4000-8000-000000000011',
  departmentHr: '10000000-0000-4000-8000-000000000012',
  departmentEng: '10000000-0000-4000-8000-000000000013',
  jobLevelManager: '10000000-0000-4000-8000-000000000014',
  jobLevelStaff: '10000000-0000-4000-8000-000000000015',
  designationOwner: '10000000-0000-4000-8000-000000000016',
  designationHr: '10000000-0000-4000-8000-000000000017',
  designationPayroll: '10000000-0000-4000-8000-000000000018',
  designationManager: '10000000-0000-4000-8000-000000000019',
  designationEngineer: '10000000-0000-4000-8000-00000000001a',
  employmentTypeFullTime: '10000000-0000-4000-8000-00000000001b',
  leaveTypeAnnual: '10000000-0000-4000-8000-000000000020',
  leaveTypeSick: '10000000-0000-4000-8000-000000000021',
  leavePolicyAnnual: '10000000-0000-4000-8000-000000000022',
  leavePolicySick: '10000000-0000-4000-8000-000000000023',
  roleSuperAdmin: '10000000-0000-4000-8000-000000000030',
  roleCompanyOwner: '10000000-0000-4000-8000-000000000031',
  roleHrAdmin: '10000000-0000-4000-8000-000000000032',
  rolePayrollAdmin: '10000000-0000-4000-8000-000000000033',
  roleManager: '10000000-0000-4000-8000-000000000034',
  roleEmployee: '10000000-0000-4000-8000-000000000035',
  roleAccountant: '10000000-0000-4000-8000-000000000036',
  roleRecruiter: '10000000-0000-4000-8000-000000000037',
  empOwner: '10000000-0000-4000-8000-000000000040',
  empHrAdmin: '10000000-0000-4000-8000-000000000041',
  empPayrollAdmin: '10000000-0000-4000-8000-000000000042',
  empManager: '10000000-0000-4000-8000-000000000043',
  empStaff: '10000000-0000-4000-8000-000000000044',
  taxProfileOwner: '10000000-0000-4000-8000-000000000050',
  taxProfileHrAdmin: '10000000-0000-4000-8000-000000000051',
  taxProfilePayrollAdmin: '10000000-0000-4000-8000-000000000052',
  taxProfileManager: '10000000-0000-4000-8000-000000000053',
  taxProfileStaff: '10000000-0000-4000-8000-000000000054',
  userOwner: '10000000-0000-4000-8000-000000000060',
  userHrAdmin: '10000000-0000-4000-8000-000000000061',
  kbCategoryPayroll: '10000000-0000-4000-8000-000000000200',
  kbCategoryLeave: '10000000-0000-4000-8000-000000000201',
  kbArticlePayrollRun: '10000000-0000-4000-8000-000000000210',
  kbArticleLeaveRequest: '10000000-0000-4000-8000-000000000211',
  kbArticleClockIn: '10000000-0000-4000-8000-000000000212',
  exchangeRateUsdAudH1: '10000000-0000-4000-8000-000000000220',
  exchangeRateUsdAudH2: '10000000-0000-4000-8000-000000000221',
  reviewCycleH2: '10000000-0000-4000-8000-000000000230',
  kpiActivation: '10000000-0000-4000-8000-000000000231',
  kpiSupportSla: '10000000-0000-4000-8000-000000000232',
  kpiAssignmentStaffActivation: '10000000-0000-4000-8000-000000000233',
  kpiAssignmentManagerSupport: '10000000-0000-4000-8000-000000000234',
  workflowPerformanceReview: '10000000-0000-4000-8000-000000000240',
  performanceReviewStaff: '10000000-0000-4000-8000-000000000241',
  performanceReviewManager: '10000000-0000-4000-8000-000000000242',
  feedback360HrForStaff: '10000000-0000-4000-8000-000000000243',
  feedback360PayrollForStaff: '10000000-0000-4000-8000-000000000244',
  trainingCoursePrivacy: '10000000-0000-4000-8000-000000000250',
  trainingCourseLeadership: '10000000-0000-4000-8000-000000000251',
  trainingSessionPrivacy: '10000000-0000-4000-8000-000000000252',
  trainingCostPrivacyVenue: '10000000-0000-4000-8000-000000000253',
  trainingAttendanceStaff: '10000000-0000-4000-8000-000000000254',
  trainingAttendanceManager: '10000000-0000-4000-8000-000000000255',
  skillTypeScript: '10000000-0000-4000-8000-000000000256',
  skillLeadership: '10000000-0000-4000-8000-000000000257',
  skillDataPrivacy: '10000000-0000-4000-8000-000000000258',
  employeeSkillStaffPrivacy: '10000000-0000-4000-8000-000000000259',
  employeeSkillManagerLeadership: '10000000-0000-4000-8000-000000000260',
  certPrivacyStaff: '10000000-0000-4000-8000-000000000261',
  certFirstAidHr: '10000000-0000-4000-8000-000000000262',
  hrCaseGrievance: '10000000-0000-4000-8000-000000000270',
  hrCaseConduct: '10000000-0000-4000-8000-000000000271',
  hrCasePartyWitness: '10000000-0000-4000-8000-000000000272',
  hrCaseNoteConduct: '10000000-0000-4000-8000-000000000273',
  hrCaseDisciplinaryAction: '10000000-0000-4000-8000-000000000274',
  hrCaseInvestigationRecord: '10000000-0000-4000-8000-000000000275',
  engagementAnnouncement: '10000000-0000-4000-8000-000000000280',
  engagementPulseSurvey: '10000000-0000-4000-8000-000000000281',
  engagementEnpsSurvey: '10000000-0000-4000-8000-000000000282',
  engagementPulseQuestion: '10000000-0000-4000-8000-000000000283',
  engagementEnpsQuestion: '10000000-0000-4000-8000-000000000284',
  engagementKudosManager: '10000000-0000-4000-8000-000000000285',
  safetyIncidentNearMiss: '10000000-0000-4000-8000-000000000290',
  contractorClearPath: '10000000-0000-4000-8000-000000000291',
  contractorContractClearPath: '10000000-0000-4000-8000-000000000292',
  contractorInvoiceClearPathPaid: '10000000-0000-4000-8000-000000000293',
  contractorInvoiceClearPathApproved: '10000000-0000-4000-8000-000000000294',
  contractorApex: '10000000-0000-4000-8000-000000000295',
  contractorContractApex: '10000000-0000-4000-8000-000000000296',
  glAccountContractorExpense: '10000000-0000-4000-8000-000000000297',
  glAccountContractorPayable: '10000000-0000-4000-8000-000000000298',
  glMappingContractorExpense: '10000000-0000-4000-8000-000000000299',
  glMappingContractorPayable: '10000000-0000-4000-8000-00000000029a',
  contractorMilestoneClearPath1: '10000000-0000-4000-8000-00000000029b',
  contractorMilestoneClearPath2: '10000000-0000-4000-8000-00000000029c',
  safetyComplianceInduction: '10000000-0000-4000-8000-000000000291',
  userPayrollAdmin: '10000000-0000-4000-8000-000000000062',
  userManager: '10000000-0000-4000-8000-000000000063',
  userStaff: '10000000-0000-4000-8000-000000000064',
  userSuperAdmin: '10000000-0000-4000-8000-000000000065',
  shiftStandard: '10000000-0000-4000-8000-000000000070',
} as const;

const EFFECTIVE_FROM = new Date('2024-07-01');
const SEED_YEAR = 2025;
const DEMO_PASSWORD = 'password';
const BCRYPT_ROUNDS = 12;
const SEED_EMAIL_DOMAIN = 'cmsnbd.com';

/** Login emails by role — e.g. admin@cmsnbd.com, employee@cmsnbd.com */
const ROLE_SEED_EMAIL: Record<string, string> = {
  'Company Owner': `admin@${SEED_EMAIL_DOMAIN}`,
  'HR Admin': `hr@${SEED_EMAIL_DOMAIN}`,
  'Payroll Admin': `payroll@${SEED_EMAIL_DOMAIN}`,
  Manager: `manager@${SEED_EMAIL_DOMAIN}`,
  Employee: `employee@${SEED_EMAIL_DOMAIN}`,
};

type ModulePermission = { module: string; actions: PermissionAction[] };

const MODULES = [
  'tenant',
  'employee',
  'leave',
  'payroll',
  'attendance',
  'recruitment',
  'settings',
  'audit',
  'platform',
  'support',
  'performance',
  'training',
  'employee_relations',
  'engagement',
  'health_safety',
  'contractors',
] as const;

const ALL_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'finalize',
];

/** Default role permission matrix — ROLES_PERMISSIONS.md §1–§3. */
const ROLE_PERMISSIONS: Record<string, ModulePermission[]> = {
  'Super Admin': MODULES.map((module) => ({ module, actions: [...ALL_ACTIONS] })),
  'Company Owner': MODULES.filter(
    (module) => module !== 'tenant' && module !== 'platform',
  ).map((module) => ({
    module,
    actions: [...ALL_ACTIONS],
  })),
  'HR Admin': [
    { module: 'employee', actions: ['view', 'create', 'edit'] },
    { module: 'leave', actions: ['view', 'approve'] },
    { module: 'payroll', actions: ['view', 'create', 'edit'] },
    { module: 'attendance', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'recruitment', actions: ['view', 'create', 'edit', 'approve'] },
    { module: 'settings', actions: ['view', 'create', 'edit', 'delete'] },
    { module: 'support', actions: ['view', 'create', 'edit'] },
    { module: 'performance', actions: ['view', 'create', 'edit', 'approve'] },
    { module: 'training', actions: ['view', 'create', 'edit', 'approve'] },
    { module: 'employee_relations', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'engagement', actions: ['view', 'create', 'edit', 'approve'] },
    { module: 'health_safety', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    { module: 'contractors', actions: ['view', 'create', 'edit', 'approve'] },
  ],
  'Payroll Admin': [
    { module: 'employee', actions: ['view'] },
    { module: 'leave', actions: ['view'] },
    { module: 'payroll', actions: ['view', 'create', 'edit', 'approve', 'finalize'] },
    { module: 'attendance', actions: ['view'] },
    { module: 'contractors', actions: ['view', 'create', 'edit', 'approve', 'finalize'] },
  ],
  Manager: [
    { module: 'employee', actions: ['view'] },
    { module: 'leave', actions: ['view', 'approve'] },
    { module: 'attendance', actions: ['view', 'approve'] },
    { module: 'performance', actions: ['view', 'create', 'edit', 'approve'] },
    { module: 'training', actions: ['view', 'create', 'edit'] },
    { module: 'engagement', actions: ['view'] },
    { module: 'health_safety', actions: ['view', 'create'] },
  ],
  Employee: [
    { module: 'employee', actions: ['view', 'edit'] },
    { module: 'leave', actions: ['view', 'create'] },
    { module: 'payroll', actions: ['view'] },
    { module: 'attendance', actions: ['view', 'create'] },
    { module: 'support', actions: ['view', 'create'] },
    { module: 'performance', actions: ['view'] },
    { module: 'training', actions: ['view'] },
    { module: 'engagement', actions: ['view', 'create'] },
    { module: 'health_safety', actions: ['view', 'create'] },
  ],
  Accountant: [
    { module: 'employee', actions: ['view'] },
    { module: 'payroll', actions: ['view', 'approve'] },
    { module: 'contractors', actions: ['view', 'approve', 'finalize'] },
  ],
  Recruiter: [
    { module: 'recruitment', actions: ['view', 'create', 'edit', 'approve'] },
    { module: 'employee', actions: ['view', 'create', 'edit'] },
  ],
};

async function upsertRolePermissions(
  roleId: string,
  permissions: ModulePermission[],
): Promise<void> {
  for (const { module, actions } of permissions) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: {
          roleId_module_action: { roleId, module, action },
        },
        create: { roleId, module, action },
        update: {},
      });
    }
  }
}

async function main(): Promise<void> {
  console.log('Seeding demo data…');

  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'demo' },
    create: {
      id: ID.tenant,
      name: 'Demo Corp',
      subdomain: 'demo',
      planId: 'enterprise',
      status: 'active',
      storageDriver: 'local',
    },
    update: { name: 'Demo Corp', status: 'active', planId: 'enterprise' },
  });

  const country = await prisma.country.upsert({
    where: { isoCode: 'AUS' },
    create: {
      id: ID.country,
      name: 'Australia',
      isoCode: 'AUS',
      currency: 'AUD',
      timezone: 'Australia/Sydney',
      dateFormat: 'DD/MM/YYYY',
      numberFormat: '1,234.56',
    },
    update: {
      name: 'Australia',
      currency: 'AUD',
      timezone: 'Australia/Sydney',
      dateFormat: 'DD/MM/YYYY',
      numberFormat: '1,234.56',
    },
  });

  await prisma.taxBracket.upsert({
    where: { id: ID.taxBracket },
    create: {
      id: ID.taxBracket,
      countryId: country.id,
      taxYear: 2024,
      bracketJson: {
        currency: 'AUD',
        brackets: [
          { min: 0, max: 18200, rate: 0 },
          { min: 18201, max: 45000, rate: 0.16 },
          { min: 45001, max: 135000, rate: 0.3 },
          { min: 135001, max: 190000, rate: 0.37 },
          { min: 190001, max: null, rate: 0.45 },
        ],
        medicareLevy: 0.02,
      },
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: {
      taxYear: 2024,
      bracketJson: {
        currency: 'AUD',
        brackets: [
          { min: 0, max: 18200, rate: 0 },
          { min: 18201, max: 45000, rate: 0.16 },
          { min: 45001, max: 135000, rate: 0.3 },
          { min: 135001, max: 190000, rate: 0.37 },
          { min: 190001, max: null, rate: 0.45 },
        ],
        medicareLevy: 0.02,
      },
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
    },
  });

  await prisma.countryRule.upsert({
    where: { id: ID.countryRuleLeave },
    create: {
      id: ID.countryRuleLeave,
      countryId: country.id,
      ruleType: CountryRuleType.leave,
      payload: {
        annualLeaveMinimumWeeks: 4,
        personalCarersLeaveDaysPerYear: 10,
        longServiceLeaveEligibleYears: 10,
        parentalLeaveWeeks: 52,
        publicHolidays: 'state_and_territory_based',
      },
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: {
      ruleType: CountryRuleType.leave,
      payload: {
        annualLeaveMinimumWeeks: 4,
        personalCarersLeaveDaysPerYear: 10,
        longServiceLeaveEligibleYears: 10,
        parentalLeaveWeeks: 52,
        publicHolidays: 'state_and_territory_based',
      },
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
    },
  });

  await prisma.countryRule.upsert({
    where: { id: ID.countryRuleOt },
    create: {
      id: ID.countryRuleOt,
      countryId: country.id,
      ruleType: CountryRuleType.ot,
      payload: {
        weeklyThresholdHours: 38,
        multipliers: { weekday: 1.5, weekend: 2.0, publicHoliday: 2.5 },
      },
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: {
      ruleType: CountryRuleType.ot,
      payload: {
        weeklyThresholdHours: 38,
        multipliers: { weekday: 1.5, weekend: 2.0, publicHoliday: 2.5 },
      },
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
    },
  });

  await prisma.countryRule.upsert({
    where: { id: ID.countryRulePublicHoliday },
    create: {
      id: ID.countryRulePublicHoliday,
      countryId: country.id,
      ruleType: CountryRuleType.public_holiday,
      payload: {
        holidays: [
          { name: "New Year's Day", date: '2025-01-01', recurring: true },
          { name: 'Australia Day', date: '2025-01-26', recurring: true },
          { name: 'Good Friday', date: '2025-04-18', recurring: false },
          { name: 'Anzac Day', date: '2025-04-25', recurring: true },
          { name: "Queen's Birthday", date: '2025-06-09', recurring: false },
          { name: 'Christmas Day', date: '2025-12-25', recurring: true },
          { name: 'Boxing Day', date: '2025-12-26', recurring: true },
        ],
      },
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: {
      ruleType: CountryRuleType.public_holiday,
      payload: {
        holidays: [
          { name: "New Year's Day", date: '2025-01-01', recurring: true },
          { name: 'Australia Day', date: '2025-01-26', recurring: true },
          { name: 'Good Friday', date: '2025-04-18', recurring: false },
          { name: 'Anzac Day', date: '2025-04-25', recurring: true },
          { name: "Queen's Birthday", date: '2025-06-09', recurring: false },
          { name: 'Christmas Day', date: '2025-12-25', recurring: true },
          { name: 'Boxing Day', date: '2025-12-26', recurring: true },
        ],
      },
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
    },
  });

  await prisma.countryRule.upsert({
    where: { id: ID.countryRuleSocialSecurity },
    create: {
      id: ID.countryRuleSocialSecurity,
      countryId: country.id,
      ruleType: CountryRuleType.social_security,
      payload: {
        schemeName: 'Superannuation Guarantee',
        employerContributionRate: 11,
        employeeContributionRate: 0,
        contributionBase: 'gross',
      },
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: {
      ruleType: CountryRuleType.social_security,
      payload: {
        schemeName: 'Superannuation Guarantee',
        employerContributionRate: 11,
        employeeContributionRate: 0,
        contributionBase: 'gross',
      },
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
    },
  });

  await prisma.countryRule.upsert({
    where: { id: ID.countryRuleHealthSafety },
    create: {
      id: ID.countryRuleHealthSafety,
      countryId: country.id,
      ruleType: CountryRuleType.health_safety,
      payload: {
        incidentReporting: {
          regulatorReportRequiredSeverities: ['high', 'critical'],
          notifiableIncidentTypes: ['injury'],
          regulatorReportDeadlineHours: 24,
          regulatorName: 'Safe Work Australia',
        },
        injuryLog: {
          retentionYears: 7,
          requireBodyPart: true,
        },
        complianceRequirements: [
          {
            key: 'safety_induction',
            title: 'Mandatory safety induction',
            type: 'training',
            description: 'Annual workplace safety induction for all staff',
            renewalMonths: 12,
          },
          {
            key: 'monthly_workplace_inspection',
            title: 'Monthly workplace inspection',
            type: 'inspection',
            description: 'Walk-through inspection of operational areas',
            frequencyDays: 30,
          },
        ],
      },
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: {
      ruleType: CountryRuleType.health_safety,
      payload: {
        incidentReporting: {
          regulatorReportRequiredSeverities: ['high', 'critical'],
          notifiableIncidentTypes: ['injury'],
          regulatorReportDeadlineHours: 24,
          regulatorName: 'Safe Work Australia',
        },
        injuryLog: {
          retentionYears: 7,
          requireBodyPart: true,
        },
        complianceRequirements: [
          {
            key: 'safety_induction',
            title: 'Mandatory safety induction',
            type: 'training',
            description: 'Annual workplace safety induction for all staff',
            renewalMonths: 12,
          },
          {
            key: 'monthly_workplace_inspection',
            title: 'Monthly workplace inspection',
            type: 'inspection',
            description: 'Walk-through inspection of operational areas',
            frequencyDays: 30,
          },
        ],
      },
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
    },
  });

  await prisma.stateProvinceRule.upsert({
    where: { id: ID.stateRuleNswHoliday },
    create: {
      id: ID.stateRuleNswHoliday,
      countryId: country.id,
      stateCode: 'NSW',
      ruleType: 'public_holiday',
      payload: {
        holidays: [
          { name: 'Labour Day (NSW)', date: '2025-10-06', recurring: false },
          { name: 'Labour Day (NSW)', date: '2026-10-05', recurring: false },
        ],
      },
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: {
      ruleType: 'public_holiday',
      payload: {
        holidays: [
          { name: 'Labour Day (NSW)', date: '2025-10-06', recurring: false },
          { name: 'Labour Day (NSW)', date: '2026-10-05', recurring: false },
        ],
      },
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
    },
  });

  const company = await prisma.company.upsert({
    where: { id: ID.company },
    create: {
      id: ID.company,
      tenantId: tenant.id,
      name: 'Demo Corp Pty Ltd',
      countryId: country.id,
      financialYearStart: 7,
    },
    update: {
      name: 'Demo Corp Pty Ltd',
      countryId: country.id,
      financialYearStart: 7,
    },
  });

  await prisma.location.upsert({
    where: { id: ID.location },
    create: {
      id: ID.location,
      companyId: company.id,
      name: 'Sydney HQ',
      address: '100 George Street, Sydney NSW 2000',
      timezone: 'Australia/Sydney',
      lat: -33.8688,
      lng: 151.2093,
      geofenceRadiusM: 200,
    },
    update: {
      name: 'Sydney HQ',
      address: '100 George Street, Sydney NSW 2000',
      timezone: 'Australia/Sydney',
    },
  });

  await prisma.department.upsert({
    where: { id: ID.departmentHr },
    create: { id: ID.departmentHr, companyId: company.id, name: 'Human Resources' },
    update: { name: 'Human Resources' },
  });

  await prisma.department.upsert({
    where: { id: ID.departmentEng },
    create: { id: ID.departmentEng, companyId: company.id, name: 'Engineering' },
    update: { name: 'Engineering' },
  });

  await prisma.jobLevel.upsert({
    where: { companyId_code: { companyId: company.id, code: 'MGR' } },
    create: {
      id: ID.jobLevelManager,
      companyId: company.id,
      code: 'MGR',
      name: 'Manager',
      rank: 3,
    },
    update: { name: 'Manager', rank: 3 },
  });

  await prisma.jobLevel.upsert({
    where: { companyId_code: { companyId: company.id, code: 'IC3' } },
    create: {
      id: ID.jobLevelStaff,
      companyId: company.id,
      code: 'IC3',
      name: 'Individual Contributor',
      rank: 2,
    },
    update: { name: 'Individual Contributor', rank: 2 },
  });

  await prisma.designation.upsert({
    where: { id: ID.designationOwner },
    create: {
      id: ID.designationOwner,
      companyId: company.id,
      departmentId: ID.departmentHr,
      jobLevelId: ID.jobLevelManager,
      name: 'Managing Director',
      salaryGrade: 'E1',
    },
    update: { name: 'Managing Director' },
  });

  await prisma.designation.upsert({
    where: { id: ID.designationHr },
    create: {
      id: ID.designationHr,
      companyId: company.id,
      departmentId: ID.departmentHr,
      jobLevelId: ID.jobLevelManager,
      name: 'HR Manager',
      salaryGrade: 'M2',
    },
    update: { name: 'HR Manager' },
  });

  await prisma.designation.upsert({
    where: { id: ID.designationPayroll },
    create: {
      id: ID.designationPayroll,
      companyId: company.id,
      departmentId: ID.departmentHr,
      jobLevelId: ID.jobLevelStaff,
      name: 'Payroll Officer',
      salaryGrade: 'P2',
    },
    update: { name: 'Payroll Officer' },
  });

  await prisma.designation.upsert({
    where: { id: ID.designationManager },
    create: {
      id: ID.designationManager,
      companyId: company.id,
      departmentId: ID.departmentEng,
      jobLevelId: ID.jobLevelManager,
      name: 'Engineering Manager',
      salaryGrade: 'M3',
    },
    update: { name: 'Engineering Manager' },
  });

  await prisma.designation.upsert({
    where: { id: ID.designationEngineer },
    create: {
      id: ID.designationEngineer,
      companyId: company.id,
      departmentId: ID.departmentEng,
      jobLevelId: ID.jobLevelStaff,
      name: 'Software Engineer',
      salaryGrade: 'IC3',
    },
    update: { name: 'Software Engineer' },
  });

  await prisma.employmentType.upsert({
    where: { id: ID.employmentTypeFullTime },
    create: {
      id: ID.employmentTypeFullTime,
      companyId: company.id,
      name: 'Full Time',
    },
    update: { name: 'Full Time' },
  });

  await prisma.leaveType.upsert({
    where: { id: ID.leaveTypeAnnual },
    create: {
      id: ID.leaveTypeAnnual,
      companyId: company.id,
      name: 'Annual Leave',
      isPaid: true,
    },
    update: { name: 'Annual Leave', isPaid: true },
  });

  await prisma.leaveType.upsert({
    where: { id: ID.leaveTypeSick },
    create: {
      id: ID.leaveTypeSick,
      companyId: company.id,
      name: 'Personal / Carers Leave',
      isPaid: true,
    },
    update: { name: 'Personal / Carers Leave', isPaid: true },
  });

  await prisma.leavePolicy.upsert({
    where: { id: ID.leavePolicyAnnual },
    create: {
      id: ID.leavePolicyAnnual,
      companyId: company.id,
      leaveTypeId: ID.leaveTypeAnnual,
      entitlementDays: 20,
      accrualType: LeaveAccrualType.monthly,
      carryForwardMax: 5,
      expiryMonths: 6,
      encashmentAllowed: false,
      probationRestricted: true,
      allowNegativeBalance: false,
      halfDayAllowed: true,
      deductPublicHolidays: false,
      approvalSteps: [{ roleName: 'Manager' }, { roleName: 'HR Admin' }],
      yearlyAccrualAnchor: 'financial_year',
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: {
      entitlementDays: 20,
      accrualType: LeaveAccrualType.monthly,
      carryForwardMax: 5,
      expiryMonths: 6,
      probationRestricted: true,
      allowNegativeBalance: false,
      halfDayAllowed: true,
      deductPublicHolidays: false,
      approvalSteps: [{ roleName: 'Manager' }, { roleName: 'HR Admin' }],
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
    },
  });

  await prisma.leavePolicy.upsert({
    where: { id: ID.leavePolicySick },
    create: {
      id: ID.leavePolicySick,
      companyId: company.id,
      leaveTypeId: ID.leaveTypeSick,
      entitlementDays: 10,
      accrualType: LeaveAccrualType.yearly,
      yearlyAccrualAnchor: 'financial_year',
      probationRestricted: false,
      halfDayAllowed: true,
      approvalSteps: [{ roleName: 'Manager' }],
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: {
      entitlementDays: 10,
      accrualType: LeaveAccrualType.yearly,
      yearlyAccrualAnchor: 'financial_year',
      probationRestricted: false,
      halfDayAllowed: true,
      approvalSteps: [{ roleName: 'Manager' }],
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: null,
    },
  });

  // --- Default system roles (ROLES_PERMISSIONS.md §1) ---
  const systemRoles: { id: string; name: string; tenantId: string | null }[] = [
    { id: ID.roleSuperAdmin, name: 'Super Admin', tenantId: null },
    { id: ID.roleCompanyOwner, name: 'Company Owner', tenantId: tenant.id },
    { id: ID.roleHrAdmin, name: 'HR Admin', tenantId: tenant.id },
    { id: ID.rolePayrollAdmin, name: 'Payroll Admin', tenantId: tenant.id },
    { id: ID.roleManager, name: 'Manager', tenantId: tenant.id },
    { id: ID.roleEmployee, name: 'Employee', tenantId: tenant.id },
    { id: ID.roleAccountant, name: 'Accountant', tenantId: tenant.id },
    { id: ID.roleRecruiter, name: 'Recruiter', tenantId: tenant.id },
  ];

  for (const role of systemRoles) {
    await prisma.role.upsert({
      where: { id: role.id },
      create: role,
      update: { name: role.name, tenantId: role.tenantId },
    });
    await upsertRolePermissions(role.id, ROLE_PERMISSIONS[role.name] ?? []);
  }

  await prisma.permission.deleteMany({
    where: {
      module: 'platform',
      role: { tenantId: { not: null } },
    },
  });

  // --- Sample employees across roles (role stored in personalInfo until auth/users exist) ---
  type EmployeeSeed = {
    id: string;
    taxProfileId: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    roleId: string;
    roleName: string;
    departmentId: string;
    designationId: string;
    managerId?: string;
    hireDate: Date;
  };

  const employees: EmployeeSeed[] = [
    {
      id: ID.empOwner,
      taxProfileId: ID.taxProfileOwner,
      employeeNumber: 'EMP-001',
      firstName: 'Sarah',
      lastName: 'Chen',
      email: ROLE_SEED_EMAIL['Company Owner'],
      roleId: ID.roleCompanyOwner,
      roleName: 'Company Owner',
      departmentId: ID.departmentHr,
      designationId: ID.designationOwner,
      hireDate: new Date('2020-01-15'),
    },
    {
      id: ID.empHrAdmin,
      taxProfileId: ID.taxProfileHrAdmin,
      employeeNumber: 'EMP-002',
      firstName: 'James',
      lastName: 'Wilson',
      email: ROLE_SEED_EMAIL['HR Admin'],
      roleId: ID.roleHrAdmin,
      roleName: 'HR Admin',
      departmentId: ID.departmentHr,
      designationId: ID.designationHr,
      managerId: ID.empOwner,
      hireDate: new Date('2021-03-01'),
    },
    {
      id: ID.empPayrollAdmin,
      taxProfileId: ID.taxProfilePayrollAdmin,
      employeeNumber: 'EMP-003',
      firstName: 'Priya',
      lastName: 'Patel',
      email: ROLE_SEED_EMAIL['Payroll Admin'],
      roleId: ID.rolePayrollAdmin,
      roleName: 'Payroll Admin',
      departmentId: ID.departmentHr,
      designationId: ID.designationPayroll,
      managerId: ID.empOwner,
      hireDate: new Date('2021-06-15'),
    },
    {
      id: ID.empManager,
      taxProfileId: ID.taxProfileManager,
      employeeNumber: 'EMP-004',
      firstName: 'Alex',
      lastName: 'Thompson',
      email: ROLE_SEED_EMAIL.Manager,
      roleId: ID.roleManager,
      roleName: 'Manager',
      departmentId: ID.departmentEng,
      designationId: ID.designationManager,
      managerId: ID.empOwner,
      hireDate: new Date('2019-08-01'),
    },
    {
      id: ID.empStaff,
      taxProfileId: ID.taxProfileStaff,
      employeeNumber: 'EMP-005',
      firstName: 'Jordan',
      lastName: 'Lee',
      email: ROLE_SEED_EMAIL.Employee,
      roleId: ID.roleEmployee,
      roleName: 'Employee',
      departmentId: ID.departmentEng,
      designationId: ID.designationEngineer,
      managerId: ID.empManager,
      hireDate: new Date('2023-02-01'),
    },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: {
        tenantId_employeeNumber: {
          tenantId: tenant.id,
          employeeNumber: emp.employeeNumber,
        },
      },
      create: {
        id: emp.id,
        tenantId: tenant.id,
        companyId: company.id,
        employeeNumber: emp.employeeNumber,
        firstName: emp.firstName,
        lastName: emp.lastName,
        personalInfo: {
          email: emp.email,
          seedRoleId: emp.roleId,
          seedRoleName: emp.roleName,
        },
        departmentId: emp.departmentId,
        designationId: emp.designationId,
        employmentTypeId: ID.employmentTypeFullTime,
        managerId: emp.managerId,
        hireDate: emp.hireDate,
        workLocationId: ID.location,
        employmentStatus: 'active',
      },
      update: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        personalInfo: {
          email: emp.email,
          seedRoleId: emp.roleId,
          seedRoleName: emp.roleName,
        },
        departmentId: emp.departmentId,
        designationId: emp.designationId,
        managerId: emp.managerId,
        workLocationId: ID.location,
        employmentStatus: 'active',
        deletedAt: null,
      },
    });

    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_asOfYear: {
          employeeId: emp.id,
          leaveTypeId: ID.leaveTypeAnnual,
          asOfYear: SEED_YEAR,
        },
      },
      create: {
        employeeId: emp.id,
        leaveTypeId: ID.leaveTypeAnnual,
        balanceDays: 15,
        asOfYear: SEED_YEAR,
      },
      update: { balanceDays: 15 },
    });

    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_asOfYear: {
          employeeId: emp.id,
          leaveTypeId: ID.leaveTypeSick,
          asOfYear: SEED_YEAR,
        },
      },
      create: {
        employeeId: emp.id,
        leaveTypeId: ID.leaveTypeSick,
        balanceDays: 8,
        asOfYear: SEED_YEAR,
      },
      update: { balanceDays: 8 },
    });

    await prisma.employeeTaxProfile.upsert({
      where: { id: emp.taxProfileId },
      create: {
        id: emp.taxProfileId,
        employeeId: emp.id,
        taxIdNumber: `TFN-${emp.employeeNumber.replace('EMP-', '')}`,
        bankAccountNumber: `1000${emp.employeeNumber.replace('EMP-', '').padStart(6, '0')}`,
        taxSettings: { taxFreeThreshold: true, helpDebt: false },
      },
      update: {
        employeeId: emp.id,
        taxIdNumber: `TFN-${emp.employeeNumber.replace('EMP-', '')}`,
        bankAccountNumber: `1000${emp.employeeNumber.replace('EMP-', '').padStart(6, '0')}`,
        taxSettings: { taxFreeThreshold: true, helpDebt: false },
      },
    });
  }

  const shiftStart = new Date('1970-01-01T09:00:00.000Z');
  const shiftEnd = new Date('1970-01-01T17:00:00.000Z');

  await prisma.shift.upsert({
    where: { id: ID.shiftStandard },
    create: {
      id: ID.shiftStandard,
      companyId: company.id,
      name: 'Standard 9–5',
      shiftType: 'fixed',
      startTime: shiftStart,
      endTime: shiftEnd,
      breakMinutes: 60,
      graceMinutes: 15,
      minimumMinutes: 420,
      lateRule: { graceMinutes: 15, halfDayAfterMinutes: 120 },
      earlyLeaveRule: { graceMinutes: 15 },
      weekendRule: { appliesOnWeekend: false },
    },
    update: {
      name: 'Standard 9–5',
      shiftType: 'fixed',
      startTime: shiftStart,
      endTime: shiftEnd,
      breakMinutes: 60,
      graceMinutes: 15,
      minimumMinutes: 420,
      lateRule: { graceMinutes: 15, halfDayAfterMinutes: 120 },
      earlyLeaveRule: { graceMinutes: 15 },
      weekendRule: { appliesOnWeekend: false },
    },
  });

  const rosterAnchor = new Date();
  for (const emp of employees) {
    for (let offset = -7; offset <= 14; offset += 1) {
      const date = new Date(
        Date.UTC(
          rosterAnchor.getUTCFullYear(),
          rosterAnchor.getUTCMonth(),
          rosterAnchor.getUTCDate() + offset,
        ),
      );
      await prisma.roster.upsert({
        where: {
          employeeId_date: { employeeId: emp.id, date },
        },
        create: {
          employeeId: emp.id,
          shiftId: ID.shiftStandard,
          date,
          locationId: ID.location,
        },
        update: {
          shiftId: ID.shiftStandard,
          locationId: ID.location,
        },
      });
    }
  }

  await prisma.payComponent.upsert({
    where: { id: ID.payComponentBasic },
    create: {
      id: ID.payComponentBasic,
      companyId: company.id,
      name: 'Basic Salary',
      type: 'earning',
      calculationType: 'fixed',
    },
    update: { name: 'Basic Salary', type: 'earning', calculationType: 'fixed' },
  });

  await prisma.payComponent.upsert({
    where: { id: ID.payComponentHra },
    create: {
      id: ID.payComponentHra,
      companyId: company.id,
      name: 'House Rent Allowance',
      type: 'earning',
      calculationType: 'percentage',
      formula: { base: 'basic', percentage: 10 },
    },
    update: {
      name: 'House Rent Allowance',
      type: 'earning',
      calculationType: 'percentage',
      formula: { base: 'basic', percentage: 10 },
    },
  });

  await prisma.payComponent.upsert({
    where: { id: ID.payComponentTax },
    create: {
      id: ID.payComponentTax,
      companyId: company.id,
      name: 'Income Tax',
      type: 'deduction',
      calculationType: 'percentage',
      formula: { base: 'gross', percentage: 15 },
    },
    update: {
      name: 'Income Tax',
      type: 'deduction',
      calculationType: 'percentage',
      formula: { base: 'gross', percentage: 15 },
    },
  });

  await prisma.payComponent.upsert({
    where: { id: ID.payComponentLoan },
    create: {
      id: ID.payComponentLoan,
      companyId: company.id,
      name: 'Loan & Advance Recovery',
      type: 'deduction',
      calculationType: 'formula',
      formula: PAY_FORMULA_LOAN_INSTALLMENT,
    },
    update: {
      name: 'Loan & Advance Recovery',
      type: 'deduction',
      calculationType: 'formula',
      formula: PAY_FORMULA_LOAN_INSTALLMENT,
    },
  });

  await prisma.salaryStructure.upsert({
    where: { id: ID.salaryStructureBasic },
    create: {
      id: ID.salaryStructureBasic,
      employeeId: ID.empStaff,
      componentType: 'earning',
      componentId: ID.payComponentBasic,
      amountOrFormula: { amount: '6000.00' },
      effectiveFrom: new Date('2023-02-01T00:00:00.000Z'),
    },
    update: {
      amountOrFormula: { amount: '6000.00' },
      effectiveFrom: new Date('2023-02-01T00:00:00.000Z'),
    },
  });

  await prisma.salaryStructure.upsert({
    where: { id: ID.salaryStructureHra },
    create: {
      id: ID.salaryStructureHra,
      employeeId: ID.empStaff,
      componentType: 'earning',
      componentId: ID.payComponentHra,
      amountOrFormula: { percentage: 10 },
      effectiveFrom: new Date('2023-02-01T00:00:00.000Z'),
    },
    update: {
      amountOrFormula: { percentage: 10 },
      effectiveFrom: new Date('2023-02-01T00:00:00.000Z'),
    },
  });

  await prisma.salaryStructure.upsert({
    where: { id: ID.salaryStructureTax },
    create: {
      id: ID.salaryStructureTax,
      employeeId: ID.empStaff,
      componentType: 'deduction',
      componentId: ID.payComponentTax,
      amountOrFormula: { percentage: 15 },
      effectiveFrom: new Date('2023-02-01T00:00:00.000Z'),
    },
    update: {
      amountOrFormula: { percentage: 15 },
      effectiveFrom: new Date('2023-02-01T00:00:00.000Z'),
    },
  });

  const staffLoanFirstDue = new Date('2026-04-01T00:00:00.000Z');
  await prisma.salaryStructure.upsert({
    where: { id: ID.salaryStructureLoan },
    create: {
      id: ID.salaryStructureLoan,
      employeeId: ID.empStaff,
      componentType: 'deduction',
      componentId: ID.payComponentLoan,
      amountOrFormula: {},
      effectiveFrom: staffLoanFirstDue,
    },
    update: {
      componentId: ID.payComponentLoan,
      effectiveFrom: staffLoanFirstDue,
    },
  });

  await prisma.employeeLoan.upsert({
    where: { id: ID.employeeLoanStaff },
    create: {
      id: ID.employeeLoanStaff,
      tenantId: tenant.id,
      companyId: company.id,
      employeeId: ID.empStaff,
      referenceNumber: 'LN-2026-001',
      loanKind: 'salary_advance',
      purposeLabel: 'Emergency Advance',
      principalAmount: 6000,
      interestRatePercent: 0,
      tenorMonths: 6,
      monthlyInstallment: 1000,
      totalRepayable: 6000,
      remainingBalance: 6000,
      deductFromPayroll: true,
      status: 'active',
      firstDueDate: staffLoanFirstDue,
      disbursedAt: new Date('2026-03-01T00:00:00.000Z'),
      approvedAt: new Date('2026-03-01T00:00:00.000Z'),
      payComponentId: ID.payComponentLoan,
      salaryStructureId: ID.salaryStructureLoan,
    },
    update: {
      status: 'active',
      remainingBalance: 6000,
      payComponentId: ID.payComponentLoan,
      salaryStructureId: ID.salaryStructureLoan,
    },
  });

  for (let i = 1; i <= 6; i += 1) {
    const dueDate = new Date(staffLoanFirstDue);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + (i - 1));
    await prisma.loanInstallment.upsert({
      where: {
        loanId_installmentNumber: {
          loanId: ID.employeeLoanStaff,
          installmentNumber: i,
        },
      },
      create: {
        loanId: ID.employeeLoanStaff,
        tenantId: tenant.id,
        installmentNumber: i,
        dueDate,
        principalPortion: 1000,
        interestPortion: 0,
        totalDue: 1000,
        status: 'scheduled',
      },
      update: {
        dueDate,
        totalDue: 1000,
        status: 'scheduled',
      },
    });
  }

  await prisma.employeeLoan.upsert({
    where: { id: ID.employeeLoanPending },
    create: {
      id: ID.employeeLoanPending,
      tenantId: tenant.id,
      companyId: company.id,
      employeeId: ID.empManager,
      referenceNumber: 'LN-2026-002',
      loanKind: 'loan',
      purposeLabel: 'Device Purchase',
      principalAmount: 3000,
      interestRatePercent: 0,
      tenorMonths: 6,
      monthlyInstallment: 500,
      totalRepayable: 3000,
      remainingBalance: 3000,
      deductFromPayroll: true,
      status: 'pending_approval',
    },
    update: {
      status: 'pending_approval',
      purposeLabel: 'Device Purchase',
    },
  });

  await prisma.expenseCategory.upsert({
    where: { id: ID.expenseCategoryTravel },
    create: {
      id: ID.expenseCategoryTravel,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Travel & Accommodation',
      description: 'Flights, hotels, and ground transport',
      maxAmountPerClaim: 5000,
      maxAmountPerMonth: 8000,
      receiptRequired: true,
    },
    update: { name: 'Travel & Accommodation', isActive: true },
  });

  await prisma.expenseCategory.upsert({
    where: { id: ID.expenseCategoryMeals },
    create: {
      id: ID.expenseCategoryMeals,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Meals & Entertainment',
      description: 'Client meals and team events',
      maxAmountPerClaim: 500,
      maxAmountPerMonth: 1500,
      receiptRequired: true,
    },
    update: { name: 'Meals & Entertainment', isActive: true },
  });

  await prisma.expenseCategory.upsert({
    where: { id: ID.expenseCategorySoftware },
    create: {
      id: ID.expenseCategorySoftware,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Software & Subscriptions',
      description: 'SaaS tools and licenses',
      maxAmountPerClaim: 2000,
      maxAmountPerMonth: 4000,
      receiptRequired: true,
    },
    update: { name: 'Software & Subscriptions', isActive: true },
  });

  await prisma.workflowDefinition.upsert({
    where: { id: ID.workflowExpenseStandard },
    create: {
      id: ID.workflowExpenseStandard,
      companyId: company.id,
      entityType: 'expense_claim',
      name: 'Standard Expense Approval',
      description: 'Manager then Finance for routine claims',
      triggerConfig: { type: 'always' },
      steps: [
        { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
        { order: 2, assigneeType: 'role', roleName: 'Accountant' },
      ],
      isDefault: true,
      isActive: true,
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: { isActive: true, isDefault: true },
  });

  await prisma.workflowDefinition.upsert({
    where: { id: ID.workflowExpenseHighValue },
    create: {
      id: ID.workflowExpenseHighValue,
      companyId: company.id,
      entityType: 'expense_claim',
      name: 'High-Value Expense Approval',
      description: 'Extra owner sign-off above $1,000',
      triggerConfig: {
        type: 'amount_threshold',
        operator: 'gt',
        value: 1000,
        currency: 'AUD',
      },
      steps: [
        { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
        { order: 2, assigneeType: 'role', roleName: 'Accountant' },
        { order: 3, assigneeType: 'role', roleName: 'Company Owner' },
      ],
      isDefault: false,
      isActive: true,
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: { isActive: true },
  });

  await prisma.expenseClaim.upsert({
    where: { id: ID.expenseClaimPending },
    create: {
      id: ID.expenseClaimPending,
      tenantId: tenant.id,
      companyId: company.id,
      employeeId: ID.empStaff,
      categoryId: ID.expenseCategoryMeals,
      referenceNumber: 'EXP-2026-001',
      expenseDate: new Date('2026-03-20T00:00:00.000Z'),
      amount: 485.5,
      currency: 'AUD',
      description: 'Client dinner with procurement team',
      status: 'pending_approval',
      submittedAt: new Date('2026-03-21T00:00:00.000Z'),
    },
    update: {
      status: 'pending_approval',
      description: 'Client dinner with procurement team',
    },
  });

  await prisma.workflowInstance.upsert({
    where: {
      entityType_entityId: {
        entityType: 'expense_claim',
        entityId: ID.expenseClaimPending,
      },
    },
    create: {
      id: ID.expenseClaimWorkflowPending,
      definitionId: ID.workflowExpenseStandard,
      companyId: company.id,
      tenantId: tenant.id,
      entityType: 'expense_claim',
      entityId: ID.expenseClaimPending,
      requesterEmployeeId: ID.empStaff,
      requesterUserId: ID.userStaff,
      status: 'pending',
      currentStepOrder: 1,
      steps: [
        {
          order: 1,
          assigneeType: 'direct_manager',
          roleName: 'Manager',
          status: 'pending',
          actedByUserId: null,
          actedByEmployeeId: null,
          actedAt: null,
          comment: null,
        },
        {
          order: 2,
          assigneeType: 'role',
          roleName: 'Accountant',
          status: 'pending',
          actedByUserId: null,
          actedByEmployeeId: null,
          actedAt: null,
          comment: null,
        },
      ],
    },
    update: { status: 'pending', currentStepOrder: 1 },
  });

  await prisma.expenseClaim.upsert({
    where: { id: ID.expenseClaimApproved },
    create: {
      id: ID.expenseClaimApproved,
      tenantId: tenant.id,
      companyId: company.id,
      employeeId: ID.empManager,
      categoryId: ID.expenseCategorySoftware,
      referenceNumber: 'EXP-2026-002',
      expenseDate: new Date('2026-03-15T00:00:00.000Z'),
      amount: 240,
      currency: 'AUD',
      description: 'JetBrains IDE license renewal',
      status: 'approved',
      submittedAt: new Date('2026-03-16T00:00:00.000Z'),
      approvedAt: new Date('2026-03-18T00:00:00.000Z'),
    },
    update: { status: 'approved' },
  });

  await prisma.timesheetProject.upsert({
    where: { id: ID.timesheetProjectPlatform },
    create: {
      id: ID.timesheetProjectPlatform,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Platform Redesign',
      code: 'PLT',
    },
    update: { name: 'Platform Redesign', isActive: true },
  });

  await prisma.timesheetProject.upsert({
    where: { id: ID.timesheetProjectInternal },
    create: {
      id: ID.timesheetProjectInternal,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Internal Tools',
      code: 'INT',
    },
    update: { name: 'Internal Tools', isActive: true },
  });

  await prisma.workflowDefinition.upsert({
    where: { id: ID.workflowTimesheetStandard },
    create: {
      id: ID.workflowTimesheetStandard,
      companyId: company.id,
      entityType: 'timesheet_entry',
      name: 'Timesheet Manager Approval',
      description: 'Direct manager sign-off on submitted time entries',
      triggerConfig: { type: 'always' },
      steps: [
        { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
      ],
      isDefault: true,
      isActive: true,
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: { isActive: true, isDefault: true },
  });

  await prisma.timesheetEntry.upsert({
    where: { id: ID.timesheetEntryPending },
    create: {
      id: ID.timesheetEntryPending,
      tenantId: tenant.id,
      companyId: company.id,
      employeeId: ID.empStaff,
      projectId: ID.timesheetProjectPlatform,
      entryDate: new Date('2026-03-24T00:00:00.000Z'),
      taskName: 'Bug fixes',
      startTime: new Date('2026-03-24T01:00:00.000Z'),
      endTime: new Date('2026-03-24T07:00:00.000Z'),
      breakMinutes: 30,
      totalHours: 5.5,
      isBillable: true,
      billableHours: 5.5,
      nonBillableHours: 0,
      status: 'pending_approval',
      submittedAt: new Date('2026-03-24T08:00:00.000Z'),
      source: 'manual',
    },
    update: { status: 'pending_approval' },
  });

  await prisma.workflowInstance.upsert({
    where: {
      entityType_entityId: {
        entityType: 'timesheet_entry',
        entityId: ID.timesheetEntryPending,
      },
    },
    create: {
      id: ID.timesheetEntryWorkflowPending,
      definitionId: ID.workflowTimesheetStandard,
      companyId: company.id,
      tenantId: tenant.id,
      entityType: 'timesheet_entry',
      entityId: ID.timesheetEntryPending,
      requesterEmployeeId: ID.empStaff,
      requesterUserId: ID.userStaff,
      status: 'pending',
      currentStepOrder: 1,
      steps: [
        {
          order: 1,
          assigneeType: 'direct_manager',
          roleName: 'Manager',
          status: 'pending',
          actedByUserId: null,
          actedByEmployeeId: null,
          actedAt: null,
          comment: null,
        },
      ],
    },
    update: { status: 'pending', currentStepOrder: 1 },
  });

  await prisma.timesheetEntry.upsert({
    where: { id: ID.timesheetEntryApproved },
    create: {
      id: ID.timesheetEntryApproved,
      tenantId: tenant.id,
      companyId: company.id,
      employeeId: ID.empStaff,
      projectId: ID.timesheetProjectInternal,
      entryDate: new Date('2026-03-23T00:00:00.000Z'),
      taskName: 'Code review',
      startTime: new Date('2026-03-23T02:00:00.000Z'),
      endTime: new Date('2026-03-23T04:00:00.000Z'),
      breakMinutes: 0,
      totalHours: 2,
      isBillable: false,
      billableHours: 0,
      nonBillableHours: 2,
      status: 'approved',
      submittedAt: new Date('2026-03-23T05:00:00.000Z'),
      approvedAt: new Date('2026-03-23T06:00:00.000Z'),
      source: 'manual',
    },
    update: { status: 'approved' },
  });

  await prisma.workflowDefinition.upsert({
    where: { id: ID.workflowJobRequisitionStandard },
    create: {
      id: ID.workflowJobRequisitionStandard,
      companyId: company.id,
      entityType: 'job_requisition',
      name: 'Job Requisition Approval',
      description: 'HR Admin sign-off before a requisition can be opened',
      triggerConfig: { type: 'always' },
      steps: [{ order: 1, assigneeType: 'role', roleName: 'HR Admin' }],
      isDefault: true,
      isActive: true,
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: { isActive: true, isDefault: true },
  });

  await prisma.jobRequisition.upsert({
    where: { id: ID.jobRequisitionEngineer },
    create: {
      id: ID.jobRequisitionEngineer,
      tenantId: tenant.id,
      companyId: company.id,
      referenceNumber: 'REQ-2026-001',
      title: 'Senior Frontend Engineer',
      departmentId: ID.departmentEng,
      designationId: ID.designationEngineer,
      jobLevelId: ID.jobLevelStaff,
      employmentTypeId: ID.employmentTypeFullTime,
      locationId: ID.location,
      description:
        'Build and maintain customer-facing web applications using React and TypeScript. Collaborate with design and backend teams on the platform redesign.',
      headcount: 2,
      status: 'open',
      requestedByEmployeeId: ID.empManager,
      openedAt: new Date('2026-02-01T00:00:00.000Z'),
    },
    update: { status: 'open', title: 'Senior Frontend Engineer' },
  });

  await prisma.jobRequisition.upsert({
    where: { id: ID.jobRequisitionDesigner },
    create: {
      id: ID.jobRequisitionDesigner,
      tenantId: tenant.id,
      companyId: company.id,
      referenceNumber: 'REQ-2026-002',
      title: 'Product Designer',
      departmentId: ID.departmentEng,
      description:
        'Own end-to-end product design for internal HR tools and employee experiences.',
      headcount: 1,
      status: 'draft',
      requestedByEmployeeId: ID.empHrAdmin,
    },
    update: { title: 'Product Designer' },
  });

  await prisma.jobPosting.upsert({
    where: { id: ID.jobPostingEngineer },
    create: {
      id: ID.jobPostingEngineer,
      tenantId: tenant.id,
      companyId: company.id,
      requisitionId: ID.jobRequisitionEngineer,
      title: 'Senior Frontend Engineer',
      summary: 'Join our engineering team to ship modern HR experiences.',
      description:
        'We are hiring a Senior Frontend Engineer to lead UI delivery on our platform redesign. You will work with React, TypeScript, and our design system.',
      status: 'published',
      publishedAt: new Date('2026-02-05T00:00:00.000Z'),
    },
    update: { status: 'published' },
  });

  const candidateSeeds = [
    {
      id: ID.candidateJennifer,
      firstName: 'Jennifer',
      lastName: 'Wu',
      email: 'jwu@example.com',
      yearsExperience: 6,
    },
    {
      id: ID.candidateCarlos,
      firstName: 'Carlos',
      lastName: 'Mendez',
      email: 'cmendez@example.com',
      yearsExperience: 4,
      source: 'linkedin' as const,
    },
    {
      id: ID.candidateAisha,
      firstName: 'Aisha',
      lastName: 'Khan',
      email: 'akhan@example.com',
      yearsExperience: 5,
      source: 'referral' as const,
    },
    {
      id: ID.candidateMei,
      firstName: 'Mei',
      lastName: 'Lin',
      email: 'meilin@example.com',
      yearsExperience: 8,
    },
    {
      id: ID.candidateHannah,
      firstName: 'Hannah',
      lastName: 'Schmidt',
      email: 'hschmidt@example.com',
      yearsExperience: 9,
    },
    {
      id: ID.candidateOliver,
      firstName: 'Oliver',
      lastName: 'Brown',
      email: 'obrown@example.com',
      yearsExperience: 2,
    },
  ];

  for (const candidate of candidateSeeds) {
    await prisma.candidate.upsert({
      where: { id: candidate.id },
      create: {
        id: candidate.id,
        tenantId: tenant.id,
        companyId: company.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        source: candidate.source ?? 'website',
        yearsExperience: candidate.yearsExperience,
      },
      update: {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
      },
    });
  }

  const applicationSeeds = [
    {
      id: ID.applicationJennifer,
      candidateId: ID.candidateJennifer,
      stage: 'applied' as const,
      rating: null,
    },
    {
      id: ID.applicationCarlos,
      candidateId: ID.candidateCarlos,
      stage: 'applied' as const,
      rating: null,
    },
    {
      id: ID.applicationAisha,
      candidateId: ID.candidateAisha,
      stage: 'screening' as const,
      rating: 4,
    },
    {
      id: ID.applicationMei,
      candidateId: ID.candidateMei,
      stage: 'interview' as const,
      rating: 5,
    },
    {
      id: ID.applicationHannah,
      candidateId: ID.candidateHannah,
      stage: 'offer' as const,
      rating: 5,
    },
    {
      id: ID.applicationOliver,
      candidateId: ID.candidateOliver,
      stage: 'hired' as const,
      rating: 4,
    },
  ];

  for (const application of applicationSeeds) {
    await prisma.jobApplication.upsert({
      where: { id: application.id },
      create: {
        id: application.id,
        tenantId: tenant.id,
        companyId: company.id,
        candidateId: application.candidateId,
        requisitionId: ID.jobRequisitionEngineer,
        postingId: ID.jobPostingEngineer,
        stage: application.stage,
        rating: application.rating,
        appliedAt: new Date('2026-02-10T00:00:00.000Z'),
        stageUpdatedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      update: { stage: application.stage, rating: application.rating },
    });
  }

  const meiInterviewRounds = [
    {
      id: ID.interviewRoundMeiTechnical,
      roundType: 'technical' as const,
      roundOrder: 1,
      status: 'completed' as const,
      score: 4.5,
      recommendation: 'yes' as const,
      feedback: 'Strong React and TypeScript fundamentals.',
      scheduledStartAt: new Date('2026-02-20T02:00:00.000Z'),
      scheduledEndAt: new Date('2026-02-20T03:00:00.000Z'),
      interviewerEmployeeId: ID.empManager,
      completedAt: new Date('2026-02-20T03:30:00.000Z'),
      completedByUserId: ID.userManager,
    },
    {
      id: ID.interviewRoundMeiHr,
      roundType: 'hr' as const,
      roundOrder: 2,
      status: 'scheduled' as const,
      scheduledStartAt: new Date('2026-02-25T01:00:00.000Z'),
      scheduledEndAt: new Date('2026-02-25T02:00:00.000Z'),
      location: 'Sydney HQ — Room 3',
      interviewerEmployeeId: ID.empHrAdmin,
    },
    {
      id: ID.interviewRoundMeiManagement,
      roundType: 'management' as const,
      roundOrder: 3,
      status: 'pending' as const,
    },
    {
      id: ID.interviewRoundMeiFinal,
      roundType: 'final_decision' as const,
      roundOrder: 4,
      status: 'pending' as const,
    },
  ];

  for (const round of meiInterviewRounds) {
    await prisma.jobApplicationInterviewRound.upsert({
      where: { id: round.id },
      create: {
        id: round.id,
        tenantId: tenant.id,
        companyId: company.id,
        applicationId: ID.applicationMei,
        roundType: round.roundType,
        roundOrder: round.roundOrder,
        status: round.status,
        score: round.score ?? null,
        recommendation: round.recommendation ?? null,
        feedback: round.feedback ?? null,
        scheduledStartAt: round.scheduledStartAt ?? null,
        scheduledEndAt: round.scheduledEndAt ?? null,
        location: round.location ?? null,
        interviewerEmployeeId: round.interviewerEmployeeId ?? null,
        completedAt: round.completedAt ?? null,
        completedByUserId: round.completedByUserId ?? null,
      },
      update: {
        status: round.status,
        score: round.score ?? null,
        recommendation: round.recommendation ?? null,
      },
    });
  }

  const hannahInterviewRounds = [
    {
      id: ID.interviewRoundHannahTechnical,
      roundType: 'technical' as const,
      roundOrder: 1,
      score: 5,
      recommendation: 'strong_yes' as const,
    },
    {
      id: ID.interviewRoundHannahHr,
      roundType: 'hr' as const,
      roundOrder: 2,
      score: 4.5,
      recommendation: 'yes' as const,
    },
    {
      id: ID.interviewRoundHannahManagement,
      roundType: 'management' as const,
      roundOrder: 3,
      score: 5,
      recommendation: 'strong_yes' as const,
    },
    {
      id: ID.interviewRoundHannahFinal,
      roundType: 'final_decision' as const,
      roundOrder: 4,
      score: 5,
      recommendation: 'strong_yes' as const,
      feedback: 'Unanimous hire — extend offer.',
    },
  ];

  for (const round of hannahInterviewRounds) {
    await prisma.jobApplicationInterviewRound.upsert({
      where: { id: round.id },
      create: {
        id: round.id,
        tenantId: tenant.id,
        companyId: company.id,
        applicationId: ID.applicationHannah,
        roundType: round.roundType,
        roundOrder: round.roundOrder,
        status: 'completed',
        score: round.score,
        recommendation: round.recommendation,
        feedback: round.feedback ?? null,
        completedAt: new Date('2026-02-28T00:00:00.000Z'),
        completedByUserId: ID.userHrAdmin,
      },
      update: { status: 'completed', score: round.score },
    });
  }

  await prisma.workflowDefinition.upsert({
    where: { id: ID.workflowOfferLetterStandard },
    create: {
      id: ID.workflowOfferLetterStandard,
      companyId: company.id,
      entityType: 'offer_letter',
      name: 'Offer Letter Approval',
      description: 'HR Admin then Company Owner sign-off before sending offers',
      triggerConfig: { type: 'always' },
      steps: [
        { order: 1, assigneeType: 'role', roleName: 'HR Admin' },
        { order: 2, assigneeType: 'role', roleName: 'Company Owner' },
      ],
      isDefault: true,
      isActive: true,
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: { isActive: true, isDefault: true },
  });

  await prisma.offerLetter.upsert({
    where: { id: ID.offerLetterHannah },
    create: {
      id: ID.offerLetterHannah,
      tenantId: tenant.id,
      companyId: company.id,
      applicationId: ID.applicationHannah,
      status: 'accepted',
      template: 'senior',
      jobTitle: 'Senior Frontend Engineer',
      departmentId: ID.departmentEng,
      designationId: ID.designationEngineer,
      employmentTypeId: ID.employmentTypeFullTime,
      workLocationId: ID.location,
      annualSalary: 145000,
      currency: 'AUD',
      startDate: new Date('2026-04-15T00:00:00.000Z'),
      reportingTo: 'Alex Thompson, Engineering Manager',
      signingBonus: 10000,
      equityNotes: '5,000 stock options (4-year vesting)',
      probationMonths: 3,
      expiryDate: new Date('2026-03-15T00:00:00.000Z'),
      sentAt: new Date('2026-03-01T00:00:00.000Z'),
      acceptedAt: new Date('2026-03-05T00:00:00.000Z'),
    },
    update: { status: 'accepted' },
  });

  await prisma.holiday.upsert({
    where: { id: ID.companyHoliday },
    create: {
      id: ID.companyHoliday,
      tenantId: tenant.id,
      companyId: company.id,
      scope: 'company',
      name: 'Demo Corp Foundation Day',
      date: new Date('2025-11-15T00:00:00.000Z'),
      recurring: true,
    },
    update: {
      name: 'Demo Corp Foundation Day',
      recurring: true,
    },
  });

  await prisma.holiday.upsert({
    where: { id: ID.branchHoliday },
    create: {
      id: ID.branchHoliday,
      tenantId: tenant.id,
      companyId: company.id,
      scope: 'branch',
      locationId: ID.location,
      name: 'Sydney HQ Open Day',
      date: new Date('2025-08-01T00:00:00.000Z'),
      recurring: false,
    },
    update: {
      name: 'Sydney HQ Open Day',
      locationId: ID.location,
    },
  });

  const documentTypeSeeds = [
    {
      id: ID.documentTypeNationalId,
      name: 'National ID',
      description: 'Government-issued photo identification',
      requiresVerification: true,
      tracksExpiry: true,
    },
    {
      id: ID.documentTypeBankDetails,
      name: 'Bank Account Details',
      description: 'Bank account information for payroll direct deposit',
      requiresVerification: true,
      tracksExpiry: false,
    },
    {
      id: ID.documentTypeHandbook,
      name: 'Employee Handbook Acknowledgment',
      description: 'Signed acknowledgment of the employee handbook',
      requiresVerification: true,
      tracksExpiry: false,
    },
    {
      id: ID.documentTypeCodeOfConduct,
      name: 'Code of Conduct Agreement',
      description: 'Signed code of conduct and confidentiality agreement',
      requiresVerification: false,
      tracksExpiry: false,
    },
  ];

  for (const docType of documentTypeSeeds) {
    await prisma.documentType.upsert({
      where: { id: docType.id },
      create: {
        id: docType.id,
        companyId: company.id,
        name: docType.name,
        description: docType.description,
        requiresVerification: docType.requiresVerification,
        tracksExpiry: docType.tracksExpiry,
        isActive: true,
      },
      update: {
        name: docType.name,
        description: docType.description,
        requiresVerification: docType.requiresVerification,
        tracksExpiry: docType.tracksExpiry,
        isActive: true,
      },
    });
  }

  await prisma.onboardingChecklistTemplate.upsert({
    where: { id: ID.onboardingTemplateDefault },
    create: {
      id: ID.onboardingTemplateDefault,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Standard New Hire',
      description: 'Default onboarding checklist for all new employees',
      isDefault: true,
      isActive: true,
    },
    update: {
      name: 'Standard New Hire',
      description: 'Default onboarding checklist for all new employees',
      isDefault: true,
      isActive: true,
    },
  });

  const templateItemSeeds = [
    {
      id: ID.onboardingTemplateItemId,
      title: 'Collect National ID',
      description: 'Receive verified government photo ID',
      category: 'document_collection' as const,
      taskType: 'document_collection' as const,
      documentTypeId: ID.documentTypeNationalId,
      assigneeLabel: 'HR Admin',
      dueDaysOffset: 3,
      sortOrder: 1,
    },
    {
      id: ID.onboardingTemplateItemBank,
      title: 'Bank Account Details',
      description: 'Collect bank info for payroll setup',
      category: 'document_collection' as const,
      taskType: 'document_collection' as const,
      documentTypeId: ID.documentTypeBankDetails,
      assigneeLabel: 'HR Admin',
      dueDaysOffset: 5,
      sortOrder: 2,
    },
    {
      id: ID.onboardingTemplateItemHandbook,
      title: 'Employee Handbook Acknowledgment',
      description: 'Read and sign employee handbook',
      category: 'policy_acceptance' as const,
      taskType: 'policy_acceptance' as const,
      documentTypeId: ID.documentTypeHandbook,
      assigneeLabel: 'New Hire',
      dueDaysOffset: 5,
      sortOrder: 3,
    },
    {
      id: ID.onboardingTemplateItemConduct,
      title: 'Code of Conduct Agreement',
      description: 'Sign code of conduct and NDA',
      category: 'policy_acceptance' as const,
      taskType: 'policy_acceptance' as const,
      documentTypeId: ID.documentTypeCodeOfConduct,
      assigneeLabel: 'New Hire',
      dueDaysOffset: 5,
      sortOrder: 4,
    },
    {
      id: ID.onboardingTemplateItemLaptop,
      title: 'IT Equipment Setup',
      description: 'Provision laptop, monitor, and accessories',
      category: 'equipment_provisioning' as const,
      taskType: 'provisioning' as const,
      assetCategory: 'laptop' as const,
      assigneeLabel: 'IT Team',
      dueDaysOffset: 7,
      sortOrder: 5,
    },
    {
      id: ID.onboardingTemplateItemEmail,
      title: 'Email & System Access',
      description: 'Create email account and core system access',
      category: 'system_access' as const,
      taskType: 'provisioning' as const,
      assigneeLabel: 'IT Team',
      dueDaysOffset: 1,
      sortOrder: 6,
    },
  ];

  for (const item of templateItemSeeds) {
    await prisma.onboardingChecklistTemplateItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        templateId: ID.onboardingTemplateDefault,
        title: item.title,
        description: item.description,
        category: item.category,
        taskType: item.taskType,
        documentTypeId: item.documentTypeId ?? null,
        assetCategory: item.assetCategory ?? null,
        assigneeLabel: item.assigneeLabel,
        dueDaysOffset: item.dueDaysOffset,
        sortOrder: item.sortOrder,
        isRequired: true,
      },
      update: {
        title: item.title,
        description: item.description,
        category: item.category,
        taskType: item.taskType,
        documentTypeId: item.documentTypeId ?? null,
        assetCategory: item.assetCategory ?? null,
        assigneeLabel: item.assigneeLabel,
        dueDaysOffset: item.dueDaysOffset,
        sortOrder: item.sortOrder,
      },
    });
  }

  await prisma.employeeDocument.upsert({
    where: { id: ID.employeeDocumentStaffId },
    create: {
      id: ID.employeeDocumentStaffId,
      employeeId: ID.empStaff,
      documentTypeId: ID.documentTypeNationalId,
      fields: {},
      verifiedAt: new Date('2023-02-05T00:00:00.000Z'),
    },
    update: {
      verifiedAt: new Date('2023-02-05T00:00:00.000Z'),
    },
  });

  await prisma.employeeOnboarding.upsert({
    where: { id: ID.employeeOnboardingStaff },
    create: {
      id: ID.employeeOnboardingStaff,
      tenantId: tenant.id,
      companyId: company.id,
      employeeId: ID.empStaff,
      templateId: ID.onboardingTemplateDefault,
      status: 'in_progress',
      startedAt: new Date('2023-02-01T00:00:00.000Z'),
      welcomeSentAt: new Date('2023-02-01T09:00:00.000Z'),
    },
    update: {
      status: 'in_progress',
      templateId: ID.onboardingTemplateDefault,
    },
  });

  const onboardingTaskSeeds = [
    {
      id: '10000000-0000-4000-8000-000000000180',
      templateItemId: ID.onboardingTemplateItemId,
      title: 'Collect National ID',
      category: 'document_collection' as const,
      taskType: 'document_collection' as const,
      documentTypeId: ID.documentTypeNationalId,
      employeeDocumentId: ID.employeeDocumentStaffId,
      assigneeLabel: 'HR Admin',
      dueDate: new Date('2023-02-04T00:00:00.000Z'),
      status: 'completed' as const,
      completedAt: new Date('2023-02-05T00:00:00.000Z'),
      sortOrder: 1,
    },
    {
      id: '10000000-0000-4000-8000-000000000181',
      templateItemId: ID.onboardingTemplateItemBank,
      title: 'Bank Account Details',
      category: 'document_collection' as const,
      taskType: 'document_collection' as const,
      documentTypeId: ID.documentTypeBankDetails,
      assigneeLabel: 'HR Admin',
      dueDate: new Date('2023-02-06T00:00:00.000Z'),
      status: 'pending' as const,
      sortOrder: 2,
    },
    {
      id: '10000000-0000-4000-8000-000000000182',
      templateItemId: ID.onboardingTemplateItemHandbook,
      title: 'Employee Handbook Acknowledgment',
      category: 'policy_acceptance' as const,
      taskType: 'policy_acceptance' as const,
      documentTypeId: ID.documentTypeHandbook,
      assigneeLabel: 'New Hire',
      dueDate: new Date('2023-02-06T00:00:00.000Z'),
      status: 'pending' as const,
      sortOrder: 3,
    },
    {
      id: '10000000-0000-4000-8000-000000000183',
      templateItemId: ID.onboardingTemplateItemConduct,
      title: 'Code of Conduct Agreement',
      category: 'policy_acceptance' as const,
      taskType: 'policy_acceptance' as const,
      documentTypeId: ID.documentTypeCodeOfConduct,
      assigneeLabel: 'New Hire',
      dueDate: new Date('2023-02-06T00:00:00.000Z'),
      status: 'pending' as const,
      sortOrder: 4,
    },
    {
      id: '10000000-0000-4000-8000-000000000184',
      templateItemId: ID.onboardingTemplateItemLaptop,
      title: 'IT Equipment Setup',
      category: 'equipment_provisioning' as const,
      taskType: 'provisioning' as const,
      assetCategory: 'laptop' as const,
      assigneeLabel: 'IT Team',
      dueDate: new Date('2023-02-08T00:00:00.000Z'),
      status: 'pending' as const,
      sortOrder: 5,
    },
    {
      id: '10000000-0000-4000-8000-000000000185',
      templateItemId: ID.onboardingTemplateItemEmail,
      title: 'Email & System Access',
      category: 'system_access' as const,
      taskType: 'provisioning' as const,
      assigneeLabel: 'IT Team',
      dueDate: new Date('2023-02-02T00:00:00.000Z'),
      status: 'completed' as const,
      completedAt: new Date('2023-02-01T00:00:00.000Z'),
      sortOrder: 6,
    },
  ];

  for (const task of onboardingTaskSeeds) {
    await prisma.employeeOnboardingTask.upsert({
      where: { id: task.id },
      create: {
        id: task.id,
        onboardingId: ID.employeeOnboardingStaff,
        templateItemId: task.templateItemId,
        title: task.title,
        category: task.category,
        taskType: task.taskType,
        documentTypeId: task.documentTypeId ?? null,
        assetCategory: task.assetCategory ?? null,
        employeeDocumentId: task.employeeDocumentId ?? null,
        assigneeLabel: task.assigneeLabel,
        dueDate: task.dueDate ?? null,
        status: task.status,
        completedAt: task.completedAt ?? null,
        sortOrder: task.sortOrder,
        isRequired: true,
      },
      update: {
        status: task.status,
        completedAt: task.completedAt ?? null,
        assetCategory: task.assetCategory ?? null,
        employeeDocumentId: task.employeeDocumentId ?? null,
      },
    });
  }

  await prisma.companyAsset.upsert({
    where: { id: ID.assetLaptopManager },
    create: {
      id: ID.assetLaptopManager,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'MacBook Pro 14"',
      assetTag: 'AST-LAP-1048',
      category: 'laptop',
      serialNumber: 'C02ZX19QMD6T',
      purchaseDate: new Date('2025-02-12T00:00:00.000Z'),
      warrantyExpiryDate: new Date('2028-02-11T00:00:00.000Z'),
      purchaseValue: 2399,
      status: 'assigned',
    },
    update: {
      name: 'MacBook Pro 14"',
      status: 'assigned',
    },
  });

  await prisma.employeeAssetAssignment.upsert({
    where: { id: ID.assetAssignmentManager },
    create: {
      id: ID.assetAssignmentManager,
      assetId: ID.assetLaptopManager,
      employeeId: ID.empManager,
      status: 'active',
      assignedAt: new Date('2025-02-15T00:00:00.000Z'),
      conditionOnAssign: 'New',
      assignedByUserId: ID.userHrAdmin,
    },
    update: {
      status: 'active',
      employeeId: ID.empManager,
    },
  });

  await prisma.companyAsset.upsert({
    where: { id: ID.assetLaptopStaff },
    create: {
      id: ID.assetLaptopStaff,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Dell Latitude 5540',
      assetTag: 'AST-LAP-1052',
      category: 'laptop',
      serialNumber: 'DL5540-STAFF-01',
      purchaseDate: new Date('2025-08-01T00:00:00.000Z'),
      warrantyExpiryDate: new Date('2028-07-31T00:00:00.000Z'),
      purchaseValue: 1899,
      status: 'available',
    },
    update: {
      name: 'Dell Latitude 5540',
      status: 'available',
    },
  });

  await prisma.offboardingChecklistTemplate.upsert({
    where: { id: ID.offboardingTemplateDefault },
    create: {
      id: ID.offboardingTemplateDefault,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Standard Exit',
      description: 'Default offboarding checklist for departing employees',
      isDefault: true,
      isActive: true,
    },
    update: {
      name: 'Standard Exit',
      isDefault: true,
      isActive: true,
    },
  });

  const offboardingTemplateItems = [
    {
      id: ID.offboardingTemplateItemExitSchedule,
      title: 'Schedule Exit Interview',
      description: 'Book exit interview with HR',
      category: 'exit_process' as const,
      taskType: 'manual_task' as const,
      assigneeLabel: 'HR Admin',
      dueDaysOffset: 3,
      sortOrder: 1,
    },
    {
      id: ID.offboardingTemplateItemExitComplete,
      title: 'Complete Exit Interview',
      description: 'Record exit interview feedback and reason for leaving',
      category: 'exit_process' as const,
      taskType: 'exit_interview' as const,
      assigneeLabel: 'HR Admin',
      dueDaysOffset: 7,
      sortOrder: 2,
    },
    {
      id: ID.offboardingTemplateItemLaptopReturn,
      title: 'Return Company Laptop',
      description: 'Collect laptop and accessories from departing employee',
      category: 'asset_return' as const,
      taskType: 'asset_return' as const,
      assetCategory: 'laptop' as const,
      assigneeLabel: 'IT Team',
      dueDaysOffset: 10,
      sortOrder: 3,
    },
    {
      id: ID.offboardingTemplateItemAccessRevoke,
      title: 'Revoke System Access',
      description: 'Deactivate login, email, and application access',
      category: 'access_revocation' as const,
      taskType: 'access_revocation' as const,
      assigneeLabel: 'IT Team',
      dueDaysOffset: 11,
      sortOrder: 4,
    },
    {
      id: ID.offboardingTemplateItemClearance,
      title: 'Department Clearance',
      description: 'Obtain signed clearance from all departments',
      category: 'clearance' as const,
      taskType: 'clearance' as const,
      assigneeLabel: 'HR Admin',
      dueDaysOffset: 12,
      sortOrder: 5,
    },
    {
      id: ID.offboardingTemplateItemSettlement,
      title: 'Full & Final Settlement',
      description: 'Calculate and queue final settlement payroll adjustment',
      category: 'final_settlement' as const,
      taskType: 'final_settlement' as const,
      assigneeLabel: 'Payroll Admin',
      dueDaysOffset: 14,
      sortOrder: 6,
    },
  ];

  for (const item of offboardingTemplateItems) {
    await prisma.offboardingChecklistTemplateItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        templateId: ID.offboardingTemplateDefault,
        title: item.title,
        description: item.description,
        category: item.category,
        taskType: item.taskType,
        assetCategory: item.assetCategory ?? null,
        assigneeLabel: item.assigneeLabel,
        dueDaysOffset: item.dueDaysOffset,
        sortOrder: item.sortOrder,
        isRequired: true,
      },
      update: {
        title: item.title,
        category: item.category,
        taskType: item.taskType,
        assetCategory: item.assetCategory ?? null,
        sortOrder: item.sortOrder,
      },
    });
  }

  await prisma.payrollPeriod.upsert({
    where: { id: ID.payrollPeriodAug2026 },
    create: {
      id: ID.payrollPeriodAug2026,
      companyId: company.id,
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-08-31T00:00:00.000Z'),
      paymentDate: new Date('2026-09-05T00:00:00.000Z'),
      status: 'closed',
    },
    update: {
      status: 'closed',
    },
  });

  await prisma.payrollRun.upsert({
    where: { id: ID.payrollRunManagerAug2026 },
    create: {
      id: ID.payrollRunManagerAug2026,
      payrollPeriodId: ID.payrollPeriodAug2026,
      employeeId: ID.empManager,
      grossPay: 8500,
      totalDeductions: 1700,
      netPay: 6800,
      status: 'finalized',
      finalizedAt: new Date('2026-09-01T00:00:00.000Z'),
      locked: true,
    },
    update: {
      status: 'finalized',
      locked: true,
    },
  });

  await prisma.benefitPlan.upsert({
    where: { id: ID.benefitPlanHealthGold },
    create: {
      id: ID.benefitPlanHealthGold,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Comprehensive Health & Dental (Gold)',
      category: 'health_insurance',
      provider: 'Medibank Private',
      planTier: 'Gold',
      description:
        'Comprehensive medical, dental, and vision coverage with low excess.',
      employerContributionLabel: '85% ($850/mo)',
      employerContributionAmount: 850,
      employeeContributionAmount: 150,
      employeeContributionLabel: '$150/mo',
      coverageLimitLabel: '$2,000,000 In-Network',
      status: 'active',
    },
    update: {
      status: 'active',
      employerContributionAmount: 850,
      employeeContributionAmount: 150,
    },
  });

  await prisma.benefitPlan.upsert({
    where: { id: ID.benefitPlanLife },
    create: {
      id: ID.benefitPlanLife,
      tenantId: tenant.id,
      companyId: company.id,
      name: 'Group Term Life Insurance',
      category: 'life_insurance',
      provider: 'MetLife',
      planTier: 'Gold',
      description: 'Life insurance and AD&D protection — 3× annual base salary.',
      employerContributionLabel: '100% ($60/mo)',
      employerContributionAmount: 60,
      employeeContributionAmount: 0,
      employeeContributionLabel: '$0/mo',
      coverageLimitLabel: '3× Annual Base Salary',
      status: 'active',
    },
    update: {
      status: 'active',
      employerContributionAmount: 60,
    },
  });

  await prisma.benefitOpenEnrollmentPeriod.upsert({
    where: { id: ID.benefitOpenEnrollment2026 },
    create: {
      id: ID.benefitOpenEnrollment2026,
      tenantId: tenant.id,
      companyId: company.id,
      name: '2026 Annual Benefits Open Enrollment',
      description: 'Select health and life coverage for the 2026 plan year.',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T00:00:00.000Z'),
      status: 'open',
      openedAt: new Date('2026-09-01T00:00:00.000Z'),
      plans: {
        create: [
          { benefitPlanId: ID.benefitPlanHealthGold },
          { benefitPlanId: ID.benefitPlanLife },
        ],
      },
    },
    update: {
      status: 'open',
      openedAt: new Date('2026-09-01T00:00:00.000Z'),
    },
  });

  await prisma.benefitOpenEnrollmentPlan.upsert({
    where: {
      openEnrollmentPeriodId_benefitPlanId: {
        openEnrollmentPeriodId: ID.benefitOpenEnrollment2026,
        benefitPlanId: ID.benefitPlanHealthGold,
      },
    },
    create: {
      openEnrollmentPeriodId: ID.benefitOpenEnrollment2026,
      benefitPlanId: ID.benefitPlanHealthGold,
    },
    update: {},
  });

  await prisma.benefitOpenEnrollmentPlan.upsert({
    where: {
      openEnrollmentPeriodId_benefitPlanId: {
        openEnrollmentPeriodId: ID.benefitOpenEnrollment2026,
        benefitPlanId: ID.benefitPlanLife,
      },
    },
    create: {
      openEnrollmentPeriodId: ID.benefitOpenEnrollment2026,
      benefitPlanId: ID.benefitPlanLife,
    },
    update: {},
  });

  await prisma.benefitEnrollment.upsert({
    where: { id: ID.benefitEnrollmentStaffHealth },
    create: {
      id: ID.benefitEnrollmentStaffHealth,
      tenantId: tenant.id,
      companyId: company.id,
      employeeId: ID.empStaff,
      benefitPlanId: ID.benefitPlanHealthGold,
      openEnrollmentPeriodId: ID.benefitOpenEnrollment2026,
      enrollmentType: 'open_enrollment',
      status: 'active',
      effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
      employeeContributionAmount: 150,
      enrolledAt: new Date('2026-09-05T00:00:00.000Z'),
      dependents: {
        create: {
          id: ID.benefitDependentStaffSpouse,
          tenantId: tenant.id,
          fullName: 'Alex Lee',
          relationship: 'spouse',
          dateOfBirth: new Date('1990-03-15T00:00:00.000Z'),
          status: 'active',
        },
      },
    },
    update: {
      status: 'active',
    },
  });

  await prisma.benefitEnrollment.upsert({
    where: { id: ID.benefitEnrollmentStaffLife },
    create: {
      id: ID.benefitEnrollmentStaffLife,
      tenantId: tenant.id,
      companyId: company.id,
      employeeId: ID.empStaff,
      benefitPlanId: ID.benefitPlanLife,
      openEnrollmentPeriodId: ID.benefitOpenEnrollment2026,
      enrollmentType: 'open_enrollment',
      status: 'active',
      effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
      employeeContributionAmount: 0,
      beneficiarySharePercent: 100,
      enrolledAt: new Date('2026-09-05T00:00:00.000Z'),
    },
    update: {
      status: 'active',
      beneficiarySharePercent: 100,
    },
  });

  const glAccountSeeds = [
    {
      id: ID.glAccountSalariesPayable,
      code: '2100',
      name: 'Salaries Payable',
      accountType: 'liability' as const,
    },
    {
      id: ID.glAccountBasicSalary,
      code: '5010',
      name: 'Basic Salary Expense',
      accountType: 'expense' as const,
    },
    {
      id: ID.glAccountAllowances,
      code: '5020',
      name: 'Allowances Expense',
      accountType: 'expense' as const,
    },
    {
      id: ID.glAccountTaxPayable,
      code: '2110',
      name: 'Income Tax Payable',
      accountType: 'liability' as const,
    },
    {
      id: ID.glAccountLoanPayable,
      code: '2120',
      name: 'Loan Repayment Payable',
      accountType: 'liability' as const,
    },
    {
      id: ID.glAccountSuperExpense,
      code: '5030',
      name: 'Employer Superannuation Expense',
      accountType: 'expense' as const,
    },
    {
      id: ID.glAccountSuperPayable,
      code: '2130',
      name: 'Superannuation Payable',
      accountType: 'liability' as const,
    },
    {
      id: ID.glAccountBenefitsPayable,
      code: '2140',
      name: 'Benefits Payable',
      accountType: 'liability' as const,
    },
    {
      id: ID.glAccountContractorExpense,
      code: '5040',
      name: 'Contractor Services Expense',
      accountType: 'expense' as const,
    },
    {
      id: ID.glAccountContractorPayable,
      code: '2150',
      name: 'Contractor Payments Payable',
      accountType: 'liability' as const,
    },
  ];

  for (const account of glAccountSeeds) {
    await prisma.glAccount.upsert({
      where: { id: account.id },
      create: {
        id: account.id,
        tenantId: tenant.id,
        companyId: company.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        isActive: true,
      },
      update: {
        name: account.name,
        accountType: account.accountType,
        isActive: true,
      },
    });
  }

  const glMappingSeeds = [
    {
      id: ID.glMappingBasic,
      payComponentId: ID.payComponentBasic,
      systemKey: null,
      postingSide: 'debit' as const,
      glAccountId: ID.glAccountBasicSalary,
    },
    {
      id: ID.glMappingHra,
      payComponentId: ID.payComponentHra,
      systemKey: null,
      postingSide: 'debit' as const,
      glAccountId: ID.glAccountAllowances,
    },
    {
      id: ID.glMappingTax,
      payComponentId: ID.payComponentTax,
      systemKey: null,
      postingSide: 'credit' as const,
      glAccountId: ID.glAccountTaxPayable,
    },
    {
      id: ID.glMappingLoan,
      payComponentId: ID.payComponentLoan,
      systemKey: null,
      postingSide: 'credit' as const,
      glAccountId: ID.glAccountLoanPayable,
    },
    {
      id: ID.glMappingNetPay,
      payComponentId: null,
      systemKey: 'net_pay_salary_payable',
      postingSide: 'credit' as const,
      glAccountId: ID.glAccountSalariesPayable,
    },
    {
      id: ID.glMappingSuperExpense,
      payComponentId: null,
      systemKey: 'employer_superannuation_expense',
      postingSide: 'debit' as const,
      glAccountId: ID.glAccountSuperExpense,
    },
    {
      id: ID.glMappingSuperLiability,
      payComponentId: null,
      systemKey: 'employer_superannuation_liability',
      postingSide: 'credit' as const,
      glAccountId: ID.glAccountSuperPayable,
    },
  ];

  for (const mapping of glMappingSeeds) {
    if (mapping.payComponentId) {
      await prisma.glPayrollMapping.upsert({
        where: {
          companyId_payComponentId: {
            companyId: company.id,
            payComponentId: mapping.payComponentId,
          },
        },
        create: {
          id: mapping.id,
          tenantId: tenant.id,
          companyId: company.id,
          payComponentId: mapping.payComponentId,
          postingSide: mapping.postingSide,
          glAccountId: mapping.glAccountId,
        },
        update: {
          postingSide: mapping.postingSide,
          glAccountId: mapping.glAccountId,
        },
      });
      continue;
    }

    await prisma.glPayrollMapping.upsert({
      where: {
        companyId_systemKey: {
          companyId: company.id,
          systemKey: mapping.systemKey!,
        },
      },
      create: {
        id: mapping.id,
        tenantId: tenant.id,
        companyId: company.id,
        systemKey: mapping.systemKey!,
        postingSide: mapping.postingSide,
        glAccountId: mapping.glAccountId,
      },
      update: {
        postingSide: mapping.postingSide,
        glAccountId: mapping.glAccountId,
      },
    });
  }

  for (const mapping of [
    {
      id: ID.glMappingContractorExpense,
      systemKey: 'contractor_expense',
      postingSide: 'debit' as const,
      glAccountId: ID.glAccountContractorExpense,
    },
    {
      id: ID.glMappingContractorPayable,
      systemKey: 'contractor_payable',
      postingSide: 'credit' as const,
      glAccountId: ID.glAccountContractorPayable,
    },
  ]) {
    await prisma.glContractorMapping.upsert({
      where: {
        companyId_systemKey: {
          companyId: company.id,
          systemKey: mapping.systemKey,
        },
      },
      create: {
        id: mapping.id,
        tenantId: tenant.id,
        companyId: company.id,
        systemKey: mapping.systemKey,
        postingSide: mapping.postingSide,
        glAccountId: mapping.glAccountId,
      },
      update: {
        postingSide: mapping.postingSide,
        glAccountId: mapping.glAccountId,
      },
    });
  }

  await prisma.employeeOffboarding.upsert({
    where: { id: ID.employeeOffboardingManager },
    create: {
      id: ID.employeeOffboardingManager,
      tenantId: tenant.id,
      companyId: company.id,
      employeeId: ID.empManager,
      templateId: ID.offboardingTemplateDefault,
      status: 'in_progress',
      lastWorkingDate: new Date('2026-09-15T00:00:00.000Z'),
      startedAt: new Date('2026-09-01T00:00:00.000Z'),
    },
    update: {
      status: 'in_progress',
      templateId: ID.offboardingTemplateDefault,
    },
  });

  const offboardingTaskSeeds = [
    {
      id: '10000000-0000-4000-8000-000000000191',
      templateItemId: ID.offboardingTemplateItemExitSchedule,
      title: 'Schedule Exit Interview',
      category: 'exit_process' as const,
      taskType: 'manual_task' as const,
      assigneeLabel: 'HR Admin',
      dueDate: new Date('2026-09-04T00:00:00.000Z'),
      status: 'completed' as const,
      completedAt: new Date('2026-09-02T00:00:00.000Z'),
      sortOrder: 1,
    },
    {
      id: '10000000-0000-4000-8000-000000000192',
      templateItemId: ID.offboardingTemplateItemExitComplete,
      title: 'Complete Exit Interview',
      category: 'exit_process' as const,
      taskType: 'exit_interview' as const,
      assigneeLabel: 'HR Admin',
      dueDate: new Date('2026-09-08T00:00:00.000Z'),
      status: 'pending' as const,
      sortOrder: 2,
    },
    {
      id: '10000000-0000-4000-8000-000000000193',
      templateItemId: ID.offboardingTemplateItemLaptopReturn,
      title: 'Return Company Laptop',
      category: 'asset_return' as const,
      taskType: 'asset_return' as const,
      assetCategory: 'laptop' as const,
      assigneeLabel: 'IT Team',
      dueDate: new Date('2026-09-11T00:00:00.000Z'),
      status: 'pending' as const,
      sortOrder: 3,
    },
    {
      id: '10000000-0000-4000-8000-000000000194',
      templateItemId: ID.offboardingTemplateItemAccessRevoke,
      title: 'Revoke System Access',
      category: 'access_revocation' as const,
      taskType: 'access_revocation' as const,
      assigneeLabel: 'IT Team',
      dueDate: new Date('2026-09-12T00:00:00.000Z'),
      status: 'pending' as const,
      sortOrder: 4,
    },
    {
      id: '10000000-0000-4000-8000-000000000195',
      templateItemId: ID.offboardingTemplateItemClearance,
      title: 'Department Clearance',
      category: 'clearance' as const,
      taskType: 'clearance' as const,
      assigneeLabel: 'HR Admin',
      dueDate: new Date('2026-09-13T00:00:00.000Z'),
      status: 'pending' as const,
      sortOrder: 5,
    },
    {
      id: '10000000-0000-4000-8000-000000000196',
      templateItemId: ID.offboardingTemplateItemSettlement,
      title: 'Full & Final Settlement',
      category: 'final_settlement' as const,
      taskType: 'final_settlement' as const,
      assigneeLabel: 'Payroll Admin',
      dueDate: new Date('2026-09-15T00:00:00.000Z'),
      status: 'pending' as const,
      sortOrder: 6,
    },
  ];

  for (const task of offboardingTaskSeeds) {
    await prisma.employeeOffboardingTask.upsert({
      where: { id: task.id },
      create: {
        id: task.id,
        offboardingId: ID.employeeOffboardingManager,
        templateItemId: task.templateItemId,
        title: task.title,
        category: task.category,
        taskType: task.taskType,
        assetCategory: task.assetCategory ?? null,
        assigneeLabel: task.assigneeLabel,
        dueDate: task.dueDate ?? null,
        status: task.status,
        completedAt: task.completedAt ?? null,
        sortOrder: task.sortOrder,
        isRequired: true,
      },
      update: {
        status: task.status,
        completedAt: task.completedAt ?? null,
      },
    });
  }

  await prisma.exitInterviewRecord.upsert({
    where: { offboardingId: ID.employeeOffboardingManager },
    create: {
      id: '10000000-0000-4000-8000-000000000197',
      offboardingId: ID.employeeOffboardingManager,
      employeeId: ID.empManager,
      scheduledAt: new Date('2026-09-07T02:00:00.000Z'),
      interviewerEmployeeId: ID.empHrAdmin,
    },
    update: {
      scheduledAt: new Date('2026-09-07T02:00:00.000Z'),
      interviewerEmployeeId: ID.empHrAdmin,
    },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  const seedUserIds: Record<string, string> = {
    [ID.empOwner]: ID.userOwner,
    [ID.empHrAdmin]: ID.userHrAdmin,
    [ID.empPayrollAdmin]: ID.userPayrollAdmin,
    [ID.empManager]: ID.userManager,
    [ID.empStaff]: ID.userStaff,
  };

  for (const emp of employees) {
    await prisma.user.upsert({
      where: { id: seedUserIds[emp.id] },
      create: {
        id: seedUserIds[emp.id],
        tenantId: tenant.id,
        employeeId: emp.id,
        roleId: emp.roleId,
        email: emp.email,
        passwordHash,
        isActive: true,
      },
      update: {
        tenantId: tenant.id,
        employeeId: emp.id,
        roleId: emp.roleId,
        email: emp.email,
        passwordHash,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  await prisma.user.upsert({
    where: { id: ID.userSuperAdmin },
    create: {
      id: ID.userSuperAdmin,
      tenantId: null,
      employeeId: null,
      roleId: ID.roleSuperAdmin,
      email: `super@${SEED_EMAIL_DOMAIN}`,
      passwordHash,
      isActive: true,
    },
    update: {
      tenantId: null,
      employeeId: null,
      roleId: ID.roleSuperAdmin,
      email: `super@${SEED_EMAIL_DOMAIN}`,
      passwordHash,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await prisma.kbCategory.upsert({
    where: { id: ID.kbCategoryPayroll },
    create: {
      id: ID.kbCategoryPayroll,
      tenantId: ID.tenant,
      name: 'Payroll',
      slug: 'payroll',
      description: 'Runs, payslips, and tax profiles.',
      sortOrder: 1,
    },
    update: {
      name: 'Payroll',
      slug: 'payroll',
      description: 'Runs, payslips, and tax profiles.',
      sortOrder: 1,
    },
  });

  await prisma.kbCategory.upsert({
    where: { id: ID.kbCategoryLeave },
    create: {
      id: ID.kbCategoryLeave,
      tenantId: ID.tenant,
      name: 'Leave',
      slug: 'leave',
      description: 'Balances, policies, and requests.',
      sortOrder: 2,
    },
    update: {
      name: 'Leave',
      slug: 'leave',
      description: 'Balances, policies, and requests.',
      sortOrder: 2,
    },
  });

  await prisma.kbArticle.upsert({
    where: { id: ID.kbArticlePayrollRun },
    create: {
      id: ID.kbArticlePayrollRun,
      tenantId: ID.tenant,
      categoryId: ID.kbCategoryPayroll,
      title: 'Start and lock a monthly payroll run',
      slug: 'start-monthly-payroll-run',
      summary:
        'Walk through validation, exceptions, and approval before funds move.',
      body:
        'Open Payroll → Runs, select the pay period, review exceptions, then lock the register. Once locked, submit for approval before finalizing.',
      published: true,
      viewCount: 0,
      createdByUserId: ID.userHrAdmin,
    },
    update: {
      title: 'Start and lock a monthly payroll run',
      summary:
        'Walk through validation, exceptions, and approval before funds move.',
      body:
        'Open Payroll → Runs, select the pay period, review exceptions, then lock the register. Once locked, submit for approval before finalizing.',
      published: true,
      updatedByUserId: ID.userHrAdmin,
    },
  });

  await prisma.kbArticle.upsert({
    where: { id: ID.kbArticleLeaveRequest },
    create: {
      id: ID.kbArticleLeaveRequest,
      tenantId: ID.tenant,
      categoryId: ID.kbCategoryLeave,
      title: 'Submit a leave request',
      slug: 'submit-leave-request',
      summary: 'Employees can request leave from ESS or the mobile app.',
      body:
        'Go to Leave, choose a leave type, pick start and end dates, add a reason, and submit. Your manager receives a notification for approval.',
      published: true,
      viewCount: 0,
      createdByUserId: ID.userHrAdmin,
    },
    update: {
      title: 'Submit a leave request',
      summary: 'Employees can request leave from ESS or the mobile app.',
      body:
        'Go to Leave, choose a leave type, pick start and end dates, add a reason, and submit. Your manager receives a notification for approval.',
      published: true,
      updatedByUserId: ID.userHrAdmin,
    },
  });

  await prisma.kbArticle.upsert({
    where: { id: ID.kbArticleClockIn },
    create: {
      id: ID.kbArticleClockIn,
      tenantId: ID.tenant,
      categoryId: ID.kbCategoryLeave,
      title: 'Fix a missed clock-in',
      slug: 'fix-missed-clock-in',
      summary: 'Use regularization when a device punch is missing.',
      body:
        'From Attendance, open the day record and submit a regularization request with the correct time and optional notes.',
      published: true,
      viewCount: 0,
      createdByUserId: ID.userHrAdmin,
    },
    update: {
      title: 'Fix a missed clock-in',
      summary: 'Use regularization when a device punch is missing.',
      body:
        'From Attendance, open the day record and submit a regularization request with the correct time and optional notes.',
      published: true,
      updatedByUserId: ID.userHrAdmin,
    },
  });

  await prisma.exchangeRate.upsert({
    where: { id: ID.exchangeRateUsdAudH1 },
    create: {
      id: ID.exchangeRateUsdAudH1,
      tenantId: ID.tenant,
      baseCurrency: 'AUD',
      quoteCurrency: 'USD',
      rate: '1.40000000',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: new Date('2026-06-30'),
      createdByUserId: ID.userHrAdmin,
    },
    update: {
      rate: '1.40000000',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: new Date('2026-06-30'),
    },
  });

  await prisma.exchangeRate.upsert({
    where: { id: ID.exchangeRateUsdAudH2 },
    create: {
      id: ID.exchangeRateUsdAudH2,
      tenantId: ID.tenant,
      baseCurrency: 'AUD',
      quoteCurrency: 'USD',
      rate: '1.48000000',
      effectiveFrom: new Date('2026-07-01'),
      effectiveTo: null,
      createdByUserId: ID.userHrAdmin,
    },
    update: {
      rate: '1.48000000',
      effectiveFrom: new Date('2026-07-01'),
      effectiveTo: null,
    },
  });

  await prisma.performanceReviewCycle.upsert({
    where: { id: ID.reviewCycleH2 },
    create: {
      id: ID.reviewCycleH2,
      tenantId: ID.tenant,
      companyId: ID.company,
      name: 'H2 2026 Performance Review',
      description: 'Company-wide mid-year performance cycle',
      periodStart: new Date('2026-07-01'),
      periodEnd: new Date('2026-12-31'),
      measurementPeriod: 'semi_annual',
      reviewDueDate: new Date('2026-12-18'),
      status: 'active',
      createdByUserId: ID.userHrAdmin,
    },
    update: {
      status: 'active',
      reviewDueDate: new Date('2026-12-18'),
    },
  });

  await prisma.kpiDefinition.upsert({
    where: { id: ID.kpiActivation },
    create: {
      id: ID.kpiActivation,
      tenantId: ID.tenant,
      companyId: ID.company,
      name: 'Enterprise activation rate',
      description: 'Percentage of new enterprise accounts activated within 30 days',
      category: 'Growth',
      unit: 'percentage',
      direction: 'higher_is_better',
      defaultTargetValue: '80',
      isActive: true,
      createdByUserId: ID.userHrAdmin,
    },
    update: { isActive: true, defaultTargetValue: '80' },
  });

  await prisma.kpiDefinition.upsert({
    where: { id: ID.kpiSupportSla },
    create: {
      id: ID.kpiSupportSla,
      tenantId: ID.tenant,
      companyId: ID.company,
      name: 'Support resolution time',
      description: 'Median hours to resolve priority support tickets',
      category: 'Customer experience',
      unit: 'hours',
      direction: 'lower_is_better',
      defaultTargetValue: '4',
      isActive: true,
      createdByUserId: ID.userHrAdmin,
    },
    update: { isActive: true, defaultTargetValue: '4' },
  });

  await prisma.employeeKpiAssignment.upsert({
    where: { id: ID.kpiAssignmentStaffActivation },
    create: {
      id: ID.kpiAssignmentStaffActivation,
      tenantId: ID.tenant,
      companyId: ID.company,
      reviewCycleId: ID.reviewCycleH2,
      kpiDefinitionId: ID.kpiActivation,
      employeeId: ID.empStaff,
      assignedByUserId: ID.userManager,
      title: 'Enterprise activation rate',
      unit: 'percentage',
      direction: 'higher_is_better',
      targetValue: '80',
      currentValue: '72',
      measurementPeriod: 'semi_annual',
      measurementPeriodStart: new Date('2026-07-01'),
      measurementPeriodEnd: new Date('2026-12-31'),
      weightPercent: '40',
      status: 'active',
    },
    update: { currentValue: '72', status: 'active' },
  });

  await prisma.employeeKpiAssignment.upsert({
    where: { id: ID.kpiAssignmentManagerSupport },
    create: {
      id: ID.kpiAssignmentManagerSupport,
      tenantId: ID.tenant,
      companyId: ID.company,
      reviewCycleId: ID.reviewCycleH2,
      kpiDefinitionId: ID.kpiSupportSla,
      employeeId: ID.empManager,
      assignedByUserId: ID.userHrAdmin,
      title: 'Support resolution time',
      unit: 'hours',
      direction: 'lower_is_better',
      targetValue: '4',
      currentValue: '5.8',
      measurementPeriod: 'semi_annual',
      measurementPeriodStart: new Date('2026-07-01'),
      measurementPeriodEnd: new Date('2026-12-31'),
      weightPercent: '30',
      status: 'active',
    },
    update: { currentValue: '5.8', status: 'active' },
  });

  await prisma.workflowDefinition.upsert({
    where: { id: ID.workflowPerformanceReview },
    create: {
      id: ID.workflowPerformanceReview,
      companyId: ID.company,
      entityType: 'performance_review',
      name: 'Performance Review Sign-off',
      description: 'Manager, skip-level manager, then HR Admin',
      triggerConfig: { type: 'always' },
      steps: [
        { order: 1, assigneeType: 'direct_manager', roleName: 'Manager' },
        { order: 2, assigneeType: 'skip_level_manager', roleName: 'Skip-level Manager' },
        { order: 3, assigneeType: 'role', roleName: 'HR Admin' },
      ],
      isDefault: true,
      isActive: true,
      effectiveFrom: EFFECTIVE_FROM,
    },
    update: { isActive: true, isDefault: true },
  });

  await prisma.performanceReviewParticipant.upsert({
    where: {
      reviewCycleId_employeeId: {
        reviewCycleId: ID.reviewCycleH2,
        employeeId: ID.empStaff,
      },
    },
    create: {
      tenantId: ID.tenant,
      companyId: ID.company,
      reviewCycleId: ID.reviewCycleH2,
      employeeId: ID.empStaff,
    },
    update: {},
  });

  await prisma.performanceReviewParticipant.upsert({
    where: {
      reviewCycleId_employeeId: {
        reviewCycleId: ID.reviewCycleH2,
        employeeId: ID.empManager,
      },
    },
    create: {
      tenantId: ID.tenant,
      companyId: ID.company,
      reviewCycleId: ID.reviewCycleH2,
      employeeId: ID.empManager,
    },
    update: {},
  });

  const staffSelfAssessment = {
    competencies: [
      { key: 'impact', label: 'Business impact', selfRating: 4 },
      { key: 'ownership', label: 'Ownership', selfRating: 5 },
      { key: 'collaboration', label: 'Collaboration', selfRating: 4 },
      { key: 'craft', label: 'Functional excellence', selfRating: 4 },
    ],
    kpiAssessments: [
      {
        kpiAssignmentId: ID.kpiAssignmentStaffActivation,
        title: 'Enterprise activation rate',
        unit: 'percentage',
        targetValue: 80,
        currentValue: 72,
        progressPercent: 90,
        selfRating: 4,
      },
    ],
    overallSelfComment:
      'Strong progress on activation; partnering with CS on onboarding friction.',
  };

  await prisma.employeePerformanceReview.upsert({
    where: { id: ID.performanceReviewStaff },
    create: {
      id: ID.performanceReviewStaff,
      tenantId: ID.tenant,
      companyId: ID.company,
      reviewCycleId: ID.reviewCycleH2,
      employeeId: ID.empStaff,
      managerEmployeeId: ID.empManager,
      status: 'manager_review',
      selfAssessment: staffSelfAssessment,
      managerAssessment: {
        competencies: staffSelfAssessment.competencies.map((item) => ({
          ...item,
          managerRating: item.selfRating,
        })),
        kpiAssessments: staffSelfAssessment.kpiAssessments.map((item) => ({
          ...item,
          managerRating: 4,
        })),
        overallManagerComment: 'Delivered consistently; activation KPI needs one more push.',
      },
      selfSubmittedAt: new Date('2026-12-08'),
    },
    update: {
      status: 'manager_review',
      selfAssessment: staffSelfAssessment,
    },
  });

  await prisma.performanceReviewCycle.update({
    where: { id: ID.reviewCycleH2 },
    data: {
      requiresWorkflowApproval: true,
      launchedAt: new Date('2026-11-01'),
      status: 'active',
    },
  });

  await prisma.performance360Feedback.upsert({
    where: {
      reviewId_reviewerEmployeeId: {
        reviewId: ID.performanceReviewStaff,
        reviewerEmployeeId: ID.empHrAdmin,
      },
    },
    create: {
      id: ID.feedback360HrForStaff,
      tenantId: ID.tenant,
      companyId: ID.company,
      reviewId: ID.performanceReviewStaff,
      reviewerEmployeeId: ID.empHrAdmin,
      relationship: 'cross_functional',
      status: 'submitted',
      competencyRatings: [
        { key: 'impact', rating: 4 },
        { key: 'ownership', rating: 5 },
        { key: 'collaboration', rating: 4 },
        { key: 'craft', rating: 4 },
      ],
      comment: 'Dependable partner who connects product choices to customer evidence.',
      submittedAt: new Date('2026-12-10'),
    },
    update: { status: 'submitted' },
  });

  await prisma.performance360Feedback.upsert({
    where: {
      reviewId_reviewerEmployeeId: {
        reviewId: ID.performanceReviewStaff,
        reviewerEmployeeId: ID.empPayrollAdmin,
      },
    },
    create: {
      id: ID.feedback360PayrollForStaff,
      tenantId: ID.tenant,
      companyId: ID.company,
      reviewId: ID.performanceReviewStaff,
      reviewerEmployeeId: ID.empPayrollAdmin,
      relationship: 'peer',
      status: 'submitted',
      competencyRatings: [
        { key: 'impact', rating: 4 },
        { key: 'ownership', rating: 4 },
        { key: 'collaboration', rating: 5 },
        { key: 'craft', rating: 4 },
      ],
      comment: 'Creates clarity quickly and makes space for dissent before decisions.',
      submittedAt: new Date('2026-12-11'),
    },
    update: { status: 'submitted' },
  });

  await prisma.trainingCourse.upsert({
    where: { id: ID.trainingCoursePrivacy },
    create: {
      id: ID.trainingCoursePrivacy,
      tenantId: ID.tenant,
      companyId: ID.company,
      title: 'Data Privacy Essentials',
      description: 'Mandatory privacy and data handling for all staff.',
      category: 'Compliance',
      deliveryMode: 'virtual',
      durationMinutes: 45,
      isMandatory: true,
      status: 'active',
      createdByUserId: ID.userHrAdmin,
    },
    update: { status: 'active' },
  });

  await prisma.trainingCourse.upsert({
    where: { id: ID.trainingCourseLeadership },
    create: {
      id: ID.trainingCourseLeadership,
      tenantId: ID.tenant,
      companyId: ID.company,
      title: 'Leading Through Change',
      description: 'Leadership skills for managers navigating organizational change.',
      category: 'Leadership',
      deliveryMode: 'instructor_led',
      durationMinutes: 150,
      isMandatory: false,
      status: 'active',
      createdByUserId: ID.userHrAdmin,
    },
    update: { status: 'active' },
  });

  await prisma.trainingSession.upsert({
    where: { id: ID.trainingSessionPrivacy },
    create: {
      id: ID.trainingSessionPrivacy,
      tenantId: ID.tenant,
      companyId: ID.company,
      courseId: ID.trainingCoursePrivacy,
      scheduledStart: new Date('2026-09-15T09:00:00.000Z'),
      scheduledEnd: new Date('2026-09-15T10:00:00.000Z'),
      location: 'Virtual — Teams',
      instructor: 'Elena Rossi',
      status: 'completed',
      createdByUserId: ID.userHrAdmin,
    },
    update: { status: 'completed' },
  });

  await prisma.trainingSessionCost.upsert({
    where: { id: ID.trainingCostPrivacyVenue },
    create: {
      id: ID.trainingCostPrivacyVenue,
      tenantId: ID.tenant,
      companyId: ID.company,
      sessionId: ID.trainingSessionPrivacy,
      category: 'technology',
      description: 'Virtual classroom platform license',
      amount: 450,
      currency: 'AUD',
    },
    update: {},
  });

  await prisma.trainingAttendance.upsert({
    where: {
      sessionId_employeeId: {
        sessionId: ID.trainingSessionPrivacy,
        employeeId: ID.empStaff,
      },
    },
    create: {
      id: ID.trainingAttendanceStaff,
      tenantId: ID.tenant,
      companyId: ID.company,
      sessionId: ID.trainingSessionPrivacy,
      employeeId: ID.empStaff,
      status: 'completed',
      attendedAt: new Date('2026-09-15T09:05:00.000Z'),
      completedAt: new Date('2026-09-15T10:00:00.000Z'),
      score: 96,
    },
    update: { status: 'completed', score: 96 },
  });

  await prisma.trainingAttendance.upsert({
    where: {
      sessionId_employeeId: {
        sessionId: ID.trainingSessionPrivacy,
        employeeId: ID.empManager,
      },
    },
    create: {
      id: ID.trainingAttendanceManager,
      tenantId: ID.tenant,
      companyId: ID.company,
      sessionId: ID.trainingSessionPrivacy,
      employeeId: ID.empManager,
      status: 'completed',
      attendedAt: new Date('2026-09-15T09:05:00.000Z'),
      completedAt: new Date('2026-09-15T10:00:00.000Z'),
      score: 91,
    },
    update: { status: 'completed', score: 91 },
  });

  await prisma.skill.upsert({
    where: { id: ID.skillTypeScript },
    create: {
      id: ID.skillTypeScript,
      tenantId: ID.tenant,
      companyId: ID.company,
      name: 'TypeScript',
      category: 'Engineering',
      description: 'Typed JavaScript for application development.',
    },
    update: {},
  });

  await prisma.skill.upsert({
    where: { id: ID.skillLeadership },
    create: {
      id: ID.skillLeadership,
      tenantId: ID.tenant,
      companyId: ID.company,
      name: 'Leadership',
      category: 'Management',
      description: 'People leadership, coaching, and change management.',
    },
    update: {},
  });

  await prisma.skill.upsert({
    where: { id: ID.skillDataPrivacy },
    create: {
      id: ID.skillDataPrivacy,
      tenantId: ID.tenant,
      companyId: ID.company,
      name: 'Data Privacy Compliance',
      category: 'Compliance',
      description: 'Privacy regulations, data handling, and breach response.',
    },
    update: {},
  });

  await prisma.employeeSkill.upsert({
    where: {
      employeeId_skillId: {
        employeeId: ID.empStaff,
        skillId: ID.skillDataPrivacy,
      },
    },
    create: {
      id: ID.employeeSkillStaffPrivacy,
      tenantId: ID.tenant,
      companyId: ID.company,
      employeeId: ID.empStaff,
      skillId: ID.skillDataPrivacy,
      level: 'advanced',
      assessedAt: new Date('2026-09-15'),
    },
    update: { level: 'advanced' },
  });

  await prisma.employeeSkill.upsert({
    where: {
      employeeId_skillId: {
        employeeId: ID.empManager,
        skillId: ID.skillLeadership,
      },
    },
    create: {
      id: ID.employeeSkillManagerLeadership,
      tenantId: ID.tenant,
      companyId: ID.company,
      employeeId: ID.empManager,
      skillId: ID.skillLeadership,
      level: 'expert',
      assessedAt: new Date('2026-06-01'),
    },
    update: { level: 'expert' },
  });

  await prisma.employeeCertification.upsert({
    where: { id: ID.certPrivacyStaff },
    create: {
      id: ID.certPrivacyStaff,
      tenantId: ID.tenant,
      companyId: ID.company,
      employeeId: ID.empStaff,
      courseId: ID.trainingCoursePrivacy,
      name: 'Data Privacy Essentials Certificate',
      issuer: 'Demo Corp Learning',
      certificateNumber: 'DP-2025-0044',
      issuedAt: new Date('2025-09-15'),
      expiryDate: new Date('2026-09-15'),
      status: 'active',
    },
    update: { status: 'active' },
  });

  await prisma.employeeCertification.upsert({
    where: { id: ID.certFirstAidHr },
    create: {
      id: ID.certFirstAidHr,
      tenantId: ID.tenant,
      companyId: ID.company,
      employeeId: ID.empHrAdmin,
      name: 'First Aid at Work',
      issuer: 'St John Ambulance',
      certificateNumber: 'FA-2024-0041',
      issuedAt: new Date('2024-09-18'),
      expiryDate: new Date('2026-09-18'),
      status: 'active',
    },
    update: { status: 'active' },
  });

  await prisma.hrCase.upsert({
    where: { id: ID.hrCaseGrievance },
    create: {
      id: ID.hrCaseGrievance,
      tenantId: ID.tenant,
      companyId: ID.company,
      caseNumber: 'ER-2026-001',
      title: 'Formal workload grievance',
      caseType: 'grievance',
      status: 'open',
      priority: 'high',
      reportingEmployeeId: ID.empStaff,
      assignedOfficerEmployeeId: ID.empHrAdmin,
      detailsEncrypted:
        'Formal grievance concerning sustained workload allocation and manager communication. Employee reports repeated overtime without compensation review.',
      createdByUserId: ID.userHrAdmin,
      isRestricted: true,
    },
    update: { status: 'open' },
  });

  await prisma.hrCase.upsert({
    where: { id: ID.hrCaseConduct },
    create: {
      id: ID.hrCaseConduct,
      tenantId: ID.tenant,
      companyId: ID.company,
      caseNumber: 'ER-2026-002',
      title: 'Workplace conduct concern',
      caseType: 'investigation',
      status: 'investigating',
      priority: 'critical',
      subjectEmployeeId: ID.empManager,
      assignedOfficerEmployeeId: ID.empHrAdmin,
      detailsEncrypted:
        'Confidential report regarding repeated conduct concerns within the Commercial team. Witness interviews scheduled.',
      resolutionNotesEncrypted: 'Pending investigation findings and legal review.',
      createdByUserId: ID.userHrAdmin,
      isRestricted: true,
    },
    update: { status: 'investigating' },
  });

  await prisma.hrCaseParty.upsert({
    where: { id: ID.hrCasePartyWitness },
    create: {
      id: ID.hrCasePartyWitness,
      tenantId: ID.tenant,
      caseId: ID.hrCaseConduct,
      employeeId: ID.empStaff,
      partyRole: 'witness',
      isAnonymized: true,
      anonymizedLabel: 'Witness A',
    },
    update: {},
  });

  await prisma.hrCaseNote.upsert({
    where: { id: ID.hrCaseNoteConduct },
    create: {
      id: ID.hrCaseNoteConduct,
      tenantId: ID.tenant,
      caseId: ID.hrCaseConduct,
      contentEncrypted:
        'Witness interview completed. Notes restricted to the assigned investigation team.',
      createdByUserId: ID.userHrAdmin,
    },
    update: {},
  });

  await prisma.hrCaseDisciplinaryAction.upsert({
    where: { id: ID.hrCaseDisciplinaryAction },
    create: {
      id: ID.hrCaseDisciplinaryAction,
      tenantId: ID.tenant,
      companyId: ID.company,
      caseId: ID.hrCaseGrievance,
      actionType: 'verbal_warning',
      effectiveDate: new Date('2026-08-20'),
      letterReference: 'VW-2026-014',
      detailsEncrypted: 'Informal counseling regarding attendance patterns prior to formal grievance.',
      issuedByUserId: ID.userHrAdmin,
    },
    update: {},
  });

  await prisma.hrCaseInvestigationRecord.upsert({
    where: { id: ID.hrCaseInvestigationRecord },
    create: {
      id: ID.hrCaseInvestigationRecord,
      tenantId: ID.tenant,
      caseId: ID.hrCaseConduct,
      recordType: 'interview',
      title: 'Witness A interview',
      contentEncrypted:
        'Witness confirmed timeline of events on 12 Aug. Statement recorded under confidentiality protocol.',
      recordedAt: new Date('2026-08-22T10:00:00.000Z'),
      createdByUserId: ID.userHrAdmin,
    },
    update: {},
  });

  await prisma.companyAnnouncement.upsert({
    where: { id: ID.engagementAnnouncement },
    create: {
      id: ID.engagementAnnouncement,
      tenantId: ID.tenant,
      companyId: ID.company,
      title: 'Q3 all-hands recap & benefits update',
      body:
        'Thank you to everyone who joined the Q3 all-hands. Reminder: open enrollment for health benefits closes 30 September. See HR for the updated flexible working policy.',
      status: 'published',
      isPinned: true,
      publishedAt: new Date('2026-09-01T09:00:00.000Z'),
      createdByUserId: ID.userHrAdmin,
    },
    update: { status: 'published' },
  });

  await prisma.engagementSurvey.upsert({
    where: { id: ID.engagementEnpsSurvey },
    create: {
      id: ID.engagementEnpsSurvey,
      tenantId: ID.tenant,
      companyId: ID.company,
      title: 'September eNPS pulse',
      description: 'How likely are you to recommend Demo Corp as a place to work?',
      surveyType: 'enps',
      isAnonymous: true,
      status: 'published',
      publishedAt: new Date('2026-09-05T08:00:00.000Z'),
      createdByUserId: ID.userHrAdmin,
    },
    update: { status: 'published' },
  });

  await prisma.engagementSurveyQuestion.upsert({
    where: { id: ID.engagementEnpsQuestion },
    create: {
      id: ID.engagementEnpsQuestion,
      surveyId: ID.engagementEnpsSurvey,
      sortOrder: 0,
      questionType: 'enps',
      prompt: 'On a scale of 0–10, how likely are you to recommend Demo Corp as a place to work?',
      isRequired: true,
    },
    update: {},
  });

  await prisma.engagementSurvey.upsert({
    where: { id: ID.engagementPulseSurvey },
    create: {
      id: ID.engagementPulseSurvey,
      tenantId: ID.tenant,
      companyId: ID.company,
      title: 'Quarterly engagement pulse (draft)',
      description: 'Manager support and workload check-in.',
      surveyType: 'pulse',
      isAnonymous: true,
      status: 'draft',
      createdByUserId: ID.userHrAdmin,
    },
    update: {},
  });

  await prisma.engagementSurveyQuestion.upsert({
    where: { id: ID.engagementPulseQuestion },
    create: {
      id: ID.engagementPulseQuestion,
      surveyId: ID.engagementPulseSurvey,
      sortOrder: 0,
      questionType: 'rating',
      prompt: 'How satisfied are you with your experience at the company?',
      isRequired: true,
    },
    update: {},
  });

  await prisma.employeeKudos.upsert({
    where: { id: ID.engagementKudosManager },
    create: {
      id: ID.engagementKudosManager,
      tenantId: ID.tenant,
      companyId: ID.company,
      fromEmployeeId: ID.empManager,
      toEmployeeId: ID.empStaff,
      kudosType: 'manager',
      message:
        'Outstanding collaboration on the Q3 client deliverable — your attention to detail made the difference.',
      createdByUserId: ID.userManager,
    },
    update: {},
  });

  await prisma.workplaceIncident.upsert({
    where: { id: ID.safetyIncidentNearMiss },
    create: {
      id: ID.safetyIncidentNearMiss,
      tenantId: ID.tenant,
      companyId: ID.company,
      incidentNumber: 'WSH-2026-001',
      incidentType: 'near_miss',
      severity: 'medium',
      status: 'under_investigation',
      location: 'Warehouse · Bay 3',
      occurredAt: new Date('2026-08-24T14:35:00.000Z'),
      description:
        'Pallet shifted while being lifted; area was isolated immediately.',
      reportedByEmployeeId: ID.empStaff,
      regulatorReportRequired: false,
      createdByUserId: ID.userStaff,
    },
    update: { status: 'under_investigation' },
  });

  await prisma.safetyComplianceRecord.upsert({
    where: {
      companyId_requirementKey_scopeKey: {
        companyId: ID.company,
        requirementKey: 'safety_induction',
        scopeKey: 'company',
      },
    },
    create: {
      id: ID.safetyComplianceInduction,
      tenantId: ID.tenant,
      companyId: ID.company,
      requirementKey: 'safety_induction',
      title: 'Mandatory safety induction',
      description: 'Annual workplace safety induction for all staff',
      requirementType: 'training',
      status: 'compliant',
      dueDate: new Date('2026-12-31'),
      completedAt: new Date('2026-01-15'),
      scopeKey: 'company',
      sourceRuleType: 'health_safety',
      metadata: {},
    },
    update: { status: 'compliant' },
  });

  await prisma.contractor.upsert({
    where: { id: ID.contractorClearPath },
    create: {
      id: ID.contractorClearPath,
      tenantId: ID.tenant,
      companyId: ID.company,
      contractorNumber: 'VEN-2026-001',
      legalName: 'ClearPath Consulting Pty Ltd',
      displayName: 'ClearPath Consulting',
      contractorKind: 'consultant',
      category: 'Professional Services',
      contactName: 'Marcus Lee',
      email: 'marcus@clearpath.co',
      phone: '+61 2 5550 0172',
      location: 'Sydney, NSW',
      status: 'active',
      ownerEmployeeId: ID.empHrAdmin,
      createdByUserId: ID.userHrAdmin,
    },
    update: { status: 'active' },
  });

  await prisma.contractorContract.upsert({
    where: { id: ID.contractorContractClearPath },
    create: {
      id: ID.contractorContractClearPath,
      tenantId: ID.tenant,
      companyId: ID.company,
      contractorId: ID.contractorClearPath,
      contractNumber: 'CTR-2026-001',
      title: 'Organizational design advisory',
      scopeDescription:
        'Organizational design and change advisory. Includes monthly service reporting and quarterly business reviews.',
      status: 'active',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      annualValue: 120000,
      fixedFeeAmount: 120000,
      currency: 'AUD',
      paymentStructure: 'milestone',
      paymentTerms: 'net_30',
      billingFrequency: 'milestone',
      autoRenewal: false,
      noticePeriodDays: 60,
      ownerEmployeeId: ID.empHrAdmin,
      createdByUserId: ID.userHrAdmin,
    },
    update: {
      status: 'active',
      paymentStructure: 'milestone',
      fixedFeeAmount: 120000,
      billingFrequency: 'milestone',
    },
  });

  await prisma.contractorContractMilestone.upsert({
    where: { id: ID.contractorMilestoneClearPath1 },
    create: {
      id: ID.contractorMilestoneClearPath1,
      tenantId: ID.tenant,
      companyId: ID.company,
      contractId: ID.contractorContractClearPath,
      title: 'Discovery & assessment',
      amount: 40000,
      targetDate: new Date('2026-06-30'),
      sortOrder: 0,
      status: 'paid',
    },
    update: { status: 'paid' },
  });

  await prisma.contractorContractMilestone.upsert({
    where: { id: ID.contractorMilestoneClearPath2 },
    create: {
      id: ID.contractorMilestoneClearPath2,
      tenantId: ID.tenant,
      companyId: ID.company,
      contractId: ID.contractorContractClearPath,
      title: 'Implementation phase',
      amount: 80000,
      targetDate: new Date('2027-03-31'),
      sortOrder: 1,
      status: 'pending',
    },
    update: {},
  });

  await prisma.contractorInvoice.upsert({
    where: { id: ID.contractorInvoiceClearPathPaid },
    create: {
      id: ID.contractorInvoiceClearPathPaid,
      tenantId: ID.tenant,
      companyId: ID.company,
      contractorId: ID.contractorClearPath,
      contractId: ID.contractorContractClearPath,
      milestoneId: ID.contractorMilestoneClearPath1,
      invoiceNumber: 'CINV-2026-001',
      periodLabel: 'Milestone 1 — Discovery',
      description: 'Discovery & assessment milestone',
      lineItems: [
        {
          description: 'Discovery & assessment milestone',
          amount: '40000.00',
        },
      ],
      amount: 40000,
      currency: 'AUD',
      issuedAt: new Date('2026-07-18'),
      dueAt: new Date('2026-08-17'),
      status: 'paid',
      paidAt: new Date('2026-08-15'),
      paymentReference: 'EFT-20260815-001',
      approvedByUserId: ID.userPayrollAdmin,
      createdByUserId: ID.userHrAdmin,
    },
    update: { status: 'paid' },
  });

  await prisma.contractorInvoice.upsert({
    where: { id: ID.contractorInvoiceClearPathApproved },
    create: {
      id: ID.contractorInvoiceClearPathApproved,
      tenantId: ID.tenant,
      companyId: ID.company,
      contractorId: ID.contractorClearPath,
      contractId: ID.contractorContractClearPath,
      invoiceNumber: 'CINV-2026-002',
      periodLabel: 'August 2026',
      description: 'Monthly advisory retainer',
      lineItems: [
        {
          description: 'Organizational design advisory — August 2026',
          amount: '10000.00',
        },
      ],
      amount: 10000,
      currency: 'AUD',
      issuedAt: new Date('2026-08-18'),
      dueAt: new Date('2026-09-17'),
      status: 'approved',
      approvedByUserId: ID.userPayrollAdmin,
      createdByUserId: ID.userHrAdmin,
    },
    update: { status: 'approved' },
  });

  await prisma.contractor.upsert({
    where: { id: ID.contractorApex },
    create: {
      id: ID.contractorApex,
      tenantId: ID.tenant,
      companyId: ID.company,
      contractorNumber: 'VEN-2026-002',
      legalName: 'Apex Facilities Group',
      displayName: 'Apex Facilities Group',
      contractorKind: 'vendor',
      category: 'Facilities',
      contactName: 'Sofia Martinez',
      email: 'sofia@apexfacilities.com',
      phone: '+61 2 5550 0194',
      location: 'Melbourne, VIC',
      status: 'active',
      ownerEmployeeId: ID.empManager,
      createdByUserId: ID.userHrAdmin,
    },
    update: { status: 'active' },
  });

  await prisma.contractorContract.upsert({
    where: { id: ID.contractorContractApex },
    create: {
      id: ID.contractorContractApex,
      tenantId: ID.tenant,
      companyId: ID.company,
      contractorId: ID.contractorApex,
      contractNumber: 'CTR-2026-002',
      title: 'Office maintenance and facilities response',
      scopeDescription: 'Office maintenance, cleaning, and facilities response SLA.',
      status: 'active',
      startDate: new Date('2025-09-15'),
      endDate: new Date('2026-09-14'),
      annualValue: 86400,
      hourlyRate: 95,
      currency: 'AUD',
      paymentStructure: 'hourly_invoice',
      paymentTerms: 'net_30',
      billingFrequency: 'monthly',
      autoRenewal: false,
      noticePeriodDays: 30,
      ownerEmployeeId: ID.empManager,
      createdByUserId: ID.userHrAdmin,
    },
    update: {
      status: 'active',
      paymentStructure: 'hourly_invoice',
      hourlyRate: 95,
    },
  });

  console.log('Seed complete.');
  console.log(`  Tenant:   ${tenant.name} (subdomain: demo)`);
  console.log(`  Company:  ${company.name}`);
  console.log(`  Country:  ${country.name} (${country.isoCode})`);
  console.log(`  Roles:    ${systemRoles.length} default roles with permissions`);
  console.log(`  Employees: ${employees.length} sample employees`);
  console.log('  Employees by role:');
  for (const emp of employees) {
    console.log(`    - ${emp.firstName} ${emp.lastName} (${emp.roleName})`);
  }
  console.log('  Demo logins (password for all):', DEMO_PASSWORD);
  for (const emp of employees) {
    console.log(`    - ${emp.email} (${emp.roleName})`);
  }
  console.log(`    - super@${SEED_EMAIL_DOMAIN} (Super Admin — platform, no tenant)`);
  console.log('  Example: POST /api/v1/auth/login');
  console.log(
    `    { "email": "${ROLE_SEED_EMAIL['Company Owner']}", "password": "${DEMO_PASSWORD}", "tenantSubdomain": "demo" }`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
