// @flow
import { Record } from 'immutable';
import RawMessage from './raw_message';
import bytesListToInt from './util/bytes_list_to_int';

type ScalesStateFields = {
  isFixed: boolean,
  autoZero: boolean,
  enabled: boolean,
  tare: boolean,
  stable: boolean,
  autoZeroError: boolean,
  overweight: boolean,
  measurementError: boolean,
  underweight: boolean,
  noAnswerFromADC: boolean,
  weight: number,
  tareWeight: number
}

export default class ScalesState extends Record({
  isFixed: null,
  autoZero: null,
  enabled: null,
  tare: null,
  stable: null,
  autoZeroError: null,
  overweight: null,
  measurementError: null,
  underweight: null,
  noAnswerFromADC: null,
  weight: null,
  tareWeight: null
}) {
  constructor(props: ScalesStateFields) {
    super(props);
  }

  static fromMessage(m: RawMessage): ScalesState {
    function bit(b: number, p: number): boolean {
      return ((b >> p) & 1) === 1;
    }

    return new ScalesState({
      isFixed: bit(m.data.get(1), 0),
      autoZero: bit(m.data.get(1), 1),
      enabled: bit(m.data.get(1), 2),
      tare: bit(m.data.get(1), 3),
      stable: bit(m.data.get(1), 4),
      autoZeroError: bit(m.data.get(1), 5),
      overweight: bit(m.data.get(1), 6),
      measurementError: bit(m.data.get(1), 7),
      underweight: bit(m.data.get(2), 0),
      noAnswerFromADC: bit(m.data.get(2), 1),
      weight: bytesListToInt(m.data.slice(3, 7)),
      tareWeight: bytesListToInt(m.data.slice(7, 9))
    });
  }
}
