import { useState } from 'react';
import styled from 'styled-components';

import { ModalHeader, ModalWrapper } from 'app/components/library';
import { useLayers } from 'app/root/hooks';
import { UIComponent } from 'app/root/types';
import { useAccount, useVisibility } from 'app/stores';
import { ItemImages } from 'assets/images/items';
import { hasMilestone } from 'network/shapes/Ballot';
import { getFromDescription } from 'network/shapes/utils';
import { waitForActionCompletion } from 'network/utils';
import { Score } from './Score';
import { Streak } from './Streak';
import { Tabs, TabType } from './Tabs';
import { useVip } from './useVip';
import { Vote } from './Vote';

// voting for Yominet in Initia's VIP gauge: vote/settle on L1, earn Ballots, spend them here
export const VipModal: UIComponent = {
  id: 'VipModal',
  Render: () => {
    const { network } = useLayers();
    const { actions, api, world, components } = network;
    const accountID = useAccount((s) => s.account.id);
    const isOpen = useVisibility((s) => s.modals.vip);
    const [tab, setTab] = useState<TabType>('VOTE');

    const vip = useVip(isOpen);

    const describeItem = (index: number) => getFromDescription(world, components, 'ITEM', index);

    /////////////////
    // ACTIONS

    // one claim at a time: a second one only reverts
    const [claiming, setClaiming] = useState(false);
    const claim = async () => {
      if (claiming) return;
      setClaiming(true);
      try {
        const index = actions.add({
          action: 'BallotClaim',
          params: [],
          description: `Claiming ${vip.owed.ballots} Ballots`,
          execute: async () => api.player.ballot.claim(),
        });
        await waitForActionCompletion(actions.Action, index);
      } finally {
        setClaiming(false);
      }
    };

    /////////////////
    // DISPLAY

    const Header = [
      <PixelHeader key='header'>
        <ModalHeader title='VIP Voting & Ballots' icon={ItemImages.golden_box} />
      </PixelHeader>,
      <Tabs key='tabs' tab={tab} setTab={setTab} />,
    ];

    const Body = () => {
      if (tab === 'STREAK')
        return (
          <Streak
            vip={vip}
            describeItem={describeItem}
            hasMilestone={(step) => hasMilestone(world, components, accountID, step)}
          />
        );
      if (tab === 'SCORE') return <Score vip={vip} />;
      return <Vote vip={vip} claim={claim} claiming={claiming} describeItem={describeItem} />;
    };

    return (
      <ModalWrapper id='vip' header={Header} canExit overlay noPadding showScrollBar truncate>
        {isOpen && Body()}
      </ModalWrapper>
    );
  },
};

// the header icon is item art: keep it pixelated
const PixelHeader = styled.div`
  img {
    image-rendering: pixelated;
  }
`;
