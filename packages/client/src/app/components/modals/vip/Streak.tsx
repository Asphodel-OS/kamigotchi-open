import styled from 'styled-components';

import { TextTooltip, Tooltip } from 'app/components/library';
import { formatFull, Palette, prettyName, RewardTooltip } from 'app/components/library/pastel';
import { IndicatorIcons } from 'assets/images/icons/indicators';
import {
  GOLDEN_BALLOT_INDEX,
  MILESTONES,
  STREAK_CAP,
  VOTER_BADGE_INDICES,
} from 'network/shapes/Ballot';
import { DetailedEntity } from 'network/shapes/utils';
import { formatCountdownShort } from 'utils/time';
import { Caption, Hero, HeroIcon, Section, Stack, Value } from './styles';
import { VipState } from './useVip';

// the streak as a 52-epoch calendar: reward steps show their item, every cell's tooltip says
// what that step pays. grace stays a hidden mechanism
export const Streak = ({
  vip,
  describeItem,
  hasMilestone,
}: {
  vip: VipState;
  describeItem: (index: number) => DetailedEntity;
  hasMilestone: (step: number) => boolean;
}) => {
  const { streak, cfg, gauge, now } = vip;
  const pct = Math.round(cfg.streakMin * 100);
  const min = formatFull(cfg.streakPower);

  // what to do about the streak this epoch, then the rule; one line each
  const rule = `Counts at ${pct}%+ Yominet with ${min}+ staked INIT.`;
  const prompt = (() => {
    if (!vip.isOpen) return `Voting reopens in ${formatCountdownShort(gauge.end - now)}.`;
    const left = formatCountdownShort(gauge.votingEnd - now);
    if (!vip.voteLoaded) return 'Vote every epoch to add one.';
    if (vip.streakVote) return 'Your vote counts: +1 when the epoch ends.';
    if (vip.voted && vip.yominetWeight < cfg.streakMin)
      return `Your vote is ${Math.round(vip.yominetWeight * 100)}% Yominet: not enough. ${left} left.`;
    if (vip.voted) return `Under ${min} INIT on Yominet: doesn't count. ${left} left.`;
    if (streak > 0) return `Keep it going: vote within ${left}.`;
    return 'Start one: vote every epoch.';
  })();

  // badges pay once per account; golden ballots every goldenEvery steps
  const rewardsAt = (step: number) => {
    const badge = MILESTONES.indexOf(step);
    const out: number[] = [];
    if (badge >= 0) out.push(VOTER_BADGE_INDICES[badge]);
    if (step % cfg.goldenEvery === 0) out.push(GOLDEN_BALLOT_INDEX);
    return out;
  };
  const isEarned = (step: number, index: number) =>
    VOTER_BADGE_INDICES.includes(index) ? hasMilestone(step) : step <= streak;

  const steps = Array.from({ length: STREAK_CAP }, (_, i) => i + 1);
  const next = steps.find((s) => s > streak && rewardsAt(s).some((i) => !isEarned(s, i)));
  const nextRewards = next ? rewardsAt(next).filter((i) => !isEarned(next, i)) : [];
  const heroItem = describeItem(nextRewards[0] ?? GOLDEN_BALLOT_INDEX);

  const when = (step: number) => {
    if (step <= streak) return 'Reached';
    const k = step - streak;
    return k === 1 ? 'Next epoch' : `In ${k} epochs`;
  };

  const tip = (step: number, rewards: number[]) => (
    <Tip>
      <TipHead>
        <span>{step} in a row</span>
        <span>{when(step)}</span>
      </TipHead>
      {rewards.map((index) => {
        const entity = describeItem(index);
        return (
          <Faded key={index} faded={isEarned(step, index) && step > streak}>
            <RewardTooltip entity={entity} name={prettyName(entity.name)} />
          </Faded>
        );
      })}
    </Tip>
  );

  return (
    <Section>
      <Hero>
        <Tooltip content={tip(next ?? streak, nextRewards)} isDisabled={!next} maxWidth={16}>
          <HeroIcon src={heroItem.image} alt={heroItem.name} />
        </Tooltip>
        <Stack>
          <Count>{streak ? `${streak}-epoch streak` : 'No streak yet'}</Count>
          <Prompt>{prompt}</Prompt>
          <Prompt>{rule}</Prompt>
        </Stack>
      </Hero>

      <Calendar>
        {steps.map((step) => {
          const rewards = rewardsAt(step);
          const reached = step <= streak;
          const cell = (
            <Cell reached={reached} next={step === streak + 1} reward={rewards.length > 0}>
              {rewards.length > 0 && (
                <CellIcon
                  src={describeItem(rewards[0]).image}
                  alt=''
                  dim={!reached && !rewards.every((i) => isEarned(step, i))}
                />
              )}
              {rewards.length > 1 && <Extra src={describeItem(rewards[1]).image} alt='' />}
              {rewards.length === 0 && (
                <Tick src={IndicatorIcons.success} alt='' reached={reached} />
              )}
            </Cell>
          );
          return rewards.length ? (
            <Tooltip key={step} content={tip(step, rewards)} isDisabled={false} maxWidth={16}>
              {cell}
            </Tooltip>
          ) : (
            <TextTooltip key={step} text={[`${step} in a row`, when(step)]}>
              {cell}
            </TextTooltip>
          );
        })}
      </Calendar>
    </Section>
  );
};

const Count = styled(Value)`
  font-size: 1vw;
`;

const Prompt = styled(Caption)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Calendar = styled.div`
  display: grid;
  grid-template-columns: repeat(13, minmax(0, 1fr));
  gap: 0.35vw;
`;

const Cell = styled.div<{ reached: boolean; next: boolean; reward: boolean }>`
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ reached }) => (reached ? Palette.progress.fill : Palette.soft)};
  border: ${({ next }) => (next ? 'dashed' : 'solid')}
    ${({ reached, reward, next }) =>
      next || reward ? Palette.ink : reached ? Palette.progress.edge : Palette.line}
    0.12vw;
  border-radius: 0.4vw;
`;

const CellIcon = styled.img<{ dim: boolean }>`
  width: 75%;
  height: 75%;
  image-rendering: pixelated;
  opacity: ${({ dim }) => (dim ? 0.35 : 1)};
  user-drag: none;
`;

// a badge step that also pays a golden ballot: the second reward rides in the corner
// steps without a reward: a small tick, quieter than the reward icons
const Tick = styled.img<{ reached: boolean }>`
  width: 40%;
  height: 40%;
  image-rendering: pixelated;
  opacity: ${({ reached }) => (reached ? 1 : 0.25)};
  filter: ${({ reached }) => (reached ? 'none' : 'grayscale(1)')};
  user-drag: none;
`;

const Extra = styled.img`
  position: absolute;
  right: -0.3vw;
  bottom: -0.3vw;
  width: 45%;
  height: 45%;
  image-rendering: pixelated;
  user-drag: none;
`;

const Tip = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5vw;
`;

const TipHead = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1vw;
  font-family: Pixel;
  font-size: 0.6vw;
  color: ${Palette.muted};
`;

const Faded = styled.div<{ faded: boolean }>`
  opacity: ${({ faded }) => (faded ? 0.5 : 1)};
`;
