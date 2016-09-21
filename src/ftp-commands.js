'use strict';

const _ = require('lodash');
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

function feat(args, client, server) {
  let features = server.features;
  let text = _.concat(['211-Features'], features, ['211 Features end']).join('\r\n');
  return client.sendText(text);
}

function opts(args, client, server) {
  if (args.toUpperCase() === 'UTF8 ON') {
    return client.setState('encoding', 'utf8').send(200, 'UTF8 Enabled');
  }
  else if (args.toUpperCase() === 'UTF8 OFF') {
    return client.setState('encoding', 'ascii').send(200, 'UTF8 Disabled');
  }
  else {
    client.send(451, 'Not supported');
  }
}

function noop(args, client) {
  return client.send(200, 'Noop');
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
    .send(200, `OK. Port (${ep.host}:${ep.port}) accepted`);
}

function pwd(args, client) {
  return client.send(257, `Current working directory: "${client.storage.pwd()}"`);
}

function cwd(args, client) {
  client.storage.cd(args)
    .then(dir => client.send(250, `Changed working directory: "${dir}"`))
    .catch(err => {
      console.log(err);
      return (typeof err === 'string')
        ? client.send(550, err)
        : client.send(550, 'Error');
    });
}

function cdup(args, client) {
  client.storage.cd('..')
    .then(dir => client.send(250, `Changed working directory: "${dir}"`))
    .catch(err => {
      console.log(err);
      return (typeof err === 'string')
        ? client.send(550, err)
        : client.send(550, 'Error');
    });
}

function list(args, client) {

  let dataToSend;

  return client.storage.list()
    .then(files => {
      let content = listFormatter.format(files);
      dataToSend = stream.fromText(content, client.state.encoding);
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

function mkd(name, client) {
  client.storage.mkdir(name)
    .then(path => {
      return client.send(257, `Dir created: "${path}"`);
    });
}

function rnfr(args, client) {
  // todo: rename from
}

function rnto(args, client) {
  // todo: rename to
}

function dele(args, client) {
  // todo: delete file
}

function size(args, client) {
  // todo: get file size
}

function retr(args, client) {
  // todo: download file
}

function stor(args, client) {
  // todo: upload file
}

function appe(args, client) {
  // todo: append file
}

function abor(args, client) {
  // todo: abort current transfer
}

function rest(args, client) {
  // todo: rest
}

function quit(args, client) {
  // todo: quit
}

module.exports = {
  syst, user, pass, feat, opts, noop, type, port,
  pwd,  cwd,  cdup, list, mkd,  rnfr, rnto, dele,
  size, retr, stor, appe, abor, rest,
  quit
};
