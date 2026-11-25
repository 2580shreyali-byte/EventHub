import assert from 'assert';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const TEST_PORT = 5002;

async function runTests() {
  console.log('======================================================');
  console.log('EVENTHUB PHASE 2 AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  // Start in-process server on test port
  const server = app.listen(TEST_PORT);
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api/v1`;

  const results = [];
  function logResult(testNum, title, passed, details = '') {
    results.push({ testNum, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [Test ${testNum}]: ${title} ${details ? `(${details})` : ''}`);
  }

  try {
    // Generate unique email & student ID for test isolation
    const timestamp = Date.now();
    const testStudent = {
      fullName: 'Test Student',
      email: `student_${timestamp}@campus.edu`,
      password: 'SecurePassword123!',
      studentId: `STU-${timestamp.toString().slice(-6)}`,
      department: 'Computer Science'
    };

    let studentCookie = '';
    let adminCookie = '';

    // Test 1: Student registration succeeds
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testStudent)
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201, `Expected status 201, got ${res.status}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.role, 'student', 'Public registration must force role=student');
      assert.strictEqual(data.data.user.email, testStudent.email);
      assert.strictEqual(data.data.user.password_hash, undefined, 'password_hash must never be returned');

      // Check cookie header
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie && setCookie.includes('access_token'), 'access_token cookie must be set');
      assert.ok(setCookie.includes('HttpOnly'), 'Cookie must have HttpOnly attribute');
      studentCookie = setCookie.split(';')[0];

      logResult(1, 'Student registration succeeds', true, `User ID: ${data.data.user.id}`);
    } catch (e) {
      logResult(1, 'Student registration succeeds', false, e.message);
    }

    // Test 2: Duplicate email is rejected
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testStudent,
          studentId: `STU-DIFF-${timestamp.toString().slice(-4)}`
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 409, `Expected status 409, got ${res.status}`);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'EMAIL_ALREADY_EXISTS');
      logResult(2, 'Duplicate email is rejected', true, 'Code: EMAIL_ALREADY_EXISTS');
    } catch (e) {
      logResult(2, 'Duplicate email is rejected', false, e.message);
    }

    // Test 3: Duplicate student ID is rejected
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testStudent,
          email: `different_${timestamp}@campus.edu`
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 409, `Expected status 409, got ${res.status}`);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'STUDENT_ID_ALREADY_EXISTS');
      logResult(3, 'Duplicate student ID is rejected', true, 'Code: STUDENT_ID_ALREADY_EXISTS');
    } catch (e) {
      logResult(3, 'Duplicate student ID is rejected', false, e.message);
    }

    // Test 4: Password is stored as a hash (direct DB inspection)
    try {
      const [rows] = await pool.query('SELECT password_hash FROM users WHERE email = ?', [testStudent.email]);
      assert.ok(rows.length > 0, 'User not found in database');
      const hash = rows[0].password_hash;
      assert.notStrictEqual(hash, testStudent.password, 'Password must not be in plaintext');
      assert.ok(hash.startsWith('$2'), 'Hash must be valid bcrypt hash starting with $2');
      logResult(4, 'Password is stored as a bcrypt hash', true, `Prefix: ${hash.substring(0, 7)}`);
    } catch (e) {
      logResult(4, 'Password is stored as a bcrypt hash', false, e.message);
    }

    // Test 5: Login succeeds
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testStudent.email,
          password: testStudent.password
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected status 200, got ${res.status}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.email, testStudent.email);
      assert.strictEqual(data.data.token, undefined, 'JWT must not be returned in body response');
      logResult(5, 'Login succeeds', true);
    } catch (e) {
      logResult(5, 'Login succeeds', false, e.message);
    }

    // Test 6: Login with incorrect password fails
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testStudent.email,
          password: 'WrongPassword999!'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
      logResult(6, 'Login with incorrect password fails', true);
    } catch (e) {
      logResult(6, 'Login with incorrect password fails', false, e.message);
    }

    // Test 7: HTTP-only authentication cookie is set
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testStudent.email,
          password: testStudent.password
        })
      });
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'No Set-Cookie header present');
      assert.ok(setCookie.includes('access_token='), 'access_token cookie missing');
      assert.ok(setCookie.includes('HttpOnly'), 'HttpOnly flag missing');
      studentCookie = setCookie.split(';')[0];
      logResult(7, 'HTTP-only authentication cookie is set', true);
    } catch (e) {
      logResult(7, 'HTTP-only authentication cookie is set', false, e.message);
    }

    // Test 8: /auth/me returns the logged-in user's profile
    try {
      const res = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Cookie: studentCookie }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected status 200, got ${res.status}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.user.email, testStudent.email);
      assert.strictEqual(data.data.user.role, 'student');
      logResult(8, '/auth/me returns the logged-in user profile', true);
    } catch (e) {
      logResult(8, '/auth/me returns the logged-in user profile', false, e.message);
    }

    // Test 9: Logout clears the cookie
    try {
      const res = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Cookie: studentCookie }
      });
      const setCookie = res.headers.get('set-cookie');
      assert.strictEqual(res.status, 200);
      assert.ok(setCookie, 'Set-Cookie header missing on logout');
      assert.ok(setCookie.includes('Max-Age=0') || setCookie.includes('expires='), 'Cookie expiration missing on logout');
      logResult(9, 'Logout clears the authentication cookie', true);
    } catch (e) {
      logResult(9, 'Logout clears the authentication cookie', false, e.message);
    }

    // Setup Admin user for event authorization tests
    const adminEmail = (env.ADMIN_EMAIL || 'admin@eventhub.campus.edu').toLowerCase();
    const adminPassword = env.ADMIN_PASSWORD || 'AdminPassword123!';

    // Authenticate as Admin
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    const adminSetCookie = adminLoginRes.headers.get('set-cookie');
    adminCookie = adminSetCookie ? adminSetCookie.split(';')[0] : '';

    // Re-login student to get valid student cookie
    const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testStudent.email, password: testStudent.password })
    });
    studentCookie = studentLoginRes.headers.get('set-cookie').split(';')[0];

    // Sample valid event payload
    const validEvent = {
      title: `Hackathon 2026 ${timestamp}`,
      description: 'Annual campus technology hackathon and innovation symposium.',
      category: 'Hackathon',
      venue: 'Main Auditorium Hall A',
      startTime: '2026-12-01T09:00:00.000Z',
      endTime: '2026-12-02T18:00:00.000Z',
      registrationDeadline: '2026-11-30T23:59:59.000Z',
      maxCapacity: 150,
      registrationType: 'individual',
      status: 'published'
    };

    // Test 10: Student cannot create events (403 Forbidden)
    try {
      const res = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: studentCookie
        },
        body: JSON.stringify(validEvent)
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
      logResult(10, 'Student cannot create events (Forbidden)', true, 'Status 403');
    } catch (e) {
      logResult(10, 'Student cannot create events (Forbidden)', false, e.message);
    }

    // Test 11: Admin can create events (201 Created)
    let createdEventId = null;
    try {
      const res = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie
        },
        body: JSON.stringify(validEvent)
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201, `Expected status 201, got ${res.status}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.title, validEvent.title);
      assert.strictEqual(data.data.maxCapacity, 150);
      createdEventId = data.data.id;
      logResult(11, 'Admin can create events', true, `Event ID: ${createdEventId}`);
    } catch (e) {
      logResult(11, 'Admin can create events', false, e.message);
    }

    // Test 12: Public event listing does not reveal unpublished events
    try {
      // 1. Admin creates a draft/unpublished event
      const draftRes = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie
        },
        body: JSON.stringify({
          ...validEvent,
          title: `Secret Draft Event ${timestamp}`,
          status: 'draft'
        })
      });
      const draftData = await draftRes.json();
      const draftEventId = draftData.data.id;

      // 2. Public / Student lists events
      const publicListRes = await fetch(`${BASE_URL}/events`);
      const publicListData = await publicListRes.json();
      const isDraftVisible = publicListData.data.events.some(ev => ev.id === draftEventId);
      assert.strictEqual(isDraftVisible, false, 'Draft event must NOT be visible to public');

      // 3. Direct GET by public should return 404
      const directGetRes = await fetch(`${BASE_URL}/events/${draftEventId}`);
      assert.strictEqual(directGetRes.status, 404, 'Public GET for draft event must return 404');

      // 4. Admin listing CAN see draft event
      const adminListRes = await fetch(`${BASE_URL}/events?status=draft`, {
        headers: { Cookie: adminCookie }
      });
      const adminListData = await adminListRes.json();
      const isAdminSeeingDraft = adminListData.data.events.some(ev => ev.id === draftEventId);
      assert.strictEqual(isAdminSeeingDraft, true, 'Admin must be able to view draft events');

      logResult(12, 'Public event listing does not reveal unpublished events', true);
    } catch (e) {
      logResult(12, 'Public event listing does not reveal unpublished events', false, e.message);
    }

    // Test 13: Invalid event dates are rejected (registrationDeadline after startTime, or endTime before startTime)
    try {
      // Case A: End time before start time
      const resA = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie
        },
        body: JSON.stringify({
          ...validEvent,
          startTime: '2026-12-05T12:00:00.000Z',
          endTime: '2026-12-04T12:00:00.000Z' // Invalid: before start
        })
      });
      assert.strictEqual(resA.status, 400, 'End time before start time must return 400');

      // Case B: Registration deadline after start time
      const resB = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie
        },
        body: JSON.stringify({
          ...validEvent,
          startTime: '2026-12-05T12:00:00.000Z',
          registrationDeadline: '2026-12-06T12:00:00.000Z' // Invalid: after start
        })
      });
      assert.strictEqual(resB.status, 400, 'Deadline after start time must return 400');

      // Case C: Non-positive max capacity
      const resC = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie
        },
        body: JSON.stringify({
          ...validEvent,
          maxCapacity: 0 // Invalid: must be positive
        })
      });
      assert.strictEqual(resC.status, 400, 'Non-positive capacity must return 400');

      logResult(13, 'Invalid event dates and capacity are rejected', true, 'Status 400 validation');
    } catch (e) {
      logResult(13, 'Invalid event dates and capacity are rejected', false, e.message);
    }

  } finally {
    server.close();
  }

  console.log('\n======================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TEST SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} PASSED`);
  console.log('======================================================');

  if (!allPassed) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
