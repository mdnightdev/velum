import React, { useState, useEffect, useRef } from 'react';
import { Plus, Send, MessageSquare, Tag, Trash2, ChevronDown, Check, ChevronUp, MessageCircle } from 'lucide-react';
import { Ticket } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface TicketsMainDashboardProps {
  currentUserId: number;
  isDark?: boolean;
}

export default function TicketsMainDashboard({
  currentUserId,
  isDark = true
}: TicketsMainDashboardProps) {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reason, setReason] = useState('');
  const [issueType, setIssueType] = useState('general_support');
  const [credentials, setCredentials] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({});
  const [confirmAction, setConfirmAction] = useState<{ type: 'close' | 'delete'; ticketId: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchSessionId = () => sessionStorage.getItem('velum-sessionId') || localStorage.getItem('velum-sessionId') || '';

  const categories = [
    { value: 'general_support', label: 'General Support' },
    { value: 'escrow_dispute', label: 'Escrow Dispute' },
    { value: 'account_sanction', label: 'Account Ban / Sanction' },
    { value: 'marketplace_listing', label: 'Marketplace Listing' },
    { value: 'wallet_payments', label: 'Wallet & Payments' }
  ];

  const stripLarpNoise = (str?: string | null): string => {
    if (!str) return '';
    return str.replace(/\[Forwarded Details \/ Encrypted Metadata\]:\s*/gi, '').trim();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

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
        showToast('Support ticket submitted successfully.');
        loadTickets();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to submit ticket.');
      }
    } catch (err) {
      showToast('Network error occurred while submitting ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDeleteTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/user/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        }
      });
      setConfirmAction(null);
      if (res.ok) {
        showToast('Ticket deleted successfully.');
        loadTickets();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete ticket.');
      }
    } catch {
      showToast('Network error occurred while deleting ticket.');
    }
  };

  const executeCloseTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/api/user/tickets/${ticketId}/close`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${sId}`,
          'Content-Type': 'application/json'
        }
      });
      setConfirmAction(null);
      if (res.ok) {
        showToast('Ticket marked as closed.');
        loadTickets();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to close ticket.');
      }
    } catch {
      showToast('Network error occurred while closing ticket.');
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
          border: 'border-l-4 border-l-amber-500 border-t border-r border-b border-white/10',
          badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
        };
      case 'account_sanction':
        return {
          border: 'border-l-4 border-l-rose-500 border-t border-r border-b border-white/10',
          badge: 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
        };
      case 'marketplace_listing':
        return {
          border: 'border-l-4 border-l-indigo-500 border-t border-r border-b border-white/10',
          badge: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
        };
      case 'wallet_payments':
        return {
          border: 'border-l-4 border-l-emerald-500 border-t border-r border-b border-white/10',
          badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
        };
      case 'general_support':
      default:
        return {
          border: 'border-l-4 border-l-sky-500 border-t border-r border-b border-white/10',
          badge: 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
        };
    }
  };

  return (
    <div id="tickets_dashboard" className="flex-1 bg-transparent p-6 lg:p-8 space-y-6 font-sans">
      {toastMessage && (
        <div className="bg-accent/15 border border-accent/40 text-accent px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="text-accent hover:text-white transition p-1 cursor-pointer">
            ✕
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Create Ticket Form */}
        <form onSubmit={handleSubmitTicket} className="bg-[#10131B] border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl lg:col-span-5">
          <h3 className="text-sm font-semibold tracking-wide text-accent flex items-center gap-2">
            <Plus className="w-4 h-4 text-accent" />
            <span>Create Support Ticket</span>
          </h3>

          <div className="space-y-2 relative" ref={dropdownRef}>
            <label className="block text-xs font-semibold text-text-secondary">
              Ticket Category
            </label>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full bg-[#151924] border border-white/10 rounded-xl px-4 py-3 text-xs sm:text-sm text-text-primary hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent/40 focus:outline-none flex items-center justify-between cursor-pointer transition shadow-sm font-sans"
            >
              <span className="font-medium text-text-primary">{categories.find(c => c.value === issueType)?.label || 'Select Category'}</span>
              <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-accent' : ''}`} />
            </button>
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-[#171B28] border border-white/15 rounded-xl shadow-2xl z-50 overflow-hidden font-sans divide-y divide-white/5">
                {categories.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setIssueType(c.value);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-xs sm:text-sm transition-colors flex items-center justify-between cursor-pointer ${
                      issueType === c.value ? 'bg-accent/15 text-accent font-semibold' : 'text-text-primary hover:bg-white/5'
                    }`}
                  >
                    <span>{c.label}</span>
                    {issueType === c.value && <Check className="w-4 h-4 text-accent" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-text-secondary">
              Description of the Issue
            </label>
            <textarea
              id="ticket_reason"
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please describe your issue or question in detail..."
              className="w-full bg-[#151924] border border-white/10 rounded-xl p-3.5 text-xs sm:text-sm text-text-primary focus:border-accent/60 focus:ring-1 focus:ring-accent/30 focus:outline-none resize-none font-sans leading-relaxed placeholder:text-text-disabled"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-text-secondary">
              Supporting Details / Logs (Optional)
            </label>
            <textarea
              id="ticket_credentials"
              rows={3}
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder="Provide transaction IDs, error logs, or relevant details..."
              className="w-full bg-[#151924] border border-white/10 rounded-xl p-3.5 text-xs sm:text-sm text-text-primary focus:border-accent/60 focus:ring-1 focus:ring-accent/30 focus:outline-none resize-none font-sans leading-relaxed placeholder:text-text-disabled"
            />
          </div>

          <button
            id="ticket_submit_btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-accent hover:bg-accent-hover text-[#0C0E12] text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md font-sans hover:shadow-accent/20"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Submitting Ticket...' : 'Submit Ticket'}</span>
          </button>
        </form>

        {/* Existing Tickets list */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-sm font-semibold tracking-wide text-text-secondary flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-text-secondary" />
            <span>Your Support Tickets ({tickets.length})</span>
          </h3>

          {loading ? (
            <div className="text-xs text-text-secondary animate-pulse p-4">Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div className="text-xs sm:text-sm text-text-secondary leading-relaxed bg-[#10131B] border border-white/10 rounded-2xl p-8 text-center shadow-md">
              You currently have no support tickets.
            </div>
          ) : (
            <div className="space-y-3.5">
              {tickets.map((t) => {
                const styles = getCategoryStyles(t.issue_type);
                const isExpanded = !!expandedTickets[t.ticket_id];
                const lastMessage = t.messages && t.messages[t.messages.length - 1];
                const cleanReason = stripLarpNoise(t.reason || (t.messages && t.messages[0] && t.messages[0].content));

                return (
                  <div 
                    key={t.ticket_id} 
                    onClick={() => toggleTicket(t.ticket_id)}
                    className={`bg-[#10131B] border rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-md relative ${styles.border} hover:border-white/20 hover:bg-[#131622]`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-semibold text-text-secondary">
                            Ticket #{t.ticket_id.slice(0, 8)}
                          </span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5 ${styles.badge}`}>
                            <Tag className="w-3 h-3" />
                            {categories.find(c => c.value === t.issue_type)?.label || 'General Support'}
                          </span>
                        </div>
                        
                        {!isExpanded ? (
                          <div className="pt-1">
                            <p className="text-xs sm:text-sm text-text-primary font-sans leading-relaxed line-clamp-2">
                              {cleanReason}
                            </p>
                            {lastMessage && lastMessage.sender_name === 'Support operator' && (
                              <p className="text-xs text-accent font-medium flex items-center gap-1.5 mt-2">
                                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Support operator replied: "{stripLarpNoise(lastMessage.content).slice(0, 60)}..."</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="pt-3 space-y-4" onClick={(e) => e.stopPropagation()}>
                            <div className="bg-[#151924] p-4 rounded-xl border border-white/10">
                              <p className="text-xs sm:text-sm text-text-primary font-sans leading-relaxed whitespace-pre-wrap">
                                {cleanReason}
                              </p>
                            </div>

                            {/* Message Thread */}
                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                              {(t.messages || []).map((msg, idx) => {
                                const isOp = msg.sender_name === 'Support operator';
                                const isSys = msg.sender_name === 'System' || msg.sender_name === 'SYSTEM';
                                const cleanContent = stripLarpNoise(msg.content);
                                
                                if (isSys) {
                                  return (
                                    <div key={idx} className="text-center py-1">
                                      <span className="text-xs font-medium text-text-secondary bg-[#151924] px-3 py-1 rounded-full border border-white/5">
                                        {cleanContent}
                                      </span>
                                    </div>
                                  );
                                }

                                return (
                                  <div 
                                    key={idx} 
                                    className={`flex flex-col max-w-[88%] rounded-xl p-3 text-xs sm:text-sm space-y-1.5 ${
                                      isOp 
                                        ? 'bg-accent/10 border-l-2 border-l-accent mr-auto' 
                                        : 'bg-[#171B28] ml-auto border-r-2 border-r-text-secondary/50'
                                    }`}
                                  >
                                    <div className="flex justify-between gap-4 text-xs text-text-secondary">
                                      <span className="font-semibold">{msg.sender_name}</span>
                                      <span className="text-[11px] opacity-80">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="text-text-primary font-sans break-words leading-relaxed">{cleanContent}</p>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Reply Input Form */}
                            {t.status !== 'resolved' && (
                              <div className="pt-1">
                                <input
                                  type="text"
                                  placeholder="Type your reply and press Enter..."
                                  className="w-full bg-[#151924] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-text-primary focus:border-accent/60 focus:ring-1 focus:ring-accent/30 focus:outline-none"
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
                              <div className="bg-[#151924] border border-white/10 p-3.5 rounded-xl space-y-1">
                                <div className="text-xs font-semibold text-text-secondary">
                                  Supporting Details / Attachments
                                </div>
                                <pre className="text-xs font-mono text-text-primary break-all overflow-x-auto whitespace-pre-wrap">
                                  {t.credentials_forwarded}
                                </pre>
                              </div>
                            )}

                            <div className="flex justify-between items-center text-xs text-text-secondary border-t border-white/10 pt-3">
                              <span>Created: {new Date(t.created_at).toLocaleString()}</span>
                            </div>

                            {/* Actions buttons */}
                            {confirmAction?.ticketId === t.ticket_id ? (
                              <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10 bg-white/5 p-3 rounded-xl" onClick={(e) => e.stopPropagation()}>
                                <span className="text-xs font-medium text-text-primary">
                                  {confirmAction.type === 'close' ? 'Close this ticket?' : 'Delete this ticket permanently?'}
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => confirmAction.type === 'close' ? executeCloseTicket(t.ticket_id, e) : executeDeleteTicket(t.ticket_id, e)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition cursor-pointer ${
                                      confirmAction.type === 'close' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
                                    }`}
                                  >
                                    {confirmAction.type === 'close' ? 'Yes, Close Ticket' : 'Yes, Delete'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setConfirmAction(null); }}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-text-primary rounded-lg text-xs font-semibold transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2 pt-2 justify-end border-t border-white/10">
                                {t.status !== 'resolved' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmAction({ type: 'close', ticketId: t.ticket_id });
                                    }}
                                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs font-semibold text-text-primary transition cursor-pointer"
                                  >
                                    Close Ticket
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmAction({ type: 'delete', ticketId: t.ticket_id });
                                  }}
                                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase ${
                          t.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                          t.status === 'denied' ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' :
                          'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}>
                          {t.status}
                        </span>
                        
                        <div className="text-text-secondary hover:text-text-primary transition p-1">
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
