import React from 'react';

export function StatusPill({ status }) {
  const statusStyles = {
    active: 'bg-emerald-50 text-[#16865B] border-emerald-200',
    checked_in: 'bg-purple-50 text-[#6D28D9] border-purple-200',
    published: 'bg-emerald-50 text-[#16865B] border-emerald-200',
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    ongoing: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200',
    cancelled: 'bg-rose-50 text-[#DC4040] border-rose-200',
    revoked: 'bg-rose-50 text-[#DC4040] border-rose-200',
    expired: 'bg-slate-100 text-slate-500 border-slate-200',
    pending_members: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-emerald-50 text-[#16865B] border-emerald-200'
  };

  const labels = {
    active: 'Active Pass',
    checked_in: 'Checked In',
    published: 'Published',
    draft: 'Draft',
    ongoing: 'Ongoing',
    completed: 'Completed',
    cancelled: 'Cancelled',
    revoked: 'Revoked',
    expired: 'Expired',
    pending_members: 'Pending Members',
    confirmed: 'Confirmed'
  };

  const style = statusStyles[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  const label = labels[status] || status;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
      {label}
    </span>
  );
}
