import { AccountingController } from '../accounting/accounting.controller';
import {
  AttendanceController,
  AttendanceCorrectionController,
  CompanyAttendanceController,
} from '../attendance/attendance.controller';
import { AuthController } from '../auth/auth.controller';
import { DashboardController } from '../dashboard/dashboard.controller';
import { DocumentTypesController } from '../documents/document-types.controller';
import { EmployeeDocumentsController } from '../documents/employee-documents.controller';
import { EmployeeDirectoryController, EmployeesController } from '../employees/employees.controller';
import { ProfileUpdateRequestsController } from '../employees/profile-update-requests.controller';
import { EngagementController } from '../engagement/engagement.controller';
import { ExpensesController } from '../expenses/expenses.controller';
import { HealthSafetyController } from '../health-safety/health-safety.controller';
import {
  LeaveBalancesController,
  LeaveRequestsController,
  LeaveTypesController,
} from '../leave/leave.controller';
import { NotificationsController } from '../notifications/notifications.controller';
import { OrganizationController } from '../organization/organization.controller';
import { PayslipsController } from '../payroll/payslips.controller';
import { RosterRequestsController } from '../roster/roster-requests.controller';
import { RostersController } from '../roster/rosters.controller';
import { SupportController } from '../support/support.controller';
import { AttendanceSyncController, TimesheetSyncController } from '../sync/sync.controller';
import { TimesheetsController } from '../timesheets/timesheets.controller';
import { SELF_SERVICE_KEY } from './require-permission.decorator';

type ControllerClass = { prototype: object; name: string };

function isSelfService(controller: ControllerClass, handler: string): boolean {
  const method = (controller.prototype as Record<string, unknown>)[handler];
  if (typeof method !== 'function') throw new Error(`${controller.name}.${handler} does not exist`);
  return (
    Reflect.getMetadata(SELF_SERVICE_KEY, method) === true ||
    Reflect.getMetadata(SELF_SERVICE_KEY, controller) === true
  );
}

/**
 * Endpoints the My Space pages (apps/admin/src/pages/my) and the mobile app call for
 * `own`-scoped users. Dropping `@SelfService()` from any of them locks employees out.
 */
const SELF_SERVICE_ENDPOINTS: Array<[ControllerClass, string[]]> = [
  [
    AuthController,
    ['listTenants', 'switchTenant', 'listSessions', 'revokeSession', 'logout', 'logoutAll', 'changePassword'],
  ],
  [
    EmployeesController,
    ['findOne', 'listEmployees', 'updateSelfProfile', 'listProfileUpdateRequests', 'createProfileUpdateRequest'],
  ],
  [DocumentTypesController, ['list', 'getOne']],
  [
    EmployeeDocumentsController,
    ['list', 'getOne', 'getFileUrl', 'downloadFile', 'create', 'uploadFile', 'update'],
  ],
  [ProfileUpdateRequestsController, ['cancelProfileUpdateRequest']],
  [EmployeeDirectoryController, ['list']],
  [DashboardController, ['getEmployeeDashboard']],
  [
    AttendanceController,
    [
      'getToday',
      'getHistory',
      'clockIn',
      'clockOut',
      'breakStart',
      'breakEnd',
      'getCorrections',
      'submitCorrection',
    ],
  ],
  [AttendanceSyncController, ['syncAttendance']],
  [TimesheetSyncController, ['syncTimesheet']],
  [
    TimesheetsController,
    ['listProjects', 'listEntries', 'getApprovalRoute', 'createEntry', 'submitEntry'],
  ],
  [LeaveTypesController, ['list']],
  [LeaveBalancesController, ['listForEmployee']],
  [LeaveRequestsController, ['list', 'get', 'preview', 'create', 'submit', 'cancel']],
  [RostersController, ['list']],
  [
    RosterRequestsController,
    [
      'getShiftSwapApprovalRoute',
      'listShiftSwaps',
      'createShiftSwap',
      'cancelShiftSwap',
      'getOvertimeApprovalRoute',
      'listOvertimeRequests',
      'createOvertimeRequest',
      'cancelOvertimeRequest',
    ],
  ],
  [PayslipsController, ['listForEmployee', 'downloadPayslip']],
  [
    ExpensesController,
    [
      'listCategories',
      'previewApprovalRoute',
      'listClaims',
      'getClaim',
      'createClaim',
      'submitClaim',
      'cancelClaim',
      'uploadReceipt',
      'getReceiptFileUrl',
      'downloadReceipt',
    ],
  ],
  [
    NotificationsController,
    [
      'list',
      'markRead',
      'registerPushToken',
      'unregisterPushToken',
      'getPreferences',
      'updatePreferences',
      'markAllRead',
      'clearAllRead',
      'deleteNotification',
    ],
  ],
  [
    EngagementController,
    ['listKudos', 'getSurveyForEmployee', 'submitSurveyResponse', 'createKudosAsEmployee'],
  ],
  [HealthSafetyController, ['listIncidents', 'getIncident', 'createIncidentAsEmployee']],
  [OrganizationController, ['listCompanies']],
  [
    SupportController,
    ['listCategories', 'listArticles', 'getArticle', 'listTickets', 'getTicket', 'createTicket', 'addMessage'],
  ],
];

