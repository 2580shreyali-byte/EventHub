import assert from 'assert';
import crypto from 'crypto';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const TEST_PORT = 5006;

async function runTests() {
  console.log('======================================================');
  console.log('EVENTHUB PHASE 6 AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  // Start in-process server on test port 5006
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
      email: `alex_p6_${timestamp}@campus.edu`,
      password: 'Password123!',
      studentId: `CS6-${timestamp.toString().slice(-6)}`,
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

    // Helper date generator (relative to now)
    const nowMs = Date.now();
    const futureDate = (offsetHours) => new Date(nowMs + offsetHours * 3600000).toISOString();

    let event1Id = null;
    let event2Id = null;

    // -------------------------------------------------------------
    // Test 1: Admin can create a valid event
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          title: `Hackathon Alpha ${timestamp}`,
          description: '36-hour competitive coding and artificial intelligence challenge.',
          category: 'Hackathon',
          venue: 'Main Auditorium Hall A',
          startTime: futureDate(24),
          endTime: futureDate(60),
          registrationDeadline: futureDate(12),
          maxCapacity: 100,
          registrationType: 'individual',
          status: 'published'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.id);
      assert.strictEqual(data.data.maxCapacity, 100);
      assert.strictEqual(data.data.availableSeats, 100);
      event1Id = data.data.id;
      logResult(1, 'Admin can create a valid event', true, `Event ID: ${event1Id}`);
    } catch (err) {
      logResult(1, 'Admin can create a valid event', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 2: Student cannot create an event (403 Forbidden)
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: studentCookie },
        body: JSON.stringify({
          title: `Unauthorized Student Event ${timestamp}`,
          description: 'Attempted event creation by student.',
          category: 'Workshop',
          venue: 'Classroom 101',
          startTime: futureDate(24),
          endTime: futureDate(28),
          registrationDeadline: futureDate(12),
          maxCapacity: 30
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403);
      assert.strictEqual(data.error.code, 'FORBIDDEN');
      logResult(2, 'Student cannot create an event (403 Forbidden)', true);
    } catch (err) {
      logResult(2, 'Student cannot create an event', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 3: Unauthenticated user cannot create an event (401)
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Guest Event ${timestamp}`,
          description: 'No cookies provided.',
          category: 'Workshop',
          venue: 'Classroom 101',
          startTime: futureDate(24),
          endTime: futureDate(28),
          registrationDeadline: futureDate(12),
          maxCapacity: 30
        })
      });
      assert.strictEqual(res.status, 401);
      logResult(3, 'Unauthenticated user rejected from event creation (401)', true);
    } catch (err) {
      logResult(3, 'Unauthenticated user rejected from event creation', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 4: Zod validation rejects invalid event data
    // -------------------------------------------------------------
    try {
      // 4a. End time before start time
      const res1 = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          title: 'Invalid Event Dates',
          description: 'Testing end time before start time.',
          category: 'Technology',
          venue: 'Hall A',
          startTime: futureDate(48),
          endTime: futureDate(24), // Earlier than start
          registrationDeadline: futureDate(12),
          maxCapacity: 50
        })
      });
      assert.strictEqual(res1.status, 400);

      // 4b. Registration deadline after start time
      const res2 = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          title: 'Invalid Deadline',
          description: 'Deadline after event start time.',
          category: 'Technology',
          venue: 'Hall A',
          startTime: futureDate(24),
          endTime: futureDate(48),
          registrationDeadline: futureDate(30), // After start
          maxCapacity: 50
        })
      });
      assert.strictEqual(res2.status, 400);

      // 4c. Non-positive capacity
      const res3 = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          title: 'Invalid Capacity',
          description: 'Negative or zero capacity.',
          category: 'Technology',
          venue: 'Hall A',
          startTime: futureDate(24),
          endTime: futureDate(48),
          registrationDeadline: futureDate(12),
          maxCapacity: 0
        })
      });
      assert.strictEqual(res3.status, 400);

      logResult(4, 'Zod validation correctly rejects invalid dates, deadlines and capacity', true);
    } catch (err) {
      logResult(4, 'Zod validation correctly rejects invalid dates', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 5: Admin retrieves event details with gates
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/events/${event1Id}`);
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.id, event1Id);
      assert.ok(Array.isArray(data.data.gates));
      logResult(5, 'Retrieve event details includes metadata and gate array', true);
    } catch (err) {
      logResult(5, 'Retrieve event details includes metadata and gate array', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 6: Admin updates event details successfully
    // -------------------------------------------------------------
    try {
      const updatedVenue = 'New Engineering Complex Hall 3';
      const res = await fetch(`${BASE_URL}/events/${event1Id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          venue: updatedVenue,
          maxCapacity: 120
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.venue, updatedVenue);
      assert.strictEqual(data.data.maxCapacity, 120);
      assert.strictEqual(data.data.availableSeats, 120);
      logResult(6, 'Admin can update event venue and capacity', true);
    } catch (err) {
      logResult(6, 'Admin can update event venue and capacity', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 7: Reducing maxCapacity below existing registrations is rejected
    // -------------------------------------------------------------
    try {
      // Register student to event1
      const regPassRes = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: { Cookie: studentCookie }
      });
      assert.strictEqual(regPassRes.status, 201);

      // Attempt reducing capacity to 0 (below current registrations: 1)
      const res = await fetch(`${BASE_URL}/events/${event1Id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          maxCapacity: 0 // Cannot reduce below 1
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      logResult(7, 'Capacity reduction below occupied seats rejected (400 INVALID_CAPACITY)', true);
    } catch (err) {
      logResult(7, 'Capacity reduction below occupied seats rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 8: Safe event cancellation preserves registrations & passes and revokes active passes
    // -------------------------------------------------------------
    try {
      // Event1 currently has 1 registration and 1 active pass
      const res = await fetch(`${BASE_URL}/events/${event1Id}`, {
        method: 'DELETE',
        headers: { Cookie: adminCookie }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.data.action, 'cancelled');

      // Verify event in DB is 'cancelled', NOT deleted
      const [evtRows] = await pool.query('SELECT status FROM events WHERE id = ?', [event1Id]);
      assert.strictEqual(evtRows.length, 1);
      assert.strictEqual(evtRows[0].status, 'cancelled');

      // Verify registrations still exist in DB
      const [regRows] = await pool.query('SELECT COUNT(*) as count FROM registrations WHERE event_id = ?', [event1Id]);
      assert.strictEqual(regRows[0].count, 1, 'Registrations must be preserved');

      // Verify pass was transitioned to 'revoked'
      const [passRows] = await pool.query('SELECT status FROM passes WHERE event_id = ?', [event1Id]);
      assert.strictEqual(passRows[0].status, 'revoked', 'Pass must be safely revoked');

      logResult(8, 'Safe event cancellation preserves history and revokes active passes', true);
    } catch (err) {
      logResult(8, 'Safe event cancellation preserves history', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 9: Cancelled event cannot be reactivated via PATCH
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/events/${event1Id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          status: 'published' // Disallowed transition from cancelled
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error.code, 'INVALID_STATUS_TRANSITION');
      logResult(9, 'Reactivation of cancelled event is rejected (400 INVALID_STATUS_TRANSITION)', true);
    } catch (err) {
      logResult(9, 'Reactivation of cancelled event is rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Create Event 2 for Gate & Discovery Testing
    // -------------------------------------------------------------
    const createEvt2Res = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        title: `Quantum Computing Workshop ${timestamp}`,
        description: 'Hands-on laboratory workshop on quantum algorithms and qubits.',
        category: 'Workshop',
        venue: 'Physics Lab Block 4',
        startTime: futureDate(24),
        endTime: futureDate(30),
        registrationDeadline: futureDate(12),
        maxCapacity: 40,
        registrationType: 'individual',
        status: 'published'
      })
    });
    const evt2Data = await createEvt2Res.json();
    event2Id = evt2Data.data.id;
    let gate1Id = null;

    // -------------------------------------------------------------
    // Test 10: Admin can add gates to an event
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/events/${event2Id}/gates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          gateName: 'West Lab Entrance',
          locationDescription: 'Facing Physics Courtyard'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.gateName, 'West Lab Entrance');
      assert.strictEqual(data.data.isActive, true);
      gate1Id = data.data.id;
      logResult(10, 'Admin can add gates to an event (201 Created)', true, `Gate ID: ${gate1Id}`);
    } catch (err) {
      logResult(10, 'Admin can add gates to an event', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 11: Duplicate gate name for same event is rejected (409)
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/events/${event2Id}/gates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({
          gateName: 'West Lab Entrance', // Duplicate
          locationDescription: 'Another entrance'
        })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 409);
      assert.strictEqual(data.error.code, 'DUPLICATE_GATE_NAME');
      logResult(11, 'Duplicate gate name within same event rejected (409 DUPLICATE_GATE_NAME)', true);
    } catch (err) {
      logResult(11, 'Duplicate gate name within same event rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 12: Student cannot add or update gates (403 Forbidden)
    // -------------------------------------------------------------
    try {
      const resAdd = await fetch(`${BASE_URL}/events/${event2Id}/gates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: studentCookie },
        body: JSON.stringify({ gateName: 'Student Created Gate' })
      });
      assert.strictEqual(resAdd.status, 403);

      const resUpdate = await fetch(`${BASE_URL}/events/${event2Id}/gates/${gate1Id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: studentCookie },
        body: JSON.stringify({ gateName: 'Tampered Gate Name' })
      });
      assert.strictEqual(resUpdate.status, 403);

      logResult(12, 'Student role rejected from gate creation and updates (403 Forbidden)', true);
    } catch (err) {
      logResult(12, 'Student role rejected from gate creation and updates', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 13: Gate update validates event ownership (400 GATE_MISMATCH)
    // -------------------------------------------------------------
    try {
      // Attempt updating gate1Id (which belongs to event2) via event1Id route
      const res = await fetch(`${BASE_URL}/events/${event1Id}/gates/${gate1Id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ gateName: 'Cross-Event Renamed Gate' })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error.code, 'GATE_MISMATCH');
      logResult(13, 'Cross-event gate update rejected (400 GATE_MISMATCH)', true);
    } catch (err) {
      logResult(13, 'Cross-event gate update rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 14: Student discovery keyword search matches title, description, category, and venue
    // -------------------------------------------------------------
    try {
      // 14a. Search by title keyword
      const resTitle = await fetch(`${BASE_URL}/events?search=Quantum`);
      const dataTitle = await resTitle.json();
      assert.ok(dataTitle.data.events.some(e => e.id === event2Id));

      // 14b. Search by category keyword
      const resCat = await fetch(`${BASE_URL}/events?search=Workshop`);
      const dataCat = await resCat.json();
      assert.ok(dataCat.data.events.some(e => e.id === event2Id));

      // 14c. Search by venue keyword
      const resVenue = await fetch(`${BASE_URL}/events?search=Physics`);
      const dataVenue = await resVenue.json();
      assert.ok(dataVenue.data.events.some(e => e.id === event2Id));

      logResult(14, 'Student discovery keyword search matches title, category and venue', true);
    } catch (err) {
      logResult(14, 'Student discovery keyword search matches title, category and venue', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 15: Student discovery category filtering and pagination envelope
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/events?category=Workshop&page=1&limit=5`);
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data.events));
      assert.ok(data.data.pagination);
      assert.strictEqual(data.data.pagination.page, 1);
      assert.strictEqual(data.data.pagination.limit, 5);
      assert.ok(data.data.pagination.total >= 1);
      assert.ok(data.data.pagination.totalPages >= 1);

      // Verify all returned events match the requested category
      const allMatch = data.data.events.every(e => e.category === 'Workshop');
      assert.ok(allMatch, 'All filtered events must match category');

      logResult(15, 'Category filtering and pagination envelope return accurate metadata', true);
    } catch (err) {
      logResult(15, 'Category filtering and pagination envelope return accurate metadata', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 16: Available seats calculation is accurate and never negative
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${BASE_URL}/events/${event2Id}`);
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      const evt = data.data;
      assert.strictEqual(evt.availableSeats, evt.maxCapacity - evt.currentRegistrations);
      assert.ok(evt.availableSeats >= 0, 'Available seats must never be negative');
      logResult(16, 'Available seats calculation accurately reflects unreserved capacity', true);
    } catch (err) {
      logResult(16, 'Available seats calculation accurately reflects unreserved capacity', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 17: Public event listing excludes cancelled and draft events from student view
    // -------------------------------------------------------------
    try {
      // Event1 was cancelled in Test 8
      const res = await fetch(`${BASE_URL}/events`);
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      const publicEvents = data.data.events;

      // Ensure cancelled event1 is NOT visible in public listing
      const containsCancelled = publicEvents.some(e => e.id === event1Id);
      assert.strictEqual(containsCancelled, false, 'Cancelled events must not appear in public listing');

      // Ensure all public events have status 'published'
      const allPublished = publicEvents.every(e => e.status === 'published');
      assert.strictEqual(allPublished, true, 'All public events must have status published');

      logResult(17, 'Public event discovery strictly excludes cancelled and draft events', true);
    } catch (err) {
      logResult(17, 'Public event discovery strictly excludes cancelled and draft events', false, err.message);
    }

  } catch (globalErr) {
    console.error('Fatal test error in Phase 6 suite:', globalErr);
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
