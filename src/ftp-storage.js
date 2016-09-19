'use strict';

const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');

let afs = Promise.promisifyAll(fs);
let defaultRoot = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

class FTPStorage {

  constructor(root) {
    this._init = root || defaultRoot;
    this._wd = '/';
  }

  static create(root) {
    return new FTPStorage(root);
  }

  get workingDir() {
    return this._wd;
  }

  get realPath() {
    return path.join(this._init, this._wd);
  }

  list() {
    let realPath = this.realPath;
    console.log(realPath);
    return afs.readdirAsync(realPath)
      .then(names => {
        let info = names
          .map(name => {
            return {
              fileName: name,
              filePath: path.join(this._wd, name),
              realPath: path.resolve(realPath, name)
            };
          });
        return Promise.map(info, x => this._getFileInfo(x));
      });
  }

  _getFileInfo(x) {
    return afs.statAsync(x.realPath)
      .then(stat => {
        return Object.assign({}, x, {
          isFile: stat.isFile(),
          isDir: stat.isDirectory(),
          size: stat.size,
          ctime: stat.ctime,
          mtime: stat.mtime
        });
      });
  }

}

module.exports = FTPStorage;

// let storage = FTPStorage.create();
//
// storage.list().then(r => {
//   console.log(r);
// });
