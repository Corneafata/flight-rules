import test from 'node:test';
import assert from 'node:assert/strict';
import { longNight } from '../src/data/longNight.js';
import { simulate, DEFAULT_BUILD, massBreakdown, validateBuild, sampleAt, arrayPowerKw, hourOf } from '../src/sim/engine.js';
import { validateRulebook, applyRules, DEFAULT_SYSTEMS } from '../src/sim/rules.js';
import { firstDomino, nightLength } from '../src/sim/debrief.js';
import { C, v } from '../src/sim/constants.js';
import { encodeShare, decodeShare } from '../src/share.js';

const GOOD_RULES = [
  { if: 'sunDown', then: 'greenhouseOff' },
  { if: 'sunDown', then: 'heatSurvival' },
  { if: 'batteryBelow', value: 40, then: 'scienceOff' },
  { if: 'stormOn', then: 'shelterIn' },
  { if: 'stormOff', then: 'shelterOut' },
];

test('data record matches the checksums taken at retrieval', () => {
  const m = longNight.meta.checksums;
  assert.equal(longNight.sunElevDeg.length, m.n);
  assert.equal(longNight.earthElevDeg.length, m.n);
  assert.equal(+longNight.sunElevDeg.reduce((a, b) => a + b, 0).toFixed(2), m.sunElevSum);
  assert.equal(+longNight.earthElevDeg.reduce((a, b) => a + b, 0).toFixed(1), m.earthElevSum);
});

test('Horizons record: sunset Sep 4 and sunrise Sep 19 2023 at the Vikram site (flat horizon)', () => {
  const n = nightLength(longNight);
  const set = new Date(Date.parse(longNight.epochUTC) + n.sunsetHour * 3600e3).toISOString().slice(0, 10);
  const rise = new Date(Date.parse(longNight.epochUTC) + n.sunriseHour * 3600e3).toISOString().slice(0, 10);
  assert.equal(set, '2023-09-04');
  assert.equal(rise, '2023-09-19');
  // ISRO put Vikram to sleep on Sep 4, before local sunset — consistent with this record.
  assert.ok(hourOf(longNight, '2023-09-04T03:00Z') < n.sunsetHour);
});

test('Earth stays above the horizon all mission (direct-to-Earth comms always possible here)', () => {
  for (let h = longNight.missionStartHour; h < longNight.missionEndHour; h++) {
    assert.ok(sampleAt(longNight.earthElevDeg, 6, h) > 9);
  }
});

test('array power: zero below the horizon, full disc gives cos(elevation)', () => {
  assert.equal(arrayPowerKw(10, -5), 0);
  assert.ok(Math.abs(arrayPowerKw(10, 10) - 10 * Math.cos((10 * Math.PI) / 180)) < 1e-9);
  assert.ok(arrayPowerKw(10, 0) > 0 && arrayPowerKw(10, 0) < 10);
});

test('mass budget: default build fits, oversized build is rejected', () => {
  assert.deepEqual(validateBuild(DEFAULT_BUILD), []);
  assert.ok(validateBuild({ ...DEFAULT_BUILD, batteryKwh: 1500, shelterWaterKg: 3000 }).some((e) => /mass budget/.test(e)));
  assert.ok(validateBuild({ ...DEFAULT_BUILD, arrayKw: -1 }).length > 0);
});

test('consumables use the published per-person rates', () => {
  const m = massBreakdown({ ...DEFAULT_BUILD, o2Days: 10, waterDays: 10, foodDays: 0 });
  assert.ok(Math.abs(m.parts.oxygen - 10 * 4 * 1.083) < 1e-9);
  assert.ok(Math.abs(m.parts.water - 10 * 4 * 2.5) < 1e-9);
});

test('simulation is deterministic', () => {
  const a = simulate(longNight, DEFAULT_BUILD, GOOD_RULES);
  const b = simulate(longNight, DEFAULT_BUILD, GOOD_RULES);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('energy is conserved each powered hour (battery never exceeds capacity or goes negative)', () => {
  const r = simulate(longNight, DEFAULT_BUILD, GOOD_RULES);
  for (const s of r.series) {
    assert.ok(s.batteryPct >= 0 && s.batteryPct <= 100 + 1e-9);
  }
});

test('core lesson: no rules -> lost in the night, debrief blames the greenhouse', () => {
  const r = simulate(longNight, DEFAULT_BUILD, []);
  assert.equal(r.outcome.status, 'lost');
  assert.equal(r.outcome.reason, 'power');
  assert.equal(firstDomino(r, longNight).domino, 'greenhouse');
});

test('core lesson: a sensible rulebook survives the identical record', () => {
  const r = simulate(longNight, DEFAULT_BUILD, GOOD_RULES);
  assert.equal(r.outcome.status, 'survived');
});

test('storm shelter lowers the crew dose', () => {
  const noShelter = simulate(longNight, DEFAULT_BUILD, GOOD_RULES.slice(0, 3));
  const shelter = simulate(longNight, DEFAULT_BUILD, GOOD_RULES);
  assert.ok(shelter.outcome.doseMSv < noShelter.outcome.doseMSv - 5);
});

test('battery too small for the night is reported as a build problem', () => {
  const r = simulate(longNight, { ...DEFAULT_BUILD, batteryKwh: 400 }, GOOD_RULES);
  assert.equal(r.outcome.status, 'lost');
  assert.equal(firstDomino(r, longNight).domino, 'build');
});

test('rules: higher rule wins when two set the same system', () => {
  const rules = [
    { if: 'sunDown', then: 'greenhouseOff' },
    { if: 'batteryAbove', value: 10, then: 'greenhouseOn' },
  ];
  const { systems } = applyRules(rules, { sunUp: false, batteryPct: 90 }, DEFAULT_SYSTEMS);
  assert.equal(systems.greenhouse, false);
});

test('rules: invalid rulebooks are rejected with reasons', () => {
  assert.equal(validateRulebook(GOOD_RULES).length, 0);
  assert.ok(validateRulebook([{ if: 'batteryBelow', value: 150, then: 'scienceOff' }]).length === 1);
  assert.ok(validateRulebook([{ if: 'nope', then: 'scienceOff' }]).length === 1);
  assert.ok(validateRulebook(new Array(7).fill(GOOD_RULES[0])).length >= 1);
});

test('share codes round-trip and reject garbage', () => {
  const code = encodeShare(DEFAULT_BUILD, GOOD_RULES);
  const back = decodeShare(code);
  assert.deepEqual(back.build, DEFAULT_BUILD);
  assert.deepEqual(back.rules, GOOD_RULES);
  assert.equal(decodeShare('!!!not-a-code'), null);
});

test('every constant carries a source and an honesty label', () => {
  for (const [k, c] of Object.entries(C)) {
    assert.ok(c.source, `${k} has no source`);
    assert.ok(['PUBLISHED', 'DERIVED', 'GAME ESTIMATE'].includes(c.label), `${k} has bad label`);
  }
  assert.equal(v('o2ActiveKgPerPersonDay'), 1.083);
});
