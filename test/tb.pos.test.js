var test = require('tap').test
  , $ = require('interlude')
  , GroupStage = require('../')
  , TieBreaker = require('../tiebreak_groups');

test("8 4 with 2x 4-way", function (t) {
  var gs = new GroupStage(8, 4);
  gs.matches.forEach(function (m) {
    gs.score(m.id, [1,1]);
  });
  var gRes = gs.results();
  t.deepEqual($.pluck('pos', gRes), [1,1,1,1, 1,1,1,1], 'poss gs');

  t.ok(TieBreaker.isNecessary(gRes, 1), "need to break if want top 1");
  var tb = new TieBreaker(gRes, 1);

  t.equal(tb.matches.length, 3, "need 3 matches for this");

  t.deepEqual($.pluck('pos', tb.results()), [1,1,1,1, 1,1,1,1], 'poss tb r0');
  tb.findMatches({r:1}).forEach(function (m) {
    tb.score(m.id, [4,3,2,1]);
  });

  var top = tb.results();
  t.equal(top[0].pos, 1, "not broken the score between 1 and 2 yet - 0");
  t.equal(top[1].pos, 1, "not broken the score between 1 and 2 yet - 1");

  t.equal(tb.unscorable({s:0, r:2, m:1}, [2,1]), null, "scorable final");
  t.ok(tb.score({s:0, r:2, m:1}, [2,1]), "scoring final");
  var topPost = tb.results();
  t.equal(topPost[0].pos, 1, "broken the score between 1 and 2 now - 0");
  t.equal(topPost[1].pos, 2, "broken the score between 1 and 2 now - 1");

  t.end();
});
