import React, { useState, useEffect, useRef } from 'react';
import { Plus, Send, HelpCircle, MessageSquare, Clock, ShieldCheck, AlertCircle, Tag, Trash2, X, ChevronDown, Check, ChevronUp, MessageCircle } from 'lucide-react';
import { Ticket } from '../../types';

interface TicketsMainDashboardProps {
  currentUserId: number;
  isDark?: boolean;
}

export default function TicketsMainDashboard({
  currentUserId,
  isDark = true
}: TicketsMainDashboardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reason, setReason] = useState('');
  const [issueType, setIssueType] = useState('general_support');
  const [credentials, setCredentials] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchSessionId = () => sessionStorage.getItem('velum-sessionId') || '';

  const categories = [
    { value: 'general_support', label: 'General Support' },
    { value: 'escrow_dispute', label: 'Escrow Dispute' },
    { value: 'account_sanction', label: 'Account Ban / Sanction' },
    { value: 'marketplace_listing', label: 'Marketplace Listing' },
    { value: 'wallet_payments', label: 'Wallet & Payments' }
  ];

  const loadTickets = async () => {
    try {
      const sId = fetchSessionId();
      const headers = { 'Authorization': `Bearer ${sId}` };
      const res = await fetch(`/api/user/tickets`, { headers });
      if (res.ok) {
        setTickets(await res.json());
      }
    } catch (err) {
      console.warn('Sync issue in tickets loading:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(loadTickets, 10000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setIsSubmitting(true);

    try {
      const sId = fetchSessionId();
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason.trim(),
          issueType,
          credentialsForwarded: credentials.trim() || null
        })
      });

      if (res.ok) {
        setReason('');
        setCredentials('');
        setIssueType('general_support');
        loadTickets();
        alert('Your support ticket has been submitted successfully.');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit ticket.');
      }
    } catch (err) {
      alert('Network error occurred while submitting ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to permanently delete this support ticket?')) return;
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/user/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        loadTickets();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete ticket.');
      }
    } catch {
      alert('Network error occurred while deleting ticket.');
    }
  };

  const handleCloseTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to mark this ticket as resolved and closed?')) return;
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/user/tickets/${ticketId}/close`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        loadTickets();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to close ticket.');
      }
    } catch {
      alert('Network error occurred while closing ticket.');
    }
  };

  const toggleTicket = (id: string) => {
    setExpandedTickets(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getCategoryStyles = (type?: string) => {
    switch (type) {
      case 'escrow_dispute':
        return {
          border: 'border-l-4 border-l-amber-500 border-t border-r border-b border-white-5',
          text: 'text-amber-400',
          badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
        };
      case 'account_sanction':
        return {
          border: 'border-l-4 border-l-rose-500 border-t border-r border-b border-white-5',
          text: 'text-rose-400',
          badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/25'
        };
      case 'marketplace_listing':
        return {
          border: 'border-l-4 border-l-indigo-500 border-t border-r border-b border-white-5',
          text: 'text-indigo-400',
          badge: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/25'
        };
      case 'wallet_payments':
        return {
          border: 'border-l-4 border-l-emerald-500 border-t border-r border-b border-white-5',
          text: 'text-emerald-400',
          badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
        };
      case 'general_support':
      default:
        return {
          border: 'border-l-4 border-l-slate-400 border-t border-r border-b border-white-5',
          text: 'text-slate-400',
          badge: 'bg-slate-500/10 text-slate-400 border border-slate-500/25'
        };
    }
  };

  return (
    <div id="tickets_dashboard" className="flex-1 bg-transparent p-6 lg:p-8 space-y-6 select-none font-sans">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Create Ticket Form */}
        <form onSubmit={handleSubmitTicket} className="glass-card lg:col-span-5 p-5 space-y-4">
          <h3 className="text-xs uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Create a Support Ticket</span>
          </h3>

          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              Ticket Category
            </label>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary focus:border-accent focus:outline-none flex items-center justify-between cursor-pointer"
            >
              <span>{categories.find(c => c.value === issueType)?.label || 'Select Category'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-secondary" />
            </button>
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-velum-850 border border-white-5 rounded-lg shadow-xl z-50 overflow-hidden font-sans">
                {categories.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setIssueType(c.value);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition hover:bg-white-5 flex items-center justify-between ${
                      issueType === c.value ? 'text-accent font-bold' : 'text-text-primary'
                    }`}
                  >
                    <span>{c.label}</span>
                    {issueType === c.value && <Check className="w-3 h-3 text-accent" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              Description of the Issue
            </label>
            <textarea
              id="ticket_reason"
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please describe the issue or question you have in detail..."
              className="w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary focus:border-accent focus:outline-none resize-none font-sans"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              Supporting Details / Logs (Optional)
            </label>
            <textarea
              id="ticket_credentials"
              rows={3}
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder="Provide transaction IDs, error logs, or extra details to help speed up resolution..."
              className="w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary focus:border-accent focus:outline-none resize-none font-sans"
            />
          </div>

          <button
            id="ticket_submit_btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-accent hover:bg-accent-hover text-velum-900 text-[10px] font-bold uppercase rounded transition flex items-center justify-center gap-2 cursor-pointer font-sans"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Submitting...' : 'Submit Ticket'}</span>
          </button>
        </form>

        {/* Existing Tickets list */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-text-secondary font-mono flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Your Support Tickets ({tickets.length})</span>
          </h3>

          {loading ? (
            <div className="text-[10px] text-text-secondary font-mono animate-pulse">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="text-xs text-text-secondary leading-relaxed bg-velum-800/40 border border-white-5 rounded p-5 text-center">
              You have no active support tickets.
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => {
                const styles = getCategoryStyles(t.issue_type);
                const isExpanded = !!expandedTickets[t.ticket_id];
                const lastMessage = t.messages && t.messages[t.messages.length - 1];

                return (
                  <div 
                    key={t.ticket_id} 
                    onClick={() => toggleTicket(t.ticket_id)}
                    className={`glass-card p-4 transition-all duration-200 cursor-pointer shadow-md relative ${styles.border} hover:bg-white-5/[0.02]`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[8px] font-black tracking-widest font-mono text-text-secondary uppercase">
                            Ticket #{t.ticket_id.slice(0, 8)}
                          </span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono uppercase font-bold flex items-center gap-1 ${styles.badge}`}>
                            <Tag className="w-2 h-2" />
                            {categories.find(c => c.value === t.issue_type)?.label || 'General Support'}
                          </span>
                        </div>
                        
                        {!isExpanded ? (
                          <div className="pt-1.5">
                            <p className="text-[11px] text-text-primary font-sans leading-relaxed line-clamp-1">
                              {t.reason || (t.messages && t.messages[0] && t.messages[0].content)}
                            </p>
                            {lastMessage && lastMessage.sender_name === 'Support operator' && (
                              <p className="text-[9px] text-accent font-mono flex items-center gap-1 mt-1">
                                <MessageCircle className="w-2.5 h-2.5" />
                                <span>Support operator replied: "{lastMessage.content.slice(0, 50)}..."</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="pt-2 space-y-3" onClick={(e) => e.stopPropagation()}>
                            <div className="bg-velum-900/40 p-3 rounded border border-white-5/[0.05]">
                              <p className="text-[11px] text-text-primary font-sans leading-relaxed whitespace-pre-wrap">
                                {t.reason || (t.messages && t.messages[0] && t.messages[0].content)}
                              </p>
                            </div>

                            {/* Message Thread */}
                            <div className="space-y-2 mt-2 max-h-60 overflow-y-auto pr-1">
                              {(t.messages || []).map((msg, idx) => {
                                const isOp = msg.sender_name === 'Support operator';
                                const isSys = msg.sender_name === 'System' || msg.sender_name === 'SYSTEM';
                                
                                if (isSys) {
                                  return (
                                    <div key={idx} className="text-center py-1">
                                      <span className="text-[8px] font-mono text-text-secondary bg-velum-900 px-2 py-0.5 rounded">
                                        {msg.content}
                                      </span>
                                    </div>
                                  );
                                }

                                return (
                                  <div 
                                    key={idx} 
                                    className={`flex flex-col max-w-[85%] rounded-lg p-2.5 text-[10px] space-y-1 ${
                                      isOp 
                                        ? 'bg-accent/5 border-l-2 border-l-accent mr-auto' 
                                        : 'bg-white-5 ml-auto border-r-2 border-r-text-secondary/50'
                                    }`}
                                  >
                                    <div className="flex justify-between gap-4 text-[8px] text-text-secondary font-mono">
                                      <span className="font-bold uppercase">{msg.sender_name}</span>
                                      <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-text-primary font-sans break-words">{msg.content}</p>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Reply Input Form */}
                            {t.status !== 'resolved' && (
                              <div className="flex gap-2 mt-2">
                                <input
                                  type="text"
                                  placeholder="Type your reply here..."
                                  className="flex-grow bg-velum-900 border border-white-5 rounded px-2.5 py-1.5 text-[10px] text-text-primary focus:border-accent focus:outline-none"
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                      const val = e.currentTarget.value.trim();
                                      e.currentTarget.value = '';
                                      const sId = fetchSessionId();
                                      try {
                                        const res = await fetch(`/api/user/tickets/${t.ticket_id}/reply`, {
                                          method: 'POST',
                                          headers: { 'Authorization': `Bearer ${sId}`, 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ content: val })
                                        });
                                        if (res.ok) {
                                          loadTickets();
                                        } else {
                                          const data = await res.json();
                                          alert(data.error || 'Failed to submit reply.');
                                        }
                                      } catch (err) {
                                        alert('Network error occurred while submitting reply.');
                                      }
                                    }
                                  }}
                                />
                              </div>
                            )}

                            {t.credentials_forwarded && (
                              <div className="bg-velum-900 border border-white-5 p-2.5 rounded">
                                <div className="text-[8px] font-bold text-text-secondary font-mono uppercase tracking-wider mb-1">
                                  Supporting Details
                                </div>
                                <pre className="text-[9px] font-mono text-text-secondary break-all overflow-x-auto select-all">
                                  {t.credentials_forwarded}
                                </pre>
                              </div>
                            )}

                            <div className="flex justify-between items-center text-[9px] font-mono text-text-secondary border-t border-white-5 pt-2.5">
                              <span>Created: {new Date(t.created_at).toLocaleString()}</span>
                              {t.reviewer_id && (
                                <span className="text-emerald-450 font-bold">Operator ID: #{t.reviewer_id}</span>
                              )}
                            </div>

                            {/* Actions buttons */}
                            <div className="flex gap-2 pt-2 justify-end border-t border-white-5">
                              {t.status !== 'resolved' && (
                                <button
                                  type="button"
                                  onClick={(e) => handleCloseTicket(t.ticket_id, e)}
                                  className="px-2 py-1 bg-white-5 hover:bg-white-10 rounded text-[9px] uppercase font-bold text-text-primary transition"
                                >
                                  Close Ticket
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleDeleteTicket(t.ticket_id, e)}
                                className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 border border-rose-500/20 rounded text-[9px] uppercase font-bold transition flex items-center gap-1"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-black ${
                          t.status === 'resolved' ? 'bg-status-online/10 text-emerald-450 border border-emerald-900/30' :
                          t.status === 'denied' ? 'bg-rose-500/10 text-rose-455 border border-rose-900/30' :
                          'bg-amber-500/10 text-status-away border border-amber-900/30'
                        }`}>
                          {t.status}
                        </span>
                        
                        <div className="text-text-secondary hover:text-text-primary transition">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
