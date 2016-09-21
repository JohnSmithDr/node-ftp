'use strict';

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');

let defaultRoot = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

const _readdir = Promise.promisify(fs.readdir);
const _mkdir = Promise.promisify(fs.mkdir);
const _stat = Promise.promisify(fs.stat);
const _access = Promise.promisify(fs.access);
const _exsist = (path) => _access(path, fs.constants.F_OK);

class FTPStorage {

  constructor(root) {
    this._root = root || defaultRoot;
    this._path = ['/'];
  }

  static create(root) {
    return new FTPStorage(root);
  }

  rwd() {
    return path.join(this._root, this.pwd());
  }

  pwd() {
    return path.resolve.apply(path, this._path);
  }

  cd(name) {

    if (name == '.') {
      return Promise.resolve(this.pwd());
    }

    if (name == '..') {
      if (this._path.length > 1) this._path.pop();
      return Promise.resolve(this.pwd());
    }

    let p, pp;

    if (name.startsWith('/')) {
      p = path.join(this._root, name);
      pp = ['/'].concat(name.split(/\/+/).filter(x => x));
    }
    else {
      p = path.join(this.rwd(), name);
      pp = this._path.concat([name]);
    }

    return _exsist(p)
      .then(() => _stat(p))
      .catch(err => {
        console.log(err);
        Promise.reject('Not a directory');
      })
      .then(r => {
        if (!r.isDirectory()) return Promise.reject('Directory not found');
        this._path = pp;
        return this.pwd();
      });
  }

  list() {
    let wd = this.pwd();
    let rwd = this.rwd();
    return _readdir(rwd)
      .then(names => {
        let info = names
          .map(name => {
            return {
              name: name,
              path: path.join(wd, name),
              fullPath: path.resolve(rwd, name)
            };
          });
        return Promise.map(info, x => this._fileInfo(x));
      });
  }

  mkdir(name) {
    let rwd = this.rwd();
    let np = path.join(rwd, name);
    return _mkdir(np).thenReturn(np);
  }

  rm() {

  }

  _fileInfo(x) {
    return _stat(x.fullPath)
      .then(stat => {
        return Object.assign({}, x,
          _.pick(stat, ['uid', 'gid', 'mode', 'nlink', 'size', 'ctime', 'mtime']),
          {
            isFile: stat.isFile(),
            isDir: stat.isDirectory()
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
