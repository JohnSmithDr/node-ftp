'use strict';

const moment = require('moment');

function formatDate(date) {
  return moment(date).format('MMM DD HH:mm');
}

module.exports.format = function (list) {

  let lines = list.map(x => {
    let fd = x.isDir ? 'd' : '-';
    let ur = '-';
    let uw = '-';
    let ux = '-';
    let gr = '-';
    let gw = '-';
    let gx = '-';
    let or = '-';
    let ow = '-';
    let ox = '-';
    let mt = formatDate(x.mtime);
    return `${fd}${ur}${uw}${ux}${gr}${gw}${gx}${or}${ow}${ox} ${x.nlink} - - ${x.size} ${mt} ${x.fileName}`;
  });


};
