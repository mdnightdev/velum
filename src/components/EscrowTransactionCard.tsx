import React from 'react';
import { Terminal, Play, ShieldCheck } from 'lucide-react';
import { EscrowTransaction, stripAt } from '../types';

interface EscrowTransactionCardProps {
  escrow: EscrowTransaction;
  currentUserId: number;
  currentUserRole: string;
  handleRunSandboxTest: (transactionId: string) => void;
  handleReleaseEscrow: (transactionId: string) => void;
  handleRevertEscrow: (transactionId: string) => void;
}

export default function EscrowTransactionCard({
  escrow,
  currentUserId,
  currentUserRole,
  handleRunSandboxTest,
  handleReleaseEscrow,
  handleRevertEscrow
}: EscrowTransactionCardProps) {
  const targetAccountName = escrow.seller_username || 'Creator';
  const buyerAccountName = escrow.buyer_username || 'Investor';

  return (
    <div className="glass-card border border-white-5 p-5 space-y-4 relative overflow-hidden shadow-xl">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-xs font-mono font-bold text-accent-secondary">ID Ref: {escrow.transaction_id.slice(0, 16)}</h4>
          <div className="flex gap-1.5 mt-1">
            <span className="text-[9px] font-mono uppercase bg-status-online-bg text-status-online px-2 py-0.5 rounded-lg font-bold">
              {escrow.status}
            </span>
            {escrow.coupon_applied && (
              <span className="text-[9px] font-mono bg-status-away-bg text-status-away px-2 py-0.5 rounded-lg font-bold">
                 {escrow.coupon_applied} Applied
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-text-secondary block font-mono uppercase">Amount</span>
          <span className="text-lg font-mono font-black text-alert-success">${Number(escrow.amount || 0).toFixed(2)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-[10px] font-mono border-y border-white-5 py-3 text-text-secondary">
        <div>
          <span className="text-[8.5px] text-text-secondary block uppercase">Seller</span>
          <span className="font-sans font-bold text-white">{stripAt(targetAccountName)}</span>
        </div>
        <div>
          <span className="text-[8.5px] text-text-secondary block uppercase">Buyer</span>
          <span className="font-sans font-bold text-white">{stripAt(buyerAccountName)}</span>
        </div>
      </div>

      {/* Ledger dynamic fee accounting (Pillar C) */}
      <div className="flex justify-between text-[10px] font-mono bg-black/20 p-2.5 rounded-lg border border-white-5">
        <div>
          <span className="text-text-secondary mr-2">Platform Cut (5%):</span>
          <span className="text-alert-error font-bold">${Number(escrow.platform_fee || 0).toFixed(2)}</span>
        </div>
        <div>
          <span className="text-text-secondary mr-2 text-right">Net Creator Settlement:</span>
          <span className="text-alert-success font-bold">${Number(escrow.payout_amount || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Pillar F: Sandboxed Isolate execution logs */}
      {escrow.sandbox_logs && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[8.5px] font-mono font-black text-text-secondary uppercase tracking-widest flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5 text-text-secondary" />
              <span>Testing Sandbox</span>
            </span>
            <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded font-bold ${
              escrow.sandbox_state === 'DEPLOYMENT_SUCCESS' ? 'bg-status-online-bg text-status-online' : 'bg-accent/10 text-accent'
            }`}>
              {escrow.sandbox_state}
            </span>
          </div>

          <div className="bg-black-60 border border-white-5 rounded-xl p-3 h-28 overflow-y-auto font-mono text-[8.5px] leading-relaxed text-text-secondary space-y-1">
            {escrow.sandbox_logs.map((logLine, idx) => (
              <div key={idx} className={logLine.includes('') || logLine.includes('SIGNAL') ? 'text-alert-success' : 'text-text-secondary'}>
                {logLine}
              </div>
            ))}
          </div>

          {escrow.sandbox_state === 'DEPLOYED_SANDBOX' && Number(escrow.buyer_id) === currentUserId && (
            <button
              onClick={() => handleRunSandboxTest(escrow.transaction_id)}
              className="w-full py-1.5 bg-black hover:bg-neutral-900 text-alert-success font-mono text-[8.5px] font-black uppercase rounded-lg tracking-wider transition cursor-pointer flex items-center justify-center gap-1"
            >
              <Play className="w-3 h-3" />
              <span>Run Tests</span>
            </button>
          )}
        </div>
      )}

      {/* Operations Clicks */}
      {escrow.status === 'HELD_IN_ESCROW' && (
        <div className="flex gap-2 pt-1">
          {Number(escrow.buyer_id) === currentUserId && (
            <button
              id={`release_btn_${escrow.transaction_id}`}
              onClick={() => handleReleaseEscrow(escrow.transaction_id)}
              className="flex-1 py-2.5 bg-status-online hover:bg-status-online/80 text-white font-sans font-black text-[10px] uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
            >
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>Release Funds</span>
            </button>
          )}

          {/* Both buyer, seller or system ops admin can trigger reversions */}
          {(Number(escrow.buyer_id) === currentUserId || Number(escrow.seller_id) === currentUserId || currentUserRole !== 'USER') && (
            <button
              onClick={() => handleRevertEscrow(escrow.transaction_id)}
              className="py-2.5 px-3 bg-status-dnd-bg hover:bg-status-dnd text-status-dnd font-mono text-[9px] font-black uppercase rounded-xl transition cursor-pointer"
              title="Revert holding escrow contract"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
