import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  ShieldCheck,
  QrCode,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  DoorOpen,
  Info,
  Plus,
  Trash2,
  Mail,
  UserPlus,
  LogIn,
  XCircle
} from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill.jsx';

export function EventDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isStudent, isAdmin } = useAuth();

  const [event, setEvent] = useState(null);
  const [gates, setGates] = useState([]);
  const [existingPass, setExistingPass] = useState(null);
  const [registeredNewPass, setRegisteredNewPass] = useState(null);
  const [teamRegistrationResult, setTeamRegistrationResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  // Team Registration Form State
  const [teamName, setTeamName] = useState('');
  const [memberEmails, setMemberEmails] = useState(['']);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const eventRes = await api.get(`/events/${id}`);
      if (eventRes.data?.success) {
        const evt = eventRes.data.data;
        setEvent(evt);
        setGates(evt.gates || []);

        // Initialize member email fields based on minTeamSize
        const minMembersNeeded = Math.max(1, (evt.minTeamSize || 2) - 1);
        setMemberEmails(Array.from({ length: minMembersNeeded }, () => ''));
      }

      // If authenticated student, check if already registered for a pass
      if (isAuthenticated && isStudent) {
        try {
          const passesRes = await api.get('/passes/my-passes');
          if (passesRes.data?.success) {
            const myPasses = passesRes.data.data || [];
            const match = myPasses.find(p => Number(p.eventId) === Number(id));
            if (match) {
              setExistingPass(match);
            }
          }
        } catch {
          // Ignore failure to fetch personal passes
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load event details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, isAuthenticated, isStudent]);

  const handleIndividualRegister = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/events/${id}` } } });
      return;
    }

    try {
      setRegistering(true);
      setError('');
      const res = await api.post(`/events/${id}/register`, {
        registrationType: 'individual'
      });
      if (res.data?.success) {
        setRegisteredNewPass(res.data.data.pass);
        await loadData();
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  const handleTeamRegister = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/events/${id}` } } });
      return;
    }

    const trimmedTeamName = teamName.trim();
    if (!trimmedTeamName) {
      setError('Please provide a team name.');
      return;
    }

    const cleanMemberEmails = memberEmails
      .map(m => m.trim().toLowerCase())
      .filter(m => m.length > 0);

    const totalHeadcount = 1 + cleanMemberEmails.length;
    if (totalHeadcount < (event.minTeamSize || 1)) {
      setError(`Team size must be at least ${event.minTeamSize} members (including you as leader). Please add more member emails.`);
      return;
    }

    if (totalHeadcount > (event.maxTeamSize || 10)) {
      setError(`Team size cannot exceed ${event.maxTeamSize} members.`);
      return;
    }

    try {
      setRegistering(true);
      setError('');
      const res = await api.post(`/events/${id}/register`, {
        registrationType: 'team',
        teamName: trimmedTeamName,
        memberEmails: cleanMemberEmails
      });

      if (res.data?.success) {
        setTeamRegistrationResult(res.data.data);
        await loadData();
      }
    } catch (err) {
      setError(err.message || 'Team registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  const handleAcceptDirect = async (invitationId) => {
    try {
      setActionLoading(true);
      setError('');
      const res = await api.post(`/invitations/${invitationId}/accept`);
      if (res.data?.success) {
        if (res.data.data?.myPass) {
          setRegisteredNewPass(res.data.data.myPass);
        }
        setActionMessage(res.data.message || 'Invitation accepted!');
        await loadData();
      }
    } catch (err) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineDirect = async (invitationId) => {
    if (!window.confirm('Are you sure you want to decline this invitation?')) return;
    try {
      setActionLoading(true);
      setError('');
      const res = await api.post(`/invitations/${invitationId}/decline`);
      if (res.data?.success) {
        setActionMessage('You have declined the team invitation.');
        await loadData();
      }
    } catch (err) {
      setError(err.message || 'Failed to decline invitation.');
    } finally {
      setActionLoading(false);
    }
  };

  const addMemberField = () => {
    const currentTotal = 1 + memberEmails.length;
    if (currentTotal < (event?.maxTeamSize || 10)) {
      setMemberEmails([...memberEmails, '']);
    }
  };

  const removeMemberField = (index) => {
    if (memberEmails.length > 1) {
      setMemberEmails(memberEmails.filter((_, i) => i !== index));
    }
  };

  const updateMemberEmail = (index, value) => {
    const updated = [...memberEmails];
    updated[index] = value;
    setMemberEmails(updated);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-8 h-8 border-3 border-purple-200 border-t-[#6D28D9] rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-[#777180]">Loading event details...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-[#DC4040] mx-auto mb-3" />
        <h2 className="text-xl font-bold text-[#24212B]">Event Not Found</h2>
        <p className="text-xs text-[#777180] mt-1">{error || 'This event may have been unlisted or removed.'}</p>
        <Link to="/events" className="mt-4 inline-block px-4 py-2 bg-[#6D28D9] text-white rounded-xl text-xs font-bold">
          Back to Events
        </Link>
      </div>
    );
  }

  const isFull = event.currentRegistrations >= event.maxCapacity;
  const isPastDeadline = new Date() > new Date(event.registrationDeadline);
  const isClosed = isFull || isPastDeadline || event.status !== 'published';
  const isTeamEvent = event.registrationType === 'team';
  const userParticipation = event.userParticipation;
  const isUserParticipating = !!userParticipation;
  const isTeamPending = userParticipation?.registrationStatus === 'pending_members';
  const isTeamConfirmed = userParticipation?.registrationStatus === 'confirmed';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link to="/events" className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#777180] hover:text-[#6D28D9]">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to all events</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs">
          <CheckCircle2 className="w-4 h-4 text-[#16865B] flex-shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Registration Success Banner (Individual Pass) */}
      {(registeredNewPass || existingPass) && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-emerald-900 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="w-6 h-6 text-[#16865B] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-extrabold text-base text-[#16865B]">Registration Confirmed! SmartPass Active.</h3>
              <p className="text-xs text-emerald-800 mt-1">
                Your individual cryptographic QR pass is ready. Pass Code: <span className="font-mono font-bold">{(registeredNewPass || existingPass).passCode}</span>
              </p>
            </div>
          </div>
          <Link
            to="/my-passes"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#16865B] text-white text-xs font-bold hover:bg-emerald-800 transition-colors whitespace-nowrap text-center"
          >
            Open My SmartPass
          </Link>
        </div>
      )}

      {/* Team Pending Status Banner / Roster */}
      {isTeamPending && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6 text-purple-900 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <Clock className="w-6 h-6 text-[#6D28D9] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-extrabold text-base text-[#6D28D9]">
                  Team Registration: "{userParticipation.teamName}"
                </h3>
                <p className="text-xs text-purple-800 mt-0.5">
                  Status: <span className="font-bold uppercase tracking-wider bg-purple-200 px-2 py-0.5 rounded text-[10px]">Awaiting Member Confirmations</span> · Reserved Headcount: <strong className="text-[#24212B]">{userParticipation.reservedHeadcount} seats</strong>
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  {userParticipation.isLeader
                    ? 'You are the Team Leader. Passes will be issued to each member once everyone accepts.'
                    : `You have been invited to participate on this team as a member.`}
                </p>
              </div>
            </div>

            {/* If current user is an invited member who hasn't accepted yet */}
            {!userParticipation.isLeader && userParticipation.memberStatus === 'invited' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDeclineDirect(userParticipation.invitationId)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 font-bold text-xs transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleAcceptDirect(userParticipation.invitationId)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#16865B] hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-colors"
                >
                  {actionLoading ? 'Accepting...' : 'Accept Invitation'}
                </button>
              </div>
            )}
          </div>

          {/* Teammates Roster */}
          {userParticipation.teammates?.length > 0 && (
            <div className="bg-white/90 rounded-xl p-4 border border-purple-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 block mb-2">Team Members & Acceptance Progress</span>
              <div className="space-y-2">
                {userParticipation.teammates.map((tm, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-purple-50/60">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-[#24212B]">{tm.fullName}</span>
                      <span className="text-[10px] text-[#777180]">({tm.email})</span>
                      {tm.role === 'leader' && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-200 text-[#6D28D9]">Leader</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      tm.status === 'accepted'
                        ? 'bg-emerald-100 text-[#16865B]'
                        : tm.status === 'declined'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {tm.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Event Card */}
      <div className="bg-white rounded-3xl border border-[#EAE6F0] p-6 sm:p-10 shadow-sm space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#6D28D9] bg-[#F1EBFF] px-3 py-1 rounded-full">
              {event.category}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
              {isTeamEvent ? `Team Event (${event.minTeamSize}-${event.maxTeamSize} members)` : 'Individual'}
            </span>
            <StatusPill status={event.status} />
          </div>

          <div className="text-right">
            <span className="text-xs text-[#777180]">Capacity Status:</span>
            <p className="text-sm font-extrabold text-[#24212B]">
              {event.currentRegistrations || 0} / {event.maxCapacity} <span className="text-xs font-normal text-emerald-600">({Math.max(0, event.maxCapacity - (event.currentRegistrations || 0))} available)</span>
            </p>
          </div>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#24212B] tracking-tight">{event.title}</h1>
          <p className="mt-4 text-sm text-[#777180] leading-relaxed whitespace-pre-line">{event.description}</p>
        </div>

        {/* Schedule & Location Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#EAE6F0]">
          <div className="p-4 rounded-xl bg-[#FAF9FC] border border-[#EAE6F0]">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#6D28D9] mb-1">
              <Clock className="w-4 h-4" />
              <span>Date & Time</span>
            </div>
            <p className="text-xs font-semibold text-[#24212B]">{new Date(event.startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
            <p className="text-[11px] text-[#777180]">
              {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF9FC] border border-[#EAE6F0]">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#6D28D9] mb-1">
              <MapPin className="w-4 h-4" />
              <span>Campus Venue</span>
            </div>
            <p className="text-xs font-semibold text-[#24212B]">{event.venue}</p>
            <p className="text-[11px] text-[#777180]">Authorized Gates Configured</p>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF9FC] border border-[#EAE6F0]">
            <div className="flex items-center space-x-2 text-xs font-bold text-[#6D28D9] mb-1">
              <Calendar className="w-4 h-4" />
              <span>Registration Closes</span>
            </div>
            <p className="text-xs font-semibold text-[#24212B]">{new Date(event.registrationDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p className={`text-[11px] ${isPastDeadline ? 'text-[#DC4040] font-bold' : 'text-[#16865B]'}`}>
              {isPastDeadline ? 'Deadline Passed' : 'Active Registration'}
            </p>
          </div>
        </div>

        {/* Authorized Gates */}
        {gates.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-[#EAE6F0]">
            <h3 className="text-sm font-extrabold text-[#24212B] flex items-center space-x-2">
              <DoorOpen className="w-4 h-4 text-[#6D28D9]" />
              <span>Authorized Check-In Gates</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gates.map((g) => (
                <div key={g.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#24212B]">{g.gateName}</span>
                    {g.locationDescription && (
                      <p className="text-[11px] text-[#777180]">{g.locationDescription}</p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Active Gate
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEAM REGISTRATION FORM (When event is team, user is logged in as student, and NOT yet participating) */}
        {isTeamEvent && !isUserParticipating && !existingPass && !registeredNewPass && isStudent && !isClosed && (
          <form onSubmit={handleTeamRegister} className="pt-6 border-t border-[#EAE6F0] space-y-6">
            <div className="bg-[#FAF9FC] p-6 rounded-2xl border border-purple-100 space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-[#6D28D9] uppercase tracking-wider">
                <Users className="w-4 h-4" />
                <span>Team Registration & Member Invitations</span>
              </div>
              <p className="text-xs text-[#777180]">
                As Team Leader, you will reserve seats for your team. Each invited student will receive an invitation in their portal to accept.
              </p>

              {/* Team Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#24212B]">Team Name</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. CyberKnights"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#EAE6F0] rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] outline-none"
                />
              </div>

              {/* Dynamic Member Emails */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#24212B] flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#6D28D9]" />
                    <span>Invite Team Members by Email ({memberEmails.length} invited)</span>
                  </label>
                  <span className="text-[11px] text-[#777180]">
                    Total Team Headcount: <strong className="text-[#24212B]">{1 + memberEmails.length}</strong> (Allowed: {event.minTeamSize}-{event.maxTeamSize})
                  </span>
                </div>

                <div className="space-y-2">
                  {memberEmails.map((email, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => updateMemberEmail(idx, e.target.value)}
                          placeholder={`Team member #${idx + 1} email (e.g. student@campus.edu)`}
                          className="w-full px-3.5 py-2 bg-white border border-[#EAE6F0] rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#6D28D9]/20 focus:border-[#6D28D9] outline-none"
                        />
                      </div>
                      {memberEmails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMemberField(idx)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Remove member field"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {1 + memberEmails.length < (event.maxTeamSize || 10) && (
                  <button
                    type="button"
                    onClick={addMemberField}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#6D28D9] hover:text-[#4C1D95] pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Member</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={registering}
                className="px-8 py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white font-bold text-sm shadow-md shadow-purple-200 transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{registering ? 'Reserving Team Capacity...' : 'Register Team & Send Invitations'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Action Button Section */}
        <div className="pt-6 border-t border-[#EAE6F0] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[#777180]">
            {isStudent && (
              <span className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#16865B]" />
                <span>Verified Campus Student</span>
              </span>
            )}
          </div>

          <div>
            {!isAuthenticated ? (
              <Link
                to="/login"
                state={{ from: { pathname: `/events/${id}` } }}
                className="px-8 py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white font-bold text-sm shadow-md shadow-purple-200 transition-all flex items-center space-x-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{isTeamEvent ? 'Sign In as Student to Register Team' : 'Sign In to Register'}</span>
              </Link>
            ) : existingPass || registeredNewPass ? (
              <Link
                to="/my-passes"
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center space-x-2 transition-colors"
              >
                <QrCode className="w-4 h-4" />
                <span>View My SmartPass</span>
              </Link>
            ) : isTeamPending ? (
              <Link
                to="/invitations"
                className="px-6 py-3 rounded-xl bg-purple-100 hover:bg-purple-200 text-[#6D28D9] font-bold text-sm flex items-center space-x-2 transition-colors"
              >
                <Clock className="w-4 h-4" />
                <span>View Team Invitations Portal</span>
              </Link>
            ) : isAdmin ? (
              <Link
                to={`/admin/events/${event.id}/edit`}
                className="px-6 py-3 rounded-xl bg-[#6D28D9] text-white font-bold text-sm hover:bg-[#4C1D95]"
              >
                Edit Event (Admin)
              </Link>
            ) : isClosed ? (
              <button
                disabled
                className="px-6 py-3 rounded-xl bg-slate-200 text-slate-500 font-bold text-sm cursor-not-allowed"
              >
                {isFull ? 'Event Full (Capacity Reached)' : 'Registration Closed'}
              </button>
            ) : !isTeamEvent ? (
              <button
                onClick={handleIndividualRegister}
                disabled={registering}
                className="px-8 py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white font-bold text-sm shadow-md shadow-purple-200 transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <QrCode className="w-4 h-4" />
                <span>{registering ? 'Claiming Pass...' : 'Register & Claim SmartPass'}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
