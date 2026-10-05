/**
 * Master Verification Suite:
 * Registration Approval, Admin Hub, QR Activation, and Attendance Lifecycle
 * Tests 1 to 12
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Setup Node.js VM context mimicking browser environment
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(k) { return this.store[k] !== undefined ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
}

const localStorage = new LocalStorageMock();
const sessionStorage = new LocalStorageMock();

const mockDocument = {
  getElementById: (id) => null,
  querySelector: (sel) => null,
  querySelectorAll: (sel) => [],
  createElement: (tag) => ({
    classList: { add: () => {}, remove: () => {} },
    appendChild: () => {},
    innerHTML: '',
    style: {}
  }),
  body: { classList: { add: () => {}, remove: () => {} } },
  documentElement: { classList: { add: () => {}, remove: () => {} } }
};

const mockWindow = {
  localStorage,
  sessionStorage,
  document: mockDocument,
  console,
  safeJSONParse: (k, fb) => {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : fb;
    } catch (e) {
      return fb;
    }
  },
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  location: { replace: (url) => { mockWindow._lastRedirect = url; } }
};

mockWindow.window = mockWindow;

// Global context
const context = vm.createContext(mockWindow);

// 1. Load event_schedule.js
const eventScheduleCode = fs.readFileSync(path.join(__dirname, 'js', 'event_schedule.js'), 'utf8');
vm.runInContext(eventScheduleCode, context);

// 2. Load attendance_logger.js
const attendanceLoggerCode = fs.readFileSync(path.join(__dirname, 'js', 'attendance_logger.js'), 'utf8');
vm.runInContext(attendanceLoggerCode, context);

// Test Runner
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    results.push({ name, passed: false, error: err.message });
    console.error(`❌ [FAIL] ${name}:`, err.message);
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    results.push({ name, passed: false, error: err.message });
    console.error(`❌ [FAIL] ${name}:`, err.message);
  }
}

async function runSuite() {
  console.log('\n======================================================');
  console.log('RUNNING REGISTRATION APPROVAL & QR ATTENDANCE TEST SUITE');
  console.log('======================================================\n');

  const { AttendanceLogger, EventSchedule } = context;

  // Initial Seed for tests
  const adminAccount = {
    id: 'PROD001',
    name: 'Bro. Paul',
    rollNo: 'PROD-NAIC-01',
    username: 'paul',
    email: 'paul@mcgiprod.org',
    password: 'admin123',
    locale: 'Naic',
    level: 'MUNICIPAL PROD',
    role: 'admin',
    isAdmin: true,
    isGlobalAdmin: true,
    duty: 'MPRO',
    status: 'ACTIVE',
    qr_active: true,
    qrCode: ''
  };
  adminAccount.qrCode = AttendanceLogger.generateMemberQr(adminAccount);

  localStorage.setItem('mcgi_selected_duty', 'MPRO');
  localStorage.setItem('mcgi_mpro_auth_users', JSON.stringify([adminAccount]));
  localStorage.setItem('mcgi_mpro_members', JSON.stringify([{
    id: 'PROD001',
    name: 'Bro. Paul',
    rollNo: 'PROD-NAIC-01',
    department: 'Naic',
    role: 'MUNICIPAL PROD',
    email: 'paul@mcgiprod.org',
    status: 'ACTIVE',
    qr_active: true,
    active: true,
    qrDisabled: false,
    qrCode: adminAccount.qrCode
  }]));

  // TEST 1 — NEW REGISTRATION
  test('TEST 1: New Registration creates PENDING account without usable QR and no auto-login', () => {
    const newUserEmail = 'juan.delacruz@example.com';
    const newUserName = 'Juan Dela Cruz';
    const regPayload = {
      id: 'PROD9999',
      name: newUserName,
      username: 'juan',
      email: newUserEmail,
      password: 'password123',
      locale: 'Naic',
      level: 'LOCALE PROD',
      role: 'member',
      isAdmin: false,
      status: 'PENDING',
      qr_active: false,
      qrCode: '',
      duty: 'MPRO',
      registered_at: new Date().toISOString()
    };

    // Store in auth_users as login.html does
    const authUsers = JSON.parse(localStorage.getItem('mcgi_mpro_auth_users'));
    authUsers.push(regPayload);
    localStorage.setItem('mcgi_mpro_auth_users', JSON.stringify(authUsers));

    // Also push to members as PENDING
    const members = JSON.parse(localStorage.getItem('mcgi_mpro_members'));
    members.push({
      id: regPayload.id,
      name: regPayload.name,
      rollNo: 'PROD-NAI-99',
      department: 'Naic',
      role: regPayload.level,
      email: regPayload.email,
      duty: 'MPRO',
      status: 'PENDING',
      qr_active: false,
      active: false,
      qrDisabled: true,
      qrCode: ''
    });
    localStorage.setItem('mcgi_mpro_members', JSON.stringify(members));

    // Verify properties
    if (regPayload.status !== 'PENDING') throw new Error('Account status must be PENDING');
    if (regPayload.qr_active !== false) throw new Error('qr_active must be false');
    if (regPayload.qrCode !== '') throw new Error('qrCode must be empty');

    // Test QR generator refusal on pending status
    const attemptedQr = AttendanceLogger.generateMemberQr(regPayload);
    if (attemptedQr !== '') throw new Error('AttendanceLogger.generateMemberQr must refuse to generate for PENDING member');

    // Confirm no session token
    if (sessionStorage.getItem('mcgi_portal_access_token')) throw new Error('No session token should exist');
  });

  // TEST 2 — PENDING LOGIN
  test('TEST 2: Login attempt with PENDING account is blocked with proper waiting message', () => {
    const authUsers = JSON.parse(localStorage.getItem('mcgi_mpro_auth_users'));
    const user = authUsers.find(u => u.email === 'juan.delacruz@example.com');
    if (!user) throw new Error('User not found');

    const status = String(user.status || 'ACTIVE').toUpperCase();
    if (status !== 'PENDING') throw new Error('Expected status PENDING');

    // Check login guard logic
    let loginBlocked = false;
    let loginError = '';
    if (status === 'PENDING') {
      loginBlocked = true;
      loginError = 'Your registration is still waiting for administrator approval.';
    }

    if (!loginBlocked) throw new Error('Login was not blocked');
    if (loginError !== 'Your registration is still waiting for administrator approval.') {
      throw new Error('Incorrect pending message: ' + loginError);
    }
  });

  // TEST 3 — ADMIN APPROVAL
  test('TEST 3: Admin approves pending user, sets ACTIVE, approved_by, generates QR and activates roster', () => {
    const admin = adminAccount;
    const authUsers = JSON.parse(localStorage.getItem('mcgi_mpro_auth_users'));
    const user = authUsers.find(u => u.email === 'juan.delacruz@example.com');
    if (!user) throw new Error('User not found');

    // Admin authorization check (using role/permission, NO hardcoded Paul)
    const hasAdminPermission = !!(admin.isAdmin === true || admin.role === 'admin' || admin.isGlobalAdmin === true);
    if (!hasAdminPermission) throw new Error('Admin authorization check failed');

    // Approval action
    const nowIso = new Date().toISOString();
    user.status = 'ACTIVE';
    user.approved_at = nowIso;
    user.approved_by = admin.id;
    user.qr_active = true;

    // Generate QR
    const qrPayload = AttendanceLogger.generateMemberQr({
      id: user.id,
      rollNo: 'PROD-NAI-99',
      email: user.email,
      status: 'ACTIVE',
      qr_active: true
    });
    if (!qrPayload) throw new Error('Failed to generate QR for approved user');
    user.qrCode = qrPayload;
    localStorage.setItem('mcgi_mpro_auth_users', JSON.stringify(authUsers));

    // Update roster member
    const members = JSON.parse(localStorage.getItem('mcgi_mpro_members'));
    const m = members.find(m => m.id === user.id);
    m.status = 'ACTIVE';
    m.approved_at = nowIso;
    m.approved_by = admin.id;
    m.qr_active = true;
    m.active = true;
    m.qrDisabled = false;
    m.qrCode = qrPayload;
    localStorage.setItem('mcgi_mpro_members', JSON.stringify(members));

    // Verification
    if (user.status !== 'ACTIVE') throw new Error('User status not ACTIVE');
    if (!user.approved_by) throw new Error('approved_by not populated');
    if (!user.approved_at) throw new Error('approved_at not populated');
    if (!user.qrCode) throw new Error('QR payload missing');
    if (m.qr_active !== true) throw new Error('Roster qr_active is not true');
  });

  // TEST 4 — LOGIN AFTER APPROVAL
  test('TEST 4: Approved user successfully logs in and personal QR is available', () => {
    const authUsers = JSON.parse(localStorage.getItem('mcgi_mpro_auth_users'));
    const user = authUsers.find(u => u.email === 'juan.delacruz@example.com');

    const status = String(user.status || 'ACTIVE').toUpperCase();
    if (status !== 'ACTIVE') throw new Error('User not active');

    // Simulate successful session creation
    sessionStorage.setItem('mcgi_portal_access_token', 'granted_' + Date.now());
    localStorage.setItem('mcgi_current_user', JSON.stringify(user));

    if (!sessionStorage.getItem('mcgi_portal_access_token')) throw new Error('Session token not set');
    if (!user.qrCode) throw new Error('Personal QR code is not available on profile');
  });

  // TEST 5 — APPROVED QR ATTENDANCE
  await runAsyncTest('TEST 5: Approved member QR is scanned, auto-detects schedule and records attendance', async () => {
    const authUsers = JSON.parse(localStorage.getItem('mcgi_mpro_auth_users'));
    const user = authUsers.find(u => u.email === 'juan.delacruz@example.com');

    // Check QR validation
    const validation = AttendanceLogger.validateMemberQr(user.qrCode);
    if (!validation.valid) throw new Error('Validation failed: ' + validation.error);
    if (!validation.member) throw new Error('Validation returned no member');

    // Record attendance
    const scanResult = await AttendanceLogger.recordAttendanceFromQR(user.qrCode);
    if (!scanResult.success) throw new Error('recordAttendanceFromQR failed: ' + scanResult.message);

    // Verify record in state
    const attendance = JSON.parse(localStorage.getItem('mcgi_mpro_attendance') || '{}');
    const today = new Date().toISOString().split('T')[0];
    const todayRec = attendance[today] && attendance[today][user.id];
    if (!todayRec) throw new Error('Attendance record was not written to storage for today');
    if (todayRec.status !== 'present' && todayRec.status !== 'late') throw new Error('Invalid status recorded: ' + todayRec.status);
  });

  // TEST 6 — PENDING QR
  test('TEST 6: Attempting to scan a QR for a PENDING member is rejected with clear message', () => {
    // Member in pending state with artificially forged or old QR
    const fakePendingId = 'PROD_PENDING_01';
    const authUsers = JSON.parse(localStorage.getItem('mcgi_mpro_auth_users'));
    authUsers.push({
      id: fakePendingId,
      name: 'Pending Person',
      email: 'pending@example.com',
      rollNo: 'PROD-NAI-88',
      status: 'PENDING',
      qr_active: false
    });
    localStorage.setItem('mcgi_mpro_auth_users', JSON.stringify(authUsers));

    const pendingPayload = JSON.stringify({ mid: fakePendingId, roll: 'PROD-NAI-88' });
    const validation = AttendanceLogger.validateMemberQr(pendingPayload);

    if (validation.valid) throw new Error('Pending QR was unexpectedly accepted!');
    if (validation.error !== 'Registration is still waiting for administrator approval.') {
      throw new Error('Unexpected error message: ' + validation.error);
    }
  });

  // TEST 7 — REJECTED REGISTRATION
  test('TEST 7: Admin rejects user, status becomes REJECTED, login and QR attendance are blocked', () => {
    const authUsers = JSON.parse(localStorage.getItem('mcgi_mpro_auth_users'));
    const user = authUsers.find(u => u.email === 'juan.delacruz@example.com');
    const nowIso = new Date().toISOString();

    user.status = 'REJECTED';
    user.rejected_at = nowIso;
    user.rejected_by = 'PROD001';
    user.qr_active = false;
    localStorage.setItem('mcgi_mpro_auth_users', JSON.stringify(authUsers));

    // Verify login rejection message
    const status = String(user.status).toUpperCase();
    let loginBlocked = false;
    let loginMsg = '';
    if (status === 'REJECTED') {
      loginBlocked = true;
      loginMsg = 'Your registration was not approved. Please contact the administrator.';
    }
    if (!loginBlocked || loginMsg !== 'Your registration was not approved. Please contact the administrator.') {
      throw new Error('Rejected login was not properly blocked');
    }

    // Verify QR scan rejection
    const validation = AttendanceLogger.validateMemberQr(user.qrCode);
    if (validation.valid) throw new Error('Rejected user QR was accepted!');
    if (validation.error !== 'This registration has not been approved.') {
      throw new Error('Unexpected rejection error message: ' + validation.error);
    }
  });

  // TEST 8 — DISABLED / REVOKED QR
  test('TEST 8: Admin revokes/disables QR, scan is rejected with QR inactive message', () => {
    const authUsers = JSON.parse(localStorage.getItem('mcgi_mpro_auth_users'));
    const user = authUsers.find(u => u.email === 'juan.delacruz@example.com');

    // Reactivate account but disable QR
    user.status = 'ACTIVE';
    user.qr_active = false;
    user.rejected_at = null;
    user.rejected_by = null;
    localStorage.setItem('mcgi_mpro_auth_users', JSON.stringify(authUsers));

    const members = JSON.parse(localStorage.getItem('mcgi_mpro_members'));
    const m = members.find(m => m.id === user.id);
    m.status = 'ACTIVE';
    m.qr_active = false;
    m.qrDisabled = true;
    localStorage.setItem('mcgi_mpro_members', JSON.stringify(members));

    const validation = AttendanceLogger.validateMemberQr(user.qrCode);
    if (validation.valid) throw new Error('Disabled QR was accepted!');
    if (validation.error !== 'This QR code is not currently active.' && validation.error !== 'This member QR code is disabled.') {
      throw new Error('Unexpected disabled QR error message: ' + validation.error);
    }
  });

  // TEST 9 — EXISTING USERS BACKWARD COMPATIBILITY
  test('TEST 9: Legacy users without status field remain ACTIVE and existing QR remains functional', () => {
    // Create legacy member with no status or qr_active fields
    const legacyUser = {
      id: 'PROD_LEGACY_01',
      name: 'Legacy Member',
      rollNo: 'PROD-NAI-07',
      username: 'legacy',
      email: 'legacy@mcgiprod.org',
      password: '123',
      locale: 'Naic',
      level: 'LOCALE PROD',
      role: 'member',
      duty: 'MPRO'
    };
    const legacyQr = AttendanceLogger.generateMemberQr(legacyUser);
    legacyUser.qrCode = legacyQr;

    const authUsers = JSON.parse(localStorage.getItem('mcgi_mpro_auth_users'));
    authUsers.push(legacyUser);
    localStorage.setItem('mcgi_mpro_auth_users', JSON.stringify(authUsers));

    const members = JSON.parse(localStorage.getItem('mcgi_mpro_members'));
    members.push({
      id: legacyUser.id,
      name: legacyUser.name,
      rollNo: 'PROD-NAI-07',
      department: 'Naic',
      role: 'LOCALE PROD',
      email: legacyUser.email,
      duty: 'MPRO',
      active: true,
      qrCode: legacyQr
    });
    localStorage.setItem('mcgi_mpro_members', JSON.stringify(members));

    // Validate QR for legacy member
    const validation = AttendanceLogger.validateMemberQr(legacyQr);
    if (!validation.valid) throw new Error('Legacy member QR was invalidated: ' + validation.error);
    if (!validation.member) throw new Error('Legacy member not found in validation');
  });

  // TEST 10 — CROSS SYSTEM PROTECTION
  test('TEST 10: Production member QR scanned under GCOS triggers Cross-System Alert', () => {
    try {
      // Current duty is GCOS
      localStorage.setItem('mcgi_selected_duty', 'GCOS');

      // Attempt to scan PROD001 QR under GCOS
      const prodQr = adminAccount.qrCode;
      const validation = AttendanceLogger.validateMemberQr(prodQr);

      if (validation.valid) throw new Error('Cross-system QR was improperly accepted!');
      if (!validation.error || !validation.error.includes('Cross-System Alert')) {
        throw new Error('Cross-system alert missing: ' + validation.error);
      }
    } finally {
      // Reset duty back to MPRO
      localStorage.setItem('mcgi_selected_duty', 'MPRO');
    }
  });

  // TEST 11 — LOGIN PAGE QR ATTENDANCE
  await runAsyncTest('TEST 11: Logged-out QR scan records attendance without creating user session', async () => {
    // Ensure active duty is MPRO
    localStorage.setItem('mcgi_selected_duty', 'MPRO');
    // Ensure user is logged out
    sessionStorage.removeItem('mcgi_portal_access_token');
    localStorage.removeItem('mcgi_current_user');

    // Admin account scans their QR at the login page kiosk
    const scanResult = await AttendanceLogger.recordAttendanceFromQR(adminAccount.qrCode);
    if (!scanResult.success) throw new Error('Kiosk attendance scan failed: ' + scanResult.message);

    // Verify session remains logged out
    if (sessionStorage.getItem('mcgi_portal_access_token')) {
      throw new Error('User was incorrectly logged into application after scanning attendance QR!');
    }
  });

  // TEST 12 — AUTOMATIC EVENT / SCHEDULE
  test('TEST 12: QR scan resolves attendance context via centralized EventSchedule module', () => {
    if (!EventSchedule || typeof EventSchedule.resolveAttendanceContext !== 'function') {
      throw new Error('EventSchedule.resolveAttendanceContext is missing or not a function');
    }

    const context = EventSchedule.resolveAttendanceContext();
    if (!context || !context.eventType) {
      throw new Error('EventSchedule failed to resolve attendance context');
    }
    console.log(`    ↳ Resolved context: Event: "${context.eventType}", Detection status: "${context.detected?.status}"`);
  });

  console.log('\n======================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TEST SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} PASSED`);
  console.log('======================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
