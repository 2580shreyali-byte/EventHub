import React, { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { 
  Activity, 
  DoorOpen, 
  RefreshCw, 
  Info, 
  ShieldCheck, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

export function QueueLessPage() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [error, setError] = useState('');

  // Load events
  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await api.get('/events?limit=50');
        if (res.data?.success) {
          const evts = res.data.data.events || [];
          setEvents(evts);
          if (evts.length > 0) {
            setSelectedEventId(String(evts[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load events for QueueLess:', err);
      }
    }
    loadEvents();
  }, []);

  const fetchMetrics = async (eventId) => {
    if (!eventId) return;
    try {
      setError('');
      const res = await api.get(`/events/${eventId}/queueless`);
      if (res.data?.success) {
        setMetrics(res.data.data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      setError(err.message || 'Failed to load QueueLess metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedEventId) return;
    setLoading(true);
    fetchMetrics(selectedEventId);

    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMetrics(selectedEventId);
    }, 10000); // 10s auto refresh

    return () => clearInterval(interval);
  }, [selectedEventId, autoRefresh]);

  const getActivityBadge = (color, level) => {
    const colorClasses = {
      green: 'bg-emerald-50 text-[#16865B] border-emerald-200',
      yellow: 'bg-amber-50 text-amber-700 border-amber-200',
      red: 'bg-rose-50 text-[#DC4040] border-rose-200'
    };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${colorClasses[color] || 'bg-slate-100'}`}>
        <span className="w-2 h-2 rounded-full bg-current mr-2 opacity-80" />
        {level}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-200">
            <Activity className="w-3.5 h-3.5" />
            <span>QueueLess Live Velocity Engine</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#24212B] tracking-tight">Gate Flow Analytics</h1>
          <p className="text-sm text-[#777180] mt-1">Real-time check-in scan throughput over rolling 10-minute sliding windows</p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs font-semibold text-[#777180] bg-white px-3 py-2 rounded-xl border border-[#EAE6F0]">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-[#6D28D9] focus:ring-[#6D28D9]"
            />
            <span>Auto-Refresh (10s)</span>
          </label>
          <button
            onClick={() => fetchMetrics(selectedEventId)}
            className="p-2.5 rounded-xl bg-white border border-[#EAE6F0] hover:bg-slate-50 text-[#777180] hover:text-[#6D28D9] transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Event Selection Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#EAE6F0] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-96">
          <label className="block text-xs font-bold text-[#24212B] mb-1">Select Active Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full px-3.5 py-2 border border-[#EAE6F0] rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
          >
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title} ({evt.category})
              </option>
            ))}
          </select>
        </div>

        {lastRefreshed && (
          <span className="text-[11px] text-[#777180]">
            Last updated: {lastRefreshed.toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-2 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Recommended Gate Hero */}
      {metrics?.recommendedGateName && (
        <div className="bg-gradient-to-r from-emerald-800 to-[#16865B] rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>Recommended Fast-Flow Gate</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black">{metrics.recommendedGateName}</h2>
            <p className="text-xs text-emerald-100 max-w-xl">
              Currently handling the lowest scan frequency. Incoming attendees are advised to use this gate for minimal waiting time.
            </p>
          </div>
          <div className="text-center sm:text-right bg-white/10 px-5 py-4 rounded-2xl backdrop-blur-sm border border-white/20">
            <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-200">Terminal ID</span>
            <span className="text-2xl font-black">{metrics.recommendedGateId}</span>
          </div>
        </div>
      )}

      {/* Gate Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="h-48 rounded-3xl bg-white border border-[#EAE6F0] p-6 animate-pulse" />
          ))}
        </div>
      ) : !metrics || metrics.gates.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#EAE6F0] p-12 text-center max-w-md mx-auto">
          <DoorOpen className="w-12 h-12 text-[#6D28D9] mx-auto mb-3 opacity-50" />
          <h3 className="font-bold text-[#24212B]">No Active Gates Configured</h3>
          <p className="text-xs text-[#777180] mt-1">Configure gates for this event in the Admin Event Settings to activate QueueLess throughput monitoring.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {metrics.gates.map((gate) => (
            <div 
              key={gate.gateId}
              className={`bg-white rounded-3xl border p-6 shadow-sm transition-all space-y-4 ${
                gate.gateId === metrics.recommendedGateId
                  ? 'border-emerald-300 ring-2 ring-emerald-100'
                  : 'border-[#EAE6F0]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#777180]">Gate Terminal #{gate.gateId}</span>
                  <h3 className="text-lg font-extrabold text-[#24212B] mt-0.5">{gate.gateName}</h3>
                </div>
                {getActivityBadge(gate.indicatorColor, gate.activityLevel)}
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#EAE6F0]">
                <div className="p-3 bg-[#FAF9FC] rounded-2xl border border-[#EAE6F0]">
                  <span className="text-[10px] font-bold text-[#777180] uppercase tracking-wider block">Last 10 Min</span>
                  <span className="text-2xl font-black text-[#24212B] mt-1 block">{gate.scansInLast10Min}</span>
                  <span className="text-[10px] text-[#777180]">total check-in scans</span>
                </div>

                <div className="p-3 bg-[#FAF9FC] rounded-2xl border border-[#EAE6F0]">
                  <span className="text-[10px] font-bold text-[#777180] uppercase tracking-wider block">Throughput</span>
                  <span className="text-2xl font-black text-[#6D28D9] mt-1 block">{gate.throughputScansPerMin}</span>
                  <span className="text-[10px] text-[#777180]">scans / minute</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mandatory Transparency Disclaimer */}
      {metrics?.disclaimer && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-3 text-xs text-[#777180]">
          <Info className="w-4 h-4 text-[#6D28D9] flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <span className="font-bold text-[#24212B]">Operational Disclaimer:</span> {metrics.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
