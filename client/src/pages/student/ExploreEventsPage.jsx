import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { 
  Calendar, 
  Search, 
  MapPin, 
  Clock, 
  Users, 
  Filter, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { StatusPill } from '../../components/common/StatusPill.jsx';

export function ExploreEventsPage() {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 9, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchEvents = async (pageToFetch = page) => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.append('page', String(pageToFetch));
      params.append('limit', '9');
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);

      const res = await api.get(`/events?${params.toString()}`);
      if (res.data?.success) {
        const evts = res.data.data.events || [];
        setEvents(evts);
        if (res.data.data.pagination) {
          setPagination(res.data.data.pagination);
        }

        // Dynamically collect unique categories
        const cats = [...new Set(evts.map(e => e.category))].filter(Boolean);
        setCategories(prev => [...new Set([...prev, ...cats])]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchEvents(1);
  }, [selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchEvents(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPage(newPage);
      fetchEvents(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-[#24212B] tracking-tight">Explore Campus Events</h1>
        <p className="text-sm text-[#777180] mt-1">Discover campus hackathons, technical symposiums, workshops and conferences</p>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#EAE6F0] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-[#777180] absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, topics, categories, venues..."
            className="w-full pl-10 pr-4 py-2 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9] focus:border-transparent"
          />
        </form>

        {/* Category Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategory === ''
                ? 'bg-[#6D28D9] text-white shadow-sm shadow-purple-200'
                : 'bg-slate-100 text-[#777180] hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#6D28D9] text-white shadow-sm shadow-purple-200'
                  : 'bg-slate-100 text-[#777180] hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-64 rounded-2xl bg-white border border-[#EAE6F0] p-6 animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-6 bg-slate-200 rounded w-3/4" />
              <div className="h-16 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#EAE6F0] p-12 text-center max-w-md mx-auto">
          <Calendar className="w-12 h-12 text-[#6D28D9] mx-auto mb-3 opacity-50" />
          <h3 className="font-bold text-[#24212B] text-base">No Events Match Your Query</h3>
          <p className="text-xs text-[#777180] mt-1">Try clearing your search filters or check back later for newly announced events.</p>
          {(selectedCategory || searchQuery) && (
            <button
              onClick={() => { setSelectedCategory(''); setSearchQuery(''); }}
              className="mt-4 px-4 py-2 bg-[#F1EBFF] text-[#6D28D9] font-bold text-xs rounded-xl hover:bg-purple-100 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((evt) => (
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
                  <p className="text-xs text-[#777180] mt-2 line-clamp-3 leading-relaxed">{evt.description}</p>

                  <div className="mt-5 pt-4 border-t border-[#EAE6F0] space-y-2 text-xs text-[#777180]">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span>{new Date(evt.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span className="line-clamp-1">{evt.venue}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="flex items-center space-x-1.5">
                        <Users className="w-3.5 h-3.5 text-[#6D28D9]" />
                        <span>{evt.currentRegistrations || 0} / {evt.maxCapacity} Seats</span>
                      </span>
                      <span className="font-semibold text-emerald-600">
                        {evt.availableSeats !== undefined ? `${evt.availableSeats} open` : `${Math.max(0, evt.maxCapacity - (evt.currentRegistrations || 0))} open`}
                      </span>
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

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="bg-white p-4 rounded-2xl border border-[#EAE6F0] shadow-sm flex items-center justify-between">
              <span className="text-xs text-[#777180]">
                Page <span className="font-bold text-[#24212B]">{pagination.page}</span> of{' '}
                <span className="font-bold text-[#24212B]">{pagination.totalPages}</span> ({pagination.total} events)
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 rounded-xl border border-[#EAE6F0] text-[#777180] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-2 rounded-xl border border-[#EAE6F0] text-[#777180] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
