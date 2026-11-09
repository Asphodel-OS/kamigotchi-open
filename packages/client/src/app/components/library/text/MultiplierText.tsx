import styled from 'styled-components';

import { MULT_PREC } from 'network/shapes/Node/multiplier';

// a node's harvest multiplier value: red under 1.0, green over
export const MultiplierText = styled.span<{ $k: number }>`
  color: ${({ $k }) => ($k < MULT_PREC ? '#b55' : '#4a4')};
`;
