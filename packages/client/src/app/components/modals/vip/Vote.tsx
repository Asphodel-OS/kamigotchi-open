import styled, { keyframes } from 'styled-components';

import { TextTooltip } from 'app/components/library';
import { formatFull, Palette, prettyName, RewardChip } from 'app/components/library/pastel';
import { IndicatorIcons } from 'assets/images/icons/indicators';
import { ItemImages } from 'assets/images/items';
import { TokenIcons } from 'assets/images/tokens';
import { BALLOT_INDEX } from 'network/shapes/Ballot';
import { DetailedEntity } from 'network/shapes/utils';
import { playClick } from 'utils/sounds';
import { formatCountdownShort } from 'utils/time';
import { Button, Gold, Note, Section } from './styles';
import { VipState } from './useVip';

const STAKE_URL = 'https://app.initia.xyz';

// the epoch's one job, voting Yominet: the epoch, a big centred button, the vote's state and a
// few facts under it. the claim sits behind a divider, only when something is owed
export const Vote = ({
  vip,
  claim,
  claiming,
  describeItem,
}: {
  vip: VipState;
  claim: () => void;
  claiming: boolean;
  describeItem: (index: number) => DetailedEntity;
}) => {
  const { now, gauge, isOpen, voted, sole, cfg, tx } = vip;
  const noPower = vip.loaded && vip.votingPower === 0;
  const left = formatCountdownShort((isOpen ? gauge.votingEnd : gauge.end) - now);
  const streakRule = `${Math.round(cfg.streakMin * 100)}%+ Yominet with ${formatFull(cfg.streakPower)}+ INIT of staked voting power builds your streak`;

  const run = (fn: () => void) => () => {
    playClick();
    fn();
  };

  const Action = () => {
    if (vip.loading) return <Big disabled>…</Big>;
    if (noPower)
      return (
        <Big onClick={run(() => window.open(STAKE_URL, '_blank', 'noopener'))}>Stake INIT</Big>
      );
    // anything short of 100% yominet can switch while voting is open; the vote replaces it
    const canVote = isOpen && !sole;
    const label = voted && vip.yominetWeight > 0 ? 'Vote 100% Yominet' : 'Vote Yominet';
    const icon = <BigIcon src={ItemImages.ballot} alt='' />;
    if (canVote && !tx.blocker)
      return (
        <Big disabled={!!tx.pending} onClick={run(tx.vote)}>
          {icon}
          {tx.pending ? 'Voting…' : label}
        </Big>
      );
    if (canVote)
      return (
        <Big disabled>
          {icon}
          {tx.blocker}
        </Big>
      );
    // done for this epoch: a quiet badge in place of the button
    if (voted)
      return (
        <TextTooltip text={[streakRule]}>
          <Done tone={vip.streakVote ? 'ok' : 'warn'}>
            {vip.streakVote && <DoneIcon src={IndicatorIcons.success} alt='' />}
            Voted {Math.round(vip.yominetWeight * 100)}% Yominet
          </Done>
        </TextTooltip>
      );
    return <Done tone='none'>Voting closed</Done>;
  };

  // the vote this epoch, in one short line: green when it builds the streak
  const status = (() => {
    if (!vip.voteLoaded) return undefined;
    if (!voted)
      return isOpen
        ? { text: "You haven't voted yet", tone: 'due' }
        : { text: 'No vote this epoch', tone: 'none' };
    if (vip.yominetWeight === 0) return { text: 'Voted for other rollups', tone: 'warn' };
    const text = `Voted ${Math.round(vip.yominetWeight * 100)}% Yominet`;
    return vip.streakVote ? { text: `${text} ✓`, tone: 'ok' } : { text, tone: 'warn' };
  })() as { text: string; tone: Tone } | undefined;

  const notes = [
    vip.pendingCycle > 0 && `Epoch ${vip.pendingCycle} is being counted: its Ballots arrive soon.`,
    tx.wrongWallet && 'Vote from the wallet you play with: power staked elsewhere shows as 0.',
    vip.l1Error,
    tx.error,
  ].filter(Boolean) as string[];

  return (
    <Section>
      <Center>
        <Epoch>Epoch {gauge.cycle}</Epoch>
      </Center>

      <Center>
        {Action()}
        {status && isOpen && !sole && (
          <TextTooltip text={[streakRule]}>
            <Status tone={status.tone}>{status.text}</Status>
          </TextTooltip>
        )}
        {/* the deadline matters only while there's no vote yet; once closed, when the next opens */}
        {status?.tone === 'due' && <Countdown tone='due'>Voting closes in {left}</Countdown>}
        {!isOpen && !vip.loading && <Countdown tone='none'>Next epoch in {left}</Countdown>}
        <Facts>
          <TextTooltip text={['Your voting power: INIT staked on Initia']}>
            <Fact>
              <FactIcon src={TokenIcons.init} alt='INIT' />
              {vip.loaded ? formatFull(vip.votingPower) : '…'}
            </Fact>
          </TextTooltip>
          {vip.loaded && vip.votingPower > 0 && (
            <TextTooltip
              text={[
                "Estimated from last epoch's split.",
                `Your share of the ${formatFull(cfg.pool)} is set when the epoch closes.`,
              ]}
            >
              <Fact>
                <FactIcon src={ItemImages.ballot} alt='Ballots' />≈{formatFull(vip.estimate)}
              </Fact>
            </TextTooltip>
          )}
          {vip.streakRewards.length > 0 && (
            <TextTooltip
              text={[
                `A vote that counts makes a ${vip.streak + 1}-epoch streak:`,
                vip.streakRewards.map((i) => prettyName(describeItem(i).name)).join(' + '),
              ]}
            >
              <Fact>
                +
                {vip.streakRewards.map((i) => (
                  <FactIcon key={i} src={describeItem(i).image} alt='' />
                ))}
              </Fact>
            </TextTooltip>
          )}
        </Facts>
        {notes.map((n) => (
          <Note key={n}>{n}</Note>
        ))}
      </Center>

      {vip.claimable ? (
        <Claim>
          <TextTooltip
            text={[
              'Ballots add up over every epoch you vote, and never expire.',
              'One claim takes everything owed.',
            ]}
          >
            <ClaimLabel>Ready to claim</ClaimLabel>
          </TextTooltip>
          <Chips>
            {vip.owed.ballots > 0 && (
              <RewardChip entity={describeItem(BALLOT_INDEX)} amount={vip.owed.ballots} size='sm' />
            )}
            {vip.owed.rewards.map((r) => (
              <RewardChip
                key={r.index}
                entity={describeItem(r.index)}
                amount={r.amount}
                size='sm'
              />
            ))}
          </Chips>
          <ClaimButton disabled={claiming} onClick={run(claim)}>
            {claiming ? 'Claiming…' : 'Claim'}
          </ClaimButton>
        </Claim>
      ) : (
        vip.hasAccount && (
          <Settled>
            <SettledIcon src={IndicatorIcons.success} alt='' />
            No pending claims
          </Settled>
        )
      )}
    </Section>
  );
};

