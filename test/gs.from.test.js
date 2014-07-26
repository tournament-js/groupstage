var tap = require('tap')
  , test = tap.test
  , $ = require('interlude')
  , GS = require('../');

test("GS -> GS -> GS", function (t) {
  var g1 = new GS(16, { groupSize: 4 });
  g1.matches.forEach(function (m) {
    g1.score(m.id, m.p[0] < m.p[1] ? [0,1] : [1,0]); // reverse seed order
  })
  var top8 = $.pluck('seed', g1.results().slice(0, 8));
  t.deepEqual(top8, [13,14,15,16,9,10,11,12], "winners are bottom 8 seeds");
  // NB: gs ties 1st and 2nd placers and sorts these between by seeds

  var g2 = GS.from(g1, 8, { groupSize: 4 });
  t.deepEqual(g2.players(), [9,10,11,12,13,14,15,16], "advancers from g1");
  // group(8,4) gives [ [ 1, 3, 6, 8 ], [ 2, 4, 5, 7 ] ]
  var sort = function (xs) {
    return xs.sort($.compare());
  };
  t.deepEqual(g2.players({s:1}), sort([13,15,10,12]), 'g2 grp1 is 1,3,6,8');
  t.deepEqual(g2.players({s:2}), sort([14,16,9,11]), 'g2 grp2 is 2,4,5,7');

  g2.matches.forEach(function (m) {
    g2.score(m.id, m.p[0] < m.p[1] ? [1,0] : [0,1]); // seed order
  });
  var top4 = $.pluck('seed', g2.results().slice(0, 4));
  t.deepEqual(top4, [9,10,11,12], "winners top 4 in g2");

  var g3 = GS.from(g2, 4);
  t.deepEqual(g3.players(), [9,10,11,12], "top 4 progressed to g3");

  t.end();
});
