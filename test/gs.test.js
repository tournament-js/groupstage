var $ = require('interlude')
  , GroupStage = require('..')
  , test = require('bandage');

test('invalid', function *(t) {
  var inv = GroupStage.invalid;
  t.eq(inv(1), 'numPlayers cannot be less than 2', 'np limit');
  t.eq(inv(3, { groupSize: 1 }), 'groupSize cannot be less than 2');
  t.eq(inv(3, { groupSize: 4 }),  'groupSize cannot be greater than numPlayers');
});

// couple of tests to ensure correct lengths
test('standardSixteenFour', function *(t) {
  var opts = { groupSize: 4 };
  t.eq(GroupStage.invalid(16, opts), null, 'can construct a 16 4 group stage');
  var gs = new GroupStage(16, opts)
    , ms = gs.matches;
  // should be 4 rounds, with 3 matches for each player, i.e. 3! matches

  var numGroups = $.maximum(ms.map($.get('id', 's')));
  var numRounds = $.maximum(ms.map($.get('id', 'r')));

  t.eq(numGroups, 4, 'should be 4 groups (of 4)');
  t.eq(numRounds, 3, 'should be 3 rounds');

  t.eq(ms.length, 4*(3*2), '4x3 rounds of (4/2) matches in total');
});

test('standardThirtytwoEight', function *(t) {
  var opts = { groupSize: 8 };
  t.eq(GroupStage.invalid(32, opts), null, 'can construct a 32 8 group stage');
  var gs = new GroupStage(32, opts)
    , ms = gs.matches;

  var numGroups = $.maximum(ms.map($.get('id', 's')));
  var numRounds = $.maximum(ms.map($.get('id', 'r')));

  t.eq(numGroups, 4, 'should be 4 groups (of 8)');
  t.eq(numRounds, 7, 'should be 7 rounds');

  t.eq(ms.length, 4*7*4, '4x7 rounds of (8/2) matches in total');

  ms.forEach(function (g) {
    gs.score(g.id, (g.p[0] < g.p[1]) ? [2, 0] : [0, 2]);
  });
  var res = gs.results();
  t.ok(res, 'we could get results');

  res.forEach(function (r) {
    t.ok(r.wins >= 0 && r.wins <= 7, 'between 0 and 7 wins');
    t.ok(r.for >= 0 && r.for <= 2*7, 'between 0 and 14 maps');
    t.ok(r.pos >= 1 && r.pos <= 32, 'places between 1 and 32');
    t.eq(r.for, r.wins*2, 'maps === wins*2 for each result summary here');
    t.eq(r.pts, r.wins*3, 'points == 3 per mapwin');
    t.ok(r.gpos !== undefined, 'group property exists');
    var grp = r.grp;
    t.ok(1 <= grp && grp <= 4, 'grp stored');
  });

  // x-placers sorterd across groups based on pts and maps
  res.slice(0, 4).forEach(function (r) {
    t.ok($.range(4).indexOf(r.seed) >= 0, 'winner of each group in top 4');
    t.eq(r.pts, 7*3, 'all winners won 7 matches');
  });
  res.slice(4, 8).forEach(function (r) {
    t.ok($.range(5, 8).indexOf(r.seed) >= 0, '2nd placers in each group in 5-8th');
    t.eq(r.pts, 6*3, 'all 2nd placers won 6 matches');
  });
  res.slice(8, 12).forEach(function (r) {
    t.ok($.range(9, 12).indexOf(r.seed) >= 0, '3rd placers in each group 9-12th');
    t.eq(r.pts, 5*3, 'all 3rd placers won 5 matches');
  });
});

test('standardFiftyTen', function *(t) {
  var opts = { groupSize: 10 };
  t.eq(GroupStage.invalid(50, opts), null, 'can construct a 50 10 group stage');
  var gs = new GroupStage(50, opts)
    , ms = gs.matches;

  var numGroups = $.maximum(ms.map($.get('id', 's')));
  var numRounds = $.maximum(ms.map($.get('id', 'r')));

  t.eq(numGroups, 5, 'should be 5 groups (of 10)');
  t.eq(numRounds, 9, 'should be 9 rounds');

  t.eq(ms.length, 5*9*5, '5x9 rounds of (10/2) matches in total');
});

test('upcomingSix', function *(t) {
  var opts = { groupSize: 3 };
  var g = new GroupStage(6, opts);
  // grps == [1,3,6] + [2,4,5]
  $.range(6).forEach(function (n) {
    var up = g.upcoming(n);

    t.ok(up.length, 'found upcoming match for ' + n);
    t.eq(up[0].id.m, 1, '3p grps => 1 match per round');
    // had group sizes all been even we would verify .r === 1
    t.ok([1, 2].indexOf(up[0].id.r) >= 0, 'playing in one of the first rounds');

    // now verify that n exists in the match and that it's unscored
    var m = g.findMatch(up[0].id);
    t.ok(m.p.indexOf(n) >= 0, 'player ' + n + ' exists in .p');
    t.ok(!m.m, 'given match was not scored');
  });
});

