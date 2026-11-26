import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Calendar, ArrowLeft, AlertCircle, PlusCircle, CheckCircle, DoorOpen } from 'lucide-react';

export function EditEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Hackathon',
    venue: '',
    startTime: '',
    endTime: '',
    registrationDeadline: '',
    maxCapacity: 100,
    registrationType: 'individual',
    minTeamSize: 2,
    maxTeamSize: 4,
    status: 'published'
  });

  const [gates, setGates] = useState([]);
  const [newGateName, setNewGateName] = useState('');
  const [newGateDesc, setNewGateDesc] = useState('');

  const toInputDate = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    async function loadEvent() {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/events/${id}`);
        if (res.data?.success) {
          const evt = res.data.data;
          setFormData({
            title: evt.title,
            description: evt.description,
            category: evt.category,
            venue: evt.venue,
            startTime: toInputDate(evt.startTime),
            endTime: toInputDate(evt.endTime),
            registrationDeadline: toInputDate(evt.registrationDeadline),
            maxCapacity: evt.maxCapacity,
            registrationType: evt.registrationType || 'individual',
            minTeamSize: evt.minTeamSize || 2,
            maxTeamSize: evt.maxTeamSize || 4,
            status: evt.status
          });
          setGates(evt.gates || []);
        }
      } catch (err) {
        setError(err.message || 'Failed to load event details');
      } finally {
        setLoading(false);
      }
    }
    loadEvent();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      if (value === '') {
        setFormData(prev => ({ ...prev, [name]: '' }));
      } else {
        const parsed = parseInt(value, 10);
        setFormData(prev => ({ ...prev, [name]: isNaN(parsed) ? '' : parsed }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const capacityNum = parseInt(formData.maxCapacity, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      setError('Maximum capacity must be a positive integer.');
      return;
    }

    let minTeam = 1;
    let maxTeam = 1;

    if (formData.registrationType === 'team') {
      minTeam = parseInt(formData.minTeamSize, 10);
      maxTeam = parseInt(formData.maxTeamSize, 10);

      if (isNaN(minTeam) || minTeam < 2) {
        setError('Minimum team size must be at least 2 members (including leader).');
        return;
      }

      if (isNaN(maxTeam) || maxTeam < minTeam) {
        setError('Maximum team size cannot be less than minimum team size.');
        return;
      }

      if (maxTeam > capacityNum) {
        setError(`Maximum team size (${maxTeam}) cannot exceed event maximum capacity (${capacityNum}).`);
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        venue: formData.venue.trim(),
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        registrationDeadline: new Date(formData.registrationDeadline).toISOString(),
        maxCapacity: capacityNum,
        registrationType: formData.registrationType,
        minTeamSize: formData.registrationType === 'team' ? minTeam : 1,
        maxTeamSize: formData.registrationType === 'team' ? maxTeam : 1,
        status: formData.status
      };

      const res = await api.patch(`/events/${id}`, payload);
      if (res.data?.success) {
        setMessage('Event settings updated successfully.');
      }
    } catch (err) {
      setError(err.message || 'Failed to update event.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddGate = async (e) => {
    e.preventDefault();
    if (!newGateName.trim()) return;

    try {
      const res = await api.post(`/events/${id}/gates`, {
        gateName: newGateName.trim(),
        locationDescription: newGateDesc.trim() || null
      });
      if (res.data?.success) {
        setGates(prev => [...prev, res.data.data]);
        setNewGateName('');
        setNewGateDesc('');
      }
    } catch (err) {
      setError(err.message || 'Failed to add gate.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-xs text-[#777180]">
        Loading event settings...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link to="/admin" className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#777180] hover:text-[#6D28D9]">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Admin Console</span>
      </Link>

      <div className="bg-white rounded-3xl border border-[#EAE6F0] p-6 sm:p-10 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24212B]">Edit Event</h1>
          <p className="text-xs text-[#777180] mt-1">Modify schedule, max capacity thresholds and manage authorized gates</p>
        </div>

        {message && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs">
            <CheckCircle className="w-4 h-4 text-[#16865B]" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#24212B]">Event Title</label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              className="mt-1 w-full px-3.5 py-2.5 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#24212B]">Event Description</label>
            <textarea
              name="description"
              required
              rows={4}
              value={formData.description}
              onChange={handleChange}
              className="mt-1 w-full px-3.5 py-2.5 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#24212B]">Venue</label>
              <input
                type="text"
                name="venue"
                required
                value={formData.venue}
                onChange={handleChange}
                className="mt-1 w-full px-3.5 py-2.5 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24212B]">Publication Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 w-full px-3.5 py-2.5 border border-[#EAE6F0] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#24212B]">Start Date & Time</label>
              <input
                type="datetime-local"
                name="startTime"
                required
                value={formData.startTime}
                onChange={handleChange}
                className="mt-1 w-full px-3 py-2 border border-[#EAE6F0] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24212B]">End Date & Time</label>
              <input
                type="datetime-local"
                name="endTime"
                required
                value={formData.endTime}
                onChange={handleChange}
                className="mt-1 w-full px-3 py-2 border border-[#EAE6F0] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24212B]">Registration Deadline</label>
              <input
                type="datetime-local"
                name="registrationDeadline"
                required
                value={formData.registrationDeadline}
                onChange={handleChange}
                className="mt-1 w-full px-3 py-2 border border-[#EAE6F0] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#24212B]">Max Capacity</label>
              <input
                type="number"
                name="maxCapacity"
                required
                min={1}
                value={formData.maxCapacity === '' ? '' : formData.maxCapacity}
                onChange={handleChange}
                className="mt-1 w-full px-3.5 py-2 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24212B]">Registration Type</label>
              <select
                name="registrationType"
                value={formData.registrationType}
                onChange={handleChange}
                className="mt-1 w-full px-3.5 py-2 border border-[#EAE6F0] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
              >
                <option value="individual">Individual Participant</option>
                <option value="team">Team Event</option>
              </select>
            </div>
          </div>

          {/* Conditional Team Size Settings */}
          {formData.registrationType === 'team' && (
            <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-[#6D28D9] uppercase tracking-wider">Team Size Configuration</span>
              </div>
              <p className="text-xs text-[#777180]">
                Configure team capacity boundaries. Headcount includes the Team Leader plus invited member accounts.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#24212B]">Min Team Size</label>
                  <input
                    type="number"
                    name="minTeamSize"
                    required
                    min={2}
                    max={formData.maxTeamSize !== '' ? Number(formData.maxTeamSize) : 50}
                    value={formData.minTeamSize === '' ? '' : formData.minTeamSize}
                    onChange={handleChange}
                    className="mt-1 w-full px-3.5 py-2 bg-white border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
                  />
                  <span className="text-[10px] text-[#777180]">Minimum members required (including leader)</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#24212B]">Max Team Size</label>
                  <input
                    type="number"
                    name="maxTeamSize"
                    required
                    min={formData.minTeamSize !== '' ? Number(formData.minTeamSize) : 2}
                    max={50}
                    value={formData.maxTeamSize === '' ? '' : formData.maxTeamSize}
                    onChange={handleChange}
                    className="mt-1 w-full px-3.5 py-2 bg-white border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
                  />
                  <span className="text-[10px] text-[#777180]">Maximum members allowed (including leader)</span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-6 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white text-xs font-bold shadow-sm shadow-purple-200 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving Changes...' : 'Save Settings'}
            </button>
          </div>
        </form>

        {/* Gate Management Sub-section */}
        <div className="pt-6 border-t border-[#EAE6F0] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-[#24212B] flex items-center space-x-2">
              <DoorOpen className="w-4 h-4 text-[#6D28D9]" />
              <span>Configured Gates ({gates.length})</span>
            </h3>
          </div>

          <div className="space-y-2">
            {gates.map((g) => (
              <div key={g.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-[#24212B]">{g.gateName}</span>
                  {g.locationDescription && <span className="text-[#777180] ml-2">({g.locationDescription})</span>}
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Active
                </span>
              </div>
            ))}
          </div>

          {/* Add Gate Form */}
          <form onSubmit={handleAddGate} className="flex flex-col sm:flex-row gap-2 pt-2">
            <input
              type="text"
              placeholder="New Gate Name (e.g. South Gate)"
              value={newGateName}
              onChange={(e) => setNewGateName(e.target.value)}
              className="flex-1 px-3 py-2 border border-[#EAE6F0] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
            />
            <input
              type="text"
              placeholder="Location Description"
              value={newGateDesc}
              onChange={(e) => setNewGateDesc(e.target.value)}
              className="flex-1 px-3 py-2 border border-[#EAE6F0] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#F1EBFF] text-[#6D28D9] hover:bg-[#6D28D9] hover:text-white font-bold text-xs rounded-xl transition-colors whitespace-nowrap"
            >
              Add Gate
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
