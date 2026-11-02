import { Quest } from 'network/shapes/Quest';

// quest tint: main green; otherwise the faction of the largest reputation reward, lower
// faction index on a tie (Agency blue, Elders rose, Nursery dusk); then daily peach, side cream
const QuestTints = { main: '#eef8ef', daily: '#fdeee2', side: '#faf6ec' };
const FactionTints: Record<number, string> = { 1: '#eaf3fd', 2: '#fbe9ea', 3: '#ece6f3' };

export const getQuestTint = (quest: Quest) => {
  if (quest.typeComp === 'MAIN') return QuestTints.main;
  const reps = quest.rewards.filter((r) => r.type === 'REPUTATION' && FactionTints[r.index ?? 0]);
  if (reps.length) {
    const top = reps.reduce((a, b) => {
      const diff = (b.value ?? 0) * 1 - (a.value ?? 0) * 1;
      return diff > 0 || (diff === 0 && (b.index ?? 0) < (a.index ?? 0)) ? b : a;
    });
    return FactionTints[top.index ?? 0];
  }
  return quest.repeatable ? QuestTints.daily : QuestTints.side;
};
