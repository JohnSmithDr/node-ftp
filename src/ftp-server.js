'use strict';

const net = require('net');

const FTPConnection = require('./ftp-connection');
const maybe = require('./maybe');
const commands = require('./ftp-commands');
const logger = require('./logger');

class FTPServer {

  constructor(port) {
    this._port = port;
    this._listener = null;
    this._features = ['PORT', 'UTF8'];
  }

  static create(port) {
    return new FTPServer(port);
  }

  get features() {
    return this._features;
  }

  start(callback) {
    return maybe(
      new Promise((resolve, reject) => {

        this._listener = net.createServer((conn) => {

          let client = FTPConnection.create(conn);

          client.on('command', (cmd, cli) => {
            let handler = commands[cmd.name.toLowerCase()];
            return handler
              ? handler(cmd.args, cli, this)
              : cli.send(502, `Command '${cmd.name}' not implemented`);
          });

          client.send(220, 'Service ready');

        });

        this._listener.listen(this._port, (err) => {
          if (err) return reject(err);
          logger.info('FTP > service start on port:', this._port);
          resolve();
        });

      })
      ,callback
    );
  }
}

process.on('uncaughtException', err => logger.error(err));
process.on('unhandledRejection', err => logger.error(err));

module.exports = FTPServer;
