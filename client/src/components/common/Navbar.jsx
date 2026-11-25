import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { 
  Compass, 
  QrCode, 
  Calendar, 
  ShieldCheck, 
  User, 
  LogOut, 
  Menu, 
  X, 
  PlusCircle, 
  Activity, 
  ScanLine 
} from 'lucide-react';

export function Navbar() {
  const { user, isAuthenticated, isAdmin, isStudent, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#EAE6F0] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4C1D95] to-[#6D28D9] flex items-center justify-center text-white shadow-sm shadow-purple-200">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg text-[#24212B] tracking-tight">Event<span className="text-[#6D28D9]">Hub</span></span>
              <span className="text-[10px] -mt-1 font-semibold uppercase tracking-wider text-[#777180]">Campus Pulse</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            <Link
              to="/events"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive('/events')
                  ? 'bg-[#F1EBFF] text-[#6D28D9]'
                  : 'text-[#24212B] hover:text-[#6D28D9] hover:bg-slate-50'
              }`}
            >
              Explore Events
            </Link>

            {isAuthenticated && isStudent && (
              <>
                <Link
                  to="/dashboard"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/dashboard')
                      ? 'bg-[#F1EBFF] text-[#6D28D9]'
                      : 'text-[#24212B] hover:text-[#6D28D9] hover:bg-slate-50'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/my-passes"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-1.5 transition-colors ${
                    isActive('/my-passes')
                      ? 'bg-[#F1EBFF] text-[#6D28D9]'
                      : 'text-[#24212B] hover:text-[#6D28D9] hover:bg-slate-50'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-[#6D28D9]" />
                  <span>My Passes</span>
                </Link>
              </>
            )}

            {isAuthenticated && isAdmin && (
              <>
                <Link
                  to="/admin"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/admin')
                      ? 'bg-[#F1EBFF] text-[#6D28D9]'
                      : 'text-[#24212B] hover:text-[#6D28D9] hover:bg-slate-50'
                  }`}
                >
                  Admin Portal
                </Link>
                <Link
                  to="/admin/events/new"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors ${
                    isActive('/admin/events/new')
                      ? 'bg-[#F1EBFF] text-[#6D28D9]'
                      : 'text-[#24212B] hover:text-[#6D28D9] hover:bg-slate-50'
                  }`}
                >
                  <PlusCircle className="w-4 h-4 text-[#6D28D9]" />
                  <span>New Event</span>
                </Link>
                <Link
                  to="/admin/scanner"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors ${
                    isActive('/admin/scanner')
                      ? 'bg-[#F1EBFF] text-[#6D28D9]'
                      : 'text-[#24212B] hover:text-[#6D28D9] hover:bg-slate-50'
                  }`}
                >
                  <ScanLine className="w-4 h-4 text-[#6D28D9]" />
                  <span>Gate Scanner</span>
                </Link>
                <Link
                  to="/admin/queueless"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors ${
                    isActive('/admin/queueless')
                      ? 'bg-[#F1EBFF] text-[#6D28D9]'
                      : 'text-[#24212B] hover:text-[#6D28D9] hover:bg-slate-50'
                  }`}
                >
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>QueueLess</span>
                </Link>
              </>
            )}
          </nav>

          {/* User / Auth Actions */}
          <div className="hidden md:flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <Link
                  to={isStudent ? "/profile" : "/admin"}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-left border border-transparent hover:border-[#EAE6F0] transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#F1EBFF] text-[#6D28D9] font-bold text-xs flex items-center justify-center">
                    {user?.fullName?.charAt(0) || 'U'}
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-[#24212B] leading-none">{user?.fullName}</p>
                    <span className="text-[10px] text-[#777180] capitalize font-medium">{user?.role}</span>
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-2 text-[#777180] hover:text-[#DC4040] hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-semibold text-[#24212B] hover:text-[#6D28D9] rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#6D28D9] hover:bg-[#4C1D95] rounded-lg shadow-sm shadow-purple-200 transition-colors"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#777180] hover:text-[#24212B] rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#EAE6F0] bg-white px-4 pt-3 pb-5 space-y-2">
          <Link
            to="/events"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-[#24212B] hover:bg-[#F1EBFF]"
          >
            Explore Events
          </Link>

          {isAuthenticated && isStudent && (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-medium text-[#24212B] hover:bg-[#F1EBFF]"
              >
                Dashboard
              </Link>
              <Link
                to="/my-passes"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-medium text-[#24212B] hover:bg-[#F1EBFF]"
              >
                My Passes
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-medium text-[#24212B] hover:bg-[#F1EBFF]"
              >
                My Profile ({user.fullName})
              </Link>
            </>
          )}

          {isAuthenticated && isAdmin && (
            <>
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-medium text-[#24212B] hover:bg-[#F1EBFF]"
              >
                Admin Portal
              </Link>
              <Link
                to="/admin/events/new"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-medium text-[#24212B] hover:bg-[#F1EBFF]"
              >
                Create Event
              </Link>
              <Link
                to="/admin/scanner"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-medium text-[#24212B] hover:bg-[#F1EBFF]"
              >
                Gate Scanner
              </Link>
              <Link
                to="/admin/queueless"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-base font-medium text-[#24212B] hover:bg-[#F1EBFF]"
              >
                QueueLess Analytics
              </Link>
            </>
          )}

          <div className="pt-3 border-t border-[#EAE6F0]">
            {isAuthenticated ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-3 py-2 text-rose-600 font-semibold flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            ) : (
              <div className="flex flex-col space-y-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 border border-[#EAE6F0] rounded-lg text-sm font-semibold"
                >
                  Log In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 bg-[#6D28D9] text-white rounded-lg text-sm font-semibold"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