describe('Self-service endpoint allow-list', () => {
  for (const [controller, handlers] of SELF_SERVICE_ENDPOINTS) {
    it.each(handlers)(`${controller.name}.%s is open to own-scoped roles`, (handler) => {
      expect(isSelfService(controller, handler)).toBe(true);
    });
  }

  const closed: Array<[ControllerClass, string]> = [
    [EmployeesController, 'update'],
    [EmployeesController, 'create'],
    [LeaveRequestsController, 'approve'],
    [DashboardController, 'getAdminDashboard'],
    [PayslipsController, 'listForCompany'],
    [AccountingController, 'listGlAccounts'],
    [HealthSafetyController, 'updateIncident'],
    [SupportController, 'updateTicket'],
    [AttendanceController, 'correctAttendance'],
    [CompanyAttendanceController, 'listCompanyCorrections'],
    [AttendanceCorrectionController, 'approveCorrection'],
    [AttendanceCorrectionController, 'rejectCorrection'],
    [TimesheetsController, 'createProject'],
    [TimesheetsController, 'listApprovals'],
    [TimesheetsController, 'bulkAction'],
    [TimesheetsController, 'approveEntry'],
    [TimesheetsController, 'rejectEntry'],
    [EngagementController, 'listKudosModeration'],
    [EngagementController, 'removeKudos'],
    [EngagementController, 'deleteKudos'],
    [EngagementController, 'restoreKudos'],
    [ProfileUpdateRequestsController, 'listCompanyProfileUpdateRequests'],
    [ProfileUpdateRequestsController, 'approveProfileUpdateRequest'],
    [ProfileUpdateRequestsController, 'rejectProfileUpdateRequest'],
    [EmployeeDocumentsController, 'verify'],
    [EmployeeDocumentsController, 'remove'],
    [RosterRequestsController, 'approveShiftSwap'],
    [RosterRequestsController, 'rejectShiftSwap'],
    [RosterRequestsController, 'approveOvertimeRequest'],
    [RosterRequestsController, 'rejectOvertimeRequest'],
    [ExpensesController, 'createCategory'],
    [ExpensesController, 'updateCategory'],
    [ExpensesController, 'approveClaim'],
    [ExpensesController, 'rejectClaim'],
    [ExpensesController, 'reimburseClaim'],
  ];
  it.each(closed.map(([controller, handler]) => [controller.name, handler, controller] as const))(
    '%s.%s stays closed to own-scoped roles',
    (_name, handler, controller) => {
      expect(isSelfService(controller, handler)).toBe(false);
    },
  );
});