test('upcomingSixteenEight', function *(t) {
  var opts = { groupSize: 4 };
  t.eq(GroupStage.invalid(16, opts), null, 'can construct a 16 4 group stage');
  var g = new GroupStage(16, opts)
    , ms = g.matches;
  // grps == 4 of 4

  $.range(3).forEach(function (r) {
    $.range(16).forEach(function (n) {
      var up = g.upcoming(n);

      t.ok(up.length, 'found upcoming match for ' + n);
      t.eq(g.unscorable(up[0].id, [1, 0]), null, 'given id is scorable');

      // up[0].id.r follow loop as everyone plays in each round when group sizes even
      t.eq(up[0].id.r, r, 'previous round scored all now wait for round' + r);

      // now verify that n exists in the match and that it's unscored
      var m = g.findMatch(up[0].id);
      t.ok(m.p.indexOf(n) >= 0, 'player ' + n + ' exists in .p');
      t.ok(!m.m, 'given match was not scored');
    });

    // now ensure that scorable works on all ids correctly
    ms.forEach(function (m) {
      if (m.id.r >= r) {
        t.eq(g.unscorable(m.id, [1,0]), null, 'unplayed matches scorable');
      }
      else if (m.id.r < r) {
        t.eq(g.unscorable(m.id, [1,0]), null, 'still scorable in the past');
      }
    });

    $.range(4).forEach(function (s) { // all 4 groups
      $.range(2).forEach(function (m) { // all 2 matches per group (in this round)
        var id = new GroupStage.Id(s, r, m);
        t.eq(g.unscorable(id, [1,0]), null, 'can score ' + id);
        t.ok(g.score(id, [1, 0]), 'scoring round' + r);
      });
    });
  });

  $.range(16).forEach(function (n) {
    var up = g.upcoming(n);
    t.ok(!up.length, 'no more upcoming matches after 3 rounds played');
  });

  // ensure that nothing is now scorable
  ms.forEach(function (m) {
    t.eq(g.unscorable(m.id, [1,0]), null, m.id + ' still scorable');
  });
});

var makeStr = function (r) {
  var str = r.pos + ' P' + r.seed + ' W=' + r.wins;
  str += ' F=' + r.for + ' A=' + r.against;
  if (r.gpos) {
    str += ' GPOS=' + r.gpos + ' in grp=' + r.grp;
  }
  return str;
};

test('resultsNineThree', function *(t) {
  var score = function (g, r) {
    g.matches.forEach(function (m) {
      // g.id.s is unique amongst x-placers and sufficient for never-tieing prop.
      var a = 4 - m.id.s;
      var b = (m.id.s === 2) ? a-2 : a-1;
      if (m.id.r === r) {
        var scorer = m.p[0] < m.p[1] ? [a,b] : [b,a]; // always 1 diff
        t.eq(g.unscorable(m.id, [a,a-1]), null, m.id + ' !unscorable');
        t.ok(g.score(m.id, scorer), 'score ' + m.id);
      }
    });
  };

  var opts = { groupSize: 3 };
  var g = new GroupStage(9, opts);

  // verify initial conditions
  var res0 = g.results();
  t.ok(res0, 'got res0');
  var found = [];
  res0.forEach(function (r) {
    t.eq(r.pos, 9, r.seed + ' should be tied with everyone pre-start');
    t.eq(r.wins, 0, r.seed + ' should have exactly zero wins pre-start');
    t.eq(r.draws, 0, r.seed + ' should have exactly zero draws pre-start');
    t.eq(r.losses, 0, r.seed + ' should have exactly zero losses pre-start');
    t.eq(r.for, 0, r.seed + ' should have exactly zero map scrs pre-start');
    t.ok(1 <= r.grp && r.grp <= 3, r.seed + ' should have grp stored');
    t.ok(r.gpos !== undefined, r.seed + ' should have gpos stored');
    t.ok(r.seed > 0 && r.seed <= 9, 'seeds are 1-indexed: ' + r.seed);
    t.ok(found.indexOf(r.seed) < 0, 'seeds are unique: ' + r.seed);
    found.push(r.seed);
  });
  t.eq(found.length, 9, 'result length is 9');
  found.forEach(function (f) {
    t.eq(Math.ceil(f), f, 'found seed number is an integer: ' + f);
  });

  // score rounds one by one and verify that everything ties as expected
  score(g, 1);
  var res1 = g.results();
  res1.forEach(function (r) {
    t.eq(r.pos, 9, 'all players are tied at 9th before done');
    t.eq(r.pts, 3*r.wins, 'pts are 3x wins (when no draws)');
  });

  score(g, 2);
  var res2 = g.results();
  res2.forEach(function (r) {
    t.eq(r.pos, 9, 'all players are tied at 9th before done');
    t.eq(r.pts, 3*r.wins, 'pts are 3x wins (when no draws)');
  });

  // score remaining matches, now pos should only tie in a particular situation
  score(g, 3);

  var res3 = g.results();
  // this ensures that the ordered results are actually sorted by many things:
  t.deepEqual(res3.map(makeStr), [
    '1 P2 W=2 F=4 A=0 GPOS=1 in grp=2',
    '1 P1 W=2 F=6 A=4 GPOS=1 in grp=1',
    '1 P3 W=2 F=2 A=0 GPOS=1 in grp=3',
    // 2nd placers tied at 4th
    '4 P4 W=1 F=5 A=5 GPOS=2 in grp=1',
    '4 P5 W=1 F=2 A=2 GPOS=2 in grp=2',
    '4 P6 W=1 F=1 A=1 GPOS=2 in grp=3',
    // 3rd placers all tied at 7th
    '7 P7 W=0 F=0 A=2 GPOS=3 in grp=3',
    '7 P9 W=0 F=4 A=6 GPOS=3 in grp=1',
    '7 P8 W=0 F=0 A=4 GPOS=3 in grp=2'],
    'res3'
  );

  res3.forEach(function (r) {
    t.eq(r.pts, 3*r.wins, 'pts are 3x wins (when no draws)');
  });
});
