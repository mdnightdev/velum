import React from 'react';
import { EscrowTransaction } from '../../types';
import EscrowTransactionCard from '../EscrowTransactionCard';
import { ShieldCheck } from 'lucide-react';

interface MarketEscrowsViewProps {
  escrows: EscrowTransaction[];
  currentUserId: number;
  currentUserRole: string;
  onSandboxTest: (transactionId: string) => void;
  onReleaseEscrow: (transactionId: string) => void;
  onRevertEscrow: (transactionId: string) => void;
}

export function MarketEscrowsView({
  escrows,
  currentUserId,
  currentUserRole,
  onSandboxTest,
  onReleaseEscrow,
  onRevertEscrow
}: MarketEscrowsViewProps) {
  if (escrows.length === 0) return null;

  return (
    <div className="space-y-4 pt-6 border-t border-white-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <h3 className="text-xs font-mono font-black uppercase tracking-wider text-white">
          Escrows ({escrows.length})
        </h3>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {escrows.map((escrow) => (
          <EscrowTransactionCard
            key={escrow.transaction_id}
            escrow={escrow}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            handleRunSandboxTest={onSandboxTest}
            handleReleaseEscrow={onReleaseEscrow}
            handleRevertEscrow={onRevertEscrow}
          />
        ))}
      </div>
    </div>
  );
}
