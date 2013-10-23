// helper that takes a result array slice that contains pts and maps
// and calls back with the new position relative to startPos and ary slice
// that it would have gotten from this computation
exports.tieCompute = function (ary, startPos, mapsBreak, cb) {
  var pos = startPos
    , ties = 0
    , pts = -Infinity
    , maps = -Infinity;
  for (var i = 0; i < ary.length; i += 1) {
    var r = ary[i]
      , samePts = (r.pts === pts)
      , sameScores = (r.maps === maps);

    if (samePts && (!mapsBreak || sameScores)) {
      ties += 1;
    }
    else {
      pos += 1 + ties;
      ties = 0;
    }
    pts = r.pts;
    maps = r.maps;
    cb(r, pos, i); // so we can do something with pos on r
  }
};
