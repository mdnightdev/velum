import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { EscrowTransaction, stripAt } from '../types';
import { formatListingPrice } from './Market/MarketListingsView';

interface EscrowTransactionCardProps {
  escrow: EscrowTransaction;
  currentUserId: number;
  currentUserRole: string;
  handleRunSandboxTest: (transactionId: string) => void;
  handleReleaseEscrow: (transactionId: string) => void;
  handleRevertEscrow: (transactionId: string) => void;
}

function isHeld(status: string): boolean {
  const s = (status || '').toUpperCase();
  return s === 'HELD' || s === 'HELD_IN_ESCROW';
}

export default function EscrowTransactionCard({
  escrow,
  currentUserId,
  currentUserRole,
  handleRunSandboxTest: _handleRunSandboxTest,
  handleReleaseEscrow,
  handleRevertEscrow
}: EscrowTransactionCardProps) {
  const sellerName = escrow.seller_username || 'Seller';
  const buyerName = escrow.buyer_username || 'Buyer';
  const currency = escrow.currency || 'EUR';
  const held = isHeld(escrow.status);

  return (
    <div className="bg-velum-800 border border-velum-600 p-4 space-y-3 rounded-xl relative overflow-hidden">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h4 className="text-xs font-medium text-text-secondary">
            Order #{escrow.transaction_id.slice(0, 12)}
          </h4>
          {escrow.listing_title && (
            <p className="text-xs text-text-primary mt-0.5 truncate">{escrow.listing_title}</p>
          )}
          <div className="flex gap-1.5 mt-1.5">
            <span className="text-[10px] uppercase bg-velum-750 text-text-secondary px-2 py-0.5 rounded-md font-medium">
              {escrow.status}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] text-text-secondary block">Amount</span>
          <span className="text-sm font-mono font-semibold text-text-primary">
            {formatListingPrice(Number(escrow.amount || 0), currency)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs border-y border-velum-600 py-2.5 text-text-secondary">
        <div>
          <span className="text-[10px] text-text-secondary block">Seller</span>
          <span className="font-medium text-text-primary">{stripAt(sellerName)}</span>
        </div>
        <div>
          <span className="text-[10px] text-text-secondary block">Buyer</span>
          <span className="font-medium text-text-primary">{stripAt(buyerName)}</span>
        </div>
      </div>

      <div className="flex justify-between text-xs bg-velum-750 p-2.5 rounded-lg border border-velum-600">
        <div>
          <span className="text-text-secondary mr-2">Fee</span>
          <span className="text-text-primary font-medium">
            {formatListingPrice(Number(escrow.platform_fee || 0), currency)}
          </span>
        </div>
        <div>
          <span className="text-text-secondary mr-2">Seller receives</span>
          <span className="text-text-primary font-medium">
            {formatListingPrice(Number(escrow.payout_amount || 0), currency)}
          </span>
        </div>
      </div>

      {held && (
        <div className="flex gap-2 pt-1">
          {Number(escrow.buyer_id) === currentUserId && (
            <button
              id={`release_btn_${escrow.transaction_id}`}
              type="button"
              onClick={() => handleReleaseEscrow(escrow.transaction_id)}
              className="flex-1 py-2 bg-accent hover:bg-accent-hover text-black text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Release</span>
            </button>
          )}

          {(Number(escrow.buyer_id) === currentUserId ||
            Number(escrow.seller_id) === currentUserId ||
            currentUserRole !== 'USER') && (
            <button
              type="button"
              onClick={() => handleRevertEscrow(escrow.transaction_id)}
              className="py-2 px-3 bg-velum-750 hover:bg-status-dnd/20 text-status-dnd border border-velum-600 text-xs font-medium rounded-lg transition cursor-pointer"
              title="Cancel escrow"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
