import { useInterwovenKit } from '@initia/interwovenkit-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useLayers } from 'app/root/hooks';
import { useAccount } from 'app/stores';
import {
  buildVoteMsg,
  GaugeCycle,
  getGaugeCycle,
  getVotingPower,
  getWeightVote,
  VOTING_POWER_DECIMALS,
  WeightVote,
} from 'network/initia/vote';
import {
  calcBase,
  calcWeight,
  getBallotConfig,
  getCycleClock,
  getEligibleWeight,
  getGraceCycle,
  getOwed,
  getStreakAt,
  GOLDEN_BALLOT_INDEX,
  hasMilestone,
  isSettled,
  isStreakVote,
  MILESTONES,
  VOTER_BADGE_INDICES,
} from 'network/shapes/Ballot';
import {
  getScoresByFilter,
  getTotalScoreByFilter,
  getVIPEpoch,
  getVIPEpochEnd,
} from 'network/shapes/Score';

const REFRESH_MS = 5 * 60 * 1000; // public LCD; the gauge moves slowly
const OPEN_STALE_MS = 60 * 1000; // opening the modal refetches L1 data older than this
const TICK_MS = 30 * 1000; // countdowns show minutes
const VOTE_CLOSE_LEAD = 1800; // L1 voting closes 30 minutes before the cycle/epoch ends

// offline estimate of the L1 gauge, used only after the LCD fails: yominet's BALLOT_CYCLE clock,
// anchored to L1 at deploy (unset on fresh worlds: cycle/epoch 39 started 1791446400)
const estimateCycle = (clock: ReturnType<typeof getCycleClock>, now: number): GaugeCycle => {
  if (clock.configured) {
    const start = clock.end - clock.length;
    return { cycle: clock.cycle, start, end: clock.end, votingEnd: clock.end - VOTE_CLOSE_LEAD };
  }
  const cycle = 39 + Math.floor((now - 1791446400) / 1209600);
  const start = 1791446400 + (cycle - 39) * 1209600;
  return { cycle, start, end: start + 1209600, votingEnd: start + 1207800 };
};

const toVP = (raw: number) => raw / VOTING_POWER_DECIMALS;

// a failed vote in a player's words: nothing when they closed the wallet, a retry hint when
// Initia couldn't be reached, else that Initia refused it
const voteError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/reject|denied|cancel/i.test(msg)) return '';
  if (/fetch|network|timeout|50[234]/i.test(msg))
    return "Couldn't reach Initia. Try again in a minute.";
  return 'Initia rejected the vote. Try again, or vote on app.initia.xyz.';
};

const isAccount = (id: string) => !!id && id !== '0' && id !== '0x0';

