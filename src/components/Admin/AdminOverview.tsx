import React from 'react';
import { Users, BookOpen, ShieldAlert } from 'lucide-react';
import { Ticket } from '../../types';

interface AdminOverviewProps {
  metrics: {
    totalUsers: number;
    totalRooms: number;
    openTicketsCount: number;
  } | null;
  tickets: Ticket[];
  onTabChange?: (tab: string) => void;
  c: any;
}

export default function AdminOverview({
  metrics,
  tickets,
  onTabChange,
  c,
}: AdminOverviewProps) {
  const statsOverview = {
    totalUsers: metrics?.totalUsers ?? 0,
    totalRooms: metrics?.totalRooms ?? 0,
    openTicketsCount: metrics?.openTicketsCount ?? tickets.filter((t) => t.status === 'open').length,
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 3 Bento Metrics Cards (Forced Single Row) */}
      <div className="grid grid-cols-3 gap-4">
        {/* Card 1: Total Users */}
        <div
          onClick={() => onTabChange && onTabChange('users')}
          className={`p-3 sm:p-5 rounded-2xl border ${c.bgPanel} transition hover:border-accent-40 flex items-center justify-between cursor-pointer group select-none`}
        >
          <div>
            <span className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-text-secondary font-sans block mb-0.5 sm:mb-1">
              Total Users
            </span>
            <span className="text-base sm:text-2xl font-black text-text-primary font-sans">
              {statsOverview.totalUsers.toLocaleString()}
            </span>
            <span className="text-[7.5px] sm:text-[9.5px] text-accent font-bold font-sans block mt-0.5 sm:mt-1">
              Active Directory
            </span>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-accent-10 text-accent group-hover:scale-110 transition-transform shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Card 2: Active Rooms */}
        <div
          onClick={() => onTabChange && onTabChange('announcements')}
          className={`p-3 sm:p-5 rounded-2xl border ${c.bgPanel} transition hover:border-accent-secondary-20 flex items-center justify-between cursor-pointer group select-none`}
        >
          <div>
            <span className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-text-secondary font-sans block mb-0.5 sm:mb-1">
              Active Rooms
            </span>
            <span className="text-base sm:text-2xl font-black text-accent-secondary font-sans">
              {statsOverview.totalRooms}
            </span>
            <span className="text-[7.5px] sm:text-[9.5px] text-accent-secondary font-bold font-sans block mt-0.5 sm:mt-1">
              Sync Live
            </span>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-accent-secondary-10 text-accent-secondary group-hover:scale-110 transition-transform shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Card 3: Open Incidents */}
        <div
          onClick={() => onTabChange && onTabChange('tickets')}
          className={`p-3 sm:p-5 rounded-2xl border ${c.bgPanel} transition hover:border-accent-40 flex items-center justify-between cursor-pointer group select-none`}
        >
          <div>
            <span className="text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider text-text-secondary font-sans block mb-0.5 sm:mb-1">
              Open Incidents
            </span>
            <span className="text-base sm:text-2xl font-black text-text-primary font-sans">
              {statsOverview.openTicketsCount}
            </span>
            <span className="text-[7.5px] sm:text-[9.5px] text-accent font-bold font-sans block mt-0.5 sm:mt-1">
              Active Cases
            </span>
          </div>
          <div className="p-2 sm:p-3 rounded-xl bg-accent-10 text-accent group-hover:scale-110 transition-transform shrink-0">
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Recent System Incidents Table (Full Width) */}
      <div
        onClick={() => onTabChange && onTabChange('tickets')}
        className="py-6 cursor-pointer hover:text-accent transition duration-200 select-none w-full border-t border-white-5 mt-6"
      >
        <div className="flex items-center justify-between border-b border-white-5 pb-4 mb-4">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-accent font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Recent System Incidents
          </h3>
          <span className="text-[9px] font-mono text-text-secondary/45 px-2 py-0.5 rounded bg-text-primary-5 uppercase">
            ACTIVE QUEUE
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="text-text-secondary text-[9px] font-black uppercase tracking-wider border-b border-white-5">
                <th className="pb-3">ID</th>
                <th className="pb-3">Client Handle</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-text-primary">
              {tickets.slice(0, 5).map((t, idx) => {
                const statusColor =
                  t.status === 'open'
                    ? 'bg-status-dnd'
                    : t.status === 'resolved'
                    ? 'bg-status-online'
                    : 'bg-status-away';
                return (
                  <tr
                    key={idx}
                    className="hover:bg-text-primary-2 transition duration-150"
                  >
                    <td className="py-3 font-mono text-[10.5px] font-bold text-accent">
                      #{t.ticket_id}
                    </td>
                    <td className="py-3 font-bold text-text-primary">
                      {t.username || `User #${t.user_id}`}
                    </td>
                    <td className="py-3 text-text-secondary text-[11px] font-normal uppercase max-w-[150px] truncate">
                      {(t.issue_type || '').replace(/_/g, ' ')}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8.5px] font-black font-mono bg-text-primary-5 border border-white-10 uppercase">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-text-secondary text-[10px] font-mono">
                      {new Date(t.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })}
              {tickets.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-text-secondary font-mono text-[10px] uppercase"
                  >
                    // System operational queue 100% idle //
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
