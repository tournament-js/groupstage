var tap = require('tap')
  , test = tap.test
  , GroupStage = require('../')
  , TieBreaker = require('../tiebreak_groups');

var killDraws = function (resAry) {
  resAry.forEach(function (r) {
    delete r.draws;
  });
};

test("tiebreaker 6 3 uefa", function (t) {
  // same as tb uefa test
  var uefa = new GroupStage(6, 3, { meetTwice: true });
  uefa.matches.forEach(function (m) {
    t.ok(uefa.score(m.id, m.p[0] < m.p[1] ? [2,1] : [1, 2]), "score match");
  });
  // score st groups decided unanimously based on seeds:
  // thus: group 1: [1, 3, 6],, group 2: [2, 4, 5]
  // no tiebreaking, so xplacers: [[1,2], [], [3, 4], [], [5, 6], []]
  // (shared 1st, shared 3rd, shared 5th)

  var res = uefa.results({scoresBreak: true});
  killDraws(res);
  // inlined res from gs.uefa test here

  t.deepEqual(res, [
    { seed:1, wins:4, 'for':8, against:4, pos:1, grp:1, gpos:1, pts:12, losses:0 },
    { seed:2, wins:4, 'for':8, against:4, pos:1, grp:2, gpos:1, pts:12, losses:0 },
    { seed:3, wins:2, 'for':6, against:6, pos:3, grp:1, gpos:2, pts:6, losses:2 },
    { seed:4, wins:2, 'for':6, against:6, pos:3, grp:2, gpos:2, pts:6, losses:2 },
    { seed:5, wins:0, 'for':4, against:8, pos:5, grp:2, gpos:3, pts:0, losses:4 },
    { seed:6, wins:0, 'for':4, against:8, pos:5, grp:1, gpos:3, pts:0, losses:4 }
  ], "gs.uefa.test results are the same");

  var tb = new TieBreaker(res, 3);
  t.equal(tb.matches.length, 1, "only one match in tb");
  var m = tb.matches[0];
  t.equal(m.id.r, 2, "and it's a between groups one");
  t.deepEqual(m.p, [3,4], "containing 3 and 4 - the 2nd placers");

  // positions must be demoted for results (so emulate the effect with original res)
  res[2].pos = 4;
  res[3].pos = 4;

  var tbRes = tb.results();
  killDraws(tbRes);
  t.deepEqual(tbRes, res, "tbRes has demoted positions");

  t.ok(tb.score(m.id, [1,2]), 'scored r2 match');
  var tbResDone = tb.results();
  killDraws(tbResDone);

  // now positions should be fixed
  res[2].pos = 4;
  res[2].tb = 1;
  res[3].pos = 3; // 4 beat 3, thus 4 gets 3rd place
  res[3].tb = 2;

  // but also need to swap them around
  var seed4 = res.splice(3, 1)[0];
  res.splice(2, 0, seed4);

  t.deepEqual(tbResDone, res, "tbResDone has finalized positions");


  t.end();
});