// everything the VIP modal shows: L1 gauge state, yominet ballots/streak, VIP score and the vote
// tx. L1 is read only while the modal is open (it stays mounted when closed)
export const useVip = (open: boolean) => {
  const { network } = useLayers();
  const { world, components } = network;
  const accountID = useAccount((s) => s.account.id);
  const ownerAddress = useAccount((s) => s.account.ownerAddress);
  const kit = useInterwovenKit();
  const queryClient = useQueryClient();
  // reads follow the account owner: yominet settles by owner, so only its vote earns Ballots
  const address = ownerAddress;
  const wrongWallet =
    kit.isConnected && kit.hexAddress.toLowerCase() !== ownerAddress.toLowerCase();

  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), TICK_MS);
    return () => clearInterval(id);
  }, []);

  /////////////////
  // L1

  const opts = { refetchInterval: REFRESH_MS, staleTime: OPEN_STALE_MS, retry: 1 };
  const gaugeQuery = useQuery({
    queryKey: ['vip', 'gauge'],
    queryFn: getGaugeCycle,
    enabled: open,
    ...opts,
  });
  const loading = gaugeQuery.isPending;
  // a failed refetch keeps the cached gauge, which is still good
  const sample = gaugeQuery.isError && !gaugeQuery.data;
  const gauge = gaugeQuery.data ?? estimateCycle(getCycleClock(world, components, now), now);
  const { cycle } = gauge;
  const live = open && isAccount(accountID) && !!gaugeQuery.data;

  // independent, so one failing view doesn't blank the others
  const powerQuery = useQuery({
    queryKey: ['vip', 'power', address],
    queryFn: () => getVotingPower(address),
    enabled: live,
    ...opts,
  });
  const voteQuery = useQuery({
    queryKey: ['vip', 'vote', address, cycle],
    queryFn: () => getWeightVote(cycle, address),
    enabled: live,
    ...opts,
  });

  // last cycle/epoch's vote, to say when its Ballots are still on the way
  const prevVoteQuery = useQuery({
    queryKey: ['vip', 'vote', address, cycle - 1],
    queryFn: () => getWeightVote(cycle - 1, address),
    enabled: live,
    ...opts,
    // closed cycles/epochs never change
    refetchInterval: false,
    staleTime: Infinity,
  });
  const l1Errors = [
    gaugeQuery.isError && 'gauge cycle',
    powerQuery.isError && 'voting power',
    voteQuery.isError && 'vote',
  ].filter(Boolean);
  const l1Error = l1Errors.length ? `Couldn't load ${l1Errors.join(', ')} from Initia L1.` : '';

  const votingPower = powerQuery.data ?? 0;
  const vote = voteQuery.data;
  const voted = !!vote?.voted;
  const sole = vote?.yominetWeight === 1;
  const isOpen = now < gauge.votingEnd;

  // why the vote button can't be used, if it can't
  const blocker = (() => {
    if (sample) return 'Initia unreachable';
    if (!powerQuery.isSuccess || !voteQuery.isSuccess) return '…';
    if (votingPower === 0) return 'No voting power';
    if (wrongWallet) return 'Wrong wallet';
    return '';
  })();

  /////////////////
  // YOMINET

  const cfg = getBallotConfig(world, components);
  const streakVote = isStreakVote(cfg, vote?.yominetWeight ?? 0, vote?.yominetPower ?? 0);
  // no account yet (logged out / registering): skip every per-account read
  const hasAccount = isAccount(accountID);
  const owed = hasAccount
    ? getOwed(world, components, accountID)
    : { ballots: 0, items: 0, rewards: [] };
  const claimable = owed.ballots > 0 || owed.items > 0;

  // a voted cycle/epoch the reporter hasn't settled yet: this one once voting closes, else the
  // last; ones before launch never settle
  const launch = getCycleClock(world, components, now).base;
  const awaiting = (c: number, yominetPower?: number) =>
    hasAccount &&
    c >= launch &&
    (yominetPower ?? 0) > 0 &&
    !isSettled(world, components, accountID, c);
  const prev = prevVoteQuery.data;
  const pendingCycle =
    !isOpen && awaiting(cycle, vote?.yominetPower)
      ? cycle
      : awaiting(cycle - 1, prev?.yominetPower)
        ? cycle - 1
        : 0;
  // last cycle/epoch's streak vote, cast but not settled yet: it already extends the streak
  const prevPending =
    awaiting(cycle - 1, prev?.yominetPower) &&
    isStreakVote(cfg, prev?.yominetWeight ?? 0, prev?.yominetPower ?? 0);

  const graceCycle = hasAccount ? getGraceCycle(world, components, accountID) : 0;
  const graceFree = !graceCycle || cycle >= graceCycle + cfg.graceRefill;
  // latest settled streak: this cycle/epoch once settled after voting closes, else the last
  // one's, else one further back while grace can bridge the miss or the last one awaits settling
  const settledStreak = hasAccount
    ? getStreakAt(world, components, accountID, cycle) ||
      getStreakAt(world, components, accountID, cycle - 1) ||
      (graceFree || prevPending ? getStreakAt(world, components, accountID, cycle - 2) : 0)
    : 0;
  // the streak shown everywhere counts the pending vote: it is already cast and only waits
  const streak = settledStreak + (prevPending ? 1 : 0);

  // what a vote that counts this cycle/epoch completes: the streak's next step, if it pays
  const nextStep = streak + 1;
  const streakRewards = isOpen
    ? [
        ...MILESTONES.flatMap((m, i) =>
          m === nextStep && !hasMilestone(world, components, accountID, m)
            ? [VOTER_BADGE_INDICES[i]]
            : []
        ),
        ...(nextStep % cfg.goldenEvery === 0 ? [GOLDEN_BALLOT_INDEX] : []),
      ]
    : [];

  // next payout if this cycle/epoch's vote (or all power, 100% on yominet) settles with the
  // streak kept, raw uinit in as the reporter settles. the open cycle/epoch's eligible weight is
  // only known once it closes, so the last one's locked weight stands in (none yet: no pool cut)
  const estPower = voted ? (vote?.yominetPower ?? 0) : votingPower;
  const estWeight = Number(calcWeight(cfg, estPower));
  const estEligible = Math.max(getEligibleWeight(world, components, cycle - 1), estWeight);
  const estBase = calcBase(cfg, estPower, estEligible);
  const estimate = estBase;

  /////////////////
  // VIP SCORE (read only; ballots never feed it)

  // an epoch's VIP score: ours, our share of every player's (our cut of yominet's VIP rewards)
  // and our rank. scores stay on chain per epoch, so the last one reads the same way
  const scoreAt = (epoch: number) => {
    const filter = { epoch, index: 0, type: 'VIP_SCORE' };
    const scores = open ? getScoresByFilter(components, filter).filter((s) => s.value > 0) : [];
    const total = getTotalScoreByFilter(world, components, filter);
    const i = hasAccount ? scores.findIndex((s) => BigInt(s.holderID) === BigInt(accountID)) : -1;
    const value = i >= 0 ? scores[i].value : 0;
    return {
      epoch,
      value,
      total,
      share: total ? value / total : 0,
      rank: i >= 0 ? i + 1 : 0,
      players: scores.length,
    };
  };
  const scoreEpoch = getVIPEpoch(world, components);
  const score = {
    current: scoreAt(scoreEpoch),
    last: scoreAt(scoreEpoch - 1),
    end: getVIPEpochEnd(world, components),
  };

  /////////////////
  // TXS

  const castVote = async () => {
    if (pending) return;
    if (!kit.isConnected) return kit.openConnect();
    if (wrongWallet)
      return setError(
        `Connect the wallet you play with (${ownerAddress}): its INIT is what votes.`
      );
    setPending('vote');
    setError('');
    try {
      await kit.requestTxBlock({ messages: [buildVoteMsg(kit.initiaAddress, cycle)] });
      // the vote is in a block: show it now, so a flaky L1 re-read can't invite a second vote
      const full: WeightVote = {
        votingPower,
        yominetWeight: 1,
        yominetPower: votingPower,
        voted: true,
      };
      queryClient.setQueryData(['vip', 'vote', address, cycle], full);
      queryClient.invalidateQueries({ queryKey: ['vip'] });
    } catch (e) {
      setError(voteError(e));
    } finally {
      setPending('');
    }
  };

  return {
    now,
    hasAccount,
    loading,
    l1Error,
    gauge,
    isOpen,
    loaded: powerQuery.isSuccess,
    voteLoaded: voteQuery.isSuccess,
    votingPower: toVP(votingPower),
    yominetWeight: vote?.yominetWeight ?? 0,
    voted,
    sole,
    streakVote,
    estimate,
    cfg,
    owed,
    claimable,
    streak,
    streakRewards,
    pendingCycle,
    score,
    tx: { wrongWallet, blocker, pending, error, vote: castVote },
  };
};

export type VipState = ReturnType<typeof useVip>;
