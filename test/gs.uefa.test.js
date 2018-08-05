var GS = require('..')
  , test = require('bandage');

test('uefa', function *(t) {
  var opts = { groupSize: 3, scoresBreak: true };
  var gs = new GS(6, opts);

  t.eq(gs.findMatches({s: 1}).length, 3, '3 matches per group');

  opts.meetTwice = true;
  opts.numberOfDuels = 3;
  var uefa = new GS(6, opts);
  t.eq(uefa.findMatches({s: 1}).length, 9, '9 matches per group');

  opts.numberOfDuels = 2;
  var uefa = new GS(6, opts);
  t.eq(uefa.findMatches({s: 1}).length, 6, '6 matches per group');

  uefa.matches.forEach(function (m) {
    t.ok(uefa.score(m.id, m.p[0] < m.p[1] ? [2,1] : [1, 2]), 'score ' + m.id);
  });

  
  // score st groups decided unanimously based on seeds:
  // thus: group 1: [1, 3, 6],, group 2: [2, 4, 5]
  // no tiebreaking, so xplacers: [[1,2], [], [3, 4], [], [5, 6], []]
  // (shared 1st, shared 3rd, shared 5th)

  var res = uefa.results();
  res.forEach(function (r) {
    t.eq(r.draws, 0, 'no draws');
    delete r.draws;
  });
  // scores identical so should still be no breaking
  var expected = [
    { seed: 1, wins: 4, for: 8, against: 4, pos: 1, grp: 1, gpos: 1, pts: 12, losses: 0 },
    { seed: 2, wins: 4, for: 8, against: 4, pos: 1, grp: 2, gpos: 1, pts: 12, losses: 0 },
    { seed: 3, wins: 2, for: 6, against: 6, pos: 3, grp: 1, gpos: 2, pts: 6, losses: 2 },
    { seed: 4, wins: 2, for: 6, against: 6, pos: 3, grp: 2, gpos: 2, pts: 6, losses: 2 },
    { seed: 5, wins: 0, for: 4, against: 8, pos: 5, grp: 2, gpos: 3, pts: 0, losses: 4 },
    { seed: 6, wins: 0, for: 4, against: 8, pos: 5, grp: 1, gpos: 3, pts: 0, losses: 4 }
  ];
  t.deepEqual(res, expected, 'results');
});
