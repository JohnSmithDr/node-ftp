'use strict';

const _ = require('lodash');
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

  changeWorkingDir(name) {
    let destFilePath = this._resolveRealPath(name);
    console.log(destFilePath);
    return this._exsist(destFilePath)
      .then(() => this._getFileStat(destFilePath))
      .catch(err => {
        console.log(err);
        Promise.reject('Not a directory');
      })
      .then(r => {
        if (!r.isDirectory()) return Promise.reject('Directory not found');
        this._wd = this._resolveWorkingDir(name);
        return this.workingDir;
      });
  }

  list() {
    let realPath = this.realPath;
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

  mkdir(name) {
    let realPath = this.realPath;
    let newPath = path.resolve(realPath, name);
    return afs
      .mkdirAsync(newPath)
      .thenReturn(path.join(this._wd, name));
  }

  _resolveRealPath(name) {
    let rp = this.realPath;
    return name.startsWith('.') ? path.resolve(rp, name) : path.join(rp, name);
  }

  _resolveWorkingDir(name) {
    return name.startsWith('.') ? path.resolve(this._wd, name) : path.join(this._wd, name);
  }

  _getFileInfo(x) {
    return afs.statAsync(x.realPath)
      .then(stat => {
        return Object.assign({}, x,
          _.pick(stat, ['uid', 'gid', 'mode', 'nlink', 'size', 'ctime', 'mtime']),
          {
            isFile: stat.isFile(),
            isDir: stat.isDirectory(),
          });
      });
  }

  _getFileStat(path) {
    return afs.statAsync(path);
  }

  _exsist(path) {
    return afs.accessAsync(path, fs.constants.F_OK);
  }

}

module.exports = FTPStorage;

// let storage = FTPStorage.create();
//
// storage.list().then(r => {
//   console.log(r);
// });
