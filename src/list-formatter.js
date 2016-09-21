'use strict';

const moment = require('moment');

const formatDate = (date) => moment(date).format('MMM DD HH:mm');
const fileDesc = (stat) => stat.isDir ? 'd' : '-';
const ownerRead = (stat) => stat["mode"] & 400 ? 'r' : '-';
const ownerWrite = (stat) => stat["mode"] & 200 ? 'w' : '-';
const ownerExecute = (stat) => stat["mode"] & 100 ? 'x' : '-';
const groupRead = (stat) => stat["mode"] & 40 ? 'r' : '-';
const groupWrite = (stat) => stat["mode"] & 20 ? 'w' : '-';
const groupExecute = (stat) => stat["mode"] & 10 ? 'x' : '-';
const othersRead = (stat) => stat["mode"] & 4 ? 'r' : '-';
const othersWrite = (stat) => stat["mode"] & 2 ? 'w' : '-';
const othersExecute = (stat) => stat["mode"] & 1 ? 'x' : '-';

function formatFileStat(x) {
  let fd = fileDesc(x)
    , ur = ownerRead(x)
    , uw = ownerWrite(x)
    , ux = ownerExecute(x)
    , gr = groupRead(x)
    , gw = groupWrite(x)
    , gx = groupExecute(x)
    , or = othersRead(x)
    , ow = othersWrite(x)
    , ox = othersExecute(x)
    , mt = formatDate(x.mtime);
  return `${fd}${ur}${uw}${ux}${gr}${gw}${gx}${or}${ow}${ox} ${x.nlink} ${x.uid} ${x.gid} ${x.size} ${mt} ${x.name}\r\n`;
}

module.exports.format = function (list) {
  return list.map(x => formatFileStat(x)).join('');
};
