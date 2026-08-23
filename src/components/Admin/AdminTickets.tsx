import React from 'react';
import { HelpCircle, Search, ChevronRight, CheckCircle, Trash2, Key, Send, X } from 'lucide-react';
import { Ticket } from '../../types';

interface AdminTicketsProps {
  tickets: Ticket[];
  activeTicket: Ticket | null;
  setActiveTicket: (ticket: Ticket | null) => void;
  replyText: string;
  setReplyText: (text: string) => void;
  ticketSearch: string;
  setTicketSearch: (text: string) => void;
  ticketFilter: 'all' | 'open' | 'pending' | 'escalated' | 'resolved';
  setTicketFilter: (filter: 'all' | 'open' | 'pending' | 'escalated' | 'resolved') => void;
  adminId: number;
  adminRole: 'SUPPORT_ADMIN' | 'LOGIN_ADMIN' | 'CLI_ADMIN';
  adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
  fetchData: () => void;
  approveQuarantineAccess: (targetUserId: string, action: 'approve' | 'deny') => Promise<void>;
  handleTicketReply: (close: boolean, escalate: boolean) => Promise<void>;
  restoreCode: string | null;
  user?: any;
}

export default function AdminTickets({
  tickets,
  activeTicket,
  setActiveTicket,
  replyText,
  setReplyText,
  ticketSearch,
  setTicketSearch,
  ticketFilter,
  setTicketFilter,
  adminId,
  adminRole,
  adminFetch,
  fetchData,
  approveQuarantineAccess,
  handleTicketReply,
  restoreCode,
  user,
}: AdminTicketsProps) {
  // Filter tickets dynamically
  const safeTickets = Array.isArray(tickets) ? tickets : [];
  const filteredTickets = safeTickets.filter((t) => {
    if (ticketFilter !== 'all' && t.status !== ticketFilter) return false;
    if (ticketSearch.trim() !== '') {
      const q = ticketSearch.toLowerCase();
      const matchText =
        (t.username || '').toLowerCase() + ' ' + (t.issue_type || '').toLowerCase();
      return matchText.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* KPI Cards Single Row */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <div className="p-3 rounded-xl border border-velum-600 bg-velum-800 flex flex-col justify-between">
          <span className="text-xs text-text-secondary font-medium truncate">
            Total
          </span>
          <div className="mt-0.5">
            <span className="text-lg sm:text-xl font-bold text-text-primary">
              {tickets.length}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-velum-600 bg-velum-800 flex flex-col justify-between">
          <span className="text-xs text-status-dnd font-medium truncate">
            Open
          </span>
          <div className="mt-0.5">
            <span className="text-lg sm:text-xl font-bold text-status-dnd">
              {tickets.filter((t) => t.status === 'open' || t.status === 'escalated').length}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-velum-600 bg-velum-800 flex flex-col justify-between">
          <span className="text-xs text-status-away font-medium truncate">
            Pending
          </span>
          <div className="mt-0.5">
            <span className="text-lg sm:text-xl font-bold text-status-away">
              {tickets.filter((t) => t.status === 'pending').length}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-velum-600 bg-velum-800 flex flex-col justify-between">
          <span className="text-xs text-status-online font-medium truncate">
            Resolved
          </span>
          <div className="mt-0.5">
            <span className="text-lg sm:text-xl font-bold text-status-online">
              {tickets.filter((t) => t.status === 'resolved' || t.status === 'approved').length}
            </span>
          </div>
        </div>
      </div>

      {/* Central Registry Workspace */}
      <div className="flex flex-col border-t border-velum-600 pt-4 mt-2">
        {/* Header and Live Search Filters Panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-velum-600 pb-3 mb-3">
          <div className="flex items-center gap-2">
           </div>

          {/* Filtering Controllers */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-grow md:w-56">
              <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs rounded-xl w-full outline-none bg-velum-750 border border-velum-600 text-text-primary placeholder:text-text-disabled focus:border-accent/40"
              />
            </div>

            <div className="relative">
              <select
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value as any)}
                className="pl-3 pr-7 py-1.5 text-xs rounded-xl outline-none cursor-pointer appearance-none bg-velum-750 border border-velum-600 text-text-primary focus:border-accent/40"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Audit Registry Main Data Table */}
        <div className="overflow-x-auto rounded-xl border border-velum-600 bg-velum-800">
          <table className="w-full text-xs font-sans text-left border-collapse">
            <thead>
              <tr className="text-text-secondary/30 text-[9px] font-black uppercase tracking-widest border-b border-white-5">
                <th className="py-3.5 pl-4">ID</th>
                <th className="py-3.5">User</th>
                <th className="py-3.5">Subject</th>
                <th className="py-3.5">Trust</th>
                <th className="py-3.5">Date</th>
                <th className="py-3.5">Status</th>
                <th className="py-3.5 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredTickets.map((ticket) => {
                const cleanType = ticket.issue_type?.includes('CRITICAL') ? 'Compromised Account' : (ticket.issue_type || '').replace(/_/g, ' ');
                let trustBadge = '';
                if (ticket.credibility_score !== undefined) {
                  trustBadge =
                    ticket.credibility_score >= 85
                      ? 'text-status-online bg-status-online-bg hover:bg-status-online-bg'
                      : 'text-status-dnd bg-status-dnd-bg hover:bg-status-dnd-bg';
                } else {
                  trustBadge = 'text-text-secondary bg-white/[0.04]';
                }

                return (
                  <tr
                    key={ticket.ticket_id}
                    className="hover:bg-text-primary-2 transition-all duration-150 group"
                  >
                    <td className="py-3.5 pl-4 font-mono text-[10.5px] font-bold text-accent">
                      <button
                        onClick={() => {
                          setActiveTicket(ticket);
                          setReplyText('');
                        }}
                        className="hover:underline cursor-pointer text-left block"
                      >
                        #{ticket.ticket_id.slice(0, 12).toUpperCase()}...
                      </button>
                    </td>
                    <td className="py-3.5">
                      <div className="flex flex-col">
                        <span className="text-text-primary font-bold">
                         {ticket.username || 'User'}
                        </span>
                        <span className="text-[9px] font-mono text-text-secondary">
                          ID: {ticket.user_id}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span className="font-extrabold text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-md bg-text-primary-5 border border-white-10 font-mono text-text-primary">
                        {cleanType}
                      </span>
                    </td>
                    <td className="py-3.5 font-mono text-[10px]">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8.5px] font-black uppercase ${trustBadge}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                        {ticket.credibility_score !== undefined
                          ? `${ticket.credibility_score}% TRUST`
                          : 'UNRATED'}
                      </span>
                    </td>
                    <td className="py-3.5 font-mono text-text-secondary/50 text-[10.5px]">
                      {new Date(ticket.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2" title={ticket.status}>
                        <div
                          className={`w-2 h-2 rounded-full shadow-sm ${
                            (ticket.status || '').toLowerCase() === 'open'
                              ? 'bg-status-dnd shadow-status-dnd/20'
                              : (ticket.status || '').toLowerCase() === 'resolved'
                              ? 'bg-status-online shadow-status-online/20'
                              : 'bg-status-away shadow-status-away/20'
                          }`}
                        />
                        <span className="text-xs text-text-secondary capitalize font-mono">
                          {ticket.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 text-right pr-4">
                      <button
                        onClick={() => {
                          setActiveTicket(ticket);
                          setReplyText('');
                        }}
                        className="inline-flex items-center gap-1 bg-accent-10 text-accent hover:bg-accent hover:text-text-primary px-3 py-1.5 rounded-lg text-[9.5px] font-black uppercase font-mono tracking-wider border border-accent-20 transition duration-150 cursor-pointer"
                      >
                        <span>Open</span>
                        <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredTickets.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-20 text-center text-text-disabled font-mono text-[10px] uppercase font-bold tracking-widest bg-black/10"
                  >
                   
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* S_SHEET WORKSPACE: Modern Flying Sidebar/Panel sliding from the RIGHT (NOT BOTTOM) */}
      {activeTicket && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backing Blur Overlay */}
          <div
            className="absolute inset-0 modal-backdrop transition-opacity duration-300"
            onClick={() => {
              setActiveTicket(null);
              setReplyText('');
            }}
          />

          {/* Sliding Flying Panel Container */}
          <div className="relative w-full max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl bg-velum-850 border-l border-white-5 h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-slideLeft">
            {/* Fixed Panel Header */}
            <div className="p-5 border-b border-white-5 bg-velum-850 flex items-center justify-between flex-shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-black text-accent uppercase tracking-wider bg-accent-10 px-2.5 py-0.5 rounded-full">
                    {activeTicket.issue_type?.includes('CRITICAL') ? 'Compromised Account' : (activeTicket.issue_type || '').replace(/_/g, ' ')}
                  </span>
                  <div
                    className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                      (activeTicket.status || '').toLowerCase() === ''
                        ? 'bg-status-dnd shadow-status-dnd/20'
                        : (activeTicket.status || '').toLowerCase() === 'resolved'
                        ? 'bg-status-online shadow-status-online/20'
                        : 'bg-status-away shadow-status-away/20'
                    }`}
                    title={activeTicket.status}
                  />
                </div>
                <h2 className="text-sm font-black tracking-widest text-text-primary font-mono mt-1">
                  TICKET #{activeTicket.ticket_id}
                </h2>
              </div>
              <button
                onClick={() => {
                  setActiveTicket(null);
                  setReplyText('');
                }}
                className="p-2.5 rounded-lg border border-white-5 text-text-secondary hover:text-text-primary hover:bg-text-primary-5 transition cursor-pointer"
                title="Close Audit Workspace"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Main Content Area (Split into Correspondence History Timeline, logs & details) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 flex flex-col">
              {/* User Details & Trust Score */}
              <div className="bg-velum-800 border border-white-5 p-4 rounded-xl mb-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4 font-mono text-xs">
                  <div className="space-y-2 text-text-secondary">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[9px] uppercase tracking-wider">Tracking ID:</span>
                      <span className="text-text-primary break-all">{activeTicket.tracking_id || activeTicket.tracking_id || ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[9px] uppercase tracking-wider">User:</span>
                      <span className="text-text-primary">{activeTicket.user_id}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-text-secondary sm:text-right">
                    <div className="flex items-center sm:justify-end gap-2">
                      <span className="font-bold text-[9px] uppercase tracking-wider">Created:</span>
                      <span className="text-text-primary">{new Date(activeTicket.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center sm:justify-end gap-2">
                      <span className="font-bold text-[9px] uppercase tracking-wider">Trust Score:</span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                          activeTicket.credibility_score !== undefined && activeTicket.credibility_score >= 85
                            ? 'bg-status-online-bg text-status-online'
                            : 'bg-status-dnd-bg text-status-dnd'
                        }`}
                      >
                        {activeTicket.credibility_score !== undefined
                          ? `${activeTicket.credibility_score}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Timeline / Interactive Chat Log Stream */}
              <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
                {(activeTicket.messages || []).map((m, idx) => {
                  const isAdminSender =
                    m.sender_name.includes('ADMIN') ||
                    m.sender_name.includes('SUPPORT') ||
                    m.sender_name === 'System' ||
                    m.sender_name === 'SYSTEM' ||
                    m.sender_id === adminId ||
                    m.sender_id === 0;
                  
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isAdminSender ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-[13px] leading-relaxed relative ${
                          isAdminSender
                            ? 'bg-accent/10 border border-accent/20 text-text-primary rounded-tr-sm'
                            : 'bg-velum-800 border border-white-5 text-text-primary rounded-tl-sm'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1 font-mono text-[9px] tracking-wide gap-4">
                          <span className={`font-black ${isAdminSender ? 'text-accent' : 'text-text-secondary'}`}>
                            {m.sender_name}
                          </span>
                          <span className="opacity-45 text-text-secondary whitespace-nowrap">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="font-normal whitespace-pre-wrap font-sans">
                          {m.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active administrative restoration panel */}
              {activeTicket.status !== 'resolved' &&
                (activeTicket.issue_type === 'recovery_request' || String(activeTicket.issue_type).includes('CRITICAL')) && (
                  <div className="mt-6 p-4 bg-accent/5 border border-accent-20 rounded-xl space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-accent" />
                      <span className="text-xs font-bold text-text-primary tracking-wide">
                        Compromised Account
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">
                      Verify request authenticity. Restoring accounts grants instant recovery tokens bypass.
                    </p>

                    {adminRole !== 'LOGIN_ADMIN' && adminRole !== 'CLI_ADMIN' ? (
                      <div className="bg-status-away-bg text-status-away p-3 rounded-lg text-xs text-center font-semibold">
                        INSUFFICIENT PERMISSIONS
                      </div>
                    ) : activeTicket.credibility_score !== undefined &&
                      activeTicket.credibility_score < 85 ? (
                      <div className="bg-status-dnd-bg text-status-dnd p-3 rounded-lg text-xs text-center font-semibold">
                        BLOCKED: TRUST SCORE TOO LOW
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          approveQuarantineAccess(activeTicket.user_id.toString(), 'approve')
                        }
                        className="w-full bg-accent hover:bg-accent-hover text-text-primary font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
                      >
                        RESTORE ACCOUNT
                      </button>
                    )}

                    {restoreCode && (
                      <div className="p-3 bg-status-online-bg text-status-online text-xs text-center rounded-xl font-mono">
                        RECOVERY CODE GENERATED:
                        <span className="text-text-primary font-bold select-all ml-1.5">
                          {restoreCode}
                        </span>
                      </div>
                    )}
                  </div>
                )}
            </div>

            {/* Operations Base: Fixed Decision Response Input form */}
            <div className="p-4 sm:p-5 border-t border-white-5 bg-velum-850 flex-shrink-0">
              {activeTicket.status !== 'resolved' ? (
                <div className="space-y-3">
                  <div className="relative flex">
                    <textarea
                      rows={1}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleTicketReply(false, false);
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 text-sm rounded-xl py-2.5 pl-4 pr-12 outline-none resize-none transition-all bg-velum-750 border border-velum-600 text-text-primary placeholder:text-text-disabled focus:border-accent/40"
                    />
                    <button
                      onClick={() => handleTicketReply(false, false)}
                      className="absolute right-2 bottom-2 bg-accent hover:bg-accent-hover text-text-primary p-1.5 rounded-lg cursor-pointer transition-colors flex items-center justify-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex gap-2">
                      {adminRole === 'SUPPORT_ADMIN' && (
                        <button
                          onClick={() => handleTicketReply(false, true)}
                          className="bg-violet-600 hover:bg-violet-750 text-white font-bold px-4 py-2 rounded-xl cursor-pointer text-xs transition-colors"
                        >
                          Escalate
                        </button>
                      )}

                      <button
                        onClick={() => handleTicketReply(true, false)}
                        className="bg-status-online hover:bg-status-online/80 text-white font-bold px-4 py-2 rounded-xl cursor-pointer text-xs transition-colors"
                      >
                        Close
                      </button>
                    </div>

                    {(adminRole === 'LOGIN_ADMIN' || adminRole === 'CLI_ADMIN') && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await adminFetch(
                              `/v2/admin/tickets/${activeTicket.ticket_id}`,
                              {
                                method: 'DELETE',
                              }
                            );
                            if (res.ok) {
                              setActiveTicket(null);
                              fetchData();
                            }
                          } catch (err) {
                            console.error('Network error deleting ticket:', err);
                          }
                        }}
                        className="p-2 rounded-xl bg-status-dnd-bg hover:bg-status-dnd text-status-dnd hover:text-text-primary transition-colors cursor-pointer flex items-center justify-center"
                        title="Delete Ticket"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-status-online-bg text-status-online text-center py-3 px-6 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Ticket Resolved</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
