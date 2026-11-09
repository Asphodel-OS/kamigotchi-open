import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect, useRef, useState } from 'react';

import { GasSponsorURL, isGasSponsored } from 'constants/gas';
import { setSponsoredPair } from 'engine/queue/sponsoredGas';

const POLL_MS = 3000;
const PLACEHOLDER_ADDRESS = '0x000000000000000000000000000000000000dEaD'; // stores' pre-wallet default

export type SponsorStatus = 'none' | 'pending' | 'whitelisted' | 'failed' | 'removed';

const ERROR_MESSAGES: Record<string, string> = {
  cap_reached: 'The demo is full right now.',
  rate_limited: 'Too many tries. Give it a minute.',
  wallet_taken: 'This wallet is already set up with another login.',
  wallets_not_linked: 'These wallets are not linked to your login.',
};
const DEFAULT_ERROR = 'Could not reach the gas server. Try again.';

/** Tracks whether this owner and operator pair has free gas, and lets the player ask for it. */
export const useGasSponsor = (ownerAddress?: string, operatorAddress?: string) => {
  const { getAccessToken } = usePrivy();
  const owner = ownerAddress === PLACEHOLDER_ADDRESS ? undefined : ownerAddress;
  const operator = operatorAddress === PLACEHOLDER_ADDRESS ? undefined : operatorAddress;
  const [status, setStatus] = useState<SponsorStatus>('none');
  const [error, setError] = useState('');

  // the wallet pair answers belong to. a reply that arrives after the player switched wallets
  // is about the old pair and must not change what this one is shown
  const pairRef = useRef('');
  pairRef.current = `${owner}:${operator}`;

  // the status for this pair, and whether its wallets can send at gas price 0
  const applyStatus = useCallback(
    (forPair: string, next: SponsorStatus) => {
      if (pairRef.current !== forPair || !owner || !operator) return;
      setStatus(next);
      setSponsoredPair(owner, operator, next === 'whitelisted');
    },
    [owner, operator]
  );

  const refresh = useCallback(async () => {
    if (!isGasSponsored || !owner || !operator) return;
    const forPair = `${owner}:${operator}`;
    try {
      const params = new URLSearchParams({ owner, operator });
      const res = await fetch(`${GasSponsorURL}/sponsor?${params}`);
      if (res.ok) applyStatus(forPair, (await res.json()).status);
    } catch {
      // keep the last known status: the next poll or click tries again
    }
  }, [owner, operator, applyStatus]);

  useEffect(() => {
    setStatus('none');
    setError('');
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status !== 'pending') return;
    const timerID = setInterval(refresh, POLL_MS);
    return () => clearInterval(timerID);
  }, [status, refresh]);

  const request = useCallback(async () => {
    if (!isGasSponsored || !owner || !operator) return;
    const forPair = `${owner}:${operator}`;
    setError('');
    try {
      const token = await getAccessToken();
      const res = await fetch(`${GasSponsorURL}/sponsor`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ owner, operator }),
      });
      const body = await res.json();
      if (pairRef.current !== forPair) return;
      if (res.ok) applyStatus(forPair, body.status);
      else setError(ERROR_MESSAGES[body.error] ?? DEFAULT_ERROR);
    } catch {
      if (pairRef.current === forPair) setError(DEFAULT_ERROR);
    }
  }, [owner, operator, getAccessToken, applyStatus]);

  return {
    error: error || (status === 'failed' ? DEFAULT_ERROR : ''),
    isPending: status === 'pending',
    isWhitelisted: status === 'whitelisted',
    request,
  };
};
