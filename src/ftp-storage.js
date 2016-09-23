'use strict';

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');

let _defaultRoot = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

const _readdir = Promise.promisify(fs.readdir);
const _mkdir = Promise.promisify(fs.mkdir);
const _rmdir = Promise.promisify(fs.rmdir);
const _unlink = Promise.promisify(fs.unlink);
const _rename = Promise.promisify(fs.rename);
const _stat = Promise.promisify(fs.stat);
const _access = Promise.promisify(fs.access);
const _exists = (path) => _access(path, fs.constants.F_OK).then(() => true).catch(err => false);
const _reject = (err) => Promise.resolve(Error(err));
const _resolve = Promise.resolve;

class VFS {

  constructor(root) {
    this._root = root || _defaultRoot;
    this._route = ['/'];
  }

  static create(root) {
    return new VFS(root);
  }

  /**
   * Get current working directory full path.
   * @returns {string}
   */
  cwd() {
    return path.join(this._root, this.pwd());
  }

  /**
   * Get current working directory virtual path.
   * @returns {string}
   */
  pwd() {
    return path.resolve.apply(path, this._route);
  }

  /**
   * Test whether the given path exists.
   * @param {string} name
   */
  exists(name) {
    return _exists(this._resolvePath(name));
  }

  /**
   * List file items in current directory.
   * @returns {Promise}
   */
  list() {
    let cwd = this.cwd();
    return _readdir(cwd)
      .then(names => {
        let info = names
          .map(name => {
            return {
              name: name,
              path: path.resolve(cwd, name)
            };
          });
        return Promise.map(info, x => this._fileInfo(x));
      });
  }

  /**
   * Change working directory.
   * @param {string} name
   * @returns {Promise.<string>}
   */
  cd(name) {

    if (name == '.') {
      return _resolve(this.pwd());
    }

    if (name == '..') {
      if (this._route.length > 1) this._route.pop();
      return _resolve(this.pwd());
    }

    let np = this._resolvePath(name)    // new path
      , nr = this._resolveRoute(name);  // new route

    return _exists(np)
      .then(ex => ex ? _stat(np) : _reject('No such file or directory'))
      .then(stat => {
        if (!stat.isDirectory()) return _reject('Not a directory');
        this._route = nr;
        return this.pwd();
      });
  }

  /**
   * Create directory.
   * @param {string} name
   * @returns {Promise}
   */
  mkdir(name) {
    let fp = this._resolvePath(name);   // full path
    return _exists(fp)
      .then(ex => ex
        ? _reject(`File exists: "${name}"`)
        : _mkdir(fp));
  }

  /**
   * Remove directory.
   * @param {string} name
   * @returns {Promise}
   */
  rmdir(name) {
    let fp = this._resolvePath(name);   // full path
    return _exists(fp)
      .then(ex => ex
        ? _stat(fp)
        : _reject('No such file or directory'))
      .then(stat => stat.isDirectory()
        ? _rmdir(fp)
        : _reject('Not a directory'));
  }

  /**
   * Remove file.
   * @param {string} name
   * @returns {Promise}
   */
  rm(name) {
    let fp = this._resolvePath(name);
    return _exists(fp)
      .then(ex => ex
        ? _stat(fp)
        : _reject('No such file or directory'))
      .then(stat => stat.isFile()
        ? _unlink(fp)
        : _reject('Not a file'));
  }

  /**
   * Rename item.
   * @param {string} from
   * @param {string} to
   * @returns {Promise}
   */
  rename(from, to) {
    let fromPath = this._resolvePath(from);
    let toPath = this._resolvePath(to);
    return Promise.all([ _exists(fromPath), _exists(toPath) ])
      .then(r => {
        if (!r[0]) return _reject('Source path does not exist');
        if (r[1]) return _reject('Target path already exist');
        return _rename(fromPath, toPath);
      });
  }

  /**
   * Get last modification time of file.
   * @param {string} name
   * @returns {Promise}
   */
  mdtm(name) {
    let fp = this._resolvePath(name);
    return _exists(fp)
      .then(ex => ex
        ? _stat(fp)
        : _reject('No such file or directory'))
      .then(stat => stat.isFile()
        ? stat.mtime
        : _reject('Not a file'));
  }

  /**
   * Get file size.
   * @param {string} name
   * @returns {Promise}
   */
  size(name) {
    let fp = this._resolvePath(name);
    return _exists(fp)
      .then(ex => ex
        ? _stat(fp)
        : _reject('No such file or directory'))
      .then(stat => stat.isFile()
        ? stat.size
        : _reject('Not a file'));
  }

  /**
   * Open read stream of file.
   * @param {string} name
   * @param {number} start
   * @returns {Promise}
   */
  openRead(name, start) {
    let fp = this._resolvePath(name);
    return _exists(fp)
      .then(ex => ex
        ? _stat(fp)
        : _reject('No such file or directory'))
      .then(stat => stat.isFile()
        ? fs.createReadStream(fp, { flags: 'r', start: start })
        : _reject('Not a file'));
  }

  /**
   * Open write stream of file.
   * @param {string} name
   * @returns {Promise}
   */
  openWrite(name) {
    let fp = this._resolvePath(name);
    return _exists(fp)
      .then(ex => {
        if (!ex) return fs.createWriteStream(fp, { flags: 'w' });
        return _stat(fp)
          .then(stat => stat.isFile()
            ? fs.createWriteStream(fp, { flags: 'w' })
            : _reject('Not a file'));
      });
  }

  /**
   * Open write stream of file with append mode.
   * @param {string} name
   * @returns {Promise}
   */
  openAppend(name) {
    let fp = this._resolvePath(name);
    return _exists(fp)
      .then(ex => {
        if (!ex) return fs.createWriteStream(fp, { flags: 'a' });
        return _stat(fp)
          .then(stat => stat.isFile()
            ? fs.createWriteStream(fp, { flags: 'a' })
            : _reject('Not a file'));
      });
  }

  _fileInfo(x) {
    return _stat(x.path)
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
    return name.startsWith('/')
      ? path.join(this._root, name)
      : path.join(this.cwd(), name);
  }

  _resolveRoute(name) {
    return name.startsWith('/')
      ? ['/'].concat(name.split(/\/+/).filter(x => x))
      : this._route.concat(name.split(/\/+/).filter(x => x));
  }

}

module.exports = VFS;
