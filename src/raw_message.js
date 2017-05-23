// @flow
import { List, Record } from 'immutable';

class RawMessage extends Record({ type: null, data: List() }) {
  _lrc: number;
  get lrc(): number { return this._lrc; }

  constructor(type: number, data: List<number> = List()) {
    super({type, data});

    this._lrc = RawMessage.calculateLRC(List([data.size + 1, type]).concat(data));
  }

  get buffer(): Buffer {
    return Buffer.from(List([0x02, this.length, this.type], 'hex').concat(this.data).push(this.lrc).toArray());
  }

  get length(): number {
    return this.data.size + 1;
  }

  static calculateLRC(l: List<number>): number {
    return l.reduce((a, b) => a ^ b);
  }
}

export default RawMessage;
