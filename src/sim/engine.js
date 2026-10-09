// Flight Rules simulator. Pure and deterministic: same record + build + rules => same result.
// No DOM, no clock, no randomness, so it runs identically in the browser and in Node tests.

import { v } from './constants.js';
import { applyRules, DEFAULT_SYSTEMS } from './rules.js';

export const DEFAULT_BUILD = {
  arrayKw: 12,
  batteryKwh: 900,
  shelterWaterKg: 1200,
  greenhouseModules: 1,
  o2Days: 34,
  waterDays: 34,
  foodDays: 34,
};

export const BUILD_LIMITS = {
  arrayKw: { min: 0, max: 40, step: 1, unit: 'kW' },
  batteryKwh: { min: 0, max: 1500, step: 50, unit: 'kWh' },
  shelterWaterKg: { min: 0, max: 3000, step: 100, unit: 'kg' },
  greenhouseModules: { min: 0, max: 3, step: 1, unit: 'modules' },
  o2Days: { min: 0, max: 60, step: 1, unit: 'days' },
  waterDays: { min: 0, max: 60, step: 1, unit: 'days' },
  foodDays: { min: 0, max: 60, step: 1, unit: 'days' },
};

export function massBreakdown(b) {
  const crew = v('crew');
  const parts = {
    array: b.arrayKw * v('arrayKgPerKw'),
    battery: (b.batteryKwh * 1000) / v('batteryWhPerKg'),
    shelter: b.shelterWaterKg,
    greenhouse: b.greenhouseModules * v('greenhouseModuleKg'),
    oxygen: b.o2Days * crew * v('o2ActiveKgPerPersonDay'),
    water: b.waterDays * crew * v('waterKgPerPersonDay'),
    food: b.foodDays * crew * v('foodKgPerPersonDay'),
  };
  const total = Object.values(parts).reduce((a, x) => a + x, 0);
  return { parts, total, budget: v('massBudgetKg'), over: total > v('massBudgetKg') + 1e-9 };
}

export function validateBuild(b) {
  const errs = [];
  for (const [k, lim] of Object.entries(BUILD_LIMITS)) {
    const x = b?.[k];
    if (!Number.isFinite(x)) errs.push(`${k} is missing`);
    else if (x < lim.min || x > lim.max) errs.push(`${k} must be ${lim.min}–${lim.max} ${lim.unit}`);
  }
  if (!errs.length && massBreakdown(b).over) errs.push('Cargo is over the mass budget');
  return errs;
}

// Linear interpolation of a series sampled every `step` hours.
export function sampleAt(series, step, hour) {
  const x = hour / step;
  const i = Math.floor(x);
  if (i < 0) return series[0];
  if (i >= series.length - 1) return series[series.length - 1];
  const f = x - i;
  return series[i] + (series[i + 1] - series[i]) * f;
}

export function hourOf(record, isoTime) {
  return (Date.parse(isoTime) - Date.parse(record.epochUTC)) / 3600000;
}

export function hourToDate(record, hour) {
  return new Date(Date.parse(record.epochUTC) + hour * 3600000);
}

// Fraction of the solar disc above the (flat) horizon.
export function sunVisibleFraction(elevDeg) {
  const r = v('sunDiscRadiusDeg');
  return Math.min(1, Math.max(0, (elevDeg + r) / (2 * r)));
}

// Power from a vertical, Sun-tracking array: incidence angle equals the Sun's elevation.
export function arrayPowerKw(arrayKw, elevDeg) {
  if (elevDeg <= -v('sunDiscRadiusDeg')) return 0;
  return arrayKw * Math.cos((Math.max(0, elevDeg) * Math.PI) / 180) * sunVisibleFraction(elevDeg);
}

function stormWindows(record) {
  const len = v('stormHours');
  const seps = record.solarEvents.filter((e) => e.type === 'SEP').map((e) => hourOf(record, e.timeUTC)).sort((a, b) => a - b);
  const wins = [];
  for (const t of seps) {
    const last = wins[wins.length - 1];
    if (last && t <= last.end) last.end = Math.max(last.end, t + len);
    else wins.push({ start: t, end: t + len });
  }
  return wins;
}

