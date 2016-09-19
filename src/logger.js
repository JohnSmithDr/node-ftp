'use strict';

const tracer = require('tracer');

let logger = tracer.colorConsole({
  format: [
    `[{{title}}] ({{file}}:{{line}}) {{message}}`,
    { error: `[{{title}}] ({{file}}:{{line}}) {{message}}\nCall Stack:\n{{stack}}` }
  ],
  level: 'info'
});

module.exports = logger;
