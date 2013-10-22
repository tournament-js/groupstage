var tap = require('tap')
  , test = tap.test
  , GroupStage = require('../groupstage');

test("group stage 16 4 uefa", function (t) {
  var gs = new GroupStage(6, 3);

  t.equal(gs.findMatches({s:1}).length, 3, '3 matches per group');

  var uefa = new GroupStage(6, 3, { meetTwice: true });
  t.equal(uefa.findMatches({s:1}).length, 6, '6 matches per group');

  uefa.matches.forEach(function (m) {
    t.ok(uefa.score(m.id, m.p[0] < m.p[1] ? [1,0] : [0, 1]));
  });
  // score st groups decided unanimously based on seeds:
  // thus: group 1: [1, 3, 6],, group 2: [2, 4, 5]
  // no tiebreaking, so posAry: [[1,2], [], [3, 4], [], [5, 6], []]
  // (shared 1st, shared 3rd, shared 5th)

  var res = uefa.results();
  var expected = [{
    "seed" : 1,
    "maps" : 4,
    "pts" : 12,
    "pos" : 1,
    "wins" : 4,
    "draws" : 0,
    "losses" : 0,
    "grp" : 1,
    "gpos" : 1
  },{
    "seed" : 2,
    "maps" : 4,
    "pts" : 12,
    "pos" : 1,
    "wins" : 4,
    "draws" : 0,
    "losses" : 0,
    "grp" : 2,
    "gpos" : 1
  },{
    "seed" : 3,
    "maps" : 2,
    "pts" : 6,
    "pos" : 3,
    "wins" : 2,
    "draws" : 0,
    "losses" : 2,
    "grp" : 1,
    "gpos" : 2
  },{
    "seed" : 4,
    "maps" : 2,
    "pts" : 6,
    "pos" : 3,
    "wins" : 2,
    "draws" : 0,
    "losses" : 2,
    "grp" : 2,
    "gpos" : 2
  },{
    "seed" : 5,
    "maps" : 0,
    "pts" : 0,
    "pos" : 5,
    "wins" : 0,
    "draws" : 0,
    "losses" : 4,
    "grp" : 2,
    "gpos" : 3
  },{
    "seed" : 6,
    "maps" : 0,
    "pts" : 0,
    "pos" : 5,
    "wins" : 0,
    "draws" : 0,
    "losses" : 4,
    "grp" : 1,
    "gpos" : 3
  }];
  t.deepEqual(res, expected, "results");

  t.end();
});
