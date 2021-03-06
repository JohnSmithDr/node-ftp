'use strict';

/// See all ftp commands:
/// https://en.wikipedia.org/wiki/List_of_FTP_commands

const _ = require('lodash');
const os = require('os');
const moment = require('moment');
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

function _mdtmFormat(d) {
  return moment(d).format('YYYYMMDDHHmmss');
}

function syst(args, client) {
  return client.send(215, os.type());
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

function type(args, client) {

  let type = args.toUpperCase();

  if (type === 'A' || type === 'I') {
    return client
      .setState('type', type)
      .send(200, `OK. Type ${type} accepted`);
  }

  return client.send(504, `Not supported type: ${type}`);
}

function mode(args, client) {

  let mode = args.toUpperCase();

  if (mode === 'S') {
    return client
      .setState('mode', mode)
      .send(200, `OK. Mode ${mode} accepted`);
  }

  return client.send(504, `Not supported mode: ${mode}`);
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
    .catch(err => client.sendError(550, err));
}

function cdup(args, client) {
  client.storage.cd('..')
    .then(dir => client.send(250, `Changed working directory: "${dir}"`))
    .catch(err => client.sendError(550, err));
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
    })
    .finally(() => {
      dataToSend = null;
    });
}

function mkd(name, client) {
  client.storage.mkdir(name)
    .then(path => client.send(257, 'Directory created'))
    .catch(err => client.sendError(550, err));
}

function rmd(name, client) {
  client.storage.rmdir(name)
    .then(path => client.send(250, 'Directory removed'))
    .catch(err => client.sendError(550, err));
}

function rnfr(name, client) {
  return client.storage.exists(name)
    .then(exists => {
      if (!exists) {
        return client.send(550, 'No such file or directory');
      }
      client.setState('rename', name);
      return client.send(350, `Rename started`);
    });
}

function rnto(dest, client) {
  let src = client.state.rename;
  if (!src) return client.send(503, 'Bad sequence of commands, try RNFR first');
  return client.storage.rename(src, dest)
    .then(() => client.send(250, 'Rename OK'))
    .catch(err => client.sendError(550, err));
}

function dele(name, client) {
  return client.storage.rm(name)
    .then(() => client.send(250, 'File deleted'))
    .catch(err => client.sendError(550, err));
}

function mdtm(name, client) {
  return client.storage.mdtm(name)
    .then(d => client.send(213, _mdtmFormat(d)))
    .catch(err => client.sendError(550, err));
}

function size(name, client) {
  return client.storage.size(name)
    .then(size => client.send(213, size))
    .catch(err => client.sendError(550, err));
}

function rest(args, client) {
  let rest = Number.parseInt(args);
  return client.setState('rest', rest)
    .send(350, `Restarting next transfer from position: ${rest}`);
}

function retr(name, client) {
  let remote = client.state.remote, rest = client.state.rest;
  if (!remote) return client.send(503, 'Bad sequence of commands, try PORT first');

  let streamToTransfer;

  return client.openRead(name, rest)
    .then(stream => {
      streamToTransfer = stream;
      return client.send(150, 'Opening connection for data transfer');
    })
    .then(() => {
      return FTPTransfer
        .createSend(remote, streamToTransfer)
        .catch(err => {
          return client
            .send(425, 'Cannot open data connection')
            .thenThrow(err);
        });
    })
    .then(t => {
      client.setTransfer(t);
      return t.transfer();
    })
    .then(t => {
      if (t.state === 'completed')
        return client.send(226, 'File transfer completed');
      if (t.state === 'aborted')
        ;
      if (t.state === 'error')
        return client.send(550, 'Error sending file');
    })
    .finally(() => {
      client.setState('rest', 0);
      streamToTransfer = null;
    });
}

function stor(args, client) {
  let remote = client.state.remote;
  if (!remote) return client.send(503, 'Bad sequence of commands, try PORT first');

  let outputStream;

  return client.openWrite(name)
    .then(stream => {
      outputStream = stream;
      return client.send(150, 'Opening connection for data transfer');
    })
    .then(() => {
      return FTPTransfer
        .createReceive(remote, outputStream)
        .catch(err => {
          return client
            .send(425, 'Cannot open data connection')
            .thenThrow(err);
        });
    })
    .then(t => {
      client.setTransfer(t);
      return t.transfer();
    })
    .then(t => {
      if (t.state === 'completed')
        return client.send(226, 'File transfer completed');
      if (t.state === 'aborted')
        ;
      if (t.state === 'error')
        return client.send(550, 'Error receiving file');
    })
    .finally(() => {
      outputStream = null;
    });
}

function appe(args, client) {
  let remote = client.state.remote;
  if (!remote) return client.send(503, 'Bad sequence of commands, try PORT first');

  let outputStream;

  return client.openAppend(name)
    .then(stream => {
      outputStream = stream;
      return client.send(150, 'Opening connection for data transfer');
    })
    .then(() => {
      return FTPTransfer
        .createReceive(remote, outputStream)
        .catch(err => {
          return client
            .send(425, 'Cannot open data connection')
            .thenThrow(err);
        });
    })
    .then(t => {
      client.setTransfer(t);
      return t.transfer();
    })
    .then(t => {
      if (t.state === 'completed')
        return client.send(226, 'File transfer completed');
      if (t.state === 'aborted')
        ;
      if (t.state === 'error')
        return client.send(550, 'Error receiving file');
    })
    .finally(() => {
      outputStream = null;
    });
}

function abor(args, client) {
  let t = client.transfer;

  if (!t) {
    return client.send(226, 'No active transfer');
  }

  t.abort();
  return client.send(226, 'File transfer aborting');
}

function rein(args, client) {
  return client.reset()
    .then(() => client.send(220, 'Service ready'));
}

function quit(args, client) {
  return client.send(221, 'Closing connection')
    .then(() => client.close());
}

module.exports = {
  syst, user, pass, feat, opts, noop, type, mode, port,
  pwd,  cwd,  cdup, list, mkd,  rmd,  rnfr, rnto,
  dele, mdtm, size, rest, retr, stor, appe, abor,
  rein, quit
};
