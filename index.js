'use strict';

global.Promise = require('bluebird');

require('./src/ftp-server')
  .create(2100)
  .start()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
