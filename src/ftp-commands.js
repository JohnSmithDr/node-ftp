'use strict';

const stream = require('./stream');
const listFormatter = require('./list-formatter');
const FTPTransfer = require('./ftp-transfer');

function _parseEndPoint(args) {
  let m = /^(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3}),(\d{1,3})$/.exec(args);

  if (!m) return null;

  let host = `${m[1]}.${m[2]}.${m[3]}.${m[4]}`;
  let port = (parseInt(m[5], 10) << 8) + parseInt(m[6], 10);

  if (isNaN(port)) return null;

  return { host, port };
}

function syst(args, client) {
  return client.send(215, 'Unix');
}

function user(username, client, server) {
  return client
    .setState('username', username)
    .send(331, 'User name okay, need password');
}

function pass(password, client, server) {

  if (!client.state['username']) {
    return client.send(503, 'Bad sequence of commands');
  }

  return client.send(230, 'User logged in, proceed');
}

function type(type, client) {

  if (type === 'A' || type === 'I') {
    return client
      .setState('type', type)
      .send(200, `OK. Type ${type} accepted`);
  }

  return client.send(202, `Not supported type: ${type}`);
}

function port(args, client) {
  let ep = _parseEndPoint(args);
  if (!ep) {
    return client.send(501, 'Syntax error in parameters or arguments');
  }
  return client
    .setState('remote', ep)
    .send(200, `OK. Port ({${ep.host}:${ep.port}) accepted`);
}

function pwd(args, client) {
  return client.send(257, `Current working directory: "${client.storage.workingDir}"`);
}

function cwd(args, client) {

}

function list(args, client) {

  let dataToSend;

  return client.storage.list()
    .then(files => {
      let content = listFormatter.format(files);
      dataToSend = stream.fromText(content);
      return client.send(150, 'Opening data connection');
    })
    .then(() => {
      return FTPTransfer
        .createSend(client.state['remote'], dataToSend)
        .catch(err => {
          return client
            .send(425, 'Cannot open data connection')
            .thenThrow(err);
        });
    })
    .then(t => t.transfer())
    .then(t => {
      if (t.state === 'completed')
        return client.send(250, 'Closing data connection');
      if (t.state === 'aborted')
        ;
      if (t.state === 'error')
        return client.send(550, 'Error listing files');
    });
}

module.exports = {
  syst,
  user,
  pass,
  type,
  port,
  pwd,
  list
};
