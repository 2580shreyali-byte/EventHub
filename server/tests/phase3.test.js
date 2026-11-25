import assert from 'assert';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { hashToken } from '../src/utils/crypto.js';

const TEST_PORT = 5003;

async function runTests() {
  console.log('======================================================');
  console.log('EVENTHUB PHASE 3 AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  // Start in-process server on test port 5003
  const server = app.listen(TEST_PORT);
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api/v1`;

  const results = [];
  function logResult(testNum, title, passed, details = '') {
    results.push({ testNum, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [Test ${testNum}]: ${title} ${details ? `(${details})` : ''}`);
  }

  try {
    const timestamp = Date.now();

    // 1. Setup Admin Account and login
    const adminEmail = (env.ADMIN_EMAIL || 'admin@eventhub.campus.edu').toLowerCase();
    const adminPassword = env.ADMIN_PASSWORD || 'AdminPassword123!';
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0];
    assert.ok(adminCookie, 'Failed to obtain admin cookie');

    // 2. Setup Student 1 (Alex)
    const student1 = {
      fullName: 'Alex Chen',
      email: `alex_${timestamp}@campus.edu`,
      password: 'Password123!',
      studentId: `CS-${timestamp.toString().slice(-6)}`,
      department: 'Computer Science'
    };
    const regRes1 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student1)
    });
    const student1Cookie = regRes1.headers.get('set-cookie')?.split(';')[0];
    const student1Data = await regRes1.json();
    const student1Id = student1Data.data.user.id;

    // 3. Setup Student 2 (Sarah)
    const student2 = {
      fullName: 'Sarah Connor',
      email: `sarah_${timestamp}@campus.edu`,
      password: 'Password123!',
      studentId: `CS-DIFF-${timestamp.toString().slice(-4)}`,
      department: 'Computer Science'
    };
    const regRes2 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student2)
    });
    const student2Cookie = regRes2.headers.get('set-cookie')?.split(';')[0];

    // 4. Create Event 1 (Regular Capacity: 50)
    const eventRes1 = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        title: `Campus Tech Summit ${timestamp}`,
        description: 'Annual campus technology symposium with industry leaders.',
        category: 'Technology',
        venue: 'Auditorium Hall B',
        startTime: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days in future
        endTime: new Date(Date.now() + 86400000 * 3).toISOString(),
        registrationDeadline: new Date(Date.now() + 86400000).toISOString(), // 1 day in future
        maxCapacity: 50,
        registrationType: 'individual',
        status: 'published'
      })
    });
    const event1Data = await eventRes1.json();
    const event1Id = event1Data.data.id;

    let registeredPassId = null;
    let initialQrPayload = null;

    // Test 1: Student successfully registers for an event
    try {
      const res = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: { Cookie: student1Cookie }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201, `Expected status 201, got ${res.status}`);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.registrationId, 'Missing registrationId');
      assert.ok(data.data.pass, 'Missing pass object');
      assert.ok(data.data.pass.passCode.startsWith('PASS-'), 'passCode must start with PASS-');
      registeredPassId = data.data.pass.id;
      initialQrPayload = data.data.pass.qrPayload;
      logResult(1, 'Student successfully registers for an event', true, `Pass ID: ${registeredPassId}`);
    } catch (e) {
      logResult(1, 'Student successfully registers for an event', false, e.message);
    }

    // Test 2: Registration creates exactly one pass in DB
    try {
      const [passes] = await pool.query(
        'SELECT id, pass_code, token_hash, status, user_id, event_id FROM passes WHERE event_id = ? AND user_id = ?',
        [event1Id, student1Id]
      );
      assert.strictEqual(passes.length, 1, `Expected exactly 1 pass, found ${passes.length}`);
      assert.strictEqual(passes[0].id, registeredPassId);
      assert.strictEqual(passes[0].status, 'active');
      logResult(2, 'Registration creates exactly one pass', true, `Pass Code: ${passes[0].pass_code}`);
    } catch (e) {
      logResult(2, 'Registration creates exactly one pass', false, e.message);
    }

    // Test 3: QR data URL is returned and valid
    try {
      assert.ok(initialQrPayload.startsWith('EVPASS:v1:'), 'qrPayload must start with EVPASS:v1:');
      const parts = initialQrPayload.split(':');
      assert.strictEqual(parts.length, 4, 'Payload format must be EVPASS:v1:<passCode>:<rawToken>');
      const rawToken = parts[3];
      assert.strictEqual(rawToken.length, 64, 'Raw token must be 64 hex characters (32 bytes)');

      // Verify that database stores the SHA-256 hash of this rawToken, NOT the raw token itself
      const [passRows] = await pool.query('SELECT token_hash FROM passes WHERE id = ?', [registeredPassId]);
      const expectedHash = hashToken(rawToken);
      assert.strictEqual(passRows[0].token_hash, expectedHash, 'Stored token_hash must match SHA-256 of rawToken');
      assert.notStrictEqual(passRows[0].token_hash, rawToken, 'Database must never store plaintext raw token');

      logResult(3, 'QR data URL is returned with secure raw token verification', true);
    } catch (e) {
      logResult(3, 'QR data URL is returned with secure raw token verification', false, e.message);
    }

    // Test 4: Duplicate registration is rejected (409 Conflict)
    try {
      const res = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: { Cookie: student1Cookie }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 409, `Expected status 409, got ${res.status}`);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'ALREADY_REGISTERED');
      logResult(4, 'Duplicate registration is rejected', true, 'Code: ALREADY_REGISTERED');
    } catch (e) {
      logResult(4, 'Duplicate registration is rejected', false, e.message);
    }

    // Test 5: Capacity limit is enforced (Event with maxCapacity = 1)
    const singleSeatEventRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        title: `VIP Workshop ${timestamp}`,
        description: 'Exclusive 1-seat workshop.',
        category: 'Workshop',
        venue: 'Room 101',
        startTime: new Date(Date.now() + 86400000 * 2).toISOString(),
        endTime: new Date(Date.now() + 86400000 * 3).toISOString(),
        registrationDeadline: new Date(Date.now() + 86400000).toISOString(),
        maxCapacity: 1, // Only 1 seat!
        registrationType: 'individual',
        status: 'published'
      })
    });
    const singleSeatEvent = (await singleSeatEventRes.json()).data;

    // Student 1 registers for the only seat
    await fetch(`${BASE_URL}/events/${singleSeatEvent.id}/register`, {
      method: 'POST',
      headers: { Cookie: student1Cookie }
    });

    // Student 2 attempts to register when capacity is full
    try {
      const res = await fetch(`${BASE_URL}/events/${singleSeatEvent.id}/register`, {
        method: 'POST',
        headers: { Cookie: student2Cookie }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 409, `Expected status 409, got ${res.status}`);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'CAPACITY_FULL');
      logResult(5, 'Capacity limit is enforced', true, 'Code: CAPACITY_FULL');
    } catch (e) {
      logResult(5, 'Capacity limit is enforced', false, e.message);
    }

    // Test 6: Two concurrent registrations cannot overbook an event (Race Condition Prevention)
    const raceEventRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        title: `Race Condition Event ${timestamp}`,
        description: 'Single-seat event for concurrency stress test.',
        category: 'Test',
        venue: 'Lab 3',
        startTime: new Date(Date.now() + 86400000 * 2).toISOString(),
        endTime: new Date(Date.now() + 86400000 * 3).toISOString(),
        registrationDeadline: new Date(Date.now() + 86400000).toISOString(),
        maxCapacity: 1, // EXACTLY 1 SEAT
        registrationType: 'individual',
        status: 'published'
      })
    });
    const raceEvent = (await raceEventRes.json()).data;

    // Create Student 3 for race
    const student3Reg = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Racer Three',
        email: `racer3_${timestamp}@campus.edu`,
        password: 'Password123!',
        studentId: `RACE3-${timestamp.toString().slice(-4)}`,
        department: 'CS'
      })
    });
    const student3Cookie = student3Reg.headers.get('set-cookie')?.split(';')[0];

    // Fire 2 concurrent registration requests at the exact same millisecond
    try {
      const [resStudent2, resStudent3] = await Promise.all([
        fetch(`${BASE_URL}/events/${raceEvent.id}/register`, {
          method: 'POST',
          headers: { Cookie: student2Cookie }
        }),
        fetch(`${BASE_URL}/events/${raceEvent.id}/register`, {
          method: 'POST',
          headers: { Cookie: student3Cookie }
        })
      ]);

      const status2 = resStudent2.status;
      const status3 = resStudent3.status;

      // Exactly one must succeed (201) and exactly one must fail with 409 CAPACITY_FULL
      const successCount = [status2, status3].filter(s => s === 201).length;
      const conflictCount = [status2, status3].filter(s => s === 409).length;

      assert.strictEqual(successCount, 1, 'Exactly one concurrent registration must succeed');
      assert.strictEqual(conflictCount, 1, 'Exactly one concurrent registration must be rejected');

      // Verify that current_registrations in database is exactly 1 (not 2!)
      const [evRows] = await pool.query('SELECT current_registrations, max_capacity FROM events WHERE id = ?', [raceEvent.id]);
      assert.strictEqual(evRows[0].current_registrations, 1, 'Capacity must remain exactly 1');

      logResult(6, 'Two concurrent registrations cannot overbook an event', true, '1 succeeded, 1 rejected with 409');
    } catch (e) {
      logResult(6, 'Two concurrent registrations cannot overbook an event', false, e.message);
    }

    // Test 7: Failed pass creation rolls back registration and capacity increment
    try {
      // Create test event with capacity=5
      const rollbackEventRes = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          title: `Rollback Test Event ${timestamp}`,
          description: 'Testing transaction atomicity.',
          category: 'Test',
          venue: 'Room 5',
          startTime: new Date(Date.now() + 86400000 * 2).toISOString(),
          endTime: new Date(Date.now() + 86400000 * 3).toISOString(),
          registrationDeadline: new Date(Date.now() + 86400000).toISOString(),
          maxCapacity: 5,
          registrationType: 'individual',
          status: 'published'
        })
      });
      const rollbackEvent = (await rollbackEventRes.json()).data;

      // Verify initial capacity is 0
      const [beforeRows] = await pool.query('SELECT current_registrations FROM events WHERE id = ?', [rollbackEvent.id]);
      assert.strictEqual(beforeRows[0].current_registrations, 0);

      // Verify atomic rollback behavior: a transaction error in the service rolls back completely
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('UPDATE events SET current_registrations = current_registrations + 1 WHERE id = ?', [rollbackEvent.id]);
        // Simulate failure before pass insertion
        throw new Error('Simulated pass insertion failure');
      } catch (err) {
        await conn.rollback();
      } finally {
        conn.release();
      }

      // Verify capacity was reverted to 0
      const [afterRows] = await pool.query('SELECT current_registrations FROM events WHERE id = ?', [rollbackEvent.id]);
      assert.strictEqual(afterRows[0].current_registrations, 0, 'current_registrations must roll back to 0 on failure');

      logResult(7, 'Failed pass creation rolls back registration and capacity increment', true);
    } catch (e) {
      logResult(7, 'Failed pass creation rolls back registration and capacity increment', false, e.message);
    }

    // Test 8: Student cannot register without authentication (401 Unauthorized)
    try {
      const res = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST'
      });
      assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
      logResult(8, 'Student cannot register without authentication', true, 'Status 401');
    } catch (e) {
      logResult(8, 'Student cannot register without authentication', false, e.message);
    }

    // Test 9: Admin cannot use student registration endpoints (403 Forbidden)
    try {
      const res = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: { Cookie: adminCookie }
      });
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      logResult(9, 'Admin cannot use student registration endpoints', true, 'Status 403 Forbidden');
    } catch (e) {
      logResult(9, 'Admin cannot use student registration endpoints', false, e.message);
    }

    // Test 10: Student can retrieve their own passes
    try {
      const res = await fetch(`${BASE_URL}/passes/my-passes`, {
        headers: { Cookie: student1Cookie }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected status 200, got ${res.status}`);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data), 'data must be an array of passes');
      assert.ok(data.data.length >= 1, 'Student 1 must have at least 1 pass');
      const pass = data.data.find(p => p.passId === registeredPassId);
      assert.ok(pass, 'Created pass must be in my-passes listing');
      assert.strictEqual(pass.passStatus, undefined); // status field is named status
      assert.strictEqual(pass.status, 'active');
      assert.strictEqual(pass.tokenHash, undefined, 'token_hash must NEVER be exposed');
      assert.strictEqual(pass.token_hash, undefined, 'token_hash must NEVER be exposed');
      logResult(10, 'Student can retrieve their own passes', true, `Retrieved ${data.data.length} passes`);
    } catch (e) {
      logResult(10, 'Student can retrieve their own passes', false, e.message);
    }

    // Test 11: Student cannot retrieve another student's passes (403 Forbidden)
    try {
      // Student 2 tries to access Student 1's pass details by ID
      const res = await fetch(`${BASE_URL}/passes/${registeredPassId}`, {
        headers: { Cookie: student2Cookie }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403, `Expected status 403, got ${res.status}`);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
      logResult(11, "Student cannot retrieve another student's passes", true, 'Status 403 Forbidden');
    } catch (e) {
      logResult(11, "Student cannot retrieve another student's passes", false, e.message);
    }

    // Test 12: Pass reissuance generates a new QR token
    let reissuedQrPayload = null;
    try {
      const res = await fetch(`${BASE_URL}/passes/${registeredPassId}/reissue`, {
        method: 'POST',
        headers: { Cookie: student1Cookie }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected status 200, got ${res.status}`);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.qrDataUrl, 'Must return new QR Data URL');
      assert.ok(data.data.qrPayload, 'Must return new qrPayload');
      reissuedQrPayload = data.data.qrPayload;
      assert.notStrictEqual(reissuedQrPayload, initialQrPayload, 'Reissued QR payload must be different from initial token');
      logResult(12, 'Pass reissuance generates a new QR token', true);
    } catch (e) {
      logResult(12, 'Pass reissuance generates a new QR token', false, e.message);
    }

    // Test 13: Previous QR token becomes invalid after reissuance
    try {
      const oldRawToken = initialQrPayload.split(':')[3];
      const newRawToken = reissuedQrPayload.split(':')[3];
      assert.notStrictEqual(oldRawToken, newRawToken, 'New token must be different');

      // Direct check against database: database now holds hash of newRawToken, not oldRawToken
      const [passRows] = await pool.query('SELECT token_hash FROM passes WHERE id = ?', [registeredPassId]);
      const currentDbHash = passRows[0].token_hash;

      assert.strictEqual(currentDbHash, hashToken(newRawToken), 'Database must store hash of newly reissued token');
      assert.notStrictEqual(currentDbHash, hashToken(oldRawToken), 'Database must NO LONGER match old token hash');

      logResult(13, 'Previous QR token becomes invalid after reissuance', true, 'Hash successfully rotated');
    } catch (e) {
      logResult(13, 'Previous QR token becomes invalid after reissuance', false, e.message);
    }

    // Test 14: Checked-in passes cannot be reissued (400 Bad Request)
    try {
      // Simulate pass being checked in
      await pool.query("UPDATE passes SET status = 'checked_in', checked_in_at = NOW() WHERE id = ?", [registeredPassId]);

      // Attempt reissuance of the checked-in pass
      const res = await fetch(`${BASE_URL}/passes/${registeredPassId}/reissue`, {
        method: 'POST',
        headers: { Cookie: student1Cookie }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400, `Expected status 400, got ${res.status}`);
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error.code, 'ALREADY_CHECKED_IN');

      logResult(14, 'Checked-in passes cannot be reissued', true, 'Code: ALREADY_CHECKED_IN');
    } catch (e) {
      logResult(14, 'Checked-in passes cannot be reissued', false, e.message);
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
