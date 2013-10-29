var $ = require('interlude')
  , Base = require('tournament')
  , algs = require('./balancer');

var invalid = function (oldRes, limit) {
  if (!Array.isArray(oldRes)) {
    return "need GroupStage results array";
  }
  if (!Base.isInteger(limit) || limit < 1 || limit >= oldRes.length) {
    return "limit must be an integer in the range {1, ... ,results.length-1}";
  }
  var poss = [];
  for (var i = 0; i < oldRes.length; i += 1) {
    var r = oldRes[i];
    var props = [r.seed, r.pts, r.for, r.against, r.gpos, r.grp, r.pos];
    if (!props.every(Base.isInteger)) {
      return "invalid GroupStage results - common properties missing";
    }
    poss.push(r.pos);
  }
  if (poss.indexOf(1) < 0) {
    return "finish GroupStage before requesting tiebreakers";
  }
  return null;
};

var idString = function (id) {
  if (id.r === 1) {
    return "Group " + id.m + " tiebreaker";
  }
  return "Between groups tiebreaker";
};

/**
 * FFA tiebreakers
 *
 * creates 2 kind of tiebreakers
 * 1. Within groups (necessary for the latter)
 * 2. Between groups
 *
 * Because of the complexity of having subgroups tie and then redoing sub groupstages
 * with a reduced number is so high, we leave tiebreaking up to the individual host.
 *
 * Thus we only provide at most 2 matches for each player:
 * 1. One match FOR EACH GROUP to tiebreak the groups (which are filled if needed)
 * 2. One match for the between groups x-placers tiebreak
 *
 * These matches must be entered scores to represent the actual tiebreaker event.
 * NO SCORES THEREIN CAN TIE.
 * GroupStage scores will be updated (to not have ties) after TieBreaker done
 */

// given untied R1 (reflected in posAry) generate players in R2
var generateR2 = function (posAry, position) {
  return posAry.map(function (seedAry) {
    if (seedAry[position].length !== 1) {
      throw new Error("cannot generate TieBreaker round 2: round 1 still tied!");
    }
    return seedAry[position][0];
  }).sort($.compare());
};

var createTbForGroups = function (posAry, limit) {
  var numGroups = posAry.length;
  var rem = limit % numGroups;
  var position = Math.floor(limit / numGroups);
  var ms = [];

  // need group match if the current group has duplicate gpos <= position
  // - create that match for the duplicates
  // - put non-duplicates with gpos < position directly into `proceeders`
  for (var k = 0; k < numGroups; k += 1) {
    var grpPos = posAry[k];
    var unchosen = position; // need to choose this many (and sometimes 1 more)

    // loop over position + 1 (though last irrelevant if !rem)
    // and there's always a grpPos[i] because limit < numGroups
    for (var i = 0; i <= position; i += 1) {
      var posXs = grpPos[i]; // all players in position (i+1)
      /*
      Depending on how many ties there are in this group (via lengths in grpPos)
      we may need to create a tiebreaker match for this group:
      If we can distinguish a cluster <= unchosen in size, no need to tiebreak group
      If not, put last cluster in a tiebreaker
      */
      if (posXs.length <= unchosen) {
        unchosen -= posXs.length; // next cluster must fit or be broken as well
        if (!unchosen && !rem) {
          break; // this group is fine - grpPos chunks perfectly fit into position
        }
      }
      else if (posXs.length === 1 && unchosen === 0 && rem > 0) {
        // we do not need to tiebreak the one that will go to the between match
        // because by above prop, there is only one from this group
        break; // this group fine as well - chunks before fit into position
      }
      else if (posXs.length > unchosen) {
        // any other type where the chunks doesnt fit, we need to tiebreak
        // this chunk doesnt fit, need to tiebreak it
        ms.push({ id: { s: 0, r: 1, m: k+1 }, p: posXs });
        break; // done what we needed for this group
      }
    }
  }

  // need between match when we don't pick a multiple of numGroups
  if (rem > 0 && ms.length > 0) {
    ms.push({ id: { s: 0, r: 2, m: 1 }, p: $.replicate(numGroups, Base.NONE) });
  }
  else if (rem > 0) {
    // in this case we know who starts out in R2 - everyone at gpos position+1
    // we know this position is untied because ms.length === 0 here

    ms.push({ id: { s: 0, r: 2, m: 1 }, p: generateR2(posAry, position) });
  }

  return ms;
};

// returns an array (one per group) of seedArys
// where each seedAry is the group's seeds partitioned by their gpos
// NB: seedAry will function as a lookup of [gpos-1 : gposPlacers]
var posByGroup = function (oldRes, numGroups) {
  return algs.resultsByGroup(oldRes, numGroups).map(function (grp) {
    // NB: need to create the empty arrays to let result function as a lookup
    var seedAry = $.replicate(grp.length, []);
    for (var k = 0; k < grp.length; k += 1) {
      var p = grp[k];
      $.insert(seedAry[p.gpos-1], p.seed); // insert ensures ascending order
    }
    return seedAry;
  });
};

