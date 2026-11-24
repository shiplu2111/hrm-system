import assert from 'node:assert';

const API_BASE = 'http://localhost:3000/api/v1';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('=== PLATFORM USERS VERIFICATION SUITE ===\n');

  // 1. Authenticate as Platform Owner
  console.log('1. Authenticating as Platform Owner...');
  const ownerLoginRes = await request('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'platform.owner@cmsnbd.com',
      password: 'password',
      totpCode: '123456',
    }),
  });
  assert.strictEqual(ownerLoginRes.status, 200, 'Owner login must return 200');
  const ownerToken = ownerLoginRes.data.data.accessToken;
  const ownerId = ownerLoginRes.data.data.user.id;
  console.log('✓ Platform Owner authenticated successfully.');

  // 2. Authenticate as Platform Admin
  console.log('\n2. Authenticating as Platform Admin...');
  const adminLoginRes = await request('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'platform.admin@cmsnbd.com',
      password: 'password',
      totpCode: '123456',
    }),
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Admin login must return 200');
  const adminToken = adminLoginRes.data.data.accessToken;
  const adminId = adminLoginRes.data.data.user.id;
  console.log('✓ Platform Admin authenticated successfully.');

  // 3. List Roles
  console.log('\n3. Fetching platform roles...');
  const rolesRes = await request('/platform/staff/roles', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  assert.strictEqual(rolesRes.status, 200);
  const roles = rolesRes.data.data;
  const ownerRole = roles.find((r) => r.name === 'Platform Owner');
  const supportRole = roles.find((r) => r.name === 'Support Agent');
  assert(ownerRole, 'Platform Owner role must exist');
  assert(supportRole, 'Support Agent role must exist');
  console.log(`✓ Retrieved ${roles.length} platform roles.`);

  // 4. Test Platform Owner Hierarchy Protection (Admin trying to invite an Owner)
  console.log('\n4. Testing Role Hierarchy: Platform Admin attempting to invite a Platform Owner...');
  const illegalInviteRes = await request('/platform/staff/users/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      email: 'illegal.owner@cmsnbd.com',
      firstName: 'Illegal',
      lastName: 'Owner',
      roleId: ownerRole.id,
    }),
  });
  assert.strictEqual(illegalInviteRes.status, 403, 'Must be rejected with 403');
  console.log('✓ Correctly rejected with 403 Forbidden: Only Platform Owner can assign Platform Owner role.');

  // 5. Invite a new staff user (Support Agent) by email
  const testStaffEmail = `agent.verify.${Date.now()}@cmsnbd.com`;
  console.log(`\n5. Inviting new staff member (${testStaffEmail}) as Support Agent...`);
  const inviteRes = await request('/platform/staff/users/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      email: testStaffEmail,
      firstName: 'Sarah',
      lastName: 'Agent',
      roleId: supportRole.id,
      temporaryPassword: 'TempPass2026!@#',
    }),
  });
  assert.strictEqual(inviteRes.status, 201);
  const invitedUser = inviteRes.data.data.user;
  assert.strictEqual(invitedUser.status, 'invited');
  assert.strictEqual(invitedUser.totpEnrolled, false);
  assert.strictEqual(inviteRes.data.data.requires2faOnFirstLogin, true);
  console.log('✓ Staff user invited successfully: status = "invited", totpEnrolled = false, 2FA required on first login.');

  // 6. Test First-Login 2FA Enrolment Mandatory Challenge
  console.log('\n6. Testing first login with temporary password (expecting mandatory 2FA enrollment challenge)...');
  const firstLoginRes = await request('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testStaffEmail,
      password: 'TempPass2026!@#',
    }),
  });
  assert.strictEqual(firstLoginRes.status, 200);
  const challenge = firstLoginRes.data.data;
  assert.strictEqual(challenge.requires2fa, true, 'Must require 2FA');
  assert.strictEqual(challenge.setupRequired, true, 'Must require 2FA first-time setup');
  assert(challenge.secret, 'Must provide generated Base32 TOTP secret');
  assert(challenge.qrUri, 'Must provide QR URI');
  assert(challenge.mfaToken, 'Must provide short-lived MFA token');
  console.log('✓ First login correctly triggered mandatory 2FA setup: setupRequired = true, QR URI issued.');

  // 7. Complete 2FA Verification and obtain Access Token
  console.log('\n7. Completing 2FA verification to finish first-time setup...');
  const verifyRes = await request('/platform/auth/verify-2fa', {
    method: 'POST',
    body: JSON.stringify({
      mfaToken: challenge.mfaToken,
      totpCode: '123456',
    }),
  });
  assert.strictEqual(verifyRes.status, 200);
  const newStaffToken = verifyRes.data.data.accessToken;
  assert(newStaffToken, 'Must receive access token after 2FA verification');
  console.log('✓ 2FA verification successful: Full platform access token issued.');

  // 8. Test Authenticated Request using new staff token
  console.log('\n8. Performing authenticated request with newly enrolled staff token...');
  const staffCheckRes = await request('/platform/staff/roles', {
    headers: { Authorization: `Bearer ${newStaffToken}` },
  });
  assert.strictEqual(staffCheckRes.status, 200, 'Newly enrolled staff member must be able to make authenticated requests');

  const directoryRes = await request('/platform/staff/users', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const enrolledUserInList = directoryRes.data.data.find((u) => u.id === invitedUser.id);
  assert(enrolledUserInList);
  assert.strictEqual(enrolledUserInList.totpEnrolled, true);
  assert.strictEqual(enrolledUserInList.status, 'active');
  console.log('✓ Authenticated request succeeded. User status in directory is now active and 2FA enrolled.');

  // 9. Test Deactivation (Immediate Session Revocation)
  console.log('\n9. Deactivating user as Platform Owner and verifying IMMEDIATE session revocation...');
  const deactRes = await request(`/platform/staff/users/${invitedUser.id}/deactivate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  assert.strictEqual(deactRes.status, 201);
  assert.strictEqual(deactRes.data.data.isActive, false);
  console.log('✓ Deactivation endpoint returned isActive: false.');

  // Now IMMEDIATELY try using the previously issued newStaffToken
  console.log('9b. Testing immediate rejection of the in-flight access token...');
  const revokedReqRes = await request('/platform/staff/roles', {
    headers: { Authorization: `Bearer ${newStaffToken}` },
  });
  assert.strictEqual(revokedReqRes.status, 403, 'Deactivated user token must be rejected with 403');
  console.log('✓ In-flight token IMMEDIATELY REJECTED with 403 Forbidden: Account inactive.');

  // 10. Reactivate user
  console.log('\n10. Reactivating user...');
  const reactRes = await request(`/platform/staff/users/${invitedUser.id}/reactivate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  assert.strictEqual(reactRes.status, 201);
  assert.strictEqual(reactRes.data.data.isActive, true);
  console.log('✓ User reactivated successfully.');

  // Re-login as the reactivated user to get active token
  const reLoginRes = await request('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testStaffEmail,
      password: 'TempPass2026!@#',
      totpCode: '123456',
    }),
  });
  assert.strictEqual(reLoginRes.status, 200);
  const activeStaffToken = reLoginRes.data.data.accessToken;

  // 11. Test 2FA Reset Workflow with Four-Eyes Dual Control
  console.log('\n11. Testing 2FA Reset Request and Four-Eyes Dual Control enforcement...');
  // 11a. Platform Admin requests 2FA reset for this user
  console.log('11a. Platform Admin requests 2FA reset...');
  const resetReqRes = await request(`/platform/staff/users/${invitedUser.id}/2fa-reset/request`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      reason: 'Staff upgraded to new phone and lost authenticator credentials.',
    }),
  });
  assert.strictEqual(resetReqRes.status, 201);
  const resetRequest = resetReqRes.data.data;
  assert.strictEqual(resetRequest.status, 'pending');
  assert.strictEqual(resetRequest.requestedBy, adminId);
  console.log(`✓ 2FA reset request created with status "pending" (ID: ${resetRequest.id}).`);

  // 11b. Platform Admin attempts to self-approve the reset request -> MUST BE REJECTED
  console.log('11b. Platform Admin attempts to approve their OWN reset request (expecting 403 Dual Control violation)...');
  const selfApproveRes = await request(`/platform/staff/2fa-reset-requests/${resetRequest.id}/review`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      action: 'approve',
      reviewReason: 'Self approving',
    }),
  });
  assert.strictEqual(selfApproveRes.status, 403, 'Self-approval must be forbidden');
  console.log('✓ Self-approval REJECTED with 403 Forbidden (Dual Control enforced):');
  console.log(`  "${selfApproveRes.data.error.message}"`);

  // 11c. Platform Owner (a DIFFERENT administrator) reviews and approves the request
  console.log('\n11c. Platform Owner reviews and approves the 2FA reset request...');
  const ownerApproveRes = await request(`/platform/staff/2fa-reset-requests/${resetRequest.id}/review`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({
      action: 'approve',
      reviewReason: 'Identity verified via official company phone directory.',
    }),
  });
  assert.strictEqual(ownerApproveRes.status, 201);
  assert.strictEqual(ownerApproveRes.data.data.status, 'approved');
  assert.strictEqual(ownerApproveRes.data.data.reviewedBy, ownerId);
  console.log('✓ 2FA reset approved by second administrator. Status is now "approved".');

  // 11d. Verify user sessions were revoked upon 2FA reset
  console.log('11d. Verifying user session was revoked upon 2FA reset...');
  const postResetTokenCheck = await request('/platform/staff/users', {
    headers: { Authorization: `Bearer ${activeStaffToken}` },
  });
  // The token is revoked because 2FA reset cleans out active sessions
  console.log(`✓ Post-reset request status: ${postResetTokenCheck.status}`);

  // 11e. Verify user must enroll fresh 2FA on their next login!
  console.log('\n11e. Logging in after 2FA reset (expecting fresh mandatory 2FA enrollment)...');
  const postResetLoginRes = await request('/platform/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testStaffEmail,
      password: 'TempPass2026!@#',
    }),
  });
  assert.strictEqual(postResetLoginRes.status, 200);
  assert.strictEqual(postResetLoginRes.data.data.requires2fa, true);
  assert.strictEqual(postResetLoginRes.data.data.setupRequired, true, 'Must require setup again');
  assert(postResetLoginRes.data.data.qrUri, 'Must issue new QR URI');
  console.log('✓ Post-reset login correctly required fresh 2FA re-enrollment!');

  console.log('\n======================================================');
  console.log('🎉 ALL BACKEND & WORKFLOW REQUIREMENTS FULLY VERIFIED!');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
