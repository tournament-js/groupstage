// helper that takes a result array slice that contains pts and maps
// and calls back with the new position relative to startPos and ary slice
// that it would have gotten from this computation
exports.tieCompute = function (ary, startPos, scoreBreak, cb) {
  var pos = startPos
    , ties = 0
    , pts = -Infinity
    , scoreDiff = -Infinity;
  for (var i = 0; i < ary.length; i += 1) {
    var r = ary[i]
      , samePts = (r.pts === pts)
      , sameDiff = (scoreDiff === (r.for - r.against));

    if (samePts && (!scoreBreak || sameDiff)) {
      ties += 1;
    }
    else {
      pos += 1 + ties;
      ties = 0;
    }
    pts = r.pts;
    scoreDiff = r.for - r.against;
    cb(r, pos, i); // so we can do something with pos on r
  }
};

var $ = require('interlude');
exports.resultsByGroup = function (results, numGroups) {
  var grps = $.replicate(numGroups, []);
  for (var k = 0; k < results.length; k += 1) {
    var p = results[k];
    grps[p.grp - 1].push(p);
  }
  return grps;
};

exports.compareResults = function (x, y) {
  return (y.pts - x.pts) ||
         ((y.for - y.against) - (x.for - x.against)) ||
         (x.seed - y.seed);
};
