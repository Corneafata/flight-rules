// Flight-rule grammar: IF <condition> THEN <action>.
// Rules are checked every simulated hour from top to bottom. A rule whose condition is true
// applies its action. If two true rules set the same system, the higher rule wins.
// Systems keep their last setting until a rule changes it ("latched"), like real switches.

export const CONDITIONS = {
  sunDown: { text: 'the Sun has set', needsValue: false, test: (s) => !s.sunUp },
  sunUp: { text: 'the Sun is up', needsValue: false, test: (s) => s.sunUp },
  stormOn: { text: 'a solar storm is underway', needsValue: false, test: (s) => s.stormActive },
  stormOff: { text: 'no solar storm is underway', needsValue: false, test: (s) => !s.stormActive },
  batteryBelow: { text: 'battery is below', needsValue: true, unit: '%', min: 1, max: 99, def: 30, test: (s, x) => s.batteryPct < x },
  batteryAbove: { text: 'battery is above', needsValue: true, unit: '%', min: 1, max: 99, def: 60, test: (s, x) => s.batteryPct > x },
  foodDaysBelow: { text: 'food left is under', needsValue: true, unit: 'days', min: 1, max: 60, def: 5, test: (s, x) => s.foodDays < x },
  o2DaysBelow: { text: 'oxygen left is under', needsValue: true, unit: 'days', min: 1, max: 60, def: 5, test: (s, x) => s.o2Days < x },
};

// Each action sets one system to one setting.
export const ACTIONS = {
  greenhouseOff: { text: 'switch greenhouse lights OFF', system: 'greenhouse', setting: false },
  greenhouseOn: { text: 'switch greenhouse lights ON', system: 'greenhouse', setting: true },
  scienceOff: { text: 'pause science', system: 'science', setting: false },
  scienceOn: { text: 'resume science', system: 'science', setting: true },
  heatSurvival: { text: 'set heaters to survival mode', system: 'heat', setting: 'survival' },
  heatNormal: { text: 'set heaters to normal', system: 'heat', setting: 'normal' },
  shelterIn: { text: 'move crew into the storm shelter', system: 'shelter', setting: true },
  shelterOut: { text: 'let crew leave the shelter', system: 'shelter', setting: false },
  restOn: { text: 'cancel exercise (rest days)', system: 'exercise', setting: false },
  restOff: { text: 'resume exercise', system: 'exercise', setting: true },
  rationOn: { text: 'reduce food rations', system: 'ration', setting: true },
  rationOff: { text: 'return to full rations', system: 'ration', setting: false },
};

export const DEFAULT_SYSTEMS = {
  greenhouse: true,
  science: true,
  heat: 'normal',
  shelter: false,
  exercise: true,
  ration: false,
};

export const MAX_RULES = 6;

export function validateRule(rule) {
  const c = CONDITIONS[rule?.if];
  const a = ACTIONS[rule?.then];
  if (!c) return `Unknown condition "${rule?.if}"`;
  if (!a) return `Unknown action "${rule?.then}"`;
  if (c.needsValue) {
    const x = Number(rule.value);
    if (!Number.isFinite(x)) return 'Pick a number for this rule';
    if (x < c.min || x > c.max) return `Number must be between ${c.min} and ${c.max} ${c.unit}`;
  }
  return null;
}

export function validateRulebook(rules) {
  if (!Array.isArray(rules)) return ['Rulebook must be a list'];
  const errs = [];
  if (rules.length > MAX_RULES) errs.push(`At most ${MAX_RULES} rules`);
  rules.forEach((r, i) => {
    const e = validateRule(r);
    if (e) errs.push(`Rule ${i + 1}: ${e}`);
  });
  return errs;
}

// Returns { systems, fired: [{index, rule, changed}] } for this hour.
export function applyRules(rules, sense, systems) {
  const next = { ...systems };
  const claimed = new Set();
  const fired = [];
  rules.forEach((rule, index) => {
    const c = CONDITIONS[rule.if];
    const a = ACTIONS[rule.then];
    if (!c || !a) return;
    if (!c.test(sense, Number(rule.value))) return;
    if (claimed.has(a.system)) return; // a higher rule already set this system this hour
    claimed.add(a.system);
    const changed = next[a.system] !== a.setting;
    next[a.system] = a.setting;
    fired.push({ index, rule, changed });
  });
  return { systems: next, fired };
}

export function ruleText(rule) {
  const c = CONDITIONS[rule.if];
  const a = ACTIONS[rule.then];
  if (!c || !a) return 'Incomplete rule';
  const cond = c.needsValue ? `${c.text} ${rule.value}${c.unit === '%' ? '%' : ' ' + c.unit}` : c.text;
  return `IF ${cond} THEN ${a.text}`;
}
