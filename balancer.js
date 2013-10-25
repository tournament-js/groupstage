// helper that takes a result array slice that contains pts and maps
// and calls back with the new position relative to startPos and ary slice
// that it would have gotten from this computation
exports.tieCompute = function (ary, startPos, mapsBreak, cb) {
  var pos = startPos
    , ties = 0
    , pts = -Infinity
    , mapsFor = -Infinity;
  for (var i = 0; i < ary.length; i += 1) {
    var r = ary[i]
      , samePts = (r.pts === pts)
      , sameScores = (r.for === mapsFor);

    if (samePts && (!mapsBreak || sameScores)) {
      ties += 1;
    }
    else {
      pos += 1 + ties;
      ties = 0;
    }
    pts = r.pts;
    mapsFor = r.for;
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
}

exports.compareResults = $.comparing('pts', -1, 'maps', -1, 'seed', +1);
