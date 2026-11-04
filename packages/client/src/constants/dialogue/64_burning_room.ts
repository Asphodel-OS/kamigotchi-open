import { DialogueNode } from '.';

const hut: DialogueNode = {
  index: 641,
  text: [`It's hot in here. Do you want to head back outside?`],
  action: {
    type: 'move',
    label: 'Exit',
    input: 65,
  },
};

const frog: DialogueNode = {
  index: 642,
  text: ["A frog has claimed the warmest spot by the fire. It doesn't look like it plans to move."],
};

export default [hut, frog];
