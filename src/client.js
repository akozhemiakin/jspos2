// @flow
import SerialPort from 'serialport';
import RawMessage from './raw_message';
import { List } from 'immutable';
import ScalesState from './scales_state';

class Client {
  static _defaultPassword = List([0x00, 0x00, 0x03, 0x00]);

  _port: SerialPort;
  _initialized: bool = false;
  _busy = false;
  _maxTimeout: number = 1000;
  _password: List<number>;

  constructor(port: SerialPort, options: {
    password?: List<number>
  } = {}) {
    const opts = {
      password: Client._defaultPassword,
      ...options
    };

    this._port = port;
    this._password = opts.password;
  }

  init(): Promise<void> {
    if (this._initialized) {
      return Promise.resolve();
    }
    return this._handshake().then(() => {
      this._initialized = true;
    });
  }

  close(): Promise<void> {
    return new Promise((res, rej) => {
      this._port.on('error', () => res());
      this._port.close(() => {
        this._port.removeAllListeners();
        res();
      });
    });
  }

  _handshake(): Promise<void> {
    return new Promise((res, rej) => {
      let complete = false;

      const cb = (data: Buffer) => {
        complete = true;
        if (data[0] === 0x15) {
          res();
        } else { rej(); }
      };

      this._port.once('data', cb);

      this._port.write(Buffer.from([0x05], 'hex'));

      setTimeout(() => {
        if (complete === false) rej(new Error('Failed to initialize the client within the specified time interval.'));
      }, this._maxTimeout);
    });
  }

  sendRawCommand(m: RawMessage): Promise<RawMessage> {
    this._busy = true;

    return new Promise((res, rej) => {
      let mb = List();
      let complete = false;

      const finish = () => {
        complete = true;
        this._busy = false;
      };

      const handleData = (data: Buffer | List<number>) => {
        const _data = (data instanceof List) ? data : List(data.values());

        mb = mb.concat(List(_data));

        if (mb.get(0) !== 0x02) {
          this._port.removeListener('data', handleData);
          finish();

          rej(new Error('Invalid initial byte (should be STX)'));
        } else {
          // Wait until we have full message from STX to LRC
          if (mb.size > 1 && mb.size === mb.get(1) + 3) {
            const validLRC = RawMessage.calculateLRC(mb.slice(1, -1));

            this._port.removeListener('data', handleData);
            finish();

            if (mb.last() !== validLRC) {
              rej(new Error('Invalid LRC'));
            } else {
              res(new RawMessage(mb.get(2), mb.slice(3, -1)), m);
            }
          }
        }
      };

      const awaitACK = (data: List<number>) => {
        if (data.get(0) === 0x06) {
          const remainder = data.slice(1);

          this._port.on('data', handleData);

          if (remainder.isEmpty() === false) {
            handleData(remainder);
          }
        } else {
          rej(new Error('Command delivery was not confirmed with ACK byte as it should be.'));
        }
      };

      this._port.once('data', b => awaitACK(List(b.values())));

      this._port.write(m.buffer);

      setTimeout(() => {
        if (complete === false) {
          finish();
          rej(new Error('Failed to execute the command within the specified time interval.'));
        }
      }, this._maxTimeout);
    });
  }

  requestScalesState(): Promise<ScalesState> {
    return this.sendRawCommand(new RawMessage(0x3A, this._password)).then(r => ScalesState.fromMessage(r));
  }

  static fromDeviceId(vendorId: string, productId: string, options: {
    normalize?: boolean,
    password?: List<number>
  } = {}): Promise<Client> {
    const opts = {
      normalize: true,
      password: Client._defaultPassword,
      ...options
    };

    const nid = (id: string): string[] => {
      if (opts.normalize === false) {
        return [id];
      }

      const idlc = id.toLowerCase();

      return idlc.startsWith('0x') ? [idlc, idlc.substr(2)] : [idlc, `0x${idlc}`];
    };

    return new Promise((res, rej) => {
      SerialPort.list((err, ports) => {
        if (err != null) rej(Error(err));
        else {
          const portInfo = ports.find(p => {
            if (p.vendorId === undefined || p.productId === undefined) return false;

            const vid = opts.normalize ? p.vendorId.toLowerCase() : p.vendorId;
            const pid = opts.normalize ? p.productId.toLowerCase() : p.productId;

            return nid(vendorId).includes(vid) && nid(productId).includes(pid);
          });

          if (portInfo != null) {
            const port = new SerialPort(portInfo.comName, {
              password: opts.password
            }, err => {
              if (err != null) {
                rej(err);
              } else {
                res(new Client(port));
              }
            });
          } else rej((`Failed to detect scales with vendorId ${vendorId} and productId ${productId}`));
        }
      });
    });
  }
}

export default Client;
