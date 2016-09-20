'use strict';

const EventEmitter = require('events');
const FTPStorage = require('./ftp-storage');
const maybe = require('./maybe');
const logger = require('./logger');

function _parseCommand(data) {
  let line = data.toString();
  let match = /^(\w+)\s*(.*)/.exec(line);
  let name = match[1] ? match[1].trim().toUpperCase() : null;
  let args = match[2] ? match[2].trim() : '';
  return name ? ({ name, args }) : null;
}

class FTPConnection extends EventEmitter {

  constructor(conn) {
    super();
    this._dest = conn;
    this._state = {};
    this._storage = FTPStorage.create();
    this._init();
  }

  static create(conn) {
    return new FTPConnection(conn);
  }

  get state() {
    return this._state;
  }

  get storage() {
    return this._storage;
  }

  get remoteEndPoint() {
    return `${this._dest.remoteAddress}:${this._dest.remotePort}`;
  }

  setState(key, value) {
    this._state[key] = value;
    return this;
  }

  send(code, message, callback) {
    logger.info('ACK (%s) > %s %s', this.remoteEndPoint, code, message);
    return maybe(
      new Promise((resolve, reject) => {
        this._dest.write(
          `${code} ${message} \r\n`,
          (err, r) => (err ? reject(err) : resolve(r))
        );
      })
      ,callback
    );
  }

  _init() {
    this._dest.on('data', d => {
      let cmd = _parseCommand(d);
      if (cmd) {
        logger.info('CLI (%s) > %s %s', this.remoteEndPoint, cmd.name, cmd.args);
        this.emit('command', cmd, this);
      }
    });
  }

}

module.exports = FTPConnection;
