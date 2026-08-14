import React, { useState, useEffect, useRef } from 'react';
import { Plus, Send, MessageSquare, Tag, Trash2, ChevronDown, Check, ChevronUp, MessageCircle, Menu, ChevronLeft, Search, Clock, Info } from 'lucide-react';
import { Ticket } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useResponsiveLayout } from '../../hooks/useResponsive';

interface TicketsMainDashboardProps {
  currentUserId: number;
  isDark?: boolean;
  onToggleSidebar?: () => void;
}

export default function TicketsMainDashboard({
  currentUserId,
  isDark = true,
  onToggleSidebar
}: TicketsMainDashboardProps) {
  const { t } = useLanguage();
  const { isMobile: _isMobile, isTablet } = useResponsiveLayout();
  const isMobile = _isMobile || isTablet;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [reason, setReason] = useState('');
  const [issueType, setIssueType] = useState('general_support');
  const [credentials, setCredentials] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchSessionId = () => sessionStorage.getItem('velum-sessionId') || localStorage.getItem('velum-sessionId') || '';

  const categories = [
    { value: 'general_support', label: 'General Support' },
    { value: 'escrow_dispute', label: 'Escrow Dispute' },
    { value: 'account_sanction', label: 'Account Ban / Sanction' },
    { value: 'marketplace_listing', label: 'Marketplace Listing' },
    { value: 'wallet_payments', label: 'Wallet & Payments' }
  ];

  const stripSystemTags = (str?: string | null): string => {
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
      const res = await fetch(`/v2/user/tickets`, { headers });
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

  // Scroll to bottom when messages change for active ticket
  const activeTicket = tickets.find(t => t.ticket_id === activeTicketId);
  useEffect(() => {
    if (activeTicketId && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTicket?.messages]);


  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setIsSubmitting(true);
    try {
      const sId = fetchSessionId();
      const res = await fetch('/v2/tickets', {
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
        await loadTickets();
        setIsCreating(false);
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

  const handleReply = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim() && activeTicketId) {
      const val = e.currentTarget.value.trim();
      e.currentTarget.value = '';
      const sId = fetchSessionId();
      try {
        const res = await fetch(`/v2/user/tickets/${activeTicketId}/reply`, {
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
  };

  const executeDeleteTicket = async (ticketId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      const sId = fetchSessionId();
      const res = await fetch(`/v2/admin/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sId}` }
      });
      if (res.ok) {
        showToast('Ticket deleted permanently.');
        if (activeTicketId === ticketId) setActiveTicketId(null);
        loadTickets();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to delete ticket.');
      }
    } catch (err) {
      showToast('Network error occurred while deleting ticket.');
    }
  };

  // --- RENDERING ---

  const renderTicketList = () => (
    <div className={`flex flex-col h-full bg-velum-850 border-r border-white/5 ${isMobile && (activeTicketId || isCreating) ? 'hidden' : 'w-full md:w-80 flex-shrink-0'}`}>
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onToggleSidebar && isMobile && (
            <button 
              onClick={onToggleSidebar} 
              className="p-1.5 -ml-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-sm font-bold uppercase tracking-widest text-text-primary">Support Tickets</h2>
        </div>
        <button 
          onClick={() => { setIsCreating(true); setActiveTicketId(null); }}
          className="p-1.5 rounded-lg text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
          title="New Ticket"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-3 space-y-2">
        {loading ? (
          <div className="text-xs font-mono text-text-secondary/50 p-4 text-center">Loading...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-3" />
            <div className="text-xs font-semibold text-text-secondary">No open tickets</div>
          </div>
        ) : (
          tickets.map(t => {
            const isActive = activeTicketId === t.ticket_id && !isCreating;
            const category = categories.find(c => c.value === t.issue_type)?.label || 'Support';
            const cleanReason = stripSystemTags(t.reason);
            const lastMsg = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1] : null;

            return (
              <button
                key={t.ticket_id}
                onClick={() => { setActiveTicketId(t.ticket_id); setIsCreating(false); }}
                className={`w-full text-left p-3 rounded-xl transition-colors ${
                  isActive ? 'bg-white/10 shadow-sm' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${t.status === 'resolved' ? 'bg-status-offline' : t.status === 'escalated' ? 'bg-accent' : 'bg-status-online'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                      {category}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-secondary/60">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                
                <div className={`text-xs font-semibold line-clamp-1 mb-1 ${isActive ? 'text-white' : 'text-text-primary'}`}>
                  {cleanReason}
                </div>

                {lastMsg && (
                  <div className="text-[11px] text-text-secondary line-clamp-1 flex items-center gap-1.5">
                    <MessageCircle className="w-3 h-3 shrink-0" />
                    <span>{lastMsg.sender_name === 'Support operator' ? 'Operator: ' : ''}{stripSystemTags(lastMsg.content)}</span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const renderActiveTicket = () => {
    if (isCreating) return renderCreateForm();
    if (!activeTicket) {
      if (isMobile) return null;
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-velum-900 border-l border-white/5">
          <MessageSquare className="w-12 h-12 text-white/5 mb-4" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Support Center</h3>
          <p className="text-xs text-text-secondary mt-2">Select a ticket from the list or create a new one.</p>
        </div>
      );
    }

    const cleanReason = stripSystemTags(activeTicket.reason);

    return (
      <div className={`flex-1 flex flex-col h-full bg-velum-900 border-l border-white/5 ${isMobile && !activeTicketId && !isCreating ? 'hidden' : 'flex'}`}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-velum-850">
          <div className="flex items-center gap-4">
            {isMobile && (
              <button 
                onClick={() => setActiveTicketId(null)}
                className="p-1.5 -ml-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${activeTicket.status === 'resolved' ? 'bg-status-offline' : activeTicket.status === 'escalated' ? 'bg-accent' : 'bg-status-online'}`} />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  Ticket #{activeTicket.ticket_id.slice(0, 8)}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-text-secondary uppercase tracking-widest">
                <span>{categories.find(c => c.value === activeTicket.issue_type)?.label || 'Support'}</span>
                {activeTicket.tracking_id && (
                  <>
                    <span>•</span>
                    <span className="text-accent/80">TRK: {activeTicket.tracking_id}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => executeDeleteTicket(activeTicket.ticket_id)}
              className="p-2 rounded-lg text-text-secondary hover:text-status-dnd hover:bg-status-dnd/10 transition-colors cursor-pointer"
              title="Delete Ticket"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto scrollbar-none p-5 space-y-6">
          {/* Initial Ticket Request */}
          <div className="flex flex-col max-w-[85%] bg-velum-800 border border-white/5 rounded-2xl rounded-tl-sm p-4 text-xs sm:text-sm space-y-2 mr-auto shadow-sm">
            <div className="flex justify-between gap-4 text-xs text-text-secondary/80">
              <span className="font-bold text-white">Initial Request</span>
              <span className="text-[10px] font-mono">{new Date(activeTicket.created_at).toLocaleString()}</span>
            </div>
            <p className="text-text-primary font-sans break-words leading-relaxed whitespace-pre-wrap">
              {cleanReason}
            </p>
          </div>

          {/* Messages Thread */}
          {(activeTicket.messages || []).map((msg, idx) => {
            const isOp = msg.sender_name === 'Support operator' || msg.sender_name === 'Admin';
            const isSys = msg.sender_name === 'System' || msg.sender_name === 'SYSTEM';
            const cleanContent = stripSystemTags(msg.content);
            
            if (isSys) {
              return (
                <div key={idx} className="flex justify-center py-2">
                  <span className="text-[10px] font-bold text-text-secondary/60 bg-velum-850 px-4 py-1.5 rounded-full border border-white/5 uppercase tracking-widest">
                    {cleanContent}
                  </span>
                </div>
              );
            }

            return (
              <div 
                key={idx} 
                className={`flex flex-col max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm shadow-sm ${
                  isOp 
                    ? 'bg-accent/10 border border-accent/20 rounded-tl-sm mr-auto' 
                    : 'bg-velum-800 border border-white/5 rounded-tr-sm ml-auto'
                }`}
              >
                <div className="flex justify-between gap-4 text-[10px] font-bold text-text-secondary/80 mb-1.5 uppercase tracking-wider">
                  <span className={isOp ? 'text-accent' : 'text-white'}>{msg.sender_name}</span>
                  <span className="font-mono">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-text-primary font-sans break-words leading-relaxed">
                  {cleanContent}
                </p>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {activeTicket.status !== 'resolved' ? (
          <div className="p-4 bg-velum-850 border-t border-white/5 shrink-0">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Type your reply and press Enter..."
                className="w-full bg-velum-900 border border-white/10 rounded-full pl-5 pr-12 py-3.5 text-sm text-text-primary focus:border-accent/60 focus:ring-1 focus:ring-accent/30 focus:outline-none placeholder:text-text-secondary/40 transition-all"
                onKeyDown={handleReply}
              />
              <button 
                className="absolute right-2 p-2 rounded-full text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  if (input && input.value.trim()) {
                    handleReply({ key: 'Enter', currentTarget: input } as any);
                  }
                }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-velum-850 border-t border-white/5 shrink-0 flex justify-center">
            <span className="text-[10px] font-bold text-status-offline uppercase tracking-widest font-mono">
              Ticket Resolved & Closed
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderCreateForm = () => {
    return (
      <div className={`flex-1 flex flex-col h-full bg-velum-900 border-l border-white/5 overflow-y-auto scrollbar-none ${isMobile && !isCreating ? 'hidden' : 'flex'}`}>
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-4 shrink-0 sticky top-0 bg-velum-900/90 backdrop-blur z-10">
          {isMobile && (
            <button 
              onClick={() => setIsCreating(false)}
              className="p-1.5 -ml-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            Create Ticket
          </h3>
        </div>

        <div className="p-6 max-w-2xl mx-auto w-full">
          <form onSubmit={handleSubmitTicket} className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block">Issue Category</label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full bg-velum-800 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3.5 text-sm text-text-primary focus:outline-none flex items-center justify-between transition-all"
                >
                  <span className="font-semibold">{categories.find(c => c.value === issueType)?.label || 'Select Category'}</span>
                  <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-accent' : ''}`} />
                </button>
                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 bg-[#121212] border border-white/20 rounded-xl shadow-2xl z-50 overflow-hidden font-sans">
                    {categories.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          setIssueType(c.value);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                          issueType === c.value ? 'bg-accent/10 text-accent font-semibold' : 'text-text-primary hover:bg-white/5'
                        }`}
                      >
                        {c.label}
                        {issueType === c.value && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block">Description</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={5}
                className="w-full bg-velum-800 border border-white/10 rounded-xl p-4 text-sm text-text-primary focus:border-accent/60 focus:ring-1 focus:ring-accent/30 focus:outline-none transition-all resize-none placeholder:text-text-secondary/40"
                placeholder="Explain the issue in detail..."
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block flex items-center justify-between">
                <span>Additional Details (Optional)</span>
                
              </label>
              <textarea
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                rows={2}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-text-primary focus:border-accent/60 focus:ring-1 focus:ring-accent/30 focus:outline-none transition-all resize-none font-mono placeholder:text-text-secondary/40 placeholder:font-sans"
                placeholder="Provide any transaction IDs, wallet addresses, or verification details here..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="w-full py-4 bg-accent text-velum-900 font-bold rounded-xl hover:bg-accent-hover transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
              {!isSubmitting && <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-velum-900 overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-velum-800 border border-white/10 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Info className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-text-primary">{toastMessage}</span>
        </div>
      )}

      {renderTicketList()}
      {renderActiveTicket()}
    </div>
  );
}
