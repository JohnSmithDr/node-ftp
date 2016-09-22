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

function _getErrorMessage(err) {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  return err.toString();
}

class FTPConnection extends EventEmitter {

  constructor(conn) {
    super();
    this._conn = conn;
    this._state = {
      encoding: 'ascii'
    };
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
    return `${this._conn.remoteAddress}:${this._conn.remotePort}`;
  }

  close() {
    if (this._conn) {
      this._conn.close();
      this._conn.destroy();
      this._conn = null;
    }
  }

  setState(key, value) {
    this._state[key] = value;
    return this;
  }

  send(code, message, callback) {
    return this.sendText(`${code} ${message}`, callback);
  }

  sendError(code, err, callback) {
    return this.send(code, _getErrorMessage(err), callback);
  }

  sendText(text, callback) {
    logger.info('ACK (%s) > %s', this.remoteEndPoint, text);
    return maybe(
      new Promise((resolve, reject) => {
        this._conn.write(`${text}\r\n`, (err, r) => (err ? reject(err) : resolve(r)));
      })
      ,callback
    );
  }

  _init() {
    this._conn.on('data', d => {
      let cmd = _parseCommand(d);
      if (cmd) {
        logger.info('CLI (%s) > %s %s', this.remoteEndPoint, cmd.name, cmd.args);
        this.emit('command', cmd, this);
      }
    });
  }

}

module.exports = FTPConnection;
