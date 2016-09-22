'use strict';

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');

let defaultRoot = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

const _readdir = Promise.promisify(fs.readdir);
const _mkdir = Promise.promisify(fs.mkdir);
const _rmdir = Promise.promisify(fs.rmdir);
const _unlink = Promise.promisify(fs.unlink);
const _rename = Promise.promisify(fs.rename);
const _stat = Promise.promisify(fs.stat);
const _access = Promise.promisify(fs.access);
const _exsist = (path) => _access(path, fs.constants.F_OK).then(() => true).catch(err => false);

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

  exists(name) {
    return _exsist(this._resolvePath(name));
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
      .then(exists => exists ? _stat(p) : Promise.reject('Directory not found'))
      .then(stat => {
        if (!stat.isDirectory()) return Promise.reject('Not a directory');
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
    let rfp = this._resolvePath(name);
    return _mkdir(rfp).thenReturn(rfp);
  }

  rmdir(name) {
    let rfp = this._resolvePath(name);
    return _stat(rfp)
      .then(stat => {
        if (!stat.isDirectory()) return Promise.reject('Not a directory');
        return _rmdir(rfp).thenReturn(rfp);
      });
  }

  rm(name) {
    let frp = this._resolvePath(name);
    return _stat(frp)
      .then(stat => {
        if (!stat.isFile()) return Promise.reject('Not a file');
        return _unlink(frp).thenReturn(frp);
      });
  }

  rename(from, to) {
    let fromPath = this._resolvePath(from);
    let toPath = this._resolvePath(to);
    return Promise.all([ _exsist(fromPath), _exsist(toPath) ])
      .then(r => {
        if (!r[0]) return Promise.reject('Source path does not exist');
        if (r[1]) return Promise.reject('Target path already exist');
        return _rename(fromPath, toPath);
      });
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

  _resolvePath(name) {
    return path.join(this.rwd(), name);
  }

}

module.exports = FTPStorage;
