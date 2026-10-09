// Debrief: explains a flight in a few plain sentences and finds the "first domino" —
// the earliest decision that set the failure in motion. Pure functions over a simulate() result.

import { v } from './constants.js';
import { sampleAt } from './engine.js';

const SURVIVAL_NIGHT_KW = () => v('loadLifeSupportKw') + v('loadCommsKw') + v('loadHeatSurvivalKw');

// Sunset and next sunrise inside the mission window, read from the environment record itself
// (not from the flight), so the night length is right even when a flight ends early.
export function nightLength(record) {
  let sunsetHour = null;
  for (let h = record.missionStartHour; h < record.missionEndHour; h++) {
    const up = sampleAt(record.sunElevDeg, record.stepHours, h + 0.5) > 0;
    if (sunsetHour === null && !up) sunsetHour = h;
    if (sunsetHour !== null && up) return { sunsetHour, sunriseHour: h };
  }
  return sunsetHour === null ? null : { sunsetHour, sunriseHour: null };
}

export function firstDomino(result, record) {
  const o = result.outcome;
  const b = result.build;
  const s = result.series;
  const night = nightLength(record);
  const steps = [];

  if (o.status === 'survived') {
    const worst = s.reduce((m, x) => (x.batteryPct < m.batteryPct ? x : m), s[0]);
    const doseNote = o.overDoseBudget ? ` But the crew took ${o.doseMSv.toFixed(1)} mSv, over the ${v('doseBudgetMSv')} mSv budget — try the storm shelter.` : '';
    return {
      headline: 'Survived the long night',
      domino: null,
      chain: [`Closest call: the battery fell to ${worst.batteryPct.toFixed(0)}% on mission day ${Math.floor((worst.h - record.missionStartHour) / 24) + 1}.${doseNote}`],
      worstHour: worst.h,
    };
  }

  if (o.reason === 'power' && night) {
    const atSunset = s.find((x) => x.h === night.sunsetHour);
    const pctAtSunset = atSunset ? atSunset.batteryPct : 0;
    const nightHours = (night.sunriseHour ?? record.missionEndHour) - night.sunsetHour;
    const minNightKwh = SURVIVAL_NIGHT_KW() * nightHours;
    const e = result.energy;
    const nightUse = (k) => (e[k] ? e[k].night : 0);
    const heatExtra = Math.max(0, nightUse('heaters') - v('loadHeatSurvivalKw') * Math.min(nightHours, o.atHour - night.sunsetHour));
    const discretionary = [
      { key: 'greenhouse', kwh: nightUse('greenhouse'), fix: 'add a rule: IF the Sun has set THEN switch greenhouse lights OFF' },
      { key: 'science', kwh: nightUse('science'), fix: 'add a rule: IF battery is below 40% THEN pause science' },
      { key: 'normal heating', kwh: heatExtra, fix: 'add a rule: IF the Sun has set THEN set heaters to survival mode' },
    ].sort((a, b2) => b2.kwh - a.kwh);

    if (b.batteryKwh < minNightKwh) {
      return {
        headline: 'Lost in the dark',
        domino: 'build',
        chain: [
          `The night lasts about ${Math.round(nightHours)} hours. Even in survival mode the outpost needs about ${Math.round(minNightKwh)} kWh to get through it.`,
          `Your batteries hold ${b.batteryKwh} kWh, so no rule could save this build.`,
          'First domino: the batteries were too small. Trade some cargo for battery capacity.',
        ],
        worstHour: o.atHour,
      };
    }
    if (pctAtSunset < 90) {
      return {
        headline: 'Lost in the dark',
        domino: 'charge',
        chain: [
          `At sunset the battery was only ${pctAtSunset.toFixed(0)}% full.`,
          'Daytime loads used the sunlight that should have filled the batteries.',
          'First domino: too little solar array, or too many systems running in daylight.',
        ],
        worstHour: night.sunsetHour,
      };
    }
    const top = discretionary[0];
    return {
      headline: 'Lost in the dark',
      domino: top.key,
      chain: [
        `Sunset came with the battery ${pctAtSunset.toFixed(0)}% full.`,
        `During the night, ${top.key} used ${Math.round(top.kwh)} kWh that life support needed.`,
        `First domino: nothing switched ${top.key} down after sunset. To fix it, ${top.fix}.`,
      ],
      worstHour: o.atHour,
    };
  }

  const supply = { oxygen: 'oxygen', water: 'water', food: 'food' }[o.reason];
  if (supply) {
    steps.push(`The ${supply} ran out on mission day ${Math.floor((o.atHour - record.missionStartHour) / 24) + 1}.`);
    steps.push(`The mission lasts ${Math.round((record.missionEndHour - record.missionStartHour) / 24)} days. Pack more ${supply}${supply === 'food' ? ', grow it, or ration it' : supply === 'oxygen' ? ', or rest the crew to use less' : ''}.`);
    return { headline: `Out of ${supply}`, domino: supply, chain: steps, worstHour: o.atHour };
  }

  return { headline: 'Mission lost', domino: null, chain: [o.text], worstHour: o.atHour };
}
