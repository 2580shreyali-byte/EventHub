import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { 
  Calendar, 
  Plus, 
  ScanLine, 
  Activity, 
  Users, 
  Clock, 
  MapPin, 
  Edit3, 
  Trash2, 
  CheckCircle,
  AlertCircle,
  DoorOpen
} from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill.jsx';

export function AdminDashboardPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError('');
      // Admin sees all events including drafts/cancelled
      const res = await api.get('/events?limit=50');
      if (res.data?.success) {
        setEvents(res.data.data.events || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCancelOrDelete = async (eventId, title) => {
    if (!window.confirm(`Are you sure you want to cancel or delete "${title}"?`)) {
      return;
    }

    try {
      const res = await api.delete(`/events/${eventId}`);
      if (res.data?.success) {
        setMessage(res.data.message || 'Event processed successfully.');
        fetchEvents();
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel or delete event.');
    }
  };

  const totalCapacity = events.reduce((sum, e) => sum + (e.maxCapacity || 0), 0);
  const totalRegistrations = events.reduce((sum, e) => sum + (e.currentRegistrations || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#24212B] tracking-tight">Campus Event Operations</h1>
          <p className="text-sm text-[#777180] mt-1">Administrator console for event scheduling, gate verification and live flow</p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/admin/events/new"
            className="px-4 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white text-xs font-bold shadow-sm shadow-purple-200 flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Event</span>
          </Link>
          <Link
            to="/admin/scanner"
            className="px-4 py-2.5 rounded-xl bg-white border border-[#EAE6F0] hover:bg-slate-50 text-xs font-bold text-[#24212B] flex items-center space-x-1.5 transition-colors"
          >
            <ScanLine className="w-4 h-4 text-[#6D28D9]" />
            <span>Gate Scanner</span>
          </Link>
          <Link
            to="/admin/queueless"
            className="px-4 py-2.5 rounded-xl bg-white border border-[#EAE6F0] hover:bg-slate-50 text-xs font-bold text-[#24212B] flex items-center space-x-1.5 transition-colors"
          >
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>QueueLess</span>
          </Link>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-emerald-800 text-xs">
          <CheckCircle className="w-4 h-4 text-[#16865B] flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-[#EAE6F0] shadow-sm">
          <span className="text-xs font-semibold text-[#777180]">Total Managed Events</span>
          <h3 className="text-3xl font-extrabold text-[#24212B] mt-1">{events.length}</h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#EAE6F0] shadow-sm">
          <span className="text-xs font-semibold text-[#777180]">Total Student Registrations</span>
          <h3 className="text-3xl font-extrabold text-[#6D28D9] mt-1">{totalRegistrations}</h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#EAE6F0] shadow-sm">
          <span className="text-xs font-semibold text-[#777180]">Aggregate Campus Capacity</span>
          <h3 className="text-3xl font-extrabold text-emerald-700 mt-1">{totalCapacity} <span className="text-xs font-normal text-[#777180]">seats</span></h3>
        </div>
      </div>

      {/* Events Table / List */}
      <div className="bg-white rounded-3xl border border-[#EAE6F0] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#EAE6F0] flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#24212B]">All Events</h2>
          <span className="text-xs text-[#777180]">{events.length} active records</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[#777180]">Loading event inventory...</div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-10 h-10 text-[#6D28D9] mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold text-[#24212B]">No events found</p>
            <Link to="/admin/events/new" className="mt-2 inline-block text-xs font-bold text-[#6D28D9] hover:underline">
              Create your first campus event
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF9FC] border-b border-[#EAE6F0] text-[#777180] font-bold uppercase tracking-wider">
                  <th className="py-3 px-6">Event Title & Category</th>
                  <th className="py-3 px-6">Date & Schedule</th>
                  <th className="py-3 px-6">Venue</th>
                  <th className="py-3 px-6">Registrations</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6F0]">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-extrabold text-[#24212B] text-sm">{evt.title}</div>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-[#6D28D9] bg-[#F1EBFF] px-2 py-0.5 rounded-full inline-block mt-1">
                        {evt.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#777180] whitespace-nowrap">
                      <div>{new Date(evt.startTime).toLocaleDateString()}</div>
                      <div className="text-[10px]">
                        {new Date(evt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-[#777180]">{evt.venue}</td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-[#24212B]">
                        {evt.currentRegistrations || 0} / {evt.maxCapacity}
                      </div>
                      <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div 
                          className="bg-[#6D28D9] h-1.5 rounded-full" 
                          style={{ width: `${Math.min(100, ((evt.currentRegistrations || 0) / evt.maxCapacity) * 100)}%` }} 
                        />
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <StatusPill status={evt.status} />
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap space-x-2">
                      <Link
                        to={`/admin/events/${evt.id}/edit`}
                        className="p-1.5 rounded-lg text-[#777180] hover:text-[#6D28D9] hover:bg-[#F1EBFF] inline-flex items-center"
                        title="Edit Event"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleCancelOrDelete(evt.id, evt.title)}
                        className="p-1.5 rounded-lg text-[#777180] hover:text-[#DC4040] hover:bg-rose-50 inline-flex items-center"
                        title="Cancel / Delete Event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
