import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { 
  User, 
  Mail, 
  Building, 
  Award, 
  Calendar, 
  LogOut, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function StudentProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-[#24212B] tracking-tight">Student Profile</h1>
        <p className="text-sm text-[#777180] mt-1">Verified university identity and co-curricular CampusPass standing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Identity Card */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-[#EAE6F0] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#4C1D95] to-[#6D28D9] text-white font-extrabold text-2xl flex items-center justify-center shadow-md shadow-purple-200">
              {user?.fullName?.charAt(0) || 'S'}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#24212B]">{user?.fullName}</h2>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Student Account</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#EAE6F0] text-xs">
            <div className="p-3.5 rounded-xl bg-[#FAF9FC] border border-[#EAE6F0] space-y-1">
              <span className="text-[#777180] flex items-center space-x-1.5 font-medium">
                <User className="w-3.5 h-3.5 text-[#6D28D9]" />
                <span>Student ID Number</span>
              </span>
              <p className="font-mono font-bold text-sm text-[#24212B]">{user?.studentId}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF9FC] border border-[#EAE6F0] space-y-1">
              <span className="text-[#777180] flex items-center space-x-1.5 font-medium">
                <Building className="w-3.5 h-3.5 text-[#6D28D9]" />
                <span>Academic Department</span>
              </span>
              <p className="font-bold text-sm text-[#24212B]">{user?.department}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF9FC] border border-[#EAE6F0] space-y-1 sm:col-span-2">
              <span className="text-[#777180] flex items-center space-x-1.5 font-medium">
                <Mail className="w-3.5 h-3.5 text-[#6D28D9]" />
                <span>University Email</span>
              </span>
              <p className="font-bold text-sm text-[#24212B]">{user?.email}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#EAE6F0]">
            <button
              onClick={handleLogout}
              className="py-2.5 px-4 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center space-x-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out of EventHub</span>
            </button>
          </div>
        </div>

        {/* Reward Standing Card */}
        <div className="bg-gradient-to-br from-[#FAF9FC] to-[#F1EBFF] rounded-3xl border border-purple-200 p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-[#6D28D9] flex items-center justify-center shadow-sm">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#24212B]">CampusPass Rewards</h3>
              <p className="text-xs text-[#777180] mt-1 leading-relaxed">
                Every verified gate check-in earns 50 co-curricular reward points logged into the immutable database ledger.
              </p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-purple-100 shadow-sm text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#777180]">Balance</span>
              <div className="text-3xl font-extrabold text-[#6D28D9] mt-1">
                {user?.rewardPoints || 0} <span className="text-xs font-semibold text-[#777180]">PTS</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-[11px] text-[#777180]">
            <div className="flex items-center space-x-1.5 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16865B]" />
              <span>Double-reward prevention active</span>
            </div>
            <div className="flex items-center space-x-1.5 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16865B]" />
              <span>Audited transactional ledger</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
