'use strict';

const net = require('net');
const maybe = require('./maybe');

class FTPTransfer {

  constructor(src, dest) {
    this._src = src;
    this._conn = dest;
    this._s = null;
  }

  get state() {
    return this._s;
  }

  transfer(callback) {
    return maybe(
      new Promise((resolve, reject) => {

        this._conn.on('end', () => {
          this._s = 'completed';
          return resolve(this);
        });

        this._conn.on('error', (err) => {
          this._s = 'error';
          return reject(err);
        });

        this._src.pipe(this._conn);
      }),
      callback
    );
  }

  abort() {
    if (this._src && this._src.destroy) {
      this._src.end();
      this._src.destroy();
    }
    if (this._conn && this._conn.destroy) {
      this._conn.end();
      this._conn.destroy();
    }
    this._s = 'aborted';
  }

  /**
   * Create data transfer for sending.
   */
  static createSend(endPoint, input, callback) {
    return maybe(
      new Promise((resolve, reject) => {
        let conn = net.connect(endPoint.port, endPoint.host, (err) => {
          if (err) return reject(err);
          resolve(new FTPTransfer(input, conn));
        });
      }),
      callback
    );
  }

  /**
   * Create data transfer for receiving.
   */
  static createReceive(endPoint, output, callback) {
    return maybe(
      new Promise((resolve, reject) => {
        let conn = net.connect(endPoint.port, endPoint.host, (err) => {
          if (err) return reject(err);
          return new FTPTransfer(conn, output);
        });
      }),
      callback
    );
  }

}

module.exports = FTPTransfer;
