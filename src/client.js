// @flow
import SerialPort from 'serialport';
import EventEmitter from 'events';
import RawMessage from './raw_message';
import { List } from 'immutable';
import ScalesState from './scales_state';

export type ClientState = 'created' | 'awaiting_nak' | 'ready' | 'awaiting_ack' | 'processing_response' | 'invalid';

class Client extends EventEmitter {
  _port: SerialPort;
  _initialized: bool = false;
  _state: ClientState = 'created';
  _maxRetries: number = 5;
  _retryTimeout: number = 1000;
  _lastCommand: ?RawMessage = null;
  _messageBuffer: List<number> = List();
  _internalEmitter: EventEmitter = new EventEmitter();
  _password: List<number>;

  constructor(port: SerialPort, options: {
    password?: List<number>
  } = {}) {
    super();

    const opts = {
      password: List([0x00, 0x00, 0x03, 0x00]),
      ...options
    };

    this._port = port;
    this._port.on('data', d => this._handleData(d));
    this._password = opts.password;
  }

  init(): Promise<void> {
    return this._handshake().then(() => {
      this._initialized = true;
    });
  }

  close(): Promise<void> {
    return new Promise((res, rej) => {
      this._port.on('error', () => res());
      this._port.close(() => res());
    });
  }

  _handleData(data: Buffer) {
    switch (this._state) {
      case 'awaiting_nak':
        if (data[0] === 0x15) {
          this._setState('ready');
        }
        break;
      case 'awaiting_ack':
        if (data[0] === 0x06) {
          this._setState('processing_response');

          const remainder = List(data.values()).slice(1);

          if (remainder.isEmpty() === false) {
            this._processResponse(remainder);
          }
        } else {
          this._internalEmitter.emit('command_delivery_failed', this._lastCommand);
        }
        break;
      case 'processing_response':
        this._processResponse(List(data.values));
        break;
    }
  }

  _handshake(): Promise<void> {
    return new Promise((res, rej) => {
      const readyCB = (os, ns) => {
        if (ns === 'ready') {
          this._internalEmitter.removeListener('state_changed', readyCB);
          res();
        }
      };

      this._internalEmitter.on('state_changed', readyCB);

      const f = (retry: number = 0) => {
        this._setState('awaiting_nak');
        this._port.write(Buffer.from([0x05], 'hex'));

        setTimeout(() => {
          if (this._state === 'awaiting_nak') {
            if (retry + 1 < this._maxRetries) {
              f(retry + 1);
            } else {
              this._setState('created');
              this._internalEmitter.removeListener('state_changed', readyCB);
              rej();
            }
          }
        }, this._retryTimeout);
      };

      f();
    });
  }

  _setState(state: ClientState) {
    const oldState = this._state;

    this._state = state;

    this._internalEmitter.emit('state_changed', oldState, state);
  }

  _processResponse(chunk: List<number>) {
    const mb = this._messageBuffer = this._messageBuffer.concat(chunk);

    // Check if the first byte is STX. If not, then we should discard data,
    // emit the error, and put client in back in the ready state.
    if (mb.get(0) !== 0x02) {
      this._messageBuffer = List();
      this._internalEmitter.emit('response', null, new Error('Invalid initial byte (should be STX)'));
    } else {
      // Wait until we have full message from STX to LRC
      if (mb.size > 1 && mb.size === mb.get(1) + 3) {
        const validLRC = RawMessage.calculateLRC(mb.slice(1, -1));

        if (mb.last() !== validLRC) {
          this._internalEmitter.emit('response', null, new Error('Invalid LRC'));
        } else {
          this._internalEmitter.emit('response', new RawMessage(mb.get(2), mb.slice(3, -1)), this._lastCommand);
        }
        this._messageBuffer = List();
      }
    }
  }

  sendRawCommand(m: RawMessage): Promise<RawMessage> {
    return new Promise((res, rej) => {
      if (this._state === 'created') {
        rej(new Error('You should initialize scales before sending any command.'));
        return;
      } else if (this._state !== 'ready') {
        rej(new Error('Can\'t execute this command while another one is in progress.'));
        return;
      }

      let ackReceived: bool = false;
      let messageReceived: bool = false;

      const sccb = (os: ClientState, ns: ClientState) => {
        if (ns === 'processing_response') {
          ackReceived = true;
          this._internalEmitter.removeListener('state_changed', sccb);

          setTimeout(() => {
            if (messageReceived === false) {
              rej(new Error('Failed to receive the response within the specified time interval.'));
            }
          }, this._retryTimeout);
        }
      };
      const rcb = (m: ?RawMessage, error?: Error) => {
        if (error != null) {
          rej(error);
        } else {
          messageReceived = true;
          this._setState('ready');
          this._internalEmitter.removeListener('response', rcb);
          res(m);
        }
      };

      this._internalEmitter.on('state_changed', sccb);
      this._internalEmitter.on('response', rcb);

      const f = (retry: number = 0) => {
        this._setState('awaiting_ack');
        this._port.write(m.buffer);

        setTimeout(() => {
          if (ackReceived === false) {
            if (retry + 1 < this._maxRetries) {
              f(retry + 1);
            } else {
              this._internalEmitter.removeListener('state_changed', sccb);
              this._internalEmitter.removeListener('response', rcb);

              rej(new Error('Failed to deliver the command.'));
            }
          }
        }, this._retryTimeout);
      };

      f();
    });
  }

  requestScalesState(): Promise<ScalesState> {
    return this.sendRawCommand(new RawMessage(0x3A, this._password)).then(r => ScalesState.fromMessage(r));
  }

  static fromDeviceId(vendorId: string, productId: string): Promise<Client> {
    return new Promise((res, rej) => {
      SerialPort.list((err, ports) => {
        if (err != null) rej(Error(err));
        else {
          const portInfo = ports.find(p => (p.vendorId === vendorId && p.productId === productId));

          if (portInfo != null) {
            const port = new SerialPort(portInfo.comName, {}, err => {
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
