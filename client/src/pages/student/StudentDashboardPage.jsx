import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';
import { 
  Calendar, 
  QrCode, 
  Award, 
  ArrowRight, 
  Clock, 
  MapPin, 
  Sparkles,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill.jsx';

export function StudentDashboardPage() {
  const { user } = useAuth();
  const [passes, setPasses] = useState([]);
  const [recommendedEvents, setRecommendedEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [passesRes, eventsRes] = await Promise.allSettled([
          api.get('/passes/my-passes'),
          api.get('/events?limit=4')
        ]);

        if (passesRes.status === 'fulfilled' && passesRes.value.data?.success) {
          setPasses(passesRes.value.data.data || []);
        }

        if (eventsRes.status === 'fulfilled' && eventsRes.value.data?.success) {
          setRecommendedEvents(eventsRes.value.data.data.events || []);
        }
      } catch {
        // Handled
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const activePasses = passes.filter(p => p.status === 'active');
  const checkedInPasses = passes.filter(p => p.status === 'checked_in');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#4C1D95] to-[#6D28D9] rounded-2xl p-6 sm:p-8 text-white shadow-md shadow-purple-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Student Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.fullName}!
          </h1>
          <p className="text-purple-100 text-xs sm:text-sm mt-1">
            {user?.department} · Student ID: <span className="font-mono font-semibold">{user?.studentId}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Link
            to="/my-passes"
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-white text-[#4C1D95] font-bold text-xs hover:bg-slate-100 flex items-center justify-center space-x-2 transition-all"
          >
            <QrCode className="w-4 h-4 text-[#6D28D9]" />
            <span>View My Passes ({passes.length})</span>
          </Link>
          <Link
            to="/events"
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-purple-800/60 hover:bg-purple-800 text-white font-bold text-xs border border-purple-400/40 flex items-center justify-center space-x-2 transition-all"
          >
            <span>Explore Events</span>
          </Link>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-[#EAE6F0] shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-[#F1EBFF] text-[#6D28D9] flex items-center justify-center">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#777180]">Active SmartPasses</p>
            <h3 className="text-2xl font-extrabold text-[#24212B]">{activePasses.length}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAE6F0] shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#16865B] flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#777180]">Events Attended</p>
            <h3 className="text-2xl font-extrabold text-[#24212B]">{checkedInPasses.length}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAE6F0] shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#777180]">CampusPass Reward Points</p>
            <h3 className="text-2xl font-extrabold text-[#24212B]">{user?.rewardPoints || 0} <span className="text-xs font-normal text-[#777180]">pts</span></h3>
          </div>
        </div>
      </div>

      {/* Active Passes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#24212B] flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-[#6D28D9]" />
            <span>Your Registered Events & Passes</span>
          </h2>
          {passes.length > 0 && (
            <Link to="/my-passes" className="text-xs font-bold text-[#6D28D9] hover:underline flex items-center space-x-1">
              <span>All Passes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="h-40 rounded-2xl bg-white border border-[#EAE6F0] animate-pulse" />
        ) : passes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#EAE6F0] p-8 text-center">
            <Calendar className="w-10 h-10 text-[#6D28D9] mx-auto mb-2 opacity-50" />
            <h3 className="font-bold text-[#24212B] text-sm">You haven't registered for any events yet</h3>
            <p className="text-xs text-[#777180] mt-1">Discover campus symposiums and workshops to claim your first SmartPass.</p>
            <Link
              to="/events"
              className="mt-4 inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#6D28D9] text-white text-xs font-bold hover:bg-[#4C1D95] transition-colors"
            >
              <span>Explore Events</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {passes.slice(0, 2).map((pass) => (
              <div 
                key={pass.passId} 
                className="bg-white rounded-2xl border border-[#EAE6F0] p-5 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] font-bold text-[#777180]">{pass.passCode}</span>
                    <StatusPill status={pass.status} />
                  </div>
                  <h3 className="font-bold text-[#24212B] text-base">{pass.eventTitle}</h3>
                  <div className="mt-3 space-y-1.5 text-xs text-[#777180]">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span>{new Date(pass.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span>{pass.venue}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#EAE6F0] flex items-center justify-between">
                  <span className="text-[11px] text-[#777180]">Issued: {new Date(pass.issuedAt).toLocaleDateString()}</span>
                  <Link
                    to="/my-passes"
                    className="px-3 py-1.5 rounded-lg bg-[#F1EBFF] text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white font-bold text-xs transition-colors flex items-center space-x-1"
                  >
                    <span>Show QR Code</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Events */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-[#24212B] flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-[#6D28D9]" />
          <span>Events in Your University</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {recommendedEvents.map((evt) => (
            <div 
              key={evt.id} 
              className="bg-white rounded-2xl border border-[#EAE6F0] p-4 shadow-sm hover:border-purple-300 transition-all flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6D28D9] bg-[#F1EBFF] px-2 py-0.5 rounded-full">
                  {evt.category}
                </span>
                <h3 className="font-bold text-[#24212B] text-sm mt-2 line-clamp-1">{evt.title}</h3>
                <p className="text-xs text-[#777180] mt-1 line-clamp-2">{evt.description}</p>
                <div className="mt-3 text-[11px] text-[#777180] space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3 h-3 text-[#6D28D9]" />
                    <span>{new Date(evt.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="w-3 h-3 text-[#6D28D9]" />
                    <span className="line-clamp-1">{evt.venue}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2">
                <Link
                  to={`/events/${evt.id}`}
                  className="w-full block text-center py-2 px-3 rounded-lg bg-slate-50 hover:bg-[#F1EBFF] text-[#6D28D9] font-bold text-xs transition-colors"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
