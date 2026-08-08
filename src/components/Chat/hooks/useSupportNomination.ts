import { useState, useEffect } from 'react';
import { getSessionId } from '../../../utils/auth';

export interface UseSupportNominationOptions {
  activeChatPeer?: { userId: number } | null;
}

export function useSupportNomination({ activeChatPeer }: UseSupportNominationOptions) {
  const [hasPendingNomination, setHasPendingNomination] = useState(false);
  const [isSubmittingNominationAction, setIsSubmittingNominationAction] = useState(false);

  useEffect(() => {
    if (activeChatPeer?.userId === 999) {
      const sessionId = getSessionId();
      fetch('/v2/user/nomination/pending', {
        headers: { 'Authorization': `Bearer ${sessionId}` }
      })
        .then(res => res.json())
        .then(data => {
          setHasPendingNomination(!!data.hasPending);
        })
        .catch(() => {});
    } else {
      setHasPendingNomination(false);
    }
  }, [activeChatPeer]);

  const handleNominationAction = async (action: 'accept' | 'decline') => {
    if (isSubmittingNominationAction) return;
    setIsSubmittingNominationAction(true);

    try {
      const sessionId = getSessionId();
      const res = await fetch(`/v2/user/nomination/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionId}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        alert(`Successfully ${action === 'accept' ? 'accepted' : 'declined'} support admin nomination.`);
        setHasPendingNomination(false);
      } else {
        const data = await res.json();
        alert(data.error || `Failed to ${action} nomination.`);
      }
    } catch {
      alert("Network error.");
    } finally {
      setIsSubmittingNominationAction(false);
    }
  };

  return {
    hasPendingNomination,
    isSubmittingNominationAction,
    handleNominationAction,
  };
}
