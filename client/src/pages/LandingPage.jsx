import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  Calendar, 
  QrCode, 
  Zap, 
  ShieldCheck, 
  Users, 
  MapPin, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  Activity,
  Sparkles
} from 'lucide-react';
import { StatusPill } from '../components/common/StatusPill.jsx';

export function LandingPage() {
  const { isAuthenticated, isStudent, isAdmin } = useAuth();
  const [featuredEvents, setFeaturedEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeaturedEvents() {
      try {
        const res = await api.get('/events?limit=3');
        if (res.data?.success) {
          setFeaturedEvents(res.data.data.events || []);
        }
      } catch {
        // Fallback gracefully
        setFeaturedEvents([]);
      } finally {
        setLoading(false);
      }
    }
    loadFeaturedEvents();
  }, []);

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#F1EBFF] text-[#6D28D9] text-xs font-bold uppercase tracking-wider mb-6 border border-purple-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Gen Campus Experience</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-[#24212B] tracking-tight max-w-4xl mx-auto leading-tight sm:leading-none">
            Intelligent Campus Events. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6D28D9] to-[#4C1D95]">
              Seamless Entry. Zero Bottlenecks.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-[#777180] max-w-2xl mx-auto">
            Discover campus symposiums, hackathons, and workshops. Register instantly, enter gates via tamper-proof blind SmartPass QR codes, and monitor live gate velocity with QueueLess.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {isAuthenticated ? (
              <Link
                to={isAdmin ? "/admin" : "/dashboard"}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white font-bold shadow-md shadow-purple-200 flex items-center justify-center space-x-2 transition-all"
              >
                <span>Go to {isAdmin ? 'Admin Portal' : 'My Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white font-bold shadow-md shadow-purple-200 flex items-center justify-center space-x-2 transition-all"
                >
                  <span>Student Sign Up</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/events"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-[#24212B] font-bold border border-[#EAE6F0] flex items-center justify-center space-x-2 transition-all"
                >
                  <span>Browse Campus Events</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Featured Events */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#24212B]">Featured Campus Events</h2>
            <p className="text-sm text-[#777180] mt-1">Live events actively accepting verified university registrations</p>
          </div>
          <Link
            to="/events"
            className="text-sm font-bold text-[#6D28D9] hover:text-[#4C1D95] flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-white border border-[#EAE6F0] p-6 animate-pulse space-y-4">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-6 bg-slate-200 rounded w-3/4" />
                <div className="h-16 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : featuredEvents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#EAE6F0] p-12 text-center max-w-xl mx-auto">
            <Calendar className="w-10 h-10 text-[#6D28D9] mx-auto mb-3 opacity-60" />
            <h3 className="font-bold text-[#24212B]">No Upcoming Events Published Yet</h3>
            <p className="text-xs text-[#777180] mt-1">Check back shortly or log in as an administrator to publish events.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredEvents.map((evt) => (
              <div 
                key={evt.id} 
                className="bg-white rounded-2xl border border-[#EAE6F0] hover:border-purple-300 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6D28D9] bg-[#F1EBFF] px-2.5 py-0.5 rounded-full">
                      {evt.category}
                    </span>
                    <StatusPill status={evt.status} />
                  </div>

                  <h3 className="text-lg font-bold text-[#24212B] line-clamp-1">{evt.title}</h3>
                  <p className="text-xs text-[#777180] mt-2 line-clamp-2 leading-relaxed">{evt.description}</p>

                  <div className="mt-4 pt-4 border-t border-[#EAE6F0] space-y-2 text-xs text-[#777180]">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span>{new Date(evt.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span className="line-clamp-1">{evt.venue}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span>{evt.currentRegistrations || 0} / {evt.maxCapacity} registered</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3">
                  <Link
                    to={`/events/${evt.id}`}
                    className="w-full block text-center py-2.5 px-4 rounded-xl font-bold text-xs bg-[#F1EBFF] text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white transition-colors"
                  >
                    View Details & Register
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Product Architecture Pillars */}
      <section className="bg-white border-y border-[#EAE6F0] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#24212B]">Built for Real Campus Operations</h2>
            <p className="text-sm text-[#777180] mt-2">Engineered to eliminate gate queues, ticket fraud, and manual attendance tracking</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-[#FAF9FC] border border-[#EAE6F0] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#6D28D9] flex items-center justify-center font-bold">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-[#24212B]">SmartPass Blind QR Verification</h3>
              <p className="text-xs text-[#777180] leading-relaxed">
                Raw tokens are never stored in the database. The server stores only SHA-256 blind hashes. Passes rotate instantly upon reissuance to defeat screenshots.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FAF9FC] border border-[#EAE6F0] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#16865B] flex items-center justify-center font-bold">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-[#24212B]">QueueLess Gate Velocity</h3>
              <p className="text-xs text-[#777180] leading-relaxed">
                Live terminal scan throughput computed over rolling 10-minute windows. Recommends the fastest open gate without claiming physical line lengths.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#FAF9FC] border border-[#EAE6F0] space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base text-[#24212B]">Atomic Single-Transaction Check-in</h3>
              <p className="text-xs text-[#777180] leading-relaxed">
                Check-in, attendance logging, and +50 reward point ledger credits run in a single ACID transaction guarded by unique database constraints.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-[#4C1D95] to-[#6D28D9] rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl shadow-purple-200">
          <h2 className="text-2xl sm:text-4xl font-extrabold">Ready to experience seamless campus events?</h2>
          <p className="text-purple-100 text-sm sm:text-base max-w-xl mx-auto mt-3">
            Join students and campus organizers on EventHub today. Register in seconds and receive your personal SmartPass.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/register"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-[#4C1D95] font-extrabold text-sm hover:bg-slate-100 transition-colors"
            >
              Get Started Now
            </Link>
            <Link
              to="/events"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-purple-800/60 hover:bg-purple-800 text-white font-extrabold text-sm border border-purple-400/40 transition-colors"
            >
              Explore Live Events
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
