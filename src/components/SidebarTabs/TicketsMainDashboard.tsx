import React, { useState, useEffect } from 'react';
import { Eye, Plus, Send, ShieldCheck, Mail, Clock, ShieldAlert } from 'lucide-react';
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
  const [credentials, setCredentials] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSessionId = () => sessionStorage.getItem('velum-sessionId') || '';

  const loadTickets = async () => {
    try {
      const sId = fetchSessionId();
      const headers = { 'Authorization': `Bearer ${sId}` };
      const res = await fetch(`/api/tickets?userId=${currentUserId}`, { headers });
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

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
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
          reason,
          credentialsForwarded: credentials || null
        })
      });

      if (res.ok) {
        setReason('');
        setCredentials('');
        loadTickets();
        alert('Arbitration ticket filed completely for administration audit.');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to file ticket.');
      }
    } catch (err) {
      alert('Network transmission exception while filing ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="tickets_dashboard" className="flex-1 bg-transparent p-6 lg:p-8 space-y-6 select-none">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* File Ticket Form */}
        <form onSubmit={handleSubmitTicket} className="lg:col-span-5 bg-velum-800 border border-white-5 rounded p-5 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-accent font-mono flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>File Secure Request</span>
          </h3>

          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              SPECIFIC NATURE / REASON FOR DISPUTE
            </label>
            <textarea
              id="ticket_reason"
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide clean, precise operational reason (e.g. key upgrade error, locked workspace...)"
              className="w-full bg-velum-900 border border-white-5 rounded px-3 py-2 text-xs text-text-primary focus:border-accent focus:outline-none resize-none font-sans"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase tracking-wider font-bold text-text-secondary font-mono">
              FORWARDED DETAILS / ENCRYPTED METADATA (OPTIONAL)
            </label>
            <textarea
              id="ticket_credentials"
              rows={3}
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder="Hexadecimal logs or auxiliary hashes to expedite verification"
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
            <span>{isSubmitting ? 'Transmitting Request...' : 'Dispatch Request'}</span>
          </button>
        </form>

        {/* Existing Tickets list */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-[10px] uppercase tracking-wider font-bold text-text-secondary font-mono">
            Active Requests Filed ({tickets.length})
          </h3>

          {loading ? (
            <div className="text-[10px] text-text-secondary font-mono animate-pulse">Establishing secure link...</div>
          ) : tickets.length === 0 ? (
            <div className="text-[10px] text-text-secondary font-mono leading-relaxed bg-velum-800/40 border border-white-5 rounded p-4 text-center">
              No active security tickets or arbitration requests located on this node.
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <div key={t.ticket_id} className="bg-velum-800 border border-white-5 p-4 rounded space-y-3 shadow-md">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[8px] font-black tracking-widest font-mono text-text-secondary block uppercase">
                        TICKET #{t.ticket_id.slice(0, 8)}
                      </span>
                      <p className="text-[11px] text-text-primary font-sans mt-1.5 leading-relaxed">
                        {t.reason}
                      </p>
                    </div>
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-black ${
                      t.status === 'resolved' ? 'bg-status-online/10 text-emerald-450 border border-emerald-900/30' :
                      t.status === 'denied' ? 'bg-rose-500/10 text-rose-455 border border-rose-900/30' :
                      'bg-amber-500/10 text-status-away border border-amber-900/30'
                    }`}>
                      {t.status}
                    </span>
                  </div>

                  {t.credentials_forwarded && (
                    <div className="bg-velum-900 border border-white-5 p-2.5 rounded">
                      <div className="text-[8px] font-bold text-text-secondary font-mono uppercase tracking-wider mb-1">
                        Encrypted Data Associated
                      </div>
                      <pre className="text-[9px] font-mono text-text-secondary break-all overflow-x-auto select-all">
                        {t.credentials_forwarded}
                      </pre>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[9px] font-mono text-text-secondary border-t border-white-5 pt-2.5">
                    <span>Filed: {new Date(t.created_at).toLocaleString()}</span>
                    {t.reviewer_id && (
                      <span className="text-emerald-450 font-bold">Reviewer ID: #{t.reviewer_id}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
