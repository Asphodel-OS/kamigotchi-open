import styled from 'styled-components';

import { TextTooltip } from 'app/components/library';
import { formatFull, Palette } from 'app/components/library/pastel';
import { ItemImages } from 'assets/images/items';
import { formatCountdownShort } from 'utils/time';
import { Bar, Caption, Hero, HeroIcon, Section, Stack, Value } from './styles';
import { VipState } from './useVip';

// share of a score as a percent: two decimals under 1%, one above
const percent = (share: number) => `${(share * 100).toFixed(share < 0.01 ? 2 : 1)}%`;

// the VIP score: ours this epoch, its share of all players' (our cut of yominet's VIP rewards),
// our rank, and how the last epoch closed. read only: ballots never add to it
export const Score = ({ vip }: { vip: VipState }) => {
  const { score, now } = vip;
  const { current, last } = score;
  // everyone else's part of this epoch's VIP score
  const others = {
    value: Math.max(current.total - current.value, 0),
    share: current.total ? Math.max(1 - current.share, 0) : 0,
  };
  const shareTip = current.total
    ? [
        <TipLine key='mine'>
          <Swatch tone='mine' />
          You · {percent(current.share)} · {formatFull(current.value)}
          <ScoreIcon src={ItemImages.vipp} alt='VIP score' />
        </TipLine>,
        <TipLine key='others'>
          <Swatch tone='others' />
          Other players · {percent(others.share)} · {formatFull(others.value)}
          <ScoreIcon src={ItemImages.vipp} alt='VIP score' />
        </TipLine>,
      ]
    : ['No VIP score yet this epoch'];
  // a part's percentage shows inside it only when it's wide enough to read
  const inside = (share: number) => (share >= 0.12 ? percent(share) : '');

  const rank = (s: typeof current) => `#${s.rank} of ${formatFull(s.players)}`;

  return (
    <Section>
      <Hero>
        <TextTooltip
          text={[
            'Burn VIPP in the Burning Room, inside the Forest Hut, to raise your VIP score.',
            'Ballots never add to it.',
          ]}
        >
          <HeroIcon src={ItemImages.vipp} alt='VIPP' />
        </TextTooltip>
        <Stack>
          <ScoreLine>
            {formatFull(current.value)}
            {current.rank > 0 && <Rank>· {rank(current)}</Rank>}
          </ScoreLine>
          <Caption>
            VIP score · epoch {current.epoch} · ends in {formatCountdownShort(score.end - now)}
          </Caption>
        </Stack>
      </Hero>

      <Row>
        <Label>Your share</Label>
        <TextTooltip grow text={shareTip}>
          <ShareBar>
            {current.share > 0 && (
              <Segment tone='mine' style={{ width: `${Math.min(current.share, 1) * 100}%` }}>
                {inside(current.share)}
              </Segment>
            )}
            {others.share > 0 && <Segment tone='others'>{inside(others.share)}</Segment>}
          </ShareBar>
        </TextTooltip>
      </Row>

      <Last>
        <Label>Last epoch</Label>
        {last.value ? (
          <Stat>
            {formatFull(last.value)}
            <ScoreIcon src={ItemImages.vipp} alt='VIP score' />· {percent(last.share)} ·{' '}
            {rank(last)}
          </Stat>
        ) : (
          <Stat>No score</Stat>
        )}
      </Last>
    </Section>
  );
};

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8vw;
`;

const Label = styled.span`
  flex: none;
  width: 6vw;
  font-family: Pixel;
  font-size: 0.6vw;
  color: ${Palette.muted};
`;

const Stat = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35vw;
  font-family: Pixel;
  font-size: 0.7vw;
  color: ${Palette.ink};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const ShareBar = styled(Bar)`
  display: flex;
  height: 1.8vw;
`;

// the bar is the whole epoch's VIP score: our part in green, every other player's in blue
const TONES = { mine: Palette.progress.fill, others: Palette.info.hover };

const Segment = styled.div<{ tone: 'mine' | 'others' }>`
  flex: ${({ tone }) => (tone === 'mine' ? 'none' : 1)};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Pixel;
  font-size: 0.7vw;
  color: ${Palette.ink};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  background: ${({ tone }) => TONES[tone]};
  ${({ tone }) => tone === 'mine' && `border-right: solid ${Palette.ink} 0.12vw;`}
`;

const TipLine = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35vw;
  white-space: nowrap;
`;

const Swatch = styled.span<{ tone: 'mine' | 'others' }>`
  width: 0.7vw;
  height: 0.7vw;
  background: ${({ tone }) => TONES[tone]};
  border: solid ${Palette.ink} 0.1vw;
  border-radius: 0.15vw;
`;

const ScoreIcon = styled.img`
  width: 1.1vw;
  height: 1.1vw;
  image-rendering: pixelated;
`;

// score and rank centred on one line; tight line boxes so the smaller rank doesn't sit low
const ScoreLine = styled(Value)`
  display: flex;
  align-items: center;
  gap: 0.5vw;
  line-height: 1;
`;

const Rank = styled.span`
  font-size: 1vw;
  line-height: 1;
  color: ${Palette.muted};
`;

const Last = styled(Row)`
  padding-top: 0.8vw;
  border-top: solid ${Palette.line} 0.12vw;
`;
