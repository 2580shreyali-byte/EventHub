import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Calendar, AlertCircle } from 'lucide-react';

export function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    studentId: '',
    department: 'Computer Science'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const departments = [
    'Computer Science',
    'Electronics & Communication',
    'Mechanical Engineering',
    'Civil Engineering',
    'Information Technology',
    'Management Studies',
    'Biotechnology',
    'Mathematics & Computing'
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register(formData);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please check form inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#4C1D95] to-[#6D28D9] flex items-center justify-center text-white mx-auto shadow-md shadow-purple-200">
          <Calendar className="w-6 h-6" />
        </div>
        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-[#24212B] tracking-tight">
          Create Student Account
        </h2>
        <p className="mt-2 text-xs text-[#777180]">
          Register with university credentials to claim SmartPass entry passes
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-[#EAE6F0] rounded-2xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-[#24212B]">Full Name</label>
              <input
                type="text"
                name="fullName"
                required
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Alex Chen"
                className="mt-1 block w-full px-3 py-2 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24212B]">University Email</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="alex.chen@campus.edu"
                className="mt-1 block w-full px-3 py-2 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9] focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#24212B]">Student ID</label>
                <input
                  type="text"
                  name="studentId"
                  required
                  value={formData.studentId}
                  onChange={handleChange}
                  placeholder="CS-2024-0042"
                  className="mt-1 block w-full px-3 py-2 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#24212B]">Department</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9] focus:border-transparent bg-white"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#24212B]">Password</label>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                className="mt-1 block w-full px-3 py-2 border border-[#EAE6F0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6D28D9] focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#6D28D9] hover:bg-[#4C1D95] text-white text-sm font-bold shadow-sm shadow-purple-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#EAE6F0] text-center text-xs text-[#777180]">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-[#6D28D9] hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
