import { useVisibility } from 'app/stores';
import { playClick } from 'utils/sounds';

export const triggerOfferingModal = () => {
  const { modals, setModals } = useVisibility.getState();
  if (modals.offering) return;
  playClick();
  setModals({ offering: true, dialogue: false, node: false, crafting: false });
};
