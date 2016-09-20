'use strict';

const net = require('net');
const maybe = require('./maybe');

class FTPTransfer {

  constructor(src, dest) {
    this._src = src;
    this._dest = dest;
    this._s = null;
  }

  get state() {
    return this._s;
  }

  transfer(callback) {
    return maybe(
      new Promise((resolve, reject) => {

        this._dest.on('end', () => {
          this._s = 'completed';
          return resolve(this);
        });

        this._dest.on('error', (err) => {
          this._s = 'error';
          return reject(err);
        });

        this._src.pipe(this._dest);
      }),
      callback
    );
  }

  abort() {
    if (this._src && this._src.destroy) {
      this._src.end();
      this._src.destroy();
    }
    if (this._dest && this._dest.destroy) {
      this._dest.end();
      this._dest.destroy();
    }
    this._s = 'aborted';
  }

  static createSend(p, d, callback) {
    return maybe(
      new Promise((resolve, reject) => {
        let conn = net.connect(p.port, p.host, (err) => {
          if (err) return reject(err);
          resolve(new FTPTransfer(d, conn));
        });
      }),
      callback
    );
  }

  static createReceive(p, d, callback) {
    return maybe(
      new Promise((resolve, reject) => {
        let conn = net.connect(p.port, p.host, (err) => {
          if (err) return reject(err);
          return new FTPTransfer(conn, d);
        });
      }),
      callback
    );
  }

}

module.exports = FTPTransfer;
