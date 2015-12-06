var $ = require('interlude')
  , GroupStage = require('..')
  , test = require('bandage');


test('fullTiedGroupRawPositions', function *(t) {
  var gs = new GroupStage(9, { groupSize: 3 });
  var ms = gs.matches;

  // score so that everyone got exactly one win
  // easy to do by symmetry in this case, reverse score middle match in group
  ms.forEach(function (m) {
    gs.score(m.id, (m.id.r === 2) ? [0, 1] : [1, 0]);
  });

  var res = gs.results();

  t.eq($.nub($.pluck('wins', res)), [1], 'all players won 1 match');
  t.eq($.nub($.pluck('pos', res)), [1], 'all players tied for 1st');
  t.eq(gs.rawPositions(res), [
    [ [1,4,9], [], [] ], // group 1
    [ [2,5,8], [], [] ], // group 2
    [ [3,6,7], [], [] ] ], // group 3
    'raw positions shows all tied 1st in group'
  );
});

test('threeWayTie', function *(t) {
  var gs = new GroupStage(8, { groupSize: 4 });

  gs.matches.forEach(function (m) {
    if (m.id.s === 1) {
      gs.score(m.id, (m.id.r === 1) ? [1,0] : [0, 1]);
    }
    if (m.id.s === 2) {
      gs.score(m.id, ([4].indexOf(m.id.r) >= 0) ? [1, 0] : [0, 1]);
    }
  });

  t.eq(gs.rawPositions(gs.results()), [
    [ [3], [1,6,8], [], [] ], // three way tie g1
    [ [4,5,7], [], [], [2] ] ], // three way tie g2
    'three way tie properly computed'
  );
});

test('tieResult', function *(t) {
  var gs = new GroupStage(8, { groupSize: 4 });

  gs.matches.forEach(function (m) {
    if (m.id.s === 1) {
      gs.score(m.id, [1, 1]); // actual tie
    }
    if (m.id.s === 2) {
      gs.score(m.id, m.p[0] < m.p[1] ? [1, 0] : [0, 1]); // no ties here
    }
  });

  var res = gs.results();
  var g1 = res.filter(function (r) {
    return r.grp === 1;
  });
  var g2 = res.filter(function (r) {
    return r.grp === 2;
  });
  t.eq($.pluck('pts', g1), [3,3,3,3], 'all players tied 3 matches in g1');
  t.eq($.pluck('pts', g2), [9,6,3,0], 'straight point spread in g2');

  t.eq(gs.rawPositions(res), [
    [ [1,3,6,8], [], [], [] ], // full tied g1
    [ [2], [4], [5], [7] ] ],  // no ties in g2
    'full ties group is correct'
  );
});
