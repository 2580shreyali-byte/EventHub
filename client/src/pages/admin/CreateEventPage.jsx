import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Calendar, ArrowLeft, AlertCircle, PlusCircle } from 'lucide-react';

export function CreateEventPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Default start date = tomorrow 10:00 AM
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow.getTime() + 4 * 3600000);
  const deadline = new Date(tomorrow.getTime() - 2 * 3600000);

  const toInputDate = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Hackathon',
    venue: '',
    startTime: toInputDate(tomorrow),
    endTime: toInputDate(tomorrowEnd),
    registrationDeadline: toInputDate(deadline),
    maxCapacity: 100,
    registrationType: 'individual',
    minTeamSize: 2,
    maxTeamSize: 4,
    status: 'published',
    initialGateName: 'North Gate'
  });

  const categories = ['Hackathon', 'Technology', 'Workshop', 'Symposium', 'Cultural', 'Sports', 'Conference'];

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

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

    setLoading(true);

    try {
      // 1. Create Event
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

      const res = await api.post('/events', payload);
      if (res.data?.success && res.data?.data?.id) {
        const eventId = res.data.data.id;

        // 2. Configure Initial Gate if provided
        if (formData.initialGateName.trim()) {
          try {
            await api.post(`/events/${eventId}/gates`, {
              gateName: formData.initialGateName.trim(),
              locationDescription: `Main entrance for ${formData.venue}`
            });
          } catch {
            // Non-fatal gate creation error
          }
        }

        navigate('/admin');
      }
    } catch (err) {
      setError(err.message || 'Failed to create event. Please verify all fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link to="/admin" className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#777180] hover:text-[#6D28D9]">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Admin Console</span>
      </Link>

      <div className="bg-white rounded-3xl border border-[#EAE6F0] p-6 sm:p-10 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#24212B]">Create New Campus Event</h1>
          <p className="text-xs text-[#777180] mt-1">Publish an event, initialize attendance capacity, and configure check-in gates</p>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#24212B]">Event Title</label>
            <input
              type="text"
              name="title"
              required
              placeholder="e.g. HackCampus 2026: 36-Hour AI Challenge"
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
              placeholder="Detailed schedule, prerequisites, and operational instructions..."
              value={formData.description}
              onChange={handleChange}
              className="mt-1 w-full px-3.5 py-2.5 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#24212B]">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="mt-1 w-full px-3.5 py-2.5 border border-[#EAE6F0] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24212B]">Campus Venue</label>
              <input
                type="text"
                name="venue"
                required
                placeholder="e.g. Main University Auditorium"
                value={formData.venue}
                onChange={handleChange}
                className="mt-1 w-full px-3.5 py-2.5 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
              />
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

            <div>
              <label className="block text-xs font-bold text-[#24212B]">Publication Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 w-full px-3.5 py-2 border border-[#EAE6F0] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
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

          <div>
            <label className="block text-xs font-bold text-[#24212B]">Initial Check-In Gate</label>
            <input
              type="text"
              name="initialGateName"
              placeholder="e.g. North Gate"
              value={formData.initialGateName}
              onChange={handleChange}
              className="mt-1 w-full sm:w-1/2 px-3.5 py-2 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9]"
            />
          </div>

          <div className="pt-4 border-t border-[#EAE6F0] flex items-center justify-end space-x-3">
            <Link
              to="/admin"
              className="py-2.5 px-4 rounded-xl border border-[#EAE6F0] text-xs font-bold text-[#777180] hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="py-2.5 px-6 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white text-xs font-bold shadow-sm shadow-purple-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Publishing...' : 'Create & Publish Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
