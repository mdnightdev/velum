import React, { useEffect, useState } from 'react';
import { Users, BookOpen, ShieldAlert } from 'lucide-react';
import { Ticket } from '../../types';

interface AdminOverviewProps {
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onTabChange?: (tab: string) => void;
}

export default function AdminOverview({
  adminRole,
  adminFetch,
  onTabChange,
}: AdminOverviewProps) {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalRooms: 0,
    openTicketsCount: 0
  });
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [safeTickets, setSafeTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    const fetchOverviewData = async () => {
      try {
        const usersRes = await adminFetch('/v2/user/admin/all');
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setMetrics(prev => ({ ...prev, totalUsers: usersData.length || 0 }));
        }

        const ticketsRes = await adminFetch('/v2/admin/tickets');
        if (ticketsRes.ok) {
          const ticketsData = await ticketsRes.json();
          const ticketList: Ticket[] = Array.isArray(ticketsData) ? ticketsData : [];
          setTickets(ticketList);
          setSafeTickets(ticketList);
          setMetrics(prev => ({ ...prev, openTicketsCount: ticketList.filter((t: Ticket) => t.status === 'open').length }));
        }

        const loungesRes = await adminFetch('/v2/lounges');
        if (loungesRes.ok) {
          const loungesData = await loungesRes.json();
          setMetrics(prev => ({ ...prev, totalRooms: loungesData.length || 0 }));
        }
      } catch (error) {
        console.error('Failed to fetch overview data:', error);
      }
    };

    fetchOverviewData();
    const interval = setInterval(fetchOverviewData, 30000);
    return () => clearInterval(interval);
  }, [adminFetch]);

  const statsOverview = {
    totalUsers: metrics.totalUsers,
    totalRooms: metrics.totalRooms,
    openTicketsCount: metrics.openTicketsCount,
  };

  return (
    <div className="space-y-4">
      {/* 3 Metrics Cards (Single Row) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Card 1: Total Users */}
        <div
          onClick={() => onTabChange && onTabChange('users')}
          className="p-3 rounded-xl border border-velum-600 bg-velum-800 transition hover:border-accent/40 flex items-center justify-between cursor-pointer group select-none"
        >
          <div>
            <span className="text-xs text-text-secondary font-medium block truncate">
              Users
            </span>
            <span className="text-lg sm:text-xl font-bold text-text-primary">
              {statsOverview.totalUsers.toLocaleString()}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:scale-105 transition-transform shrink-0">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Active Lounges */}
        <div
          onClick={() => onTabChange && onTabChange('announcements')}
          className="p-3 rounded-xl border border-velum-600 bg-velum-800 transition hover:border-accent-secondary/40 flex items-center justify-between cursor-pointer group select-none"
        >
          <div>
            <span className="text-xs text-text-secondary font-medium block truncate">
              Lounges
            </span>
            <span className="text-lg sm:text-xl font-bold text-accent-secondary">
              {statsOverview.totalRooms}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-accent-secondary/10 text-accent-secondary group-hover:scale-105 transition-transform shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Open Tickets */}
        <div
          onClick={() => onTabChange && onTabChange('tickets')}
          className="p-3 rounded-xl border border-velum-600 bg-velum-800 transition hover:border-accent/40 flex items-center justify-between cursor-pointer group select-none"
        >
          <div>
            <span className="text-xs text-text-secondary font-medium block truncate">
              Tickets
            </span>
            <span className="text-lg sm:text-xl font-bold text-text-primary">
              {statsOverview.openTicketsCount}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:scale-105 transition-transform shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Recent Tickets Table */}
      <div
        onClick={() => onTabChange && onTabChange('tickets')}
        className="p-4 rounded-xl border border-velum-600 bg-velum-800 cursor-pointer transition select-none w-full"
      >
        <div className="flex items-center justify-between border-b border-velum-600 pb-3 mb-3">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            Recent Tickets
          </h3>
          <span className="text-xs text-text-secondary">
            View all
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-text-secondary text-xs border-b border-velum-600">
                <th className="pb-2.5 font-medium">Ticket</th>
                <th className="pb-2.5 font-medium">User</th>
                <th className="pb-2.5 font-medium">Category</th>
                <th className="pb-2.5 font-medium">Status</th>
                <th className="pb-2.5 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-velum-600/40 text-text-primary">
              {safeTickets.slice(0, 5).map((t: Ticket, idx: number) => {
                const statusBadge =
                  t.status === 'open'
                    ? 'bg-status-dnd/10 text-status-dnd'
                    : t.status === 'resolved'
                    ? 'bg-status-online/10 text-status-online'
                    : 'bg-status-away/10 text-status-away';
                return (
                  <tr
                    key={idx}
                    className="hover:bg-velum-700/40 transition duration-150"
                  >
                    <td className="py-2.5 font-mono text-xs font-medium text-accent">
                      #{t.ticket_id}
                    </td>
                    <td className="py-2.5 font-medium text-text-primary">
                      {t.username || `User #${t.user_id}`}
                    </td>
                    <td className="py-2.5 text-text-secondary text-xs capitalize max-w-[150px] truncate">
                      {(t.reason || t.issue_type || '').replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-text-secondary text-xs">
                      {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
              {safeTickets.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-text-secondary text-xs"
                  >
                    No tickets found
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
