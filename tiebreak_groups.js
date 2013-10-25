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

// given untied R1 (reflected in posAry) generate players in R2
var generateR2 = function (posAry, position) {
  return posAry.map(function (seedAry) {
    if (seedAry[position].length !== 1) {
      throw new Error("cannot generate TieBreaker round 2: round 1 still tied!");
    }
    return seedAry[position][0];
  }).sort($.compare());
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
 * Results (advancers) can be picked from last match (from 2.)
 */
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
        ms.push({id: {s:0, r:1, m:k+1}, p: posXs});
        break; // done what we needed for this group
      }
    }
  }


  // need between match when we don't pick a multiple of numGroups
  if (rem > 0 && ms.length > 0) {
    ms.push({id: {s:0, r:2, m:1}, p: $.replicate(numGroups, Base.NONE)});
  }
  else if (rem > 0) {
    // in this case we know who starts out in R2 - everyone at gpos position+1
    // we know this position is untied because ms.length === 0 here

    var r2ps = generateR2(posAry, position);
    ms.push({id: {s:0, r:2, m:1}, p: r2ps});
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
    this.numPlayers = this.oldRes.length;
    this.numGroups = $.maximum(this.oldRes.map($.get('grp')));
    this.posAry = posByGroup(this.oldRes, this.numGroups);
    initParent(createTbForGroups(this.posAry, this.limit));
  },
  progress: function (match) {
    // if id.r === 1, we need to do some analysis to get who's in R2 (if it exists)
    var last = this.matches[this.matches.length-1];
    if (match.id.r === 1 && last.id.r === 2) {
      var r1 = this.matches.slice(0, -1); // only one match in R2
      if (r1.every($.get('m'))) {
        var position = Math.floor(this.limit / this.numGroups);
        var posAry2 = posByGroup2(this.posAry, r1);
        var r2ps = generateR2(posAry2, position);

        last.p = r2ps;
      }
    }
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
  var mapsBreak = opts; // TODO: make an options object
  var oldRes = this.oldRes;
  var last = ms[ms.length-1];
  var hasR2 = (last.id.r === 2);
  var r1 = hasR2 ? ms.slice(0, -1) : ms;
  if (!r1.every($.get('m'))) {
    return oldRes; // results in the middle of or before r1 are nonsensical
  }

  // TODO: count .for/.against/.wins/.losses/.draws on tiebreaker matches?

  // r1 matches determine gpos for the tied cluster at limit border
  var getPlayersAboveInGroup = function (grpNum, gpos) {
    return oldRes.filter(function (r) {
      return (r.grp === grpNum && r.gpos < gpos);
    }).length;
  };
  r1.forEach(function (m) {
    Base.sorted(m).forEach(function (p, j) { // know this match is untied
      var resEl = res[p-1];
      resEl.gpos = j + getPlayersAboveInGroup(m.id.m, resEl.gpos) + 1;
    });
  });

  // split posAry2 into xplacers array (similar to the one in GroupStage)
  // array of positions, all of which are arrays of people with same gpos (between)
  var groupSize = Math.ceil(this.numPlayers / this.numGroups);
  var xarys = $.replicate(groupSize, []);
  posByGroup2(this.posAry, r1).forEach(function (grp) {
    grp.forEach(function (gxp, i) {
      gxp.forEach(function (s) {
        xarys[i].push(res[s-1]); // convert seed to result entry
      });
    });
  });

  // then do the full tieCompute reduction that accounts for points and maps
  xarys.reduce(function (currPos, xplacers) {
    xplacers.sort(algs.compareResults);

    // we can identify the R2 match players as a cluster
    // i.e. last.p ==== seeds from xplacers
    // because posAry2 will have resolved within clusters that are relevant
    // so the xplacer array only refers to the xplacers at the limit point
    // in the case when the limit point does not divide numGroups
    var inBetweenCluster = (hasR2 && last.p.indexOf(xplacers[0].seed) >= 0);
    var betweenPos;

    // TODO: verify seed sort (different from GroupStage - but GS seem overkill now)
    algs.tieCompute(xplacers, currPos, mapsBreak, function (r, pos, i) {
      if (inBetweenCluster && i === 0) {
        betweenPos = pos;
      }
      // inBetweenCluster case we want to maintain the tied position
      // because after R2 we adjust the pos manually for this specific cluster
      r.pos = inBetweenCluster ? betweenPos : pos;
    });
    return currPos += xplacers.length; // next pos needs to simply start this far off
  }, 0);


  // change .pos of the players in the R2 match if exists and played
  // TODO: bug here atm: if xarys reduction have already positioned these
  // as one better than the other, then the shift will fuck it up!
  if (hasR2 && last.m) {
    Base.sorted(last).forEach(function (p, i) {
      // top were all tied a same x-placement, so when scoring, anything but 1st
      // is a linear increase in pos (and this does not affect lower clusters)
      res[p-1].pos += i;
    });
  }

  // quick way of doing the sort for r2:
  // not necessary to do the full xarys reduce again because we only changed a very
  // specific subset of the xary - so all `pos` values are correct!
  return res.sort($.comparing('pos', +1, 'pts', -1, 'maps', -1, 'seed', +1));
};

module.exports = TieBreaker;
