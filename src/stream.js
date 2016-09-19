'use strict';

const Readable = require('stream').Readable;

class BufferStream extends Readable {

  constructor(buffer) {
    super();
    this._buffer = buffer;
    this._length = buffer.length;
    this._offset = 0;
    this.on('end', () => this._destroy());
  }

  _read(size) {
    if ( this._offset < this._length ) {
      this.push(this._buffer.slice(this._offset, this._offset + size));
      this._offset += size;
    }
    if (this._offset >= this._length) {
      this.push(null);
    }
  }

  _destroy() {
    this._buffer = null;
    this._offset = null;
    this._length = null;
  }

}

module.exports.fromBuffer = function (buffer) {
  return new BufferStream(buffer);
};
