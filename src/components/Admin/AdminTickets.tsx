import React from 'react';
import { HelpCircle, Search, ChevronRight, CheckCircle, Trash2, Key } from 'lucide-react';
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
  c: any;
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
  c,
}: AdminTicketsProps) {
  // Filter tickets dynamically
  const filteredTickets = tickets.filter((t) => {
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
    <div className="space-y-6 animate-fadeIn">
      {/* Top Level Audit KPI Oversight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border ${c.bgPanel} flex flex-col justify-between shadow-md`}>
          <span className="text-[9px] font-bold text-text-secondary uppercase tracking-widest font-mono">
            Total Cases Logged
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-text-primary">
              {tickets.length}
            </span>
            <span className="text-[10px] text-text-disabled">dossiers</span>
          </div>
          <div className="h-1 bg-text-primary/[0.04] mt-3 rounded-full overflow-hidden">
            <div className="h-full bg-accent-secondary rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${c.bgPanel} flex flex-col justify-between shadow-md`}>
          <span className="text-[9px] font-bold text-rose-500/80 uppercase tracking-widest font-mono">
            Active Investigation State
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-status-dnd">
              {tickets.filter((t) => t.status === 'open' || t.status === 'escalated').length}
            </span>
            <span className="text-[10px] text-text-disabled">requires review</span>
          </div>
          <div className="h-1 bg-text-primary/[0.04] mt-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-status-dnd rounded-full"
              style={{
                width: `${
                  tickets.length
                    ? (tickets.filter((t) => t.status === 'open' || t.status === 'escalated').length /
                        tickets.length) *
                      100
                    : 0
                }%`,
              }}
            ></div>
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${c.bgPanel} flex flex-col justify-between shadow-md`}>
          <span className="text-[9px] font-bold text-status-away/80 uppercase tracking-widest font-mono">
            Pending Decisions Queue
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-status-away">
              {tickets.filter((t) => t.status === 'pending').length}
            </span>
            <span className="text-[10px] text-text-disabled">hold locks</span>
          </div>
          <div className="h-1 bg-text-primary/[0.04] mt-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{
                width: `${
                  tickets.length
                    ? (tickets.filter((t) => t.status === 'pending').length / tickets.length) * 100
                    : 0
                }%`,
              }}
            ></div>
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${c.bgPanel} flex flex-col justify-between shadow-md`}>
          <span className="text-[9px] font-bold text-status-online/80 uppercase tracking-widest font-mono">
            Resolved Case Files
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-status-online">
              {tickets.filter((t) => t.status === 'resolved' || t.status === 'approved').length}
            </span>
            <span className="text-[10px] text-status-online/60 font-medium">secured dockets</span>
          </div>
          <div className="h-1 bg-text-primary/[0.04] mt-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-status-online rounded-full"
              style={{
                width: `${
                  tickets.length
                    ? (tickets.filter((t) => t.status === 'resolved' || t.status === 'approved')
                        .length /
                        tickets.length) *
                      100
                    : 0
                }%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Central Auditing Controls & Registry Workspace */}
      <div className="flex flex-col border-t border-white-5 pt-6 mt-4">
        {/* Header and Live Search Filters Panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white-5 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-accent" />
            <div>
              <h3 className="font-extrabold text-[12px] uppercase tracking-wider text-text-primary">
                Case Docket Registry
              </h3>
            </div>
          </div>

          {/* Filtering Controllers */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-grow md:w-64">
              <Search className="w-3.5 h-3.5 text-text-disabled absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder=""
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className={`pl-8 pr-3 py-1.5 text-[11px] rounded-xl w-full outline-none font-mono ${c.bgInput}`}
              />
            </div>

            <div className="relative">
              <select
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value as any)}
                className={`pl-3 pr-8 py-1.5 text-[11px] rounded-xl outline-none font-mono cursor-pointer appearance-none ${c.bgInput} border border-white-5`}
              >
                <option value="all">ALL STATUSES</option>
                <option value="open">OPEN CASES</option>
                <option value="pending">PENDING</option>
                <option value="escalated">ESCALATED</option>
                <option value="resolved">RESOLVED</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <svg
                  className="w-3 h-3 text-text-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Registry Main Data Table */}
        <div className="overflow-x-auto rounded-xl border border-white-5 bg-velum-850/40">
          <table className="w-full text-xs font-sans text-left border-collapse">
            <thead>
              <tr className="text-text-secondary/30 text-[9px] font-black uppercase tracking-widest border-b border-white-5">
                <th className="py-3.5 pl-4">CASE INDICATOR index</th>
                <th className="py-3.5">SUBMITTER ACCOUNT</th>
                <th className="py-3.5">CLASSIFICATION MODULE</th>
                <th className="py-3.5">SECURITY TRUST SCORE</th>
                <th className="py-3.5">REGISTERED TIMEFRAME</th>
                <th className="py-3.5">INCIDENT STATE STATUS</th>
                <th className="py-3.5 text-right pr-4">OVERSIGHT HANDLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredTickets.map((ticket) => {
                const cleanType = (ticket.issue_type || '').replace(/_/g, ' ');
                let trustBadge = '';
                if (ticket.credibility_score !== undefined) {
                  trustBadge =
                    ticket.credibility_score >= 85
                      ? 'text-status-online bg-status-online/5 border-emerald-500/10 hover:bg-status-online/10'
                      : 'text-status-dnd bg-status-dnd/5 border-rose-500/10 hover:bg-status-dnd/10';
                } else {
                  trustBadge = 'text-text-secondary bg-text-secondary/5 border-white-5';
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
                          @{ticket.username || 'Anonymous'}
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
                      <span
                        className={`text-[9px] uppercase px-2.5 py-0.5 rounded-full font-mono font-black ${
                          ticket.status === 'open'
                            ? c.statusOpen
                            : ticket.status === 'pending'
                            ? c.statusPending
                            : ticket.status === 'escalated'
                            ? c.statusEscalated
                            : ticket.status === 'resolved'
                            ? c.statusResolved
                            : 'bg-gray-800'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-right pr-4">
                      <button
                        onClick={() => {
                          setActiveTicket(ticket);
                          setReplyText('');
                        }}
                        className="inline-flex items-center gap-1 bg-accent-10 text-accent hover:bg-accent hover:text-text-primary px-3 py-1.5 rounded-lg text-[9.5px] font-black uppercase font-mono tracking-wider border border-accent-20 transition duration-150 cursor-pointer"
                      >
                        <span>Inspect Case</span>
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
                    // No dispute tickets detected matching filter queries //
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
            className="absolute inset-0 bg-black-60 backdrop-blur-sm transition-opacity duration-300"
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
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-black text-accent uppercase tracking-wider bg-accent-10 px-2.5 py-0.5 rounded-full">
                    {(activeTicket.issue_type || '').replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`text-[8.5px] uppercase px-2 py-0.5 rounded font-mono font-bold border ${
                      activeTicket.status === 'open'
                        ? c.statusOpen
                        : activeTicket.status === 'pending'
                        ? c.statusPending
                        : activeTicket.status === 'escalated'
                        ? c.statusEscalated
                        : activeTicket.status === 'resolved'
                        ? c.statusResolved
                        : 'bg-gray-800'
                    }`}
                  >
                    {activeTicket.status}
                  </span>
                </div>
                <h2 className="text-sm font-black tracking-widest text-text-primary font-mono mt-1">
                  AUDIT INTERACTION DISPATCH // CASE-ID: #{activeTicket.ticket_id}
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
            <div className="flex-1 overflow-y-auto space-y-4 p-6 min-h-0 divide-y divide-white/[0.03]">
              {/* Metadata and Threat level scorecard logs layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                <div className="space-y-2">
                  <span className="text-[8.5px] uppercase font-bold text-text-secondary tracking-wider font-mono block">
                    Dossier Audit Coordinates
                  </span>
                  <div className="bg-velum-750 border border-white-5 p-3 rounded-lg space-y-1.5 font-mono text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">CLIENT USER SYSTEM ID:</span>{' '}
                      <span className="text-text-primary font-bold">{activeTicket.user_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">IDENTITY HANDLE:</span>{' '}
                      <span className="text-accent font-black">
                        @{activeTicket.username || 'Anonymous'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">REGISTRATION TIMEFRAME:</span>{' '}
                      <span className="text-text-secondary">
                        {new Date(activeTicket.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[8.5px] uppercase font-bold text-text-secondary tracking-wider font-mono block">
                    System Trust Credibility Meter
                  </span>
                  <div className="bg-velum-750 border border-white-5 p-3 rounded-lg flex flex-col justify-between h-[64px]">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-mono text-text-secondary">
                        CVP INTEGRITY MATRIX:
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          activeTicket.credibility_score !== undefined &&
                          activeTicket.credibility_score >= 85
                            ? 'text-status-online'
                            : 'text-status-dnd'
                        }`}
                      >
                        {activeTicket.credibility_score !== undefined
                          ? `${activeTicket.credibility_score}% TRUST SCORE`
                          : 'UNKNOWN'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-text-primary-2 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full ${
                          activeTicket.credibility_score !== undefined &&
                          activeTicket.credibility_score >= 85
                            ? 'bg-status-online'
                            : 'bg-status-dnd'
                        }`}
                        style={{
                          width: `${
                            activeTicket.credibility_score !== undefined
                              ? activeTicket.credibility_score
                              : 40
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Timeline / Interactive Chat Log Stream */}
              <div className="pt-4 space-y-3">
                <span className="text-[8.5px] uppercase font-bold text-text-secondary tracking-wider font-mono block mb-1">
                  Case Tracking Correspondence Timeline
                </span>

                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1.5 scrollbar-thin">
                  {(activeTicket.messages || []).map((m, idx) => {
                    const isAdminSender =
                      m.sender_name.includes('ADMIN') ||
                      m.sender_name.includes('SUPPORT') ||
                      m.sender_id === adminId;
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border text-[11px] leading-relaxed transition-all ${
                          isAdminSender
                            ? 'bg-velum-800 border-accent-20 text-text-primary ml-6 relative before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-accent before:rounded-l-xl'
                            : 'bg-velum-850 border-white-5 text-text-primary mr-6'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1.5 font-mono text-[9px] tracking-wide">
                          <span
                            className={`font-black ${
                              isAdminSender ? 'text-accent' : 'text-text-secondary'
                            }`}
                          >
                            {isAdminSender ? '📢 CENTRAL OVERSIGHT' : '👤 END-USER SENDER'} &bull;{' '}
                            {m.sender_name}
                          </span>
                          <span className="opacity-45 text-text-secondary">
                            {new Date(m.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="font-normal whitespace-pre-wrap font-sans text-xs">
                          {m.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active administrative restoration panel */}
              {activeTicket.status !== 'resolved' &&
                activeTicket.issue_type === 'recovery_request' && (
                  <div className="pt-4">
                    <div className="p-4 bg-accent/5 border border-accent-20 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-accent animate-pulse" />
                        <span className="text-[10px] font-mono font-black text-accent uppercase tracking-wider">
                          Quarantine Access Controls Gate
                        </span>
                      </div>
                      <p className="text-[10px] text-text-secondary leading-relaxed">
                        Verify request authenticity, transaction metadata logs, and credibility matrix.
                        Restoring accounts grants instant recovery tokens bypass.
                      </p>

                      {adminRole !== 'LOGIN_ADMIN' ? (
                        <div className="bg-orange-500/10 text-orange-400 p-3 rounded-lg text-[9px] font-mono text-center font-bold tracking-wide uppercase">
                          APPROVAL LOCKED: INSUFFICIENT ACCESS PRIVILEGES (LOGIN_ADMIN NEEDED).
                        </div>
                      ) : activeTicket.credibility_score !== undefined &&
                        activeTicket.credibility_score < 85 ? (
                        <div className="bg-status-dnd/10 text-status-dnd p-3 rounded-lg text-[9px] font-mono text-center font-bold tracking-wide uppercase">
                          AUTHORIZATION BLOCKED: HIGH SYSTEM RISK (TRUST METER UNDER REGULATORY MINIMUM).
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            approveQuarantineAccess(activeTicket.user_id.toString(), 'approve')
                          }
                          className="w-full bg-accent hover:bg-accent-hover text-text-primary font-extrabold py-2.5 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer text-center transition-all border-0 shadow-lg shadow-accent-20"
                        >
                          RESTORE SYSTEM COMPROMISED ACCOUNT
                        </button>
                      )}

                      {restoreCode && (
                        <div className="p-3 bg-status-online/10 border border-emerald-500/20 text-status-online font-mono text-[10px] text-center rounded-xl animate-pulse">
                          AUTHENTICATED RECOVERY CREDENTIAL CODE GENERATED:
                          <span className="text-text-primary font-mono font-extrabold select-all ml-1.5 bg-velum-900/60 px-2 py-1 rounded border border-status-online/30">
                            {restoreCode}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* Operations Base: Fixed Decision Response Input form */}
            <div className="p-5 border-t border-white-5 bg-velum-850 flex-shrink-0 space-y-4">
              {activeTicket.status !== 'resolved' ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] uppercase font-bold text-text-secondary font-mono tracking-widest">
                      Type Case Reply Notes or Dispatch correspondence
                    </label>
                    <span className="text-[9px] text-text-secondary font-mono font-bold">
                      {activeTicket.status} &bull; action state
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder=""
                    className={`w-full text-xs rounded-xl p-3 outline-none resize-none transition-all font-mono ${c.bgInput} border border-white-5 focus:border-accent-40`}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => handleTicketReply(false, false)}
                        className="bg-accent hover:bg-accent-hover text-text-primary font-extrabold px-5 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-all shadow-md border-0"
                      >
                        Respond
                      </button>

                      {adminRole === 'SUPPORT_ADMIN' ? (
                        <button
                          onClick={() => handleTicketReply(false, true)}
                          className="bg-violet-600 hover:bg-violet-750 text-text-primary font-extrabold px-5 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-all shadow-md border-0"
                        >
                          Escalate
                        </button>
                      ) : (
                        <div className="font-extrabold px-3 py-2.5 rounded-xl border text-center flex items-center justify-center text-text-disabled border-white-5 text-[10px] uppercase font-mono tracking-wider">
                          Executive Desk Level
                        </div>
                      )}

                      <button
                        onClick={() => handleTicketReply(true, false)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-text-primary font-extrabold px-4 py-2.5 rounded-xl cursor-pointer text-xs uppercase tracking-wider transition-all shadow-md border-0"
                      >
                        Close Case
                      </button>
                    </div>

                    {(adminRole === 'LOGIN_ADMIN' || user?.role === 'CLI_ADMIN') && (
                      <button
                        onClick={async () => {
                          if (
                            confirm(
                              `Are you sure you want to permanently delete ticket case #${activeTicket.ticket_id}?\n\nThis will delete all correspondence and activity logs with zero option of rollback.`
                            )
                          ) {
                            try {
                              const res = await adminFetch(
                                `/api/admin/tickets/${activeTicket.ticket_id}/delete`,
                                {
                                  method: 'POST',
                                }
                              );
                              if (res.ok) {
                                alert(`Ticket Case #${activeTicket.ticket_id} successfully deleted.`);
                                setActiveTicket(null);
                                fetchData();
                              } else {
                                const errData = await res.json();
                                alert(errData.error || 'Failed to delete ticket.');
                              }
                            } catch {
                              alert('Network error.');
                            }
                          }
                        }}
                        className="p-2.5 rounded-xl bg-status-dnd/10 hover:bg-rose-600 text-status-dnd hover:text-text-primary transition duration-150 cursor-pointer border border-status-dnd/10"
                        title="Delete Case Dossier File"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-status-online/10 text-status-online text-center py-4 px-6 rounded-xl border border-emerald-500/15 text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>[ Case Containment Secured Successfully ]</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
