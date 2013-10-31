var $ = require('interlude')
  , Base = require('tournament')
  , robin = require('roundrobin')
  , grouper = require('group')
  , algs = require('./balancer');

var mapOdd = function (n) {
  return n*2 - 1;
};
var mapEven = function (n) {
  return n*2;
};

var makeMatches = function (numPlayers, groupSize, hasAway) {
  var ms = grouper(numPlayers, groupSize);

  var matches = [];
  for (var g = 0; g < ms.length; g += 1) {
    var group = ms[g];
    // make robin rounds for the group
    var rnds = robin(group.length, group);
    for (var r = 0; r < rnds.length; r += 1) {
      var rnd = rnds[r];
      for (var m = 0; m < rnd.length; m += 1) {
        var plsH = rnd[m];
        if (!hasAway) { // players only meet once
          matches.push({ id: { s: g+1, r: r+1, m: m+1 }, p : plsH });
        }
        else { // players meet twice
          var plsA = plsH.slice().reverse();
          matches.push({ id: { s: g+1, r: mapOdd(r+1),  m: m+1 }, p: plsH });
          matches.push({ id: { s: g+1, r: mapEven(r+1), m: m+1 }, p: plsA });
        }
      }
    }
  }
  return matches.sort(Base.compareMatches);
};

var GroupStage = Base.sub('GroupStage', function (opts, initParent) {
  var ms = makeMatches(this.numPlayers, opts.groupSize, opts.meetTwice);
  this.numGroups = $.maximum(ms.map($.get('id', 's')));
  this.groupSize = Math.ceil(this.numPlayers / this.numGroups); // perhaps reduced
  this.winPoints = opts.winPoints;
  this.tiePoints = opts.tiePoints;
  this.scoresBreak = opts.scoresBreak;
  initParent(ms);
});

GroupStage.configure({
  defaults: function (np, opts) {
    // no group size set => league
    opts.groupSize = Number(opts.groupSize) || np;
    opts.meetTwice = Boolean(opts.meetTwice);
    opts.winPoints = Number.isFinite(opts.winPoints) ? opts.winPoints : 3;
    opts.tiePoints = Number.isFinite(opts.tiePoints) ? opts.tiePoints : 1;
    opts.scoresBreak = Boolean(opts.scoresBreak);
    return opts;
  },

  invalid: function (np, opts) {
    if (!Base.isInteger(opts.groupSize)) {
      return "groupSize must only be specified as a finite integer";
    }
    if (np < 3) {
      return "GroupStage needs at least 3 players";
    }
    if (opts.groupSize < 3) {
      return "GroupStage needs a group size greater than or equal 3";
    }
    if (opts.groupSize > np) {
      return "cannot create GroupStage with groupSize > numPlayers";
    }
    return null;
  }
});

GroupStage.idString = function (id) {
  return "G" + id.s + " R" + id.r + " M" + id.m;
};

// helper
GroupStage.prototype.groupFor = function (playerId) {
  for (var i = 0; i < this.matches.length; i += 1) {
    var m = this.matches[i];
    if (m.p.indexOf(playerId) >= 0) {
      return m.id.s;
    }
  }
};

GroupStage.prototype.initResult = function (seed) {
  return {
    grp: this.groupFor(seed),
    gpos: this.groupSize,
    pts: 0,
    for: 0,
    against: 0,
    wins: 0,
    draws: 0,
    losses: 0
  };
};

GroupStage.prototype.stats = function (res) {
  // compute stats based on completed matches
  this.matches.filter($.get('m')).forEach(function (m) {
    var p0 = m.p[0] - 1
      , p1 = m.p[1] - 1;

    if (m.m[0] === m.m[1]) {
      res[p0].pts += this.tiePoints;
      res[p1].pts += this.tiePoints;
      res[p0].draws += 1;
      res[p1].draws += 1;
    }
    else {
      var w = (m.m[0] > m.m[1]) ? p0 : p1;
      var l = (m.m[0] > m.m[1]) ? p1 : p0;
      res[w].wins += 1;
      res[w].pts += this.winPoints;
      res[l].losses += 1;
    }
    res[p0].for += m.m[0];
    res[p1].for += m.m[1];
    res[p0].against += m.m[1];
    res[p1].against += m.m[0];
  }.bind(this));

  var scoresBreak = this.scoresBreak;
  res.sort(algs.compareResults(scoresBreak));
  var grps = algs.resultsByGroup(res, this.numGroups);

  // tieCompute within groups to get the `gpos` attribute
  // at the same time build up array of xplacers
  var xarys = $.replicate(this.groupSize, []);
  grps.forEach(function (g) { // g sorted as res is
    algs.tieCompute(g, 0, scoresBreak, function (r, pos) {
      r.gpos = pos;
      xarys[pos-1].push(r);
    });
  });

  // tieCompute across groups via xplacers to get the `pos` attribute
  // also push into the final sorted results as we go along (so we preserve orders)
  if (this.isDone()) {
    algs.positionFromXarys(xarys, scoresBreak); // position iff done
  }
  return res.sort(algs.finalCompare); // ensure sorted by pos primarily
};

module.exports = GroupStage;
