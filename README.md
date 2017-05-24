**Project is in the early stage of development**

The main goal of this project is to create simple JavaScript client to work with Shtrikh-M
(Russian scales manufacturer http://www.shtrih-m.ru/) scales which use POS2 protocol. This project
is in the very early stage of development and tested only with Shtrikh-Slim scales. For now the client is
able to connect to scales and receive current weight channel state. Also it allows to easily send raw
commands (thus allowing to send any other command that is not natively supported by this library yet),
taking care of LRC calculation and other boring stuff. 

## Installation

```
yarn add jspos2
```

Also this module depends on [serialport](https://github.com/EmergingTechnologyAdvisors/node-serialport)
module it in turn uses native bindings. It means that you may need to rebuild it, especially if
you are going to use it with electron. For more info on this subject you may look at the *serialport*
docs.

## Basic usage
To communicate with the scales you need to create the client first. The first way to create it
requires you to provide the instance of SerialPort which should be opened. For example
it may look like this:

```javascript
import { Client } from 'jspos2';

const port = new SerialPort(portName, {}, err => {
  if (err != null) { // do something }
  
  // Starting from here we can be sure that the port is ready and opened
  const client = new Client(port);
});
```

Or, alternatively, you can find it easier to make use of the factory method. To use it you need to
know your scales vendor id and product id. For example, for my Shtrikh-Slim scales it
is `1FC9` and `80A3` accordingly (library is clever enough to determine that in linux this ID will
look like '0x1FC9' and in windows '1FC9', you may specify it in either form). This factory method 
return Promise.

```javascript
Client.fromDeviceId('1FC9', '80A3').then(client => {
  // Do something with the client
}, err => {
  // Handle the error somehow
});
```

Also, according to the protocol, you should initialize client before it can be used
```javascript
client.init().then(() => {
  // Now we can be sure that the client is initialized
}, err => {
  // Handle the initialization problem 
})
```

Now, when we have client we are ready to go and to receive the current wight channel state:
```javascript
client.requestScalesState().then(s => {
  // Do something with s 
}, err => {
  // Handle the error somehow
})
```

Scales state has the following shape:
```jsx harmony
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
```

## Sending RAW requests
To utilize the scales functionality which is not yet fully supported by this library you has the
ability to send raw requests. Under the hood, both the requests and the responses are represented by
the `RawMessage` instances. For example, here is how you can request te scales state using raw command.

```javascript
import { RawMessage, Client } from 'jspos2';
import { List } from 'immutable';

const type = 0x3A;
// Pure data, without STX, length, type and LRC bytes
const data = List([0x00, 0x00, 0x03, 0x00]);

const requestMessage = new RawMessage(type, data);

// Perform it on the previously created and initialized client
client.sendRawCommand(requestMessage).then(response => {
  // Response is also the RawMessage, so you can retrieve its content from its data property.
}, error => {
  // Handle the error somehow
})
```
