var $ = require('interlude')
  , Tournament = require('tournament')
  , robin = require('roundrobin')
  , grouper = require('group');

function Id(g, r, m) {
  if (!(this instanceof Id)) {
    return new Id(g, r, m);
  }
  this.s = g;
  this.r = r;
  this.m = m;
}

Id.prototype.toString = function () {
  return 'G' + this.s + ' R' + this.r + ' M' + this.m;
};

// ------------------------------------------------------------------

var mapOdd = function (n) {
  return n*2 - 1;
};
var mapEven = function (n) {
  return n*2;
};

var makeMatches = function (numPlayers, groupSize, hasAway, numberOfDuels) {
  var groups = grouper(numPlayers, groupSize);
  var matches = [];
  for (var g = 0; g < groups.length; g += 1) {
    var group = groups[g];
    // make robin rounds for the group
    var rnds = robin(group.length, group);
    for (var r = 0; r < rnds.length; r += 1) {
      var rnd = rnds[r];
      for (var m = 0; m < rnd.length; m += 1) {
        var plsH = rnd[m];
        if (!hasAway) { // players only meet once
          matches.push({ id: new Id(g+1, r+1, m+1), p : plsH });
        }
        else { // players meet twice
          var plsA = plsH.slice().reverse();
          matches.push({ id: new Id(g+1, r+1, m+1), p: plsH });
          matches.push({ id: new Id(g+1, r+1+rnds.length, m+1), p: plsA });
          if (numberOfDuels > 2) {
            for (var d = 2; d < numberOfDuels; d++) {
              var aPls = d % 2 === 0 ? plsH : plsA;
              matches.push({ id: new Id(g+1, r+1+(rnds.length * d), m+1), p: aPls });
            }
          }
        }
      }
    }
  }
  return matches.sort(Tournament.compareMatches);
};

// ------------------------------------------------------------------

var GroupStage = Tournament.sub('GroupStage', function (opts, initParent) {
  var ms = makeMatches(this.numPlayers, opts.groupSize, opts.meetTwice, opts.numberOfDuels);
  this.numGroups = $.maximum(ms.map($.get('id', 's')));
  this.groupSize = Math.ceil(this.numPlayers / this.numGroups); // perhaps reduced
  this.winPoints = opts.winPoints;
  this.tiePoints = opts.tiePoints;
  this.scoresBreak = opts.scoresBreak;
  initParent(ms);
});

GroupStage.configure({
  defaults: function (np, o) {
    // no group size set => league
    o.groupSize = Number(o.groupSize) || np;
    o.meetTwice = Boolean(o.meetTwice);
    o.numberOfDuels = Number(o.numberOfDuels);
    o.winPoints = Number.isFinite(o.winPoints) ? o.winPoints : 3;
    o.tiePoints = Number.isFinite(o.tiePoints) ? o.tiePoints : 1;
    o.scoresBreak = Boolean(o.scoresBreak);
    return o;
  },

  invalid: function (np, opts) {
    if (np < 2) {
      return 'numPlayers cannot be less than 2';
    }
    if (opts.groupSize < 2) {
      return 'groupSize cannot be less than 2';
    }
    if (opts.groupSize > np) {
      return 'groupSize cannot be greater than numPlayers';
    }
    return null;
  }
});

// helper
GroupStage.prototype.groupFor = function (playerId) {
  for (var i = 0; i < this.matches.length; i += 1) {
    var m = this.matches[i];
    if (m.p.indexOf(playerId) >= 0) {
      return m.id.s;
    }
  }
};

// no one-round-at-a-time restrictions so can always recore
GroupStage.prototype._safe = $.constant(true);

GroupStage.prototype._initResult = function (seed) {
  return {
    grp: this.groupFor(seed),
    gpos: this.groupSize,
    pts: 0,
    draws: 0,
    losses: 0
  };
};

GroupStage.prototype._stats = function (res, m) {
  if (!m.m) {
    return res;
  }
  var p0 = Tournament.resultEntry(res, m.p[0]);
  var p1 = Tournament.resultEntry(res, m.p[1]);

  if (m.m[0] === m.m[1]) {
    p0.pts += this.tiePoints;
    p1.pts += this.tiePoints;
    p0.draws += 1;
    p1.draws += 1;
  }
  else {
    var w = (m.m[0] > m.m[1]) ? p0 : p1;
    var l = (m.m[0] > m.m[1]) ? p1 : p0;
    w.wins += 1;
    w.pts += this.winPoints;
    l.losses += 1;
  }
  p0.for += m.m[0];
  p1.for += m.m[1];
  p0.against += m.m[1];
  p1.against += m.m[0];
  return res;
};

var resultsByGroup = function (results, numGroups) {
  var grps = $.replicate(numGroups, []);
  for (var k = 0; k < results.length; k += 1) {
    var p = results[k];
    grps[p.grp - 1].push(p);
  }
  return grps;
};

var tieCompute = function (resAry, startPos, scoresBreak, cb) {
  // provide the metric for resTieCompute which look factors: points and score diff
  Tournament.resTieCompute(resAry, startPos, cb, function metric(r) {
    var val = 'PTS' + r.pts;
    if (scoresBreak) {
      val += 'DIFF' + (r.for - r.against);
    }
    return val;
  });
};

var compareResults = function (x, y) {
  var xScore = x.for - x.against;
  var yScore = y.for - y.against;
  return (y.pts - x.pts) || (yScore - xScore) || (x.seed - y.seed);
};

var finalCompare = function (x, y) {
  return (x.pos - y.pos) ||  compareResults(x, y);
};

GroupStage.prototype._sort = function (res) {
  var scoresBreak = this.scoresBreak;
  res.sort(compareResults);

  // tieCompute within groups to get the `gpos` attribute
  // at the same time build up array of xplacers
  var xarys = $.replicate(this.groupSize, []);
  resultsByGroup(res, this.numGroups).forEach(function (g) { // g sorted as res is
    tieCompute(g, 0, scoresBreak, function (r, pos) {
      r.gpos = pos;
      xarys[pos-1].push(r);
    });
  });

  if (this.isDone()) {
    // position based entirely on x-placement (ignore pts/scorediff across grps)
    var posctr = 1;
    xarys.forEach(function (xplacers) {
      xplacers.forEach(function (r) {
        r.pos = posctr;
      });
      posctr += xplacers.length;
    });
  }
  return res.sort(finalCompare); // ensure sorted by pos primarily
};

// helper method to be compatible with TieBreaker
GroupStage.prototype.rawPositions = function (res) {
  return resultsByGroup(res, this.numGroups).map(function (grp) {
    // NB: need to create the empty arrays to let result function as a lookup
    var seedAry = $.replicate(grp.length, []);
    for (var k = 0; k < grp.length; k += 1) {
      var p = grp[k];
      $.insert(seedAry[p.gpos-1], p.seed); // insert ensures ascending order
    }
    return seedAry;
  });
};

// ------------------------------------------------------------------

GroupStage.id = Id; // deprecated - should be capitalized
GroupStage.Id = Id;
module.exports = GroupStage;
