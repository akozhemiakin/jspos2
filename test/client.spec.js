// @flow
import Client from '../src/client';
import RawMessage from '../src/raw_message';
import ScalesState from '../src/scales_state';

describe('Client', () => {
  const vendorId = '1FC9';
  const productId = '80A3';

  describe('Class', () => {
    it('should be able to create instance from vendor and product id', async () => {
      const client = await Client.fromDeviceId(vendorId, productId);

      expect(client).toBeInstanceOf(Client);

      await client.close();
    });
  });

  describe('Fresh instance', () => {
    it('should be able to be initialized', async () => {
      const client = await Client.fromDeviceId(vendorId, productId);

      await client.init();

      await client.close();
    });
  });

  describe('Initialized instance', () => {
    let client: Client;

    beforeEach(async () => {
      client = await Client.fromDeviceId(vendorId, productId);

      await client.init();
    });

    afterEach(async () => {
      await client.close();
    });

    it('should send raw command and return the response', async () => {
      const response = await client.sendRawCommand(new RawMessage(0xFC));

      expect(response).toBeInstanceOf(RawMessage);
    });

    it('should request scales state and return the response', async () => {
      const response = await client.requestScalesState();

      expect(response).toBeInstanceOf(ScalesState);
    });
  });
});
