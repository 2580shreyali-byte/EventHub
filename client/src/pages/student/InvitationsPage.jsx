import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import {
  Users,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  QrCode,
  ArrowRight,
  ShieldCheck,
  Mail
} from 'lucide-react';

export function InvitationsPage() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // invitationId being processed
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message, pass?: {} }
  const [error, setError] = useState('');

  const loadInvitations = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/invitations');
      if (res.data?.success) {
        setInvitations(res.data.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  const handleAccept = async (invitationId, teamName) => {
    try {
      setActionLoading(invitationId);
      setFeedback(null);
      setError('');
      const res = await api.post(`/invitations/${invitationId}/accept`);
      if (res.data?.success) {
        const data = res.data.data;
        if (data.teamRegistrationStatus === 'confirmed') {
          setFeedback({
            type: 'success',
            message: `Invitation accepted for team "${teamName}"! Team registration is now confirmed and your individual SmartPass has been issued.`,
            pass: data.myPass
          });
        } else {
          setFeedback({
            type: 'info',
            message: `Invitation accepted for team "${teamName}"! Waiting for remaining team members to accept before SmartPasses are issued.`
          });
        }
        // Remove accepted invitation from list
        setInvitations(prev => prev.filter(inv => inv.invitationId !== invitationId));
      }
    } catch (err) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (invitationId, teamName) => {
    if (!window.confirm(`Are you sure you want to decline the invitation for team "${teamName}"?`)) {
      return;
    }

    try {
      setActionLoading(invitationId);
      setFeedback(null);
      setError('');
      const res = await api.post(`/invitations/${invitationId}/decline`);
      if (res.data?.success) {
        setFeedback({
          type: 'info',
          message: `You declined the invitation for team "${teamName}".`
        });
        setInvitations(prev => prev.filter(inv => inv.invitationId !== invitationId));
      }
    } catch (err) {
      setError(err.message || 'Failed to decline invitation.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center space-x-2 text-xs font-bold text-[#6D28D9] uppercase tracking-wider mb-1">
          <Mail className="w-4 h-4" />
          <span>Team Invites</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#24212B] tracking-tight">
          Pending Team Invitations
        </h1>
        <p className="text-xs sm:text-sm text-[#777180] mt-1">
          Review, accept or decline team event invitations dispatched by fellow students.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Feedback Banner */}
      {feedback && (
        <div className={`p-5 rounded-2xl border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-purple-50 border-purple-200 text-purple-900'
        } shadow-sm space-y-3`}>
          <div className="flex items-start space-x-3">
            <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              feedback.type === 'success' ? 'text-[#16865B]' : 'text-[#6D28D9]'
            }`} />
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold">{feedback.message}</p>
              {feedback.pass && (
                <div className="mt-3 p-3 bg-white/80 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">Personal SmartPass Code</span>
                    <span className="font-mono font-extrabold text-sm text-[#24212B]">{feedback.pass.passCode}</span>
                  </div>
                  <Link
                    to="/my-passes"
                    className="px-4 py-2 rounded-lg bg-[#16865B] hover:bg-emerald-800 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>View in My Passes</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-3 border-purple-200 border-t-[#6D28D9] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#777180]">Checking for team invitations...</p>
        </div>
      ) : invitations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EAE6F0] p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#F1EBFF] text-[#6D28D9] flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-lg text-[#24212B]">No Pending Invitations</h3>
          <p className="text-xs text-[#777180] mt-1.5 leading-relaxed">
            You're all caught up! When a team leader invites you to participate in a team event, your invitation card will appear here.
          </p>
          <Link
            to="/events"
            className="mt-6 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white font-bold text-xs shadow-sm transition-colors"
          >
            <span>Explore Events</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {invitations.map((inv) => (
            <div
              key={inv.invitationId}
              className="bg-white rounded-2xl border border-[#EAE6F0] p-6 shadow-sm hover:border-purple-200 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#F1EBFF] text-[#6D28D9] border border-purple-200">
                    Team: {inv.teamName}
                  </span>
                  <span className="text-[11px] text-[#777180] flex items-center space-x-1">
                    <span>Invited by</span>
                    <strong className="text-[#24212B]">{inv.leaderName}</strong>
                  </span>
                </div>

                <div>
                  <Link
                    to={`/events/${inv.event.id}`}
                    className="font-extrabold text-lg text-[#24212B] hover:text-[#6D28D9] transition-colors"
                  >
                    {inv.event.title}
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[#777180]">
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#777180]" />
                    <span>{inv.event.venue}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#777180]" />
                    <span>{new Date(inv.event.startTime).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#777180]" />
                    <span>{new Date(inv.event.startTime).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0 border-[#EAE6F0]">
                <button
                  onClick={() => handleDecline(inv.invitationId, inv.teamName)}
                  disabled={actionLoading === inv.invitationId}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold text-xs transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <XCircle className="w-4 h-4 text-slate-400 hover:text-rose-600" />
                  <span>Decline</span>
                </button>

                <button
                  onClick={() => handleAccept(inv.invitationId, inv.teamName)}
                  disabled={actionLoading === inv.invitationId}
                  className="px-5 py-2.5 rounded-xl bg-[#16865B] hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{actionLoading === inv.invitationId ? 'Accepting...' : 'Accept Invitation'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
