import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Calendar, AlertCircle, ArrowRight, ShieldCheck, User } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Demo autofill helper for hackathon live demo
  const fillDemo = (role) => {
    if (role === 'admin') {
      setEmail('admin@eventhub.campus.edu');
      setPassword('AdminPassword123!');
    } else {
      setEmail('alex@campus.edu');
      setPassword('Password123!');
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#4C1D95] to-[#6D28D9] flex items-center justify-center text-white mx-auto shadow-md shadow-purple-200">
          <Calendar className="w-6 h-6" />
        </div>
        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-[#24212B] tracking-tight">
          Sign In to EventHub
        </h2>
        <p className="mt-2 text-xs text-[#777180]">
          University Single-Session Portal with HTTP-Only Authentication
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-[#EAE6F0] rounded-2xl sm:px-10">
          {/* Hackathon Fast-Demo Buttons */}
          <div className="mb-6 p-3 bg-[#F1EBFF] rounded-xl border border-purple-200">
            <span className="text-[11px] font-bold text-[#6D28D9] uppercase tracking-wider block mb-2">
              ⚡ Quick Demo Personas
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('admin')}
                className="py-1.5 px-2 bg-white hover:bg-purple-50 text-[#6D28D9] border border-purple-300 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#6D28D9]" />
                <span>Admin Prof.</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo('student')}
                className="py-1.5 px-2 bg-white hover:bg-purple-50 text-[#6D28D9] border border-purple-300 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1"
              >
                <User className="w-3.5 h-3.5 text-[#6D28D9]" />
                <span>Student Alex</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-[#24212B]">University Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@campus.edu"
                className="mt-1 block w-full px-3 py-2 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24212B]">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1 block w-full px-3 py-2 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9] focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white text-sm font-bold shadow-sm shadow-purple-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#EAE6F0] text-center text-xs text-[#777180]">
            Don't have a student account?{' '}
            <Link to="/register" className="font-bold text-[#6D28D9] hover:underline">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
