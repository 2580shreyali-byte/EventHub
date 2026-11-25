import React from 'react';
import { Calendar, ShieldCheck, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-white border-t border-[#EAE6F0] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#6D28D9] flex items-center justify-center text-white">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-[#24212B]">EventHub</span>
            <span className="text-xs text-[#777180]">· Intelligent Campus Event Management Ecosystem</span>
          </div>

          <div className="flex items-center space-x-6 text-xs text-[#777180]">
            <Link to="/events" className="hover:text-[#6D28D9] transition-colors">Explore</Link>
            <span className="flex items-center space-x-1 text-emerald-600 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SmartPass Verified</span>
            </span>
            <span>Version 2.2</span>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-[#EAE6F0] text-center text-xs text-[#777180]">
          © {new Date().getFullYear()} EventHub Campus Ecosystem. Built for high-throughput campus events and academic communities.
        </div>
      </div>
    </footer>
  );
}