type Tone = 'ok' | 'warn' | 'due' | 'none';

const Center = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6vw;
`;

const Epoch = styled.span`
  font-family: Pixel;
  font-size: 1.4vw;
  color: ${Palette.ink};
`;

const Countdown = styled.span<{ tone: Tone }>`
  font-family: Pixel;
  font-size: 0.65vw;
  color: ${({ tone }) => STATUS[tone]};
`;

// the call to action: the biggest thing in the modal while there's a vote to cast
const Big = styled(Button)`
  gap: 0.6vw;
  height: 3vw;
  min-width: 15vw;
  padding: 0 1.6vw;
  font-size: 0.95vw;
  border-width: 0.18vw;
  border-radius: 0.7vw;
`;

const BigIcon = styled.img`
  width: 1.6vw;
  height: 1.6vw;
  image-rendering: pixelated;
  user-drag: none;
`;

// voted or closed: a small badge where the button was
const Done = styled.span<{ tone: Tone }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4vw;
  height: 2.2vw;
  padding: 0 1vw;
  font-family: Pixel;
  font-size: 0.7vw;
  color: ${Palette.ink};
  background: ${({ tone }) =>
    tone === 'ok' ? Palette.progress.fill : tone === 'warn' ? Gold.bg : Palette.button.disabled};
  border: solid ${({ tone }) => (tone === 'none' ? Palette.faint : Palette.ink)} 0.12vw;
  border-radius: 99vw;
`;

const DoneIcon = styled.img`
  width: 1.1vw;
  height: 1.1vw;
  image-rendering: pixelated;
`;

// the vote this epoch; not voted while it's open stands out in deep red
const STATUS = {
  ok: Palette.progress.edge,
  warn: Gold.edge,
  due: '#9b1c1c',
  none: Palette.muted,
};

const Status = styled.span<{ tone: Tone }>`
  font-family: Pixel;
  font-size: ${({ tone }) => (tone === 'due' ? 0.8 : 0.65)}vw;
  color: ${({ tone }) => STATUS[tone]};
  ${({ tone }) => tone === 'due' && 'text-shadow: 0.03vw 0 0 currentColor;'}
`;

const Facts = styled.div`
  display: flex;
  gap: 0.6vw;
`;

const Fact = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3vw;
  padding: 0.25vw 0.5vw;
  font-family: Pixel;
  font-size: 0.6vw;
  color: ${Palette.ink};
  white-space: nowrap;
  background: ${Palette.soft};
  border: solid ${Palette.line} 0.12vw;
  border-radius: 0.5vw;
`;

const FactIcon = styled.img`
  width: 1vw;
  height: 1vw;
  image-rendering: pixelated;
  user-drag: none;
`;

// behind the divider, only the claim: gold, with the game's level-up shine passing over it
const shine = keyframes`
  0%, 70% { background-position-x: 120%; }
  100% { background-position-x: -20%; }
`;

const Claim = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8vw;
  padding: 0.7vw 0.9vw;
  background:
    linear-gradient(105deg, #0000 40%, #fff9 50%, #0000 60%) 120% 0 / 250% 100% no-repeat,
    linear-gradient(${Gold.bg}, #f7dc84);
  border: solid ${Gold.edge} 0.15vw;
  border-radius: 0.6vw;
  animation: ${shine} 3.5s ease-in-out infinite;
`;

// nothing owed: the same spot, quiet, so players know it's all in their inventory
const Settled = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4vw;
  padding-top: 0.9vw;
  border-top: solid ${Palette.line} 0.12vw;
  font-family: Pixel;
  font-size: 0.6vw;
  color: ${Palette.muted};
`;

const SettledIcon = styled.img`
  width: 0.9vw;
  height: 0.9vw;
  image-rendering: pixelated;
  opacity: 0.6;
`;

const ClaimLabel = styled.span`
  font-family: Pixel;
  font-size: 0.7vw;
  color: #7a5a00;
  white-space: nowrap;
`;

const Chips = styled.div`
  flex: 1;
  display: flex;
  gap: 0.7vw;
`;

const ClaimButton = styled(Button)`
  background: #f6c945;
  &:hover:not(:disabled) {
    background: #f2bb1f;
  }
`;