export function simulate(record, build, rules = []) {
  const crew = v('crew');
  const eff = v('chargeEfficiency');
  const start = record.missionStartHour;
  const end = record.missionEndHour;
  const storms = stormWindows(record);
  const shelterCover = Math.min(1, build.shelterWaterKg / v('shelterFullWallKg'));
  const shelterFactor = v('habitatShieldFactor') * (1 - (1 - v('shelterBestFactor')) * shelterCover);

  const capKwh = build.batteryKwh;
  const st = {
    batteryKwh: capKwh * 0.8,
    o2Kg: build.o2Days * crew * v('o2ActiveKgPerPersonDay'),
    waterKg: build.waterDays * crew * v('waterKgPerPersonDay'),
    foodKcal: build.foodDays * crew * v('foodKcalPerPersonDay'),
    doseMSv: 0,
    morale: 80,
    litHours: 0,
    blackoutRun: 0,
    starveRun: 0,
    scienceHours: 0,
    systems: { ...DEFAULT_SYSTEMS },
  };
  if (build.greenhouseModules === 0) st.systems.greenhouse = false;

  const series = [];
  const events = [];
  const energy = {}; // kWh delivered per system, split by day/night
  const addE = (sys, phase, kwh) => {
    energy[sys] ??= { day: 0, night: 0 };
    energy[sys][phase] += kwh;
  };
  const marks = new Set();
  const mark = (key, ev) => {
    if (marks.has(key)) return;
    marks.add(key);
    events.push(ev);
  };

  let prevSunUp = null;
  let prevStorm = false;
  let outcome = null;

  for (let h = start; h < end; h++) {
    const sunElev = sampleAt(record.sunElevDeg, record.stepHours, h + 0.5);
    const earthElev = sampleAt(record.earthElevDeg, record.stepHours, h + 0.5);
    const sunUp = sunElev > 0;
    const stormActive = storms.some((w) => h + 0.5 >= w.start && h + 0.5 < w.end);

    if (prevSunUp !== null && sunUp !== prevSunUp) {
      events.push({ h, kind: sunUp ? 'sunrise' : 'sunset', text: sunUp ? 'Sunrise: power returns' : 'Sunset: the long night begins', source: 'horizons' });
    }
    if (stormActive && !prevStorm) events.push({ h, kind: 'storm', text: 'Solar particle storm arrives (real event, Sep 1 2023)', source: 'donki' });
    if (!stormActive && prevStorm) events.push({ h, kind: 'stormEnd', text: 'Solar storm passes', source: 'donki' });
    prevSunUp = sunUp;
    prevStorm = stormActive;

    // --- sense ---
    const o2Rate = crew * (st.systems.exercise ? v('o2ActiveKgPerPersonDay') : v('o2RestKgPerPersonDay')); // kg/day
    const waterRate = crew * v('waterKgPerPersonDay');
    const foodRate = crew * v('foodKcalPerPersonDay') * (st.systems.ration ? v('rationFactor') : 1);
    const sense = {
      sunUp,
      stormActive,
      batteryPct: capKwh > 0 ? (100 * st.batteryKwh) / capKwh : 0,
      o2Days: st.o2Kg / o2Rate,
      waterDays: st.waterKg / waterRate,
      foodDays: st.foodKcal / foodRate,
    };

    // --- rules ---
    const { systems, fired } = applyRules(rules, sense, st.systems);
    if (build.greenhouseModules === 0) systems.greenhouse = false;
    for (const f of fired) {
      if (f.changed) events.push({ h, kind: 'rule', ruleIndex: f.index, text: `Rule ${f.index + 1} fired`, rule: f.rule });
    }
    st.systems = systems;

    // --- power ---
    const night = !sunUp;
    const phase = night ? 'night' : 'day';
    const heatKw = night ? (systems.heat === 'survival' ? v('loadHeatSurvivalKw') : v('loadHeatNightKw')) : v('loadHeatDayKw');
    const loads = {
      lifeSupport: v('loadLifeSupportKw'),
      comms: v('loadCommsKw'),
      heaters: heatKw,
      science: systems.science ? v('loadScienceKw') : 0,
      greenhouse: systems.greenhouse ? build.greenhouseModules * v('loadGreenhousePerModuleKw') : 0,
    };
    const loadKw = Object.values(loads).reduce((a, x) => a + x, 0);
    const genKw = arrayPowerKw(build.arrayKw, sunElev);
    let powered = true;
    const net = genKw - loadKw;
    if (net >= 0) {
      st.batteryKwh = Math.min(capKwh, st.batteryKwh + net * eff);
    } else if (st.batteryKwh >= -net) {
      st.batteryKwh += net;
    } else {
      st.batteryKwh = 0;
      powered = false;
    }
    if (powered) {
      for (const [k, kw] of Object.entries(loads)) addE(k, phase, kw);
      st.blackoutRun = 0;
    } else {
      st.blackoutRun += 1;
      mark(`blackout-${Math.floor(h / 24)}`, { h, kind: 'blackout', text: 'Blackout: batteries empty, life support and heaters lose power', source: 'sim' });
    }

    // --- thresholds ---
    const pct = capKwh > 0 ? (100 * st.batteryKwh) / capKwh : 0;
    for (const t of [50, 25, 10]) {
      if (pct < t) mark(`batt${t}`, { h, kind: 'battery', text: `Battery below ${t}%`, source: 'sim' });
    }

    // --- crew consumables ---
    st.o2Kg = Math.max(0, st.o2Kg - o2Rate / 24);
    st.waterKg = Math.max(0, st.waterKg - waterRate / 24);
    st.foodKcal = Math.max(0, st.foodKcal - foodRate / 24);
    if (powered && systems.greenhouse && build.greenhouseModules > 0) {
      st.litHours += 1;
      if (st.litHours >= v('greenhouseLitHoursToHarvest')) {
        st.foodKcal += (build.greenhouseModules * v('greenhouseKcalPerModuleDay')) / 24;
        mark('harvest', { h, kind: 'harvest', text: 'First greenhouse harvest', source: 'sim' });
      }
    }
    st.starveRun = st.foodKcal <= 0 ? st.starveRun + 1 : 0;
    for (const [k, days, label] of [['o2', st.o2Kg / o2Rate, 'Oxygen'], ['water', st.waterKg / waterRate, 'Water'], ['food', st.foodKcal / foodRate, 'Food']]) {
      if (days < 3 && h < end - 72) mark(`low-${k}`, { h, kind: 'supply', text: `${label} below 3 days`, source: 'sim' });
    }

    // --- radiation ---
    const protect = systems.shelter ? shelterFactor : v('habitatShieldFactor');
    let doseRate = (v('moonSurfaceDoseMSvPerDay') / 24) * protect;
    if (stormActive) doseRate += v('stormDoseMSvPerHour') * protect;
    st.doseMSv += doseRate;
    if (st.doseMSv > v('doseBudgetMSv')) mark('dose', { h, kind: 'dose', text: 'Crew passes the mission radiation budget', source: 'sim' });

    // --- morale & science ---
    let dm = 0.15;
    if (night && systems.heat === 'survival') dm = -0.2;
    if (systems.ration) dm -= 0.3;
    if (!systems.exercise) dm -= 0.15;
    if (systems.shelter) dm -= 0.1;
    if (!powered) dm -= 1;
    if (systems.science && powered) {
      dm += 0.05;
      st.scienceHours += 1;
    }
    st.morale = Math.min(100, Math.max(0, st.morale + dm));

    series.push({
      h,
      sunElev,
      earthElev,
      genKw,
      loadKw,
      batteryPct: pct,
      o2Days: st.o2Kg / o2Rate,
      waterDays: st.waterKg / waterRate,
      foodDays: st.foodKcal / foodRate,
      doseMSv: st.doseMSv,
      morale: st.morale,
      powered,
      stormActive,
      systems: { ...systems },
    });

    // --- failure checks ---
    let lost = null;
    if (st.blackoutRun >= v('blackoutHoursToLoss')) lost = { reason: 'power', text: 'Life support and heaters were without power for 6 hours. The crew had to abandon the outpost.' };
    else if (st.o2Kg <= 0) lost = { reason: 'oxygen', text: 'The oxygen supply ran out.' };
    else if (st.waterKg <= 0) lost = { reason: 'water', text: 'The water supply ran out.' };
    else if (st.starveRun >= v('starvationHoursToLoss')) lost = { reason: 'food', text: 'The crew went three days without food and had to abort.' };
    if (lost) {
      outcome = { status: 'lost', ...lost, atHour: h + 1 };
      events.push({ h, kind: 'lost', text: lost.text, source: 'sim' });
      break;
    }
  }

  if (!outcome) outcome = { status: 'survived', atHour: end, text: 'The crew made it through to sunrise.' };
  const last = series[series.length - 1];
  outcome.scienceHours = st.scienceHours;
  outcome.doseMSv = st.doseMSv;
  outcome.overDoseBudget = st.doseMSv > v('doseBudgetMSv');
  outcome.morale = st.morale;
  outcome.minBatteryPct = Math.min(...series.map((s) => s.batteryPct));
  outcome.finalBatteryPct = last ? last.batteryPct : 0;
  events.sort((a, b) => a.h - b.h);
  return { record: record.id, build: { ...build }, rules: rules.map((r) => ({ ...r })), series, events, energy, outcome };
}
