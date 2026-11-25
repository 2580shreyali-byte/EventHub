import assert from 'assert';
import crypto from 'crypto';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const TEST_PORT = 5007;

async function runTests() {
  console.log('======================================================');
  console.log('EVENTHUB PHASE 7 AUTOMATED TEST SUITE');
  console.log('Headcount-Based Registration & Team Invitation Engine');
  console.log('======================================================\n');

  // Start in-process server on test port 5007
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

    // Helper to register student and return cookie + user data
    async function createStudent(prefix, name) {
      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      const student = {
        fullName: name,
        email: `${prefix}_${uniqueSuffix}@campus.edu`,
        password: 'Password123!',
        studentId: `${prefix.slice(0, 3).toUpperCase()}-${uniqueSuffix.slice(-8)}`,
        department: 'Computer Science'
      };
      const regRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student)
      });
      const cookie = regRes.headers.get('set-cookie')?.split(';')[0];
      const data = await regRes.json();
      assert.ok(data?.data?.user, `Failed to create student ${name}: ${JSON.stringify(data)}`);
      return { ...data.data.user, cookie, email: student.email };
    }

    const leaderAlex = await createStudent('alex', 'Alex Chen');
    const memberSarah = await createStudent('sarah', 'Sarah Connor');
    const memberJohn = await createStudent('john', 'John Doe');
    const memberEmma = await createStudent('emma', 'Emma Watson');
    const rivalBob = await createStudent('bob', 'Bob Vance');

    // Date helpers
    const nowMs = Date.now();
    const futureDate = (offsetHours) => new Date(nowMs + offsetHours * 3600000).toISOString();

    // Setup Event 1: Team Event, Capacity 6, Team size 3 to 4
    let event1Id = null;
    const createEvt1Res = await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookie
      },
      body: JSON.stringify({
        title: `Campus Hackathon ${timestamp}`,
        description: 'Annual flagship student hackathon. Build next-gen campus solutions.',
        category: 'Technology',
        venue: 'Engineering Hall Alpha',
        startTime: futureDate(48),
        endTime: futureDate(72),
        registrationDeadline: futureDate(36),
        maxCapacity: 6,
        registrationType: 'team',
        minTeamSize: 3,
        maxTeamSize: 4,
        status: 'published'
      })
    });
    const evt1Data = await createEvt1Res.json();
    assert.strictEqual(createEvt1Res.status, 201);
    event1Id = evt1Data.data.id;

    let teamRegId = null;
    let sarahInvitationId = null;
    let johnInvitationId = null;

    // -------------------------------------------------------------
    // Test 1: Successful Team Registration
    // -------------------------------------------------------------
    try {
      const regRes = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': leaderAlex.cookie
        },
        body: JSON.stringify({
          registrationType: 'team',
          teamName: 'CyberKnights',
          memberEmails: [memberSarah.email, memberJohn.email]
        })
      });

      const body = await regRes.json();
      assert.strictEqual(regRes.status, 201, 'Should return 201 Created');
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.teamName, 'CyberKnights');
      assert.strictEqual(body.data.status, 'pending_members');
      assert.strictEqual(body.data.reservedHeadcount, 3);
      assert.strictEqual(body.data.invitations.length, 2);
      assert.strictEqual(body.data.pass, undefined, 'Leader must NOT receive pass yet');

      teamRegId = body.data.registrationId;
      logResult(1, 'Successful team registration with pending_members status', true);
    } catch (err) {
      logResult(1, 'Successful team registration with pending_members status', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 2: Concurrency-safe Capacity Reservation for Full Headcount
    // -------------------------------------------------------------
    try {
      const evtRes = await fetch(`${BASE_URL}/events/${event1Id}`);
      const evt = await evtRes.json();
      assert.strictEqual(evt.data.currentRegistrations, 3, 'Capacity must be incremented by 3 (reserved headcount)');
      assert.strictEqual(evt.data.availableSeats, 3, 'Available seats must be 6 - 3 = 3');

      logResult(2, 'Atomically reserved full headcount (3 seats) on event', true);
    } catch (err) {
      logResult(2, 'Atomically reserved full headcount (3 seats) on event', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 3: Insufficient Capacity Rejection
    // -------------------------------------------------------------
    try {
      // Bob tries to register a team of 4 when only 3 seats remain
      const regRes = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': rivalBob.cookie
        },
        body: JSON.stringify({
          registrationType: 'team',
          teamName: 'Overbooking Squad',
          memberEmails: [memberEmma.email, `temp1_${timestamp}@campus.edu`, `temp2_${timestamp}@campus.edu`]
        })
      });

      const body = await regRes.json();
      assert.strictEqual(regRes.status, 409, 'Should return 409 for capacity overflow');
      assert.strictEqual(body.error.code, 'CAPACITY_FULL');

      logResult(3, 'Rejects team registration exceeding remaining capacity (409 CAPACITY_FULL)', true);
    } catch (err) {
      logResult(3, 'Rejects team registration exceeding remaining capacity (409 CAPACITY_FULL)', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 4: Ineligible / Unregistered Member Rejection
    // -------------------------------------------------------------
    try {
      const regRes = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': rivalBob.cookie
        },
        body: JSON.stringify({
          registrationType: 'team',
          teamName: 'Ghost Team',
          memberEmails: ['nonexistent_student_xyz@campus.edu', memberEmma.email]
        })
      });

      const body = await regRes.json();
      assert.strictEqual(regRes.status, 400, 'Should reject non-existent student email');
      assert.strictEqual(body.error.code, 'INVITEE_NOT_FOUND');

      logResult(4, 'Rejects unverified or ineligible student accounts (400 INVITEE_NOT_FOUND)', true);
    } catch (err) {
      logResult(4, 'Rejects unverified or ineligible student accounts (400 INVITEE_NOT_FOUND)', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 5: Self-Invitation and Duplicate Emails Rejection
    // -------------------------------------------------------------
    try {
      // 5a. Self-invitation
      const selfRes = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': rivalBob.cookie
        },
        body: JSON.stringify({
          registrationType: 'team',
          teamName: 'Self Invite Team',
          memberEmails: [rivalBob.email, memberEmma.email]
        })
      });
      const selfBody = await selfRes.json();
      assert.strictEqual(selfRes.status, 400);
      assert.strictEqual(selfBody.error.code, 'CANNOT_INVITE_SELF');

      // 5b. Duplicate emails in payload
      const dupRes = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': rivalBob.cookie
        },
        body: JSON.stringify({
          registrationType: 'team',
          teamName: 'Duplicate Emails Team',
          memberEmails: [memberEmma.email, memberEmma.email]
        })
      });
      const dupBody = await dupRes.json();
      assert.strictEqual(dupRes.status, 400);
      assert.strictEqual(dupBody.error.code, 'DUPLICATE_INVITEE_EMAILS');

      logResult(5, 'Rejects self-invitation (CANNOT_INVITE_SELF) and duplicate emails in request', true);
    } catch (err) {
      logResult(5, 'Rejects self-invitation (CANNOT_INVITE_SELF) and duplicate emails in request', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 6: Duplicate Event Participation Prevention
    // -------------------------------------------------------------
    try {
      // 6a. Trying to invite Sarah who is already invited in CyberKnights
      const dupPartRes = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': rivalBob.cookie
        },
        body: JSON.stringify({
          registrationType: 'team',
          teamName: 'Rival Team',
          memberEmails: [memberSarah.email, memberEmma.email]
        })
      });
      const dupPartBody = await dupPartRes.json();
      assert.strictEqual(dupPartRes.status, 409);
      assert.strictEqual(dupPartBody.error.code, 'DUPLICATE_PARTICIPATION');

      // 6b. Leader Alex trying to register again
      const leaderAgainRes = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': leaderAlex.cookie
        },
        body: JSON.stringify({
          registrationType: 'team',
          teamName: 'Alex Second Team',
          memberEmails: [memberEmma.email, rivalBob.email]
        })
      });
      const leaderAgainBody = await leaderAgainRes.json();
      assert.strictEqual(leaderAgainRes.status, 409);
      assert.strictEqual(leaderAgainBody.error.code, 'DUPLICATE_PARTICIPATION');

      logResult(6, 'Prevents duplicate event participation across registrations (409 DUPLICATE_PARTICIPATION)', true);
    } catch (err) {
      logResult(6, 'Prevents duplicate event participation across registrations (409 DUPLICATE_PARTICIPATION)', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 7: Concurrent Team Registration Race Condition Safety
    // -------------------------------------------------------------
    try {
      // Setup a small team event with capacity 3, minTeamSize 3, maxTeamSize 3
      const createRaceEvtRes = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie
        },
        body: JSON.stringify({
          title: `Race Condition Event ${timestamp}`,
          description: 'Testing concurrency safety for team reservations.',
          category: 'Competition',
          venue: 'Arena Room 1',
          startTime: futureDate(50),
          endTime: futureDate(70),
          registrationDeadline: futureDate(40),
          maxCapacity: 3,
          registrationType: 'team',
          minTeamSize: 3,
          maxTeamSize: 3,
          status: 'published'
        })
      });
      const raceEvtData = await createRaceEvtRes.json();
      const raceEvtId = raceEvtData.data.id;

      const competitor1 = await createStudent('comp1', 'Competitor One');
      const competitor2 = await createStudent('comp2', 'Competitor Two');
      const helper1 = await createStudent('help1', 'Helper One');
      const helper2 = await createStudent('help2', 'Helper Two');
      const helper3 = await createStudent('help3', 'Helper Three');
      const helper4 = await createStudent('help4', 'Helper Four');

      // Both try to register a team of 3 simultaneously for an event with capacity 3
      const [resA, resB] = await Promise.all([
        fetch(`${BASE_URL}/events/${raceEvtId}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': competitor1.cookie },
          body: JSON.stringify({
            registrationType: 'team',
            teamName: 'Team Alpha Speed',
            memberEmails: [helper1.email, helper2.email]
          })
        }),
        fetch(`${BASE_URL}/events/${raceEvtId}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': competitor2.cookie },
          body: JSON.stringify({
            registrationType: 'team',
            teamName: 'Team Beta Speed',
            memberEmails: [helper3.email, helper4.email]
          })
        })
      ]);

      const statusA = resA.status;
      const statusB = resB.status;

      assert.ok(
        (statusA === 201 && statusB === 409) || (statusA === 409 && statusB === 201),
        `Exactly one team must succeed (201) and one must be rejected (409). Got ${statusA} and ${statusB}`
      );

      // Verify event capacity did not overbook
      const finalRaceEvt = await (await fetch(`${BASE_URL}/events/${raceEvtId}`)).json();
      assert.strictEqual(finalRaceEvt.data.currentRegistrations, 3, 'Capacity must remain exactly 3');

      logResult(7, 'Concurrent team registrations safely prevent overbooking under load', true);
    } catch (err) {
      logResult(7, 'Concurrent team registrations safely prevent overbooking under load', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 8: Invitation Listing and Ownership
    // -------------------------------------------------------------
    try {
      // Sarah checks her invitations
      const sarahInvRes = await fetch(`${BASE_URL}/invitations`, {
        headers: { 'Cookie': memberSarah.cookie }
      });
      const sarahInvBody = await sarahInvRes.json();
      assert.strictEqual(sarahInvRes.status, 200);
      assert.strictEqual(sarahInvBody.success, true);
      assert.strictEqual(sarahInvBody.data.length, 1);
      assert.strictEqual(sarahInvBody.data[0].teamName, 'CyberKnights');
      assert.strictEqual(sarahInvBody.data[0].leaderName, 'Alex Chen');
      sarahInvitationId = sarahInvBody.data[0].invitationId;

      // John checks his invitations
      const johnInvRes = await fetch(`${BASE_URL}/invitations`, {
        headers: { 'Cookie': memberJohn.cookie }
      });
      const johnInvBody = await johnInvRes.json();
      assert.strictEqual(johnInvBody.data.length, 1);
      johnInvitationId = johnInvBody.data[0].invitationId;

      // Emma checks her invitations (should have none)
      const emmaInvRes = await fetch(`${BASE_URL}/invitations`, {
        headers: { 'Cookie': memberEmma.cookie }
      });
      const emmaInvBody = await emmaInvRes.json();
      assert.strictEqual(emmaInvBody.data.length, 0);

      // Emma attempts to accept Sarah's invitation (cross-tenant ownership check)
      const unauthorizedAcceptRes = await fetch(`${BASE_URL}/invitations/${sarahInvitationId}/accept`, {
        method: 'POST',
        headers: { 'Cookie': memberEmma.cookie }
      });
      assert.strictEqual(unauthorizedAcceptRes.status, 403, 'Cross-user invitation response must be forbidden');

      logResult(8, 'Invitation listing respects ownership and rejects cross-user access (403)', true);
    } catch (err) {
      logResult(8, 'Invitation listing respects ownership and rejects cross-user access (403)', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 9: Acceptance Lifecycle & SmartPass Generation
    // -------------------------------------------------------------
    try {
      // 9a. Sarah accepts (first member) -> Team remains pending_members
      const sarahAcceptRes = await fetch(`${BASE_URL}/invitations/${sarahInvitationId}/accept`, {
        method: 'POST',
        headers: { 'Cookie': memberSarah.cookie }
      });
      const sarahAcceptBody = await sarahAcceptRes.json();
      assert.strictEqual(sarahAcceptRes.status, 200);
      assert.strictEqual(sarahAcceptBody.data.teamRegistrationStatus, 'pending_members');
      assert.strictEqual(sarahAcceptBody.data.myPass, undefined, 'No passes until full team acceptance');

      // 9b. John accepts (final member) -> Team transitions to confirmed and passes are generated
      const johnAcceptRes = await fetch(`${BASE_URL}/invitations/${johnInvitationId}/accept`, {
        method: 'POST',
        headers: { 'Cookie': memberJohn.cookie }
      });
      const johnAcceptBody = await johnAcceptRes.json();
      assert.strictEqual(johnAcceptRes.status, 200);
      assert.strictEqual(johnAcceptBody.data.teamRegistrationStatus, 'confirmed');
      assert.ok(johnAcceptBody.data.myPass, 'John must receive his personal SmartPass');
      assert.ok(johnAcceptBody.data.myPass.passCode.startsWith('PASS-'));
      assert.ok(johnAcceptBody.data.myPass.qrPayload.startsWith('EVPASS:v1:'));

      // Check DB passes table: exactly 3 passes issued
      const [passesInDb] = await pool.query(
        `SELECT id, user_id, pass_code, status FROM passes WHERE registration_id = ?`,
        [teamRegId]
      );
      assert.strictEqual(passesInDb.length, 3, 'Exactly 3 individual passes must be generated in DB');

      logResult(9, 'Full acceptance transitions team to confirmed and generates individual SmartPasses', true);
    } catch (err) {
      logResult(9, 'Full acceptance transitions team to confirmed and generates individual SmartPasses', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 10: Strict Pass Isolation
    // -------------------------------------------------------------
    try {
      // Sarah accesses /passes/my-passes
      const sarahPassesRes = await fetch(`${BASE_URL}/passes/my-passes`, {
        headers: { 'Cookie': memberSarah.cookie }
      });
      const sarahPasses = (await sarahPassesRes.json()).data;
      assert.strictEqual(sarahPasses.length, 1);
      assert.strictEqual(sarahPasses[0].eventId, event1Id);

      // Alex (Team Leader) accesses /passes/my-passes
      const alexPassesRes = await fetch(`${BASE_URL}/passes/my-passes`, {
        headers: { 'Cookie': leaderAlex.cookie }
      });
      const alexPasses = (await alexPassesRes.json()).data;
      assert.strictEqual(alexPasses.length, 1);
      assert.strictEqual(alexPasses[0].eventId, event1Id);

      // Ensure Alex's pass code is distinct from Sarah's pass code
      assert.notStrictEqual(alexPasses[0].passCode, sarahPasses[0].passCode);

      // Verify token_hash is never exposed in API payload
      assert.strictEqual(sarahPasses[0].tokenHash, undefined);
      assert.strictEqual(sarahPasses[0].token_hash, undefined);
      assert.strictEqual(alexPasses[0].tokenHash, undefined);

      logResult(10, 'Strict Pass Isolation: Leader and members receive only their own passes', true);
    } catch (err) {
      logResult(10, 'Strict Pass Isolation: Leader and members receive only their own passes', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 11: Decline Invitation and Capacity Release
    // -------------------------------------------------------------
    try {
      // Create Event for decline testing (Capacity 10, minTeamSize 3, maxTeamSize 4)
      const declineEvtRes = await fetch(`${BASE_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': adminCookie
        },
        body: JSON.stringify({
          title: `Decline Release Event ${timestamp}`,
          description: 'Testing capacity release on invitation decline.',
          category: 'Sports',
          venue: 'Sports Complex',
          startTime: futureDate(40),
          endTime: futureDate(60),
          registrationDeadline: futureDate(30),
          maxCapacity: 10,
          registrationType: 'team',
          minTeamSize: 3,
          maxTeamSize: 4,
          status: 'published'
        })
      });
      const declineEvtId = (await declineEvtRes.json()).data.id;

      const teamLead = await createStudent('tlead', 'Team Lead Person');
      const teamM1 = await createStudent('tm1', 'Team Member One');
      const teamM2 = await createStudent('tm2', 'Team Member Two');

      // Register team of 3 (reserves 3 seats)
      const regRes = await fetch(`${BASE_URL}/events/${declineEvtId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': teamLead.cookie },
        body: JSON.stringify({
          registrationType: 'team',
          teamName: 'DropSquad',
          memberEmails: [teamM1.email, teamM2.email]
        })
      });
      const regData = await regRes.json();
      assert.strictEqual(regRes.status, 201);
      const decRegId = regData.data.registrationId;

      // Verify capacity reserved
      const [beforeEvt] = await pool.query(`SELECT current_registrations FROM events WHERE id = ?`, [declineEvtId]);
      assert.strictEqual(beforeEvt[0].current_registrations, 3);

      // Get invitation ID for teamM1
      const invM1Res = await fetch(`${BASE_URL}/invitations`, {
        headers: { 'Cookie': teamM1.cookie }
      });
      const invM1 = (await invM1Res.json()).data[0];

      // teamM1 declines the invitation
      const declineRes = await fetch(`${BASE_URL}/invitations/${invM1.invitationId}/decline`, {
        method: 'POST',
        headers: { 'Cookie': teamM1.cookie }
      });
      const declineBody = await declineRes.json();
      assert.strictEqual(declineRes.status, 200);
      assert.strictEqual(declineBody.success, true);

      // Since viable members = 2 < minTeamSize (3), registration should be cancelled and capacity released
      const [regAfter] = await pool.query(`SELECT status FROM registrations WHERE id = ?`, [decRegId]);
      assert.strictEqual(regAfter[0].status, 'cancelled', 'Registration must be cancelled');

      const [afterEvt] = await pool.query(`SELECT current_registrations FROM events WHERE id = ?`, [declineEvtId]);
      assert.strictEqual(afterEvt[0].current_registrations, 0, 'Capacity must be fully released back to 0');

      logResult(11, 'Invitation decline drops below minTeamSize, cancels team and releases capacity', true);
    } catch (err) {
      logResult(11, 'Invitation decline drops below minTeamSize, cancels team and releases capacity', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 12: Repeated Acceptance / Decline Protection
    // -------------------------------------------------------------
    try {
      // Calling accept on Sarah's already accepted invitation
      const repeatAcceptRes = await fetch(`${BASE_URL}/invitations/${sarahInvitationId}/accept`, {
        method: 'POST',
        headers: { 'Cookie': memberSarah.cookie }
      });
      assert.strictEqual(repeatAcceptRes.status, 400);
      const repeatBody = await repeatAcceptRes.json();
      assert.strictEqual(repeatBody.error.code, 'INVALID_INVITATION_STATUS');

      // Calling decline on John's already accepted invitation
      const repeatDeclineRes = await fetch(`${BASE_URL}/invitations/${johnInvitationId}/decline`, {
        method: 'POST',
        headers: { 'Cookie': memberJohn.cookie }
      });
      assert.strictEqual(repeatDeclineRes.status, 400);

      logResult(12, 'Prevents repeated acceptance or decline on finalized invitations (400)', true);
    } catch (err) {
      logResult(12, 'Prevents repeated acceptance or decline on finalized invitations (400)', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 13: Registration Rollback Integrity After Failure
    // -------------------------------------------------------------
    try {
      // Verify initial event capacity
      const [evtBefore] = await pool.query(`SELECT current_registrations FROM events WHERE id = ?`, [event1Id]);
      const initialCapacity = evtBefore[0].current_registrations;

      const failLead = await createStudent('faillead', 'Fail Leader');

      // Trigger a failure by passing an invalid member account
      const failRes = await fetch(`${BASE_URL}/events/${event1Id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': failLead.cookie },
        body: JSON.stringify({
          registrationType: 'team',
          teamName: 'Doomed Team',
          memberEmails: ['nonexistent_user_for_rollback@campus.edu', memberEmma.email]
        })
      });
      assert.strictEqual(failRes.status, 400);

      // Verify event capacity is unchanged
      const [evtAfter] = await pool.query(`SELECT current_registrations FROM events WHERE id = ?`, [event1Id]);
      assert.strictEqual(evtAfter[0].current_registrations, initialCapacity, 'Capacity must not change upon rollback');

      // Verify no orphan registrations created
      const [orphanRegs] = await pool.query(`SELECT id FROM registrations WHERE team_name = 'Doomed Team'`);
      assert.strictEqual(orphanRegs.length, 0, 'No registration record must persist after rollback');

      logResult(13, 'Transaction rollback cleanly restores capacity and prevents orphan records', true);
    } catch (err) {
      logResult(13, 'Transaction rollback cleanly restores capacity and prevents orphan records', false, err.message);
    }

  } catch (globalErr) {
    console.error('Fatal test error in Phase 7 suite:', globalErr);
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
