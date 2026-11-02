import { GenerateCallData } from './types';

export function auctionAPI(generateCallData: GenerateCallData, compiledCalls: string[]) {
  // create a new auction
  async function create(
    itemIndex: number,
    payItemIndex: number,
    priceTarget: number,
    period: number,
    decay: number,
    rate: number,
    max: number,
    startTs: number
  ) {
    const callData = generateCallData(
      'system.auction.registry',
      [itemIndex, payItemIndex, priceTarget, period, decay, rate, max, startTs],
      'create'
    );
    compiledCalls.push(callData);
  }

  // remove an existing auction
  async function remove(itemIndex: number) {
    const callData = generateCallData('system.auction.registry', [itemIndex], 'remove');
    compiledCalls.push(callData);
  }

  // add a requirement for an auction
  async function addRequirement(
    itemIndex: number,
    type: string,
    logic: string,
    index: number,
    value: number,
    for_: string
  ) {
    const callData = generateCallData(
      'system.auction.registry',
      [itemIndex, type, logic, index, value, for_],
      'addRequirement'
    );
    compiledCalls.push(callData);
  }

  // set the window the chain was halted (last block ts before, first block ts after), so
  // GDA pricing skips it. (0, 0) clears it
  async function setPause(itemIndex: number, pauseStart: number, pauseEnd: number) {
    const callData = generateCallData(
      'system.auction.registry',
      [itemIndex, pauseStart, pauseEnd],
      'setPause'
    );
    compiledCalls.push(callData);
  }

  return {
    create,
    remove,
    set: {
      requirement: addRequirement,
      pause: setPause,
    },
  };
}
