import assert from 'assert';
import crypto from 'crypto';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const TEST_PORT = 5004;

async function runTests() {
  console.log('======================================================');
  console.log('EVENTHUB PHASE 4 AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  // Start in-process server on test port 5004
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

    // 2. Setup Student (Alex)
    const student = {
      fullName: 'Alex Chen',
      email: `alex_p4_${timestamp}@campus.edu`,
      password: 'Password123!',
      studentId: `CS4-${timestamp.toString().slice(-6)}`,
      department: 'Computer Science'
    };
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student)
    });
    const studentCookie = regRes.headers.get('set-cookie')?.split(';')[0];
    const studentData = await regRes.json();
    const studentId = studentData.data.user.id;

    // 3. Create Main Event (Check-in window OPEN: starts in 30 mins, ends in 3 hours)
    // Registration deadline must be <= start_time
    const nowMs = Date.now();
    const eventOpenRes = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        title: `Campus Hackathon ${timestamp}`,
        description: 'Annual flagship hackathon with live smart gate check-in.',
        category: 'Hackathon',
        venue: 'Main University Auditorium',
        startTime: new Date(nowMs + 30 * 60 * 1000).toISOString(), // 30 min future (within 60 min window)
        endTime: new Date(nowMs + 180 * 60 * 1000).toISOString(), // 3 hours future
        registrationDeadline: new Date(nowMs + 20 * 60 * 1000).toISOString(),
        maxCapacity: 100,
        registrationType: 'individual',
        status: 'published'
      })
    });
    const eventOpenData = await eventOpenRes.json();
    const eventOpenId = eventOpenData.data.id;

    // Add North Gate (Active)
    const gate1Res = await fetch(`${BASE_URL}/events/${eventOpenId}/gates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        gateName: 'North Gate',
        locationDescription: 'Facing Academic Block'
      })
    });
    const gate1Data = await gate1Res.json();
    const gate1Id = gate1Data.data.id;

    // Add South Gate (Active)
    const gate2Res = await fetch(`${BASE_URL}/events/${eventOpenId}/gates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        gateName: 'South Auditorium Gate',
        locationDescription: 'Rear Parking Side'
      })
    });
    const gate2Data = await gate2Res.json();
    const gate2Id = gate2Data.data.id;

    // Add Inactive Gate
    const gateInactiveRes = await fetch(`${BASE_URL}/events/${eventOpenId}/gates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        gateName: 'East Emergency Gate',
        locationDescription: 'Staff only'
      })
    });
    const gateInactiveData = await gateInactiveRes.json();
    const gateInactiveId = gateInactiveData.data.id;
    // Deactivate it
    await fetch(`${BASE_URL}/events/${eventOpenId}/gates/${gateInactiveId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ isActive: false })
    });

    // 4. Create Second Event (For Event Mismatch & Gate Mismatch testing)
    const event2Res = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        title: `AI Symposium ${timestamp}`,
        description: 'Keynotes on deep learning.',
        category: 'Technology',
        venue: 'Science Hall 1',
        startTime: new Date(nowMs + 30 * 60 * 1000).toISOString(),
        endTime: new Date(nowMs + 120 * 60 * 1000).toISOString(),
        registrationDeadline: new Date(nowMs + 15 * 60 * 1000).toISOString(),
        maxCapacity: 50,
        registrationType: 'individual',
        status: 'published'
      })
    });
    const event2Data = await event2Res.json();
    const event2Id = event2Data.data.id;

    // Add Gate for Event 2
    const gateEvent2Res = await fetch(`${BASE_URL}/events/${event2Id}/gates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        gateName: 'Science Hall Main Entrance',
        locationDescription: 'Front lobby'
      })
    });
    const gateEvent2Data = await gateEvent2Res.json();
    const gateEvent2Id = gateEvent2Data.data.id;

    // 5. Register Student for Main Event
    const regPassRes = await fetch(`${BASE_URL}/events/${eventOpenId}/register`, {
      method: 'POST',
      headers: { Cookie: studentCookie }
    });
    const regPassData = await regPassRes.json();
    assert.strictEqual(regPassRes.status, 201, 'Student registration failed');
    const validQrPayload = regPassData.data.pass.qrPayload;
    const validPassId = regPassData.data.pass.id;
    const validPassCode = regPassData.data.pass.passCode;

    // -------------------------------------------------------------
    // Test 1: Student cannot perform gate check-in scan (Forbidden)
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: studentCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gate1Id,
          scanUuid: crypto.randomUUID(),
          qrPayload: validQrPayload
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
      logResult(1, 'Student role rejected from check-in scanner (403 Forbidden)', true);
    } catch (err) {
      logResult(1, 'Student role rejected from check-in scanner', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 2: Unauthenticated scan request is rejected (401)
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gate1Id,
          scanUuid: crypto.randomUUID(),
          qrPayload: validQrPayload
        })
      });
      assert.strictEqual(res.status, 401);
      logResult(2, 'Unauthenticated scan rejected (401 Unauthorized)', true);
    } catch (err) {
      logResult(2, 'Unauthenticated scan rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 3: Malformed QR payload is rejected with 400
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gate1Id,
          scanUuid: crypto.randomUUID(),
          qrPayload: 'MALFORMED-NOT-EVPASS'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error.code, 'INVALID_QR_PAYLOAD');
      logResult(3, 'Malformed QR payload rejected (400 INVALID_QR_PAYLOAD)', true);
    } catch (err) {
      logResult(3, 'Malformed QR payload rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 4: Fake / Non-existent pass token is rejected with 404
    // -------------------------------------------------------------
    try {
      const fakeToken = crypto.randomBytes(32).toString('hex');
      const res = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gate1Id,
          scanUuid: crypto.randomUUID(),
          qrPayload: `EVPASS:v1:PASS-FAKE-000000:${fakeToken}`
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 404);
      assert.strictEqual(data.error.code, 'PASS_NOT_FOUND');
      logResult(4, 'Non-existent pass token rejected (404 PASS_NOT_FOUND)', true);
    } catch (err) {
      logResult(4, 'Non-existent pass token rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 5: Inactive gate rejected with 400
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gateInactiveId,
          scanUuid: crypto.randomUUID(),
          qrPayload: validQrPayload
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error.code, 'GATE_INACTIVE');
      logResult(5, 'Inactive gate rejected (400 GATE_INACTIVE)', true);
    } catch (err) {
      logResult(5, 'Inactive gate rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 6: Gate belonging to another event rejected with 400
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gateEvent2Id, // Gate belongs to event2, not eventOpen
          scanUuid: crypto.randomUUID(),
          qrPayload: validQrPayload
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error.code, 'GATE_MISMATCH');
      logResult(6, 'Gate mismatch rejected (400 GATE_MISMATCH)', true);
    } catch (err) {
      logResult(6, 'Gate mismatch rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 7: Event mismatch (Valid pass submitted against wrong eventId)
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: event2Id, // Wrong event ID
          gateId: gateEvent2Id,
          scanUuid: crypto.randomUUID(),
          qrPayload: validQrPayload
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error.code, 'EVENT_MISMATCH');
      logResult(7, 'Event mismatch rejected (400 EVENT_MISMATCH)', true);
    } catch (err) {
      logResult(7, 'Event mismatch rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 8: Check-in before time window rejected (> 60 min before start)
    // -------------------------------------------------------------
    try {
      // Create event starting in 2 days (window not open)
      const eventFarRes = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          title: `Far Future Event ${timestamp}`,
          description: 'Symposium in 2 days.',
          category: 'Symposium',
          venue: 'Auditorium Hall C',
          startTime: new Date(nowMs + 86400000 * 2).toISOString(),
          endTime: new Date(nowMs + 86400000 * 3).toISOString(),
          registrationDeadline: new Date(nowMs + 86400000).toISOString(),
          maxCapacity: 50,
          registrationType: 'individual',
          status: 'published'
        })
      });
      const eventFarData = await eventFarRes.json();
      const eventFarId = eventFarData.data.id;

      // Add gate
      const farGateRes = await fetch(`${BASE_URL}/events/${eventFarId}/gates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ gateName: 'Hall C Gate' })
      });
      const farGateData = await farGateRes.json();
      const farGateId = farGateData.data.id;

      // Register student 2 for this event
      const student2Email = `student2_${timestamp}@campus.edu`;
      const regS2 = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Student Two',
          email: student2Email,
          password: 'Password123!',
          studentId: `S2-${timestamp.toString().slice(-6)}`,
          department: 'Mathematics'
        })
      });
      const s2Cookie = regS2.headers.get('set-cookie')?.split(';')[0];
      const s2RegRes = await fetch(`${BASE_URL}/events/${eventFarId}/register`, {
        method: 'POST',
        headers: { Cookie: s2Cookie }
      });
      const s2RegData = await s2RegRes.json();
      const farQrPayload = s2RegData.data.pass.qrPayload;

      // Try scan
      const scanFarRes = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventFarId,
          gateId: farGateId,
          scanUuid: crypto.randomUUID(),
          qrPayload: farQrPayload
        })
      });
      const scanFarData = await scanFarRes.json();
      assert.strictEqual(scanFarRes.status, 400);
      assert.strictEqual(scanFarData.error.code, 'WINDOW_CLOSED');
      logResult(8, 'Check-in before 60-min window rejected (400 WINDOW_CLOSED)', true);
    } catch (err) {
      logResult(8, 'Check-in before 60-min window rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 9: Valid Check-In succeeds (200 OK, Entry Approved)
    // -------------------------------------------------------------
    const primaryScanUuid = crypto.randomUUID();
    let initialPoints = 0;
    try {
      // Check initial reward points
      const [uRows] = await pool.query('SELECT reward_points FROM users WHERE id = ?', [studentId]);
      initialPoints = uRows[0].reward_points;

      const res = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gate1Id,
          scanUuid: primaryScanUuid,
          qrPayload: validQrPayload
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'APPROVED');
      assert.strictEqual(data.data.attendee.name, 'Alex Chen');
      assert.strictEqual(data.data.gateName, 'North Gate');
      assert.ok(data.data.checkedInAt);

      // Verify pass status in DB
      const [passRows] = await pool.query('SELECT status, checked_in_at FROM passes WHERE id = ?', [validPassId]);
      assert.strictEqual(passRows[0].status, 'checked_in');
      assert.ok(passRows[0].checked_in_at);

      // Verify attendance log in DB
      const [attRows] = await pool.query('SELECT * FROM attendance_logs WHERE pass_id = ?', [validPassId]);
      assert.strictEqual(attRows.length, 1);
      assert.strictEqual(attRows[0].scan_uuid, primaryScanUuid);
      assert.strictEqual(attRows[0].checkin_mode, 'online');

      // Verify points ledger (+50 points)
      const [ledgerRows] = await pool.query(
        'SELECT * FROM points_ledger WHERE pass_id = ? AND reason = ?',
        [validPassId, 'EVENT_CHECKIN']
      );
      assert.strictEqual(ledgerRows.length, 1);
      assert.strictEqual(ledgerRows[0].points_change, 50);

      // Verify user reward points increment
      const [uAfterRows] = await pool.query('SELECT reward_points FROM users WHERE id = ?', [studentId]);
      assert.strictEqual(uAfterRows[0].reward_points, initialPoints + 50);

      logResult(9, 'Valid check-in approved with atomic DB updates (+50 pts)', true);
    } catch (err) {
      logResult(9, 'Valid check-in approved with atomic DB updates', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 10: Idempotent Scan Retry (Same scanUuid awards 0 additional points)
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gate1Id,
          scanUuid: primaryScanUuid, // REPEATED scanUuid
          qrPayload: validQrPayload
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.status, 'APPROVED');

      // Verify points were NOT incremented again
      const [uRows] = await pool.query('SELECT reward_points FROM users WHERE id = ?', [studentId]);
      assert.strictEqual(uRows[0].reward_points, initialPoints + 50, 'Points must not increment on retry');

      // Verify attendance logs count is still exactly 1
      const [attRows] = await pool.query('SELECT COUNT(*) as count FROM attendance_logs WHERE pass_id = ?', [validPassId]);
      assert.strictEqual(attRows[0].count, 1);

      logResult(10, 'Idempotent retry with same scanUuid returns 200 without duplicate points', true);
    } catch (err) {
      logResult(10, 'Idempotent retry with same scanUuid', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 11: Duplicate Check-In with different scanUuid rejected (409 Conflict)
    // -------------------------------------------------------------
    try {
      const newScanUuid = crypto.randomUUID();
      const res = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gate2Id, // Attempt entry at South Gate with already checked-in pass
          scanUuid: newScanUuid,
          qrPayload: validQrPayload
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.error.code, 'DUPLICATE_CHECKIN');
      assert.ok(data.error.message.includes('ALREADY SCANNED'));
      logResult(11, 'Duplicate check-in with new scanUuid rejected (409 DUPLICATE_CHECKIN)', true, data.error.message);
    } catch (err) {
      logResult(11, 'Duplicate check-in with new scanUuid rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 12: Reissued pass old token is rejected (400 INVALID_TOKEN)
    // -------------------------------------------------------------
    try {
      // Create fresh registration on eventOpen to test reissuance rotation
      const student3Email = `student3_${timestamp}@campus.edu`;
      const regS3 = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Student Three',
          email: student3Email,
          password: 'Password123!',
          studentId: `S3-${timestamp.toString().slice(-6)}`,
          department: 'Physics'
        })
      });
      const s3Cookie = regS3.headers.get('set-cookie')?.split(';')[0];
      const s3RegRes = await fetch(`${BASE_URL}/events/${eventOpenId}/register`, {
        method: 'POST',
        headers: { Cookie: s3Cookie }
      });
      const s3RegData = await s3RegRes.json();
      const oldQrPayload = s3RegData.data.pass.qrPayload;
      const s3PassId = s3RegData.data.pass.id;

      // Student 3 reissues pass
      const reissueRes = await fetch(`${BASE_URL}/passes/${s3PassId}/reissue`, {
        method: 'POST',
        headers: { Cookie: s3Cookie }
      });
      const reissueData = await reissueRes.json();
      assert.strictEqual(reissueRes.status, 200);
      const newQrPayload = reissueData.data.qrPayload;
      assert.notStrictEqual(oldQrPayload, newQrPayload, 'Payload must change upon reissuance');

      // Attempt scanning OLD token
      const scanOldRes = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gate1Id,
          scanUuid: crypto.randomUUID(),
          qrPayload: oldQrPayload
        })
      });
      const scanOldData = await scanOldRes.json();
      assert.strictEqual(scanOldRes.status, 400);
      assert.strictEqual(scanOldData.error.code, 'INVALID_TOKEN');

      // Now scanning NEW token should succeed
      const scanNewRes = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gate1Id,
          scanUuid: crypto.randomUUID(),
          qrPayload: newQrPayload
        })
      });
      assert.strictEqual(scanNewRes.status, 200);

      logResult(12, 'Old token rejected after pass reissuance (400 INVALID_TOKEN), new token accepted', true);
    } catch (err) {
      logResult(12, 'Old token rejected after pass reissuance', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 13: Revoked pass is rejected (400 PASS_REVOKED)
    // -------------------------------------------------------------
    try {
      // Create student 4 with a pass and manually set status = 'revoked'
      const student4Email = `student4_${timestamp}@campus.edu`;
      const regS4 = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Student Four',
          email: student4Email,
          password: 'Password123!',
          studentId: `S4-${timestamp.toString().slice(-6)}`,
          department: 'Civil'
        })
      });
      const s4Cookie = regS4.headers.get('set-cookie')?.split(';')[0];
      const s4RegRes = await fetch(`${BASE_URL}/events/${eventOpenId}/register`, {
        method: 'POST',
        headers: { Cookie: s4Cookie }
      });
      const s4RegData = await s4RegRes.json();
      const s4PassId = s4RegData.data.pass.id;
      const s4QrPayload = s4RegData.data.pass.qrPayload;

      // Revoke pass in DB
      await pool.query("UPDATE passes SET status = 'revoked' WHERE id = ?", [s4PassId]);

      const scanRevokedRes = await fetch(`${BASE_URL}/checkin/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          eventId: eventOpenId,
          gateId: gate1Id,
          scanUuid: crypto.randomUUID(),
          qrPayload: s4QrPayload
        })
      });
      const scanRevokedData = await scanRevokedRes.json();
      assert.strictEqual(scanRevokedRes.status, 400);
      assert.strictEqual(scanRevokedData.error.code, 'PASS_REVOKED');
      logResult(13, 'Revoked pass rejected (400 PASS_REVOKED)', true);
    } catch (err) {
      logResult(13, 'Revoked pass rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 14: QueueLess live throughput metrics & gate recommendation
    // -------------------------------------------------------------
    try {
      const qRes = await fetch(`${BASE_URL}/events/${eventOpenId}/queueless`);
      const qData = await qRes.json();
      assert.strictEqual(qRes.status, 200);
      assert.strictEqual(qData.success, true);
      assert.strictEqual(qData.data.eventId, eventOpenId);
      assert.ok(qData.data.disclaimer.includes('Gate activity indicators'));
      assert.ok(Array.isArray(qData.data.gates));
      assert.strictEqual(qData.data.gates.length, 2); // North Gate and South Gate (inactive gate excluded)

      // North Gate had 2 scans (Alex and Student Three)
      const northGate = qData.data.gates.find(g => g.gateId === gate1Id);
      assert.ok(northGate, 'North Gate should be in metrics');
      assert.strictEqual(northGate.scansInLast10Min, 2);
      assert.strictEqual(northGate.throughputScansPerMin, 0.2);
      assert.strictEqual(northGate.activityLevel, 'Low Activity (Fast Entry)');
      assert.strictEqual(northGate.indicatorColor, 'green');

      // South Gate had 0 scans
      const southGate = qData.data.gates.find(g => g.gateId === gate2Id);
      assert.ok(southGate, 'South Gate should be in metrics');
      assert.strictEqual(southGate.scansInLast10Min, 0);

      // Recommended gate should be South Gate (lowest recent scan throughput: 0 vs 2)
      assert.strictEqual(qData.data.recommendedGateId, gate2Id);
      assert.strictEqual(qData.data.recommendedGateName, 'South Auditorium Gate');

      logResult(14, 'QueueLess throughput metrics computed correctly with recommended gate', true);
    } catch (err) {
      logResult(14, 'QueueLess throughput metrics computed correctly', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 15: Zero token leakage verification
    // -------------------------------------------------------------
    try {
      // Query response from scan must NOT contain tokenHash or rawToken
      const [checkRows] = await pool.query('SELECT * FROM passes WHERE id = ?', [validPassId]);
      assert.ok(checkRows[0].token_hash, 'Hash should exist in DB');
      // Verify rawToken does not exist as column
      assert.strictEqual(checkRows[0].raw_token, undefined, 'raw_token column must not exist in passes table');
      logResult(15, 'Zero token leakage: DB stores SHA-256 hash only, raw token never stored', true);
    } catch (err) {
      logResult(15, 'Zero token leakage', false, err.message);
    }

  } catch (globalErr) {
    console.error('Fatal test error:', globalErr);
  } finally {
    server.close();
    console.log('\n======================================================');
    const passedCount = results.filter(r => r.passed).length;
    console.log(`TEST SUMMARY: ${passedCount} / ${results.length} PASSED`);
    console.log('======================================================');

    if (passedCount !== results.length) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTests();
