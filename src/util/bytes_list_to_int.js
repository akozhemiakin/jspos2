// @flow
import { List } from 'immutable';

export default (l: List<number>): number => {
  return l.reduce((a, b, i) => a + b * Math.pow(256, i), 0);
};