// same as posByGroup but splits up inside seedArys when r1 tiebreakers took place
// in the corresponding group(s).
// this method is shared by progress and stats, but only stats needs the full result
var posByGroup2 = function (posAry, r1) {
  return posAry.map(function (posG, i) {
    var m = Base.prototype.findMatch.call({matches: r1}, {s:0, r:1, m: i+1});
    if (!m) { // group did not require tiebreakers - return old seedAry
      return posG.slice();
    }
    var res = $.replicate(posG.length, []); // this needed tiebreaking - reconstruct
    for (var x = 0; x < posG.length; ) {
      var p = posG[x]; // (x-1)th placers in this group
      if (p.indexOf(m.p[0]) < 0) { // not the chunk that required breaking
        res[x] = p.slice(); // copy these xplacers - no breakers for this/these
        x += 1;
      }
      else {
        // this is the cluster that was tied - now unbroken
        var sorted = Base.sorted(m); // no ties by definition
        for (var j = 0; j < p.length; j += 1) {
          res[x + j] = [sorted[j]]; // gpos x+j is the player that scored jth in m
        }
        x += p.length; // we split up the chunk into p.length different xplacers
      }
    }
    return res;
  });
};

var TieBreaker = Base.sub('TieBreaker', ['oldRes', 'limit'], {
  init: function (initParent) {
    this.version = 1;
    this.numGroups = $.maximum(this.oldRes.map($.get('grp')));
    this.groupSize = Math.ceil(this.oldRes.length / this.numGroups);
    this.posAry = posByGroup(this.oldRes, this.numGroups);
    initParent(createTbForGroups(this.posAry, this.limit));
    var r1 = this.findMatches({r:1});
    var r2 = this.findMatches({r:2});
    this.numPlayers = this.oldRes.length;

    // need to demote positions until stuff has been played
    // NB: if this tournament is contained in a groupstage wrapper
    // we never see the positions from groupstage because they are tied at `np`
    // until it is done, but when it is done, results are deferred to TieBreaker
    var numTbPlayers = $.flatten(r1.map($.get('p'))).length;
    if (r2.length) {
      numTbPlayers += (this.numGroups - r1.length);
    }
    var pls = this.players();
    var tieStart = this.limit + numTbPlayers - 1;
    this.oldRes.forEach(function (r) {
      if (pls.indexOf(r.seed) >= 0) {
        console.log('bumping', r.seed, 'to', tieStart);
        r.pos = tieStart;
      }
    });
  },

  verify: function (match, score) {
    if ($.nub(score).length !== score.length) {
      return "scores must unambiguously decide every position";
    }
    return null;
  },

  limbo: function (playerId) {
    // we know if a player has won a R1 match he will be in R2
    // TODO: so do this check here
    return;
  }
});

TieBreaker.invalid = invalid;
TieBreaker.idString = idString;

// given valid (gsResults, limit) do we actually need to tiebreak to pick top limit?
TieBreaker.isNecessary = function (gsResults, limit) {
  var tb = new TieBreaker(gsResults, limit);
  return (tb.matches && tb.matches.length > 0);
};


TieBreaker.prototype.initResult = function (seed) {
  return $.firstBy(function (r) {
    return r.seed === seed;
  }, this.oldRes);
};

TieBreaker.prototype.stats = function (res, opts) {
  var ms = this.matches;
  var scoresBreak = opts; // TODO: make an options object
  var oldRes = this.oldRes;
  var last = ms[ms.length-1];
  var hasR2 = (last.id.r === 2);
  var r1 = hasR2 ? ms.slice(0, -1) : ms;
  // NB: we do not care about stats from the matches apart from what it broke

  // r1 matches determine gpos for the tied cluster at limit border
  var getPlayersAboveInGroup = function (grpNum, gpos) {
    return oldRes.filter(function (r) {
      return (r.grp === grpNum && r.gpos < gpos);
    }).length;
  };
  // so make gpos correct for the scored r1 matches
  r1.filter($.get('m')).forEach(function (m) {
    Base.sorted(m).forEach(function (p, j) { // know this match is untied
      var resEl = res[p-1];
      resEl.gpos = j + getPlayersAboveInGroup(m.id.m, resEl.gpos) + 1;
    });
  });

  if (r1.every($.get('m'))) {
    // split posAry2 into xplacers array (similar to the one in GroupStage)
    // array of positions, all of which are arrays of people with same gpos (between)
    var xarys = $.replicate(this.groupSize, []);
    posByGroup2(this.posAry, r1).forEach(function (grp) {
      grp.forEach(function (gxp, i) {
        gxp.forEach(function (s) {
          xarys[i].push(res[s-1]); // convert seed to result entry
        });
      });
    });

    // account for between groups match by keeping track of an extra property
    if (hasR2 && last.m) {
      last.p.forEach(function (p, i) {
        res[p-1].tb = last.m[i];
      });
    }

    if (this.isDone()) {
      algs.positionFromXarys(xarys, scoresBreak);
    }
  }
  return res.sort(algs.finalCompare);
};

module.exports = TieBreaker;
