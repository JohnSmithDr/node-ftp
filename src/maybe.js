'use strict';

module.exports = function maybe(promise, callback) {
  if (!callback) return promise;
  promise.then(r => callback(null, r)).catch(err => callback(err));
};
