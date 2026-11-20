/**
 * Employee Panel Security Pass (Stages B-J)
 * 
 * Verifies that all Employee Self-Service (ESS) endpoints properly enforce
 * self-scoping and reject any attempt to read, write, update, or delete
 * another employee's records via:
 * 1. URL path parameter tampering (:employeeId, :id, etc.)
 * 2. Query parameter spoofing (?employeeId=...)
 * 3. Request payload tampering ({ employeeId: ..., requesterEmployeeId: ... })
 * 4. Cross-employee entity access (payslips, leave requests, documents, swaps, OT, claims, tickets, notifications)
 */

const http = require('http');

const API_BASE = 'http://localhost:3000/api/v1';

function apiRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const body = data ? JSON.stringify(data) : null;
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(resBody); } catch (_) { parsed = resBody; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login(email, password = 'password', tenantSubdomain = 'demo') {
  const res = await apiRequest('POST', '/auth/login', { email, password, tenantSubdomain });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.data.accessToken,
    user: res.body.data.user
  };
}

async function main() {
  console.log('='.repeat(78));
  console.log('EMPLOYEE PANEL SECURITY PASS: SELF-SCOPING AUDIT (STAGES B-J)');
  console.log('='.repeat(78));

  // 1. Authenticate users
  const admin = await login('admin@cmsnbd.com');
  const manager = await login('manager@cmsnbd.com');
  const employee = await login('employee@cmsnbd.com');

  const COMPANY_ID = '10000000-0000-4000-8000-000000000010';
  const SELF_EMP_ID = employee.user.employeeId;     // EMP-005 Jordan Lee (10000000-0000-4000-8000-000000000044)
  const SELF_USER_ID = employee.user.id;
  const OTHER_EMP_ID = manager.user.employeeId;    // EMP-004 Alex Thompson (10000000-0000-4000-8000-000000000043)
  const OTHER_USER_ID = manager.user.id;
  const ADMIN_EMP_ID = admin.user.employeeId;      // EMP-001 Sarah Chen (10000000-0000-4000-8000-000000000040)
  const ADMIN_USER_ID = admin.user.id;

  console.log(`\nAttacker / Caller: Employee ${employee.user.email} (EmpID: ${SELF_EMP_ID}) [Role: Employee, Scope: own]`);
  console.log(`Target 1 (Manager): Alex Thompson (EmpID: ${OTHER_EMP_ID}, UserID: ${OTHER_USER_ID})`);
  console.log(`Target 2 (Admin):   Sarah Chen (EmpID: ${ADMIN_EMP_ID}, UserID: ${ADMIN_USER_ID})`);

  const results = [];

  function record(stage, testName, passed, details, status, errorCode) {
    results.push({ stage, testName, passed, details, status, errorCode });
    const mark = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${mark}] ${stage} - ${testName} (Status: ${status}, Code: ${errorCode || 'N/A'})`);
    if (!passed) {
      console.error(`       Failure details: ${details}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Target IDs (Discovered / verified from live database)
  // ---------------------------------------------------------------------------
  console.log('\n--- Locating Target Real Entities in Live Environment ---');

  // Leave Type
  const leaveTypesRes = await apiRequest('GET', `/companies/${COMPANY_ID}/leave-types`, null, admin.token);
  const annualLeaveType = leaveTypesRes.body.data?.[0]?.id;

  // Document Type
  const docTypesRes = await apiRequest('GET', `/organization/companies/${COMPANY_ID}/document-types`, null, admin.token);
  const docTypeId = docTypesRes.body.data?.[0]?.id;

  // Expense Category
  const expCatRes = await apiRequest('GET', `/companies/${COMPANY_ID}/expense-categories`, null, admin.token);
  const expenseCategoryId = expCatRes.body.data?.[0]?.id;

  // Target Leave Request (Manager's)
  const mgrLeaves = await apiRequest('GET', `/companies/${COMPANY_ID}/leave-requests?employeeId=${OTHER_EMP_ID}`, null, admin.token);
  const targetLeaveReqId = mgrLeaves.body.data?.[0]?.id;
  console.log(`Target Leave Request ID:          ${targetLeaveReqId}`);

  // Target Payslip (Manager's)
  const mgrPayslips = await apiRequest('GET', `/employees/${OTHER_EMP_ID}/payslips`, null, admin.token);
  const targetPayslipId = mgrPayslips.body.data?.[0]?.id;
  console.log(`Target Payslip ID:                ${targetPayslipId}`);

  // Target Profile Update Request (Admin's)
  const adminProfReqs = await apiRequest('GET', `/employees/${ADMIN_EMP_ID}/profile-update-requests`, null, admin.token);
  const targetProfileReqId = adminProfReqs.body.data?.[0]?.id;
  console.log(`Target Profile Update Request ID: ${targetProfileReqId}`);

  // Target Employee Document (Manager's)
  const mgrDocs = await apiRequest('GET', `/employees/${OTHER_EMP_ID}/documents`, null, admin.token);
  const targetDocId = mgrDocs.body.data?.[0]?.id;
  console.log(`Target Document ID:               ${targetDocId}`);

  // Target Shift Swap Request (Admin's)
  const allSwaps = await apiRequest('GET', `/companies/${COMPANY_ID}/shift-swap-requests?employeeId=${ADMIN_EMP_ID}`, null, admin.token);
  const targetShiftSwapId = allSwaps.body.data?.[0]?.id;
  console.log(`Target Shift Swap Request ID:     ${targetShiftSwapId}`);

  // Target Overtime Request (Admin's)
  const allOts = await apiRequest('GET', `/companies/${COMPANY_ID}/overtime-requests?employeeId=${ADMIN_EMP_ID}`, null, admin.token);
  const targetOvertimeId = allOts.body.data?.[0]?.id;
  console.log(`Target Overtime Request ID:       ${targetOvertimeId}`);

  // Target Expense Claim & Receipt (Manager's)
  const mgrClaims = await apiRequest('GET', `/companies/${COMPANY_ID}/expense-claims?employeeId=${OTHER_EMP_ID}`, null, admin.token);
  const targetClaimId = mgrClaims.body.data?.[0]?.id;
  const targetReceiptId = mgrClaims.body.data?.[0]?.receipts?.[0]?.id;
  console.log(`Target Expense Claim ID:          ${targetClaimId}`);
  console.log(`Target Receipt ID:                ${targetReceiptId}`);

  // Target Support Ticket (Admin's confidential)
  const adminTickets = await apiRequest('GET', `/tenant/support/tickets`, null, admin.token);
  const targetTicketId = adminTickets.body.data?.find(t => t.requesterUserId === ADMIN_USER_ID)?.id;
  console.log(`Target Support Ticket ID:         ${targetTicketId}`);

  // Target In-App Notification (Manager's)
  const mgrNotifs = await apiRequest('GET', `/notifications`, null, manager.token);
  const targetNotifId = mgrNotifs.body.data?.[0]?.id;
  console.log(`Target In-App Notification ID:    ${targetNotifId}`);

  // ---------------------------------------------------------------------------
  // Stage B: Leave Management & Team Calendar
  // ---------------------------------------------------------------------------
  console.log('\n--- Stage B: Leave Management & Team Calendar ---');

  // B.1 Fetch leave balances of another employee
  {
    const res = await apiRequest('GET', `/employees/${OTHER_EMP_ID}/leave-balances`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage B', 'Read other employee leave balances (URL path tampering)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // B.2 Query leave requests with ?employeeId=OTHER_EMP_ID
  {
    const res = await apiRequest('GET', `/companies/${COMPANY_ID}/leave-requests?employeeId=${OTHER_EMP_ID}`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage B', 'Query leave requests filtered by other employeeId (query param spoofing)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // B.3 Query unfiltered leave requests list - must only return self records
  {
    const res = await apiRequest('GET', `/companies/${COMPANY_ID}/leave-requests`, null, employee.token);
    const foreignRows = (res.body.data || []).filter(r => r.employeeId !== SELF_EMP_ID);
    const passed = res.status === 200 && foreignRows.length === 0;
    record('Stage B', 'List leave requests unscoped query (must strictly return own requests only)', passed, `Found ${foreignRows.length} foreign rows`, res.status);
  }

  // B.4 Direct access to other employee leave request by ID
  if (targetLeaveReqId) {
    const res = await apiRequest('GET', `/leave-requests/${targetLeaveReqId}`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage B', 'Get other employee real leave request by ID (IDOR probe)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // B.5 Preview leave request for other employee
  {
    const res = await apiRequest('POST', `/employees/${OTHER_EMP_ID}/leave-requests/preview`, {
      leaveTypeId: annualLeaveType,
      startDate: '2026-12-05',
      endDate: '2026-12-06'
    }, employee.token);
    const passed = res.status === 403 && (res.body?.error?.code === 'FORBIDDEN' || res.body?.error?.code === 'OUT_OF_SCOPE');
    record('Stage B', 'Preview leave request on behalf of other employee', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // B.6 Create leave request for other employee
  {
    const res = await apiRequest('POST', `/employees/${OTHER_EMP_ID}/leave-requests`, {
      leaveTypeId: annualLeaveType,
      startDate: '2026-12-05',
      endDate: '2026-12-06',
      reason: 'Malicious leave submission'
    }, employee.token);
    const passed = res.status === 403 && (res.body?.error?.code === 'FORBIDDEN' || res.body?.error?.code === 'OUT_OF_SCOPE');
    record('Stage B', 'Create leave request on behalf of other employee', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // B.7 Submit other employee leave request
  if (targetLeaveReqId) {
    const res = await apiRequest('POST', `/leave-requests/${targetLeaveReqId}/submit`, null, employee.token);
    const passed = res.status === 403 && (res.body?.error?.code === 'FORBIDDEN' || res.body?.error?.code === 'OUT_OF_SCOPE');
    record('Stage B', 'Submit other employee leave request', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // B.8 Cancel other employee leave request
  if (targetLeaveReqId) {
    const res = await apiRequest('POST', `/leave-requests/${targetLeaveReqId}/cancel`, null, employee.token);
    const passed = res.status === 403 && (res.body?.error?.code === 'FORBIDDEN' || res.body?.error?.code === 'OUT_OF_SCOPE');
    record('Stage B', 'Cancel other employee leave request', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // B.9 Approve leave request (role privilege escalation attempt)
  if (targetLeaveReqId) {
    const res = await apiRequest('POST', `/leave-requests/${targetLeaveReqId}/approve`, {
      note: 'Self-approval attempt'
    }, employee.token);
    const passed = res.status === 403;
    record('Stage B', 'Approve leave request (role privilege bypass attempt)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // ---------------------------------------------------------------------------
  // Stage C: My Payslips
  // ---------------------------------------------------------------------------
  console.log('\n--- Stage C: My Payslips ---');

  // C.1 List payslips for other employee
  {
    const res = await apiRequest('GET', `/employees/${OTHER_EMP_ID}/payslips`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage C', 'List payslips for other employee (URL path tampering)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // C.2 Download payslip targeting other employee URL path
  if (targetPayslipId) {
    const res = await apiRequest('GET', `/employees/${OTHER_EMP_ID}/payslips/${targetPayslipId}/download`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage C', 'Download payslip via other employee URL path', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // C.3 Download foreign payslip under self employee URL path
  if (targetPayslipId) {
    const res = await apiRequest('GET', `/employees/${SELF_EMP_ID}/payslips/${targetPayslipId}/download`, null, employee.token);
    const passed = res.status === 404 && res.body?.error?.code === 'NOT_FOUND';
    record('Stage C', 'Download foreign payslip ID under own employee URL path (query-bound scoping)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // C.4 Access company-wide payslips list
  {
    const res = await apiRequest('GET', `/companies/${COMPANY_ID}/payslips`, null, employee.token);
    const passed = res.status === 403;
    record('Stage C', 'Access company-wide payslips list (payroll admin endpoint)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // ---------------------------------------------------------------------------
  // Stage D: My Profile
  // ---------------------------------------------------------------------------
  console.log('\n--- Stage D: My Profile ---');

  // D.1 Direct profile read for another employee
  {
    const res = await apiRequest('GET', `/employees/${OTHER_EMP_ID}`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage D', 'Fetch another employee profile by ID (URL path tampering)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // D.2 Direct admin profile update on another employee
  {
    const res = await apiRequest('PATCH', `/employees/${OTHER_EMP_ID}`, {
      firstName: 'Hacked'
    }, employee.token);
    const passed = res.status === 403;
    record('Stage D', 'Direct admin profile update on another employee (PATCH /employees/:id)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // D.3 Direct admin profile update on own record (must be closed to own-scope)
  {
    const res = await apiRequest('PATCH', `/employees/${SELF_EMP_ID}`, {
      designationId: '10000000-0000-4000-8000-000000000020'
    }, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OWN_SCOPE_FORBIDDEN';
    record('Stage D', 'Direct admin profile update on own record (must block designation self-edit)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // D.4 Self-profile update on another employee
  {
    const res = await apiRequest('PATCH', `/employees/${OTHER_EMP_ID}/self-profile`, {
      contact: { phone: '0412345678' }
    }, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage D', 'Self-profile update targeting another employee ID', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // D.5 List profile update requests of another employee
  {
    const res = await apiRequest('GET', `/employees/${OTHER_EMP_ID}/profile-update-requests`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage D', 'List profile update requests for another employee', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // D.6 Create profile update request for another employee
  {
    const res = await apiRequest('POST', `/employees/${OTHER_EMP_ID}/profile-update-requests`, {
      fieldKey: 'first_name',
      requestedValue: 'HackedName',
      reason: 'Malicious update request'
    }, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage D', 'Create profile update request on behalf of another employee', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // D.7 Cancel another employee profile update request
  if (targetProfileReqId) {
    const res = await apiRequest('POST', `/profile-update-requests/${targetProfileReqId}/cancel`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage D', 'Cancel another employee real profile update request', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // D.8 Approve profile update request (role escalation attempt)
  if (targetProfileReqId) {
    const res = await apiRequest('POST', `/profile-update-requests/${targetProfileReqId}/approve`, {
      comment: 'Self-approval attempt'
    }, employee.token);
    const passed = res.status === 403;
    record('Stage D', 'Approve profile update request (HR admin action)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // ---------------------------------------------------------------------------
  // Stage E: My Documents
  // ---------------------------------------------------------------------------
  console.log('\n--- Stage E: My Documents ---');

  // E.1 List documents of another employee
  {
    const res = await apiRequest('GET', `/employees/${OTHER_EMP_ID}/documents`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage E', 'List documents of another employee (URL path tampering)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // E.2 Get single document metadata of another employee
  if (targetDocId) {
    const res = await apiRequest('GET', `/employees/${OTHER_EMP_ID}/documents/${targetDocId}`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage E', 'Get document metadata of another employee', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // E.3 Get file URL of another employee document
  if (targetDocId) {
    const res = await apiRequest('GET', `/employees/${OTHER_EMP_ID}/documents/${targetDocId}/file-url`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage E', 'Get file download URL of another employee document', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // E.4 Download document of another employee
  if (targetDocId) {
    const res = await apiRequest('GET', `/employees/${OTHER_EMP_ID}/documents/${targetDocId}/download`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage E', 'Direct file download of another employee document', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // E.5 Create document for another employee
  {
    const res = await apiRequest('POST', `/employees/${OTHER_EMP_ID}/documents`, {
      documentTypeId: docTypeId || '10000000-0000-4000-8000-000000000150',
      expiryDate: '2030-01-01'
    }, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage E', 'Create document entry for another employee', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // E.6 Update document of another employee
  if (targetDocId) {
    const res = await apiRequest('PATCH', `/employees/${OTHER_EMP_ID}/documents/${targetDocId}`, {
      expiryDate: '2027-01-01'
    }, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage E', 'Update document metadata of another employee', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // E.7 Verify document (HR Admin privilege attempt)
  if (targetDocId) {
    const res = await apiRequest('POST', `/employees/${OTHER_EMP_ID}/documents/${targetDocId}/verify`, null, employee.token);
    const passed = res.status === 403;
    record('Stage E', 'Verify employee document (HR Admin action)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // E.8 Delete document (HR Admin privilege attempt)
  if (targetDocId) {
    const res = await apiRequest('DELETE', `/employees/${OTHER_EMP_ID}/documents/${targetDocId}`, null, employee.token);
    const passed = res.status === 403;
    record('Stage E', 'Delete employee document (HR Admin action)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // ---------------------------------------------------------------------------
  // Stage F: My Shift/Roster & Org Directory
  // ---------------------------------------------------------------------------
  console.log('\n--- Stage F: My Shift/Roster & Org Directory ---');

  // F.1 Query another employee roster via ?employeeId=OTHER_EMP_ID
  {
    const res = await apiRequest('GET', `/companies/${COMPANY_ID}/rosters?employeeId=${OTHER_EMP_ID}`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage F', 'Query roster shifts filtered by other employeeId (query param spoofing)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // F.2 Query unfiltered rosters list - must only return self shifts
  {
    const res = await apiRequest('GET', `/companies/${COMPANY_ID}/rosters`, null, employee.token);
    const foreignRows = (res.body.data || []).filter(r => r.employeeId !== SELF_EMP_ID);
    const passed = res.status === 200 && foreignRows.length === 0;
    record('Stage F', 'List roster shifts unscoped query (must strictly return own shifts only)', passed, `Found ${foreignRows.length} foreign rows`, res.status);
  }

  // F.3 Bulk assign shifts (manager/admin action)
  {
    const res = await apiRequest('POST', `/companies/${COMPANY_ID}/rosters/bulk`, {
      employeeIds: [SELF_EMP_ID],
      dates: ['2026-11-20'],
      shiftTypeId: '10000000-0000-4000-8000-000000000080'
    }, employee.token);
    const passed = res.status === 403;
    record('Stage F', 'Bulk assign roster shifts (admin/manager action)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // F.4 Org Directory data privacy check
  {
    const res = await apiRequest('GET', `/companies/${COMPANY_ID}/employee-directory`, null, employee.token);
    let leaksSensitiveField = false;
    let leakDetails = '';
    if (res.status === 200 && Array.isArray(res.body.data)) {
      for (const entry of res.body.data) {
        if ('salary' in entry || 'baseSalary' in entry || 'bankAccounts' in entry || 'taxNumber' in entry || 'ssn' in entry || 'personalInfo' in entry) {
          leaksSensitiveField = true;
          leakDetails = `Leaked sensitive field in entry ${entry.id}`;
          break;
        }
      }
    }
    const passed = res.status === 200 && !leaksSensitiveField && res.body.data.length > 0;
    record('Stage F', 'Org Directory sanitization (no salary, bank, tax, SSN)', passed, leakDetails, res.status);
  }

  // F.5 Org Directory across tenant companies
  {
    const foreignCompanyId = '00000000-0000-0000-0000-000000000000';
    const res = await apiRequest('GET', `/companies/${foreignCompanyId}/employee-directory`, null, employee.token);
    const passed = res.status === 403 || res.status === 404;
    record('Stage F', 'Org Directory for foreign company (cross-company block)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // ---------------------------------------------------------------------------
  // Stage G: Shift Swap Requests & Overtime Requests
  // ---------------------------------------------------------------------------
  console.log('\n--- Stage G: Shift Swap Requests & Overtime Requests ---');

  // G.1 List shift swaps filtered by another employee
  {
    const res = await apiRequest('GET', `/companies/${COMPANY_ID}/shift-swap-requests?employeeId=${OTHER_EMP_ID}`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage G', 'List shift swaps filtered by other employeeId', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // G.2 Create shift swap proposal spoofing requester employeeId
  {
    const res = await apiRequest('POST', `/employees/${OTHER_EMP_ID}/shift-swap-requests`, {
      targetEmployeeId: SELF_EMP_ID,
      swapDate: '2026-11-20',
      reason: 'Spoofed swap creation'
    }, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage G', 'Create shift swap spoofing requester employeeId', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // G.3 Cancel foreign shift swap request
  if (targetShiftSwapId) {
    const res = await apiRequest('POST', `/shift-swap-requests/${targetShiftSwapId}/cancel`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage G', 'Cancel foreign real shift swap request (requester ownership check)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // G.4 Approve shift swap request (manager action attempt)
  if (targetShiftSwapId) {
    const res = await apiRequest('POST', `/shift-swap-requests/${targetShiftSwapId}/approve`, {
      comment: 'Malicious approval'
    }, employee.token);
    const passed = res.status === 403;
    record('Stage G', 'Approve shift swap request (manager action)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // G.5 List overtime requests filtered by another employee
  {
    const res = await apiRequest('GET', `/companies/${COMPANY_ID}/overtime-requests?employeeId=${OTHER_EMP_ID}`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage G', 'List overtime requests filtered by other employeeId', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // G.6 Create overtime request spoofing employeeId
  {
    const res = await apiRequest('POST', `/employees/${OTHER_EMP_ID}/overtime-requests`, {
      date: '2026-11-20',
      hours: 2,
      rateType: 'weekday',
      reason: 'Spoofed OT request'
    }, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage G', 'Create overtime request spoofing employeeId', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // G.7 Cancel foreign overtime request
  if (targetOvertimeId) {
    const res = await apiRequest('POST', `/overtime-requests/${targetOvertimeId}/cancel`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage G', 'Cancel foreign real overtime request (requester ownership check)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // G.8 Approve overtime request (manager action attempt)
  if (targetOvertimeId) {
    const res = await apiRequest('POST', `/overtime-requests/${targetOvertimeId}/approve`, {
      comment: 'Malicious approval'
    }, employee.token);
    const passed = res.status === 403;
    record('Stage G', 'Approve overtime request (manager action)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // ---------------------------------------------------------------------------
  // Stage H: My Expenses
  // ---------------------------------------------------------------------------
  console.log('\n--- Stage H: My Expenses ---');

  // H.1 List expense claims filtered by another employee
  {
    const res = await apiRequest('GET', `/companies/${COMPANY_ID}/expense-claims?employeeId=${OTHER_EMP_ID}`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage H', 'List expense claims filtered by other employeeId (query param spoofing)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // H.2 Unscoped list of expense claims (must not leak other employees)
  {
    const res = await apiRequest('GET', `/companies/${COMPANY_ID}/expense-claims`, null, employee.token);
    const foreignRows = (res.body.data || []).filter(r => r.employeeId !== SELF_EMP_ID);
    const passed = res.status === 200 && foreignRows.length === 0;
    record('Stage H', 'List expense claims unscoped query (must strictly return own claims only)', passed, `Found ${foreignRows.length} foreign rows`, res.status);
  }

  // H.3 Get another employee expense claim by ID
  if (targetClaimId) {
    const res = await apiRequest('GET', `/expense-claims/${targetClaimId}`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage H', 'Get another employee real expense claim by ID', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // H.4 Create expense claim spoofing employeeId in payload
  {
    const res = await apiRequest('POST', `/companies/${COMPANY_ID}/expense-claims`, {
      employeeId: OTHER_EMP_ID,
      categoryId: expenseCategoryId || '10000000-0000-4000-8000-0000000000b1',
      amount: 120.00,
      currency: 'AUD',
      expenseDate: '2026-11-05',
      description: 'Spoofed claim submission'
    }, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage H', 'Create expense claim spoofing employeeId in body payload', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // H.5 Submit another employee expense claim
  if (targetClaimId) {
    const res = await apiRequest('POST', `/expense-claims/${targetClaimId}/submit`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage H', 'Submit another employee expense claim', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // H.6 Cancel another employee expense claim
  if (targetClaimId) {
    const res = await apiRequest('POST', `/expense-claims/${targetClaimId}/cancel`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage H', 'Cancel another employee expense claim', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // H.7 Access receipt of another employee claim
  if (targetClaimId && targetReceiptId) {
    const res = await apiRequest('GET', `/expense-claims/${targetClaimId}/receipts/${targetReceiptId}/file-url`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'OUT_OF_SCOPE';
    record('Stage H', 'Access receipt file URL of another employee claim', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // H.8 Approve expense claim (manager action attempt)
  if (targetClaimId) {
    const res = await apiRequest('POST', `/expense-claims/${targetClaimId}/approve`, {
      comment: 'Malicious approval'
    }, employee.token);
    const passed = res.status === 403;
    record('Stage H', 'Approve expense claim (manager action)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // H.9 Reimburse expense claim (payroll admin action attempt)
  if (targetClaimId) {
    const res = await apiRequest('POST', `/expense-claims/${targetClaimId}/reimburse`, null, employee.token);
    const passed = res.status === 403;
    record('Stage H', 'Mark expense claim reimbursed (payroll action)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // ---------------------------------------------------------------------------
  // Stage I: My Support Tickets & Knowledge Base
  // ---------------------------------------------------------------------------
  console.log('\n--- Stage I: My Support Tickets & Knowledge Base ---');

  // I.1 List support tickets (must only return own tickets)
  {
    const res = await apiRequest('GET', `/tenant/support/tickets`, null, employee.token);
    const foreignRows = (res.body.data || []).filter(t => t.requesterUserId !== SELF_USER_ID);
    const passed = res.status === 200 && foreignRows.length === 0;
    record('Stage I', 'List support tickets (must strictly return own tickets only)', passed, `Found ${foreignRows.length} foreign rows`, res.status);
  }

  // I.2 Get another user support ticket by ID
  if (targetTicketId) {
    const res = await apiRequest('GET', `/tenant/support/tickets/${targetTicketId}`, null, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage I', 'Get another user confidential support ticket by ID', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // I.3 Post message to another user support ticket
  if (targetTicketId) {
    const res = await apiRequest('POST', `/tenant/support/tickets/${targetTicketId}/messages`, {
      body: 'Malicious eavesdropping or message injection'
    }, employee.token);
    const passed = res.status === 403 && res.body?.error?.code === 'FORBIDDEN';
    record('Stage I', 'Post message to another user support ticket', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // I.4 Agent ticket queue access attempt
  {
    const res = await apiRequest('GET', `/tenant/support/queue`, null, employee.token);
    const passed = res.status === 403;
    record('Stage I', 'Access support agent queue (support staff endpoint)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // I.5 Update/close another user support ticket
  if (targetTicketId) {
    const res = await apiRequest('PATCH', `/tenant/support/tickets/${targetTicketId}`, {
      status: 'closed'
    }, employee.token);
    const passed = res.status === 403;
    record('Stage I', 'Update or close another user support ticket', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // ---------------------------------------------------------------------------
  // Stage J: Notification Center & Preferences
  // ---------------------------------------------------------------------------
  console.log('\n--- Stage J: Notification Center & Preferences ---');

  // J.1 List in-app notifications (must only return own notifications)
  {
    const res = await apiRequest('GET', `/notifications`, null, employee.token);
    const containsForeignNotif = targetNotifId ? (res.body.data || []).some(n => n.id === targetNotifId) : false;
    const passed = res.status === 200 && !containsForeignNotif && res.body.data.length > 0;
    record('Stage J', 'List in-app notifications (must not contain other users notifications)', passed, `Contains foreign notif: ${containsForeignNotif}`, res.status);
  }

  // J.2 Mark read another user notification
  if (targetNotifId) {
    const res = await apiRequest('PATCH', `/notifications/${targetNotifId}/read`, null, employee.token);
    const passed = res.status === 404 && res.body?.error?.code === 'NOT_FOUND';
    record('Stage J', 'Mark read another user notification (safe 404 scoping)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // J.3 Delete another user notification
  if (targetNotifId) {
    const res = await apiRequest('DELETE', `/notifications/${targetNotifId}`, null, employee.token);
    const passed = res.status === 404 && res.body?.error?.code === 'NOT_FOUND';
    record('Stage J', 'Delete another user notification (safe 404 scoping)', passed, res.body?.error?.message, res.status, res.body?.error?.code);
  }

  // J.4 Read preferences (verified scoped to caller)
  {
    const res = await apiRequest('GET', `/notifications/preferences`, null, employee.token);
    const passed = res.status === 200 && res.body.data && Array.isArray(res.body.data.categories);
    record('Stage J', 'Read notification preferences (returns own preferences)', passed, 'Valid categories', res.status);
  }

  // J.5 Update preferences - attempt to pass foreign userId in payload (mass assignment / param tampering)
  {
    const tamperRes = await apiRequest('PUT', `/notifications/preferences`, {
      userId: OTHER_USER_ID, // Maliciously spoofed foreign user ID
      preferences: [
        { category: 'leave_attendance', inApp: true, email: false, push: false }
      ]
    }, employee.token);
    // Server must reject unauthorized property injection (strict whitelist)
    const injectionBlocked = tamperRes.status === 400 && tamperRes.body?.error?.code === 'VALIDATION_ERROR';

    // Next, send valid payload and confirm foreign user preferences are never modified
    const validUpdateRes = await apiRequest('PUT', `/notifications/preferences`, {
      preferences: [
        { category: 'leave_attendance', inApp: true, email: false, push: false }
      ]
    }, employee.token);
    const selfUpdated = validUpdateRes.status === 200;

    // Check that Manager's preferences were NOT modified
    const mgrPrefCheck = await apiRequest('GET', `/notifications/preferences`, null, manager.token);
    const mgrLeavePref = mgrPrefCheck.body.data?.categories?.find(c => c.category === 'leave_attendance');
    const managerNotTouched = mgrLeavePref ? mgrLeavePref.email === true && mgrLeavePref.inApp === true : true;

    const finalPassed = injectionBlocked && selfUpdated && managerNotTouched;
    record('Stage J', 'Update preferences with spoofed foreign userId (rejected by whitelist & strictly scoped by session)', finalPassed, `injectionBlocked: ${injectionBlocked}, selfUpdated: ${selfUpdated}, managerUntouched: ${managerNotTouched}`, validUpdateRes.status);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n' + '='.repeat(78));
  console.log('SECURITY PASS AUDIT SUMMARY');
  console.log('='.repeat(78));
  const total = results.length;
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = total - passedCount;
  console.log(`Total Security Probes: ${total}`);
  console.log(`Passed (Blocked):     ${passedCount}`);
  console.log(`Failed (Vulnerable):  ${failedCount}`);

  if (failedCount > 0) {
    console.error('\nCRITICAL: One or more self-scoping probes failed!');
    process.exit(1);
  } else {
    console.log('\nSUCCESS: 100% of horizontal self-scoping attacks were correctly rejected by the server.');
  }
}

main().catch(err => {
  console.error('Fatal error during security pass:', err);
  process.exit(1);
});
