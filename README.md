# GroupStage
[![Build Status](https://secure.travis-ci.org/clux/groupstage.png)](http://travis-ci.org/clux/groupstage)
[![Dependency Status](https://david-dm.org/clux/groupstage.png)](https://david-dm.org/clux/groupstage)
[![unstable](http://hughsk.github.io/stability-badges/dist/unstable.svg)](http://nodejs.org/api/documentation.html#documentation_stability_index)

## Overview
GroupStage is a simple and customizable, early stage [tournament](https://npmjs.org/package/tournament). A group stage is designed to pick out the best players by first splitting them up in fair groups of requested size, then round robin schedule each group.

They are advantageous compared to eliminations because they guarantee `groupSize-1` matches per player. By combining a group stage with a later elimination round, the best players get picked out for an exciting finale.

## Construction
Specify the number of players and the group size, then use like a normal tournament instance.

```js
// 5 players in a single group (league)
var gs = new GroupStage(5);
gs.matches;
[ { id: { s: 1, r: 1, m: 1 }, p: [ 2, 5 ] },
  { id: { s: 1, r: 1, m: 2 }, p: [ 3, 4 ] },
  { id: { s: 1, r: 2, m: 1 }, p: [ 1, 5 ] },
  { id: { s: 1, r: 2, m: 2 }, p: [ 2, 3 ] },
  { id: { s: 1, r: 3, m: 1 }, p: [ 1, 4 ] },
  { id: { s: 1, r: 3, m: 2 }, p: [ 5, 3 ] },
  { id: { s: 1, r: 4, m: 1 }, p: [ 1, 3 ] },
  { id: { s: 1, r: 4, m: 2 }, p: [ 4, 2 ] },
  { id: { s: 1, r: 5, m: 1 }, p: [ 1, 2 ] },
  { id: { s: 1, r: 5, m: 2 }, p: [ 4, 5 ] } ]


// 8 players in groups of 4
var gs = new GroupStage(8, { groupSize: 4 });
gs.matches;
[ { id: { s: 1, r: 1, m: 1 }, p: [ 1, 8 ] },
  { id: { s: 1, r: 1, m: 2 }, p: [ 3, 6 ] },
  { id: { s: 1, r: 2, m: 1 }, p: [ 1, 6 ] },
  { id: { s: 1, r: 2, m: 2 }, p: [ 8, 3 ] },
  { id: { s: 1, r: 3, m: 1 }, p: [ 1, 3 ] },
  { id: { s: 1, r: 3, m: 2 }, p: [ 6, 8 ] },
  { id: { s: 2, r: 1, m: 1 }, p: [ 2, 7 ] },
  { id: { s: 2, r: 1, m: 2 }, p: [ 4, 5 ] },
  { id: { s: 2, r: 2, m: 1 }, p: [ 2, 5 ] },
  { id: { s: 2, r: 2, m: 2 }, p: [ 7, 4 ] },
  { id: { s: 2, r: 3, m: 1 }, p: [ 2, 4 ] },
  { id: { s: 2, r: 3, m: 2 }, p: [ 5, 7 ] } ]
// NB: groups [ 1, 3, 6, 8 ], [ 2, 4, 5, 7 ]


// 9 players in groups of 3
var gs = new GroupStage(9, { groupSize: 3 });
gs.matches;
[ { id: { s: 1, r: 1, m: 1 }, p: [ 4, 9 ] },
  { id: { s: 1, r: 2, m: 1 }, p: [ 1, 9 ] },
  { id: { s: 1, r: 3, m: 1 }, p: [ 1, 4 ] },
  { id: { s: 2, r: 1, m: 1 }, p: [ 5, 8 ] },
  { id: { s: 2, r: 2, m: 1 }, p: [ 2, 8 ] },
  { id: { s: 2, r: 3, m: 1 }, p: [ 2, 5 ] },
  { id: { s: 3, r: 1, m: 1 }, p: [ 6, 7 ] },
  { id: { s: 3, r: 2, m: 1 }, p: [ 3, 7 ] },
  { id: { s: 3, r: 3, m: 1 }, p: [ 3, 6 ] } ]
// NB: groups: [ 1, 4, 9 ], [ 2, 5, 8 ], [ 3, 6, 7 ]
```

The `GroupStage.invalid()` will tell you whether the constructor arguments produce a valid tournament.

## Relevant tournament entries
GroupStage is a [tournament](https://npmjs.org/package/tournament) - to get the most out of this module you should read (at least) the following:

- [ensuring constructibility](https://github.com/clux/tournament/blob/master/doc/base.md#ensuring-constructibility)
- [base class](https://github.com/clux/tournament/blob/master/doc/base.md#base-class)
- [scoring](https://github.com/clux/tournament/blob/master/doc/base.md#ensuring-scorability--consistency)

## Special methods
GroupStage additionally feature the following methods, unique to this subclass:

### groupFor(seedNumber) :: Number
Get the group number for the corresponding player.

## Caveats
### Ties allowed
Unlike most other tournaments, `GroupStages` allow for individual match ties. The results are simply tallied up by points (configurable) at the end. If match ties is not possible/ideal, just check for it externally:

```js
var score = function (id, score) {
  // assumes you have guarded on `gs.unscorable` earlier
  if (score[0] !== score[1]) {
    // filtering out the ties - but should probably present an error reason
    gs.score(id, score);
  }
};
```

### End results
Acting on end results in a group stage is sometimes problematic, for multiple reasons:

- The `.pos` attribute is always *increasing* in any tournament, so we can never bump player positions upwards until it is guaranteed
- We cannot make sufficiently *general* inferences between groups, so it is impossible unbreak ties at the between group level
- Complex, unexpected results can cause multi-way ties (entire groups can tie), even if individual match ties have been disallowed

Thus, the following conventions are enforced:

- Before `.isDone()`, all players have a tied `.pos` attribute at numPlayers
- After `.isDone()`, we tie all the players who got 1st in each group at 1st, then all players who got 2nd at (numFirsts+1), then so on
- Ties need to be broken [outside this module](https://npmjs.org/package/tiebreaker) to guarantee fair progression

Finally,

- Within group positions are based entirely on points, then optionally on scores

The following options can be set to enforce how group winners are decided:

```js
{
  winPoints: Number, // Number of points awarded per win - default 3
  tiePoints: Number, // Number of points awarded per tie - default 1
  scoresBreak: Boolean, // Look at the sum of scores in case of ties - default false
}
```

### Tiebreaking
In some cases, breaking by scores is also insufficient. For this you need to forward to a [`TieBreaker` tournament](https://npmjs.org/package/tiebreaker). This module can also be used as a test of whether or not tiebreaking is needed.

### Seeding and groups
Like for most other tournaments, seeding is important. The initial player partitioning into groups is done in such a way so that there is a variety of differently skilled players:

 - If the number of players is divisible by the number of groups (ideal condition), then the sum of the seeds in each group differ by at most the number of groups.

```js
require('group')(15, 5); // 15 players in groups of 5
[ [ 1, 4, 7, 12, 15 ],
  [ 2, 5, 8, 11, 14 ],
  [ 3, 6, 9, 10, 13 ] ]
```

 - If additionally, every group size is even, then the sum of seeds in each group is identical.

These conditions make standard group arrangements like 16 players in groups of 4 perfectly fair, provided the seeding is perfect.

```js
require('group')(16, 4)
[ [ 1, 5, 12, 16 ],
  [ 2, 6, 11, 15 ],
  [ 3, 7, 10, 14 ],
  [ 4, 8, 9, 13 ] ]
```

This model ensures that unusual results are directly caused by upsets (a presumed bad player beats a higher ranked one), not the fact that the top 4 players was in one group, causing lower ranked players to advance from the group stage without merit.

## Architechture
This whole library is essentially small tournament wrapper around the [group library](https://github.com/clux/group) and the [round robin library](https://github.com/clux/roundrobin). These are worth looking into for UI helpers or understanding.

## License
MIT-Licensed. See LICENSE file for details.
