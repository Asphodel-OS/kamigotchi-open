import { useSelected, useVisibility } from 'app/stores';
import { DialogueAnchor } from 'app/stores/selected';
import { playClick } from 'utils/sounds';

// anchor: the clicked room object, so npc speech can sit beside it
export const triggerDialogueModal = (index: number, anchor?: DialogueAnchor) => {
  const { modals } = useVisibility.getState();
  const { dialogueIndex } = useSelected.getState();
  playClick();

  useSelected.setState({ dialogueIndex: index, dialogueAnchor: anchor ?? null });
  if (!modals.dialogue) {
    useVisibility.setState({
      modals: {
        ...modals,
        dialogue: true,
        questDialogue: false,
        bridgeERC20: false,
        bridgeERC721: false,
        emaBoard: false,
        kami: false,
        map: false,
        merchant: false,
        node: false,
        party: false,
        leaderboard: false,
      },
    });
  } else if (dialogueIndex === index) {
    useVisibility.setState({ modals: { ...modals, dialogue: false } });
  }
};
