// Flight Rules — UI. Talks to the pure simulator; holds no science of its own.
import { longNight } from './data/longNight.js';
import { C } from './sim/constants.js';
import { CONDITIONS, ACTIONS, MAX_RULES, validateRulebook, ruleText } from './sim/rules.js';
import { simulate, DEFAULT_BUILD, BUILD_LIMITS, massBreakdown, validateBuild, hourToDate, hourOf, sampleAt } from './sim/engine.js';
import { firstDomino, nightLength } from './sim/debrief.js';
import { encodeShare, decodeShare } from './share.js';

const REC = longNight;
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, val] of Object.entries(attrs)) {
    if (val === null || val === undefined || val === false) continue;
    if (k === 'class') n.className = val;
    else if (k === 'text') n.textContent = val;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), val);
    else n.setAttribute(k, val === true ? '' : val);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return n;
};
const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, val] of Object.entries(attrs)) if (val !== null && val !== undefined) n.setAttribute(k, val);
  for (const kid of kids.flat()) if (kid) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return n;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (h) => {
  const d = hourToDate(REC, h);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, '0')}:00 UTC`;
};
const fmtDay = (h) => {
  const d = hourToDate(REC, h);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const missionDay = (h) => Math.floor((h - REC.missionStartHour) / 24) + 1;

// ---------------- state ----------------
const STARTER_RULES = [
  { if: 'stormOn', then: 'shelterIn' },
  { if: 'stormOff', then: 'shelterOut' },
];
const state = {
  screen: 'intro',
  build: { ...DEFAULT_BUILD },
  rules: STARTER_RULES.map((r) => ({ ...r })),
  result: null,
  prev: null,
  flights: 0,
  play: { i: 0, timer: null, speed: 40 },
};

function saveLocal() {
  try {
    localStorage.setItem('flight-rules', JSON.stringify({ build: state.build, rules: state.rules }));
  } catch {}
}
function loadLocal() {
  try {
    const s = JSON.parse(localStorage.getItem('flight-rules') || 'null');
    if (s && !validateBuild(s.build).length && !validateRulebook(s.rules).length) {
      state.build = s.build;
      state.rules = s.rules;
    }
  } catch {}
}

// ---------------- navigation ----------------
const STEPS = [
  ['build', 'Build'],
  ['rules', 'Write rules'],
  ['fly', 'Fly'],
  ['debrief', 'Debrief'],
];
function go(screen) {
  stopPlay();
  state.screen = screen;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function renderNav() {
  const nav = $('#steps');
  nav.replaceChildren(
    ...STEPS.map(([id, label], i) => {
      const enabled = id === 'build' || id === 'rules' || (id === 'fly' && state.screen !== 'intro') || (id === 'debrief' && state.result);
      return el(
        'button',
        {
          class: 'step' + (state.screen === id ? ' on' : ''),
          'aria-current': state.screen === id ? 'step' : null,
          disabled: !enabled,
          onclick: () => (id === 'fly' ? startFlight() : go(id)),
        },
        el('span', { class: 'n', text: String(i + 1) }),
        el('span', { text: label }),
      );
    }),
  );
}

// ---------------- charts ----------------
const W = 1000;
function xOf(h) {
  return 48 + ((h - REC.missionStartHour) / (REC.missionEndHour - REC.missionStartHour)) * (W - 64);
}

function missionChart({ result = null, prev = null, playH = null, compact = false } = {}) {
  const sunTop = 26, sunH = compact ? 56 : 64;
  const batTop = sunTop + sunH + 26, batH = compact ? 0 : 150;
  const H = compact ? sunTop + sunH + 34 : batTop + batH + 34;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Mission timeline: real Sun elevation at the landing site, with battery charge from your flight' });
  const start = REC.missionStartHour, end = REC.missionEndHour;
  const night = nightLength(REC);
  const bottom = compact ? sunTop + sunH : batTop + batH;

  // night band (observed)
  if (night) {
    const x0 = xOf(night.sunsetHour), x1 = xOf(night.sunriseHour ?? end);
    s.append(svg('rect', { x: x0, y: sunTop - 6, width: x1 - x0, height: bottom - sunTop + 6, class: 'nightband' }));
    s.append(svg('text', { x: (x0 + x1) / 2, y: sunTop + sunH / 2 + 4, class: 'nightlabel', 'text-anchor': 'middle' }, `Lunar night · ${Math.round((night.sunriseHour - night.sunsetHour) / 24 * 10) / 10} Earth days`));
  }
  // storms (observed times)
  const storms = REC.solarEvents.filter((e) => e.type === 'SEP').map((e) => hourOf(REC, e.timeUTC));
  if (storms.length) {
    const t0 = Math.min(...storms), t1 = Math.max(...storms) + C.stormHours.value;
    s.append(svg('rect', { x: xOf(t0), y: sunTop - 6, width: xOf(t1) - xOf(t0), height: bottom - sunTop + 6, class: 'stormband' }));
    s.append(svg('text', { x: xOf(t1) + 4, y: bottom - 6, class: 'tick storm' }, 'Solar storm · DONKI'));
  }

  // sun strip
  const ymin = -25, ymax = 25;
  const ySun = (e) => sunTop + ((ymax - e) / (ymax - ymin)) * sunH;
  s.append(svg('line', { x1: 48, x2: W - 16, y1: ySun(0), y2: ySun(0), class: 'horizon' }));
  let d = '';
  for (let h = start; h <= end; h += 2) d += `${h === start ? 'M' : 'L'}${xOf(h).toFixed(1)} ${ySun(sampleAt(REC.sunElevDeg, REC.stepHours, h)).toFixed(1)}`;
  s.append(svg('path', { d, class: 'sunline' }));
  s.append(svg('text', { x: 44, y: ySun(0) + 4, class: 'tick', 'text-anchor': 'end' }, '0°'));
  s.append(svg('text', { x: 44, y: ySun(20) + 4, class: 'tick', 'text-anchor': 'end' }, '20°'));
  s.append(svg('text', { x: 52, y: sunTop - 10, class: 'axislabel' }, 'Sun elevation at the site · OBSERVED (JPL Horizons)'));

  // ghost markers (reported)
  for (const g of REC.ghost) {
    const h = hourOf(REC, g.timeUTC);
    if (h < start || h > end) continue;
    const x = xOf(h);
    const grp = svg('g', { class: 'ghost' });
    grp.append(svg('title', {}, `${g.label} (${fmtDay(h)}): ${g.detail} Source: ISRO.`));
    grp.append(svg('path', { d: `M${x} ${bottom + 6}l6 6l-6 6l-6 -6z` }));
    s.append(grp);
  }
  // date ticks
  for (let h = start; h <= end; h += 24) {
    if ((h - start) % 120 !== 0) continue;
    s.append(svg('text', { x: xOf(h), y: H - 4, class: 'tick', 'text-anchor': 'middle' }, fmtDay(h)));
  }
  s.append(svg('text', { x: W - 16, y: sunTop - 10, class: 'tick', 'text-anchor': 'end' }, '◆ = what Vikram did (ISRO)'));

  if (!compact) {
    const yB = (p) => batTop + ((100 - p) / 100) * batH;
    for (const p of [0, 50, 100]) {
      s.append(svg('line', { x1: 48, x2: W - 16, y1: yB(p), y2: yB(p), class: 'grid' }));
      s.append(svg('text', { x: 44, y: yB(p) + 4, class: 'tick', 'text-anchor': 'end' }, `${p}%`));
    }
    s.append(svg('text', { x: 52, y: batTop - 8, class: 'axislabel' }, 'Battery charge · SIMULATED from your build and rules'));
    const path = (series, upto) => {
      let dd = '';
      series.forEach((pt, i) => {
        if (upto !== null && pt.h > upto) return;
        dd += `${i ? 'L' : 'M'}${xOf(pt.h).toFixed(1)} ${yB(pt.batteryPct).toFixed(1)}`;
      });
      return dd;
    };
    if (prev) s.append(svg('path', { d: path(prev.series, null), class: 'prevline' }));
    if (result) {
      s.append(svg('path', { d: path(result.series, playH), class: 'battline' }));
      if (result.outcome.status === 'lost' && (playH === null || playH >= result.outcome.atHour - 1)) {
        const x = xOf(result.outcome.atHour);
        s.append(svg('line', { x1: x, x2: x, y1: batTop, y2: batTop + batH, class: 'lostline' }));
        s.append(svg('text', { x: x + 6, y: batTop + 14, class: 'tick lost' }, 'Mission lost'));
      }
    }
    if (prev) s.append(svg('text', { x: W - 16, y: batTop - 8, class: 'tick', 'text-anchor': 'end' }, '- - - previous flight'));
  }
  if (playH !== null) {
    const x = xOf(playH);
    s.append(svg('line', { x1: x, x2: x, y1: sunTop - 6, y2: bottom, class: 'playhead' }));
  }
  return el('div', { class: 'chartwrap' }, s);
}

// ---------------- screens ----------------
function infoTip(key) {
  const c = C[key];
  if (!c) return null;
  const tip = `${c.value} ${c.unit} · ${c.label} · ${c.source}`;
  return el('span', { class: 'tag ' + c.label.replace(' ', '-').toLowerCase(), title: tip, tabindex: 0, 'aria-label': tip }, c.label === 'GAME ESTIMATE' ? 'EST' : c.label === 'PUBLISHED' ? 'PUB' : 'DER');
}

function screenIntro() {
  const night = nightLength(REC);
  return el(
    'section',
    { class: 'intro' },
    el(
      'div',
      { class: 'introtext' },
      el('p', { class: 'eyebrow', text: 'Junior astronaut mission trainer' }),
      el('h1', {}, 'Write the rules', el('br'), 'before the night falls.'),
      el(
        'p',
        { class: 'lede' },
        'Real flight controllers decide what to do ',
        el('em', { text: 'before' }),
        ' trouble starts, and write those decisions down as flight rules. Here you do the same: pack an outpost, write up to six rules, then watch it live through what really happened at a real place on the Moon.',
      ),
      el('div', { class: 'cta' }, el('button', { class: 'primary', onclick: () => go('build') }, 'Start the mission'), el('button', { class: 'ghostbtn', onclick: () => go('sources') }, 'Where the data comes from')),
    ),
    el(
      'article',
      { class: 'missioncard' },
      el('p', { class: 'eyebrow', text: 'Mission 1 · Moon' }),
      el('h2', { text: REC.name }),
      el('p', { class: 'sitename' }, `${REC.site.name}, ${Math.abs(REC.site.lat)}° S, ${REC.site.lonE}° E`),
      el(
        'dl',
        { class: 'facts' },
        el('div', {}, el('dt', { text: 'Window' }), el('dd', { text: `${fmtDay(REC.missionStartHour)} – ${fmtDay(REC.missionEndHour)}, 2023` })),
        el('div', {}, el('dt', { text: 'Crew' }), el('dd', { text: `${C.crew.value} astronauts` })),
        el('div', {}, el('dt', { text: 'Sunset' }), el('dd', { text: fmtDate(night.sunsetHour) })),
        el('div', {}, el('dt', { text: 'Night' }), el('dd', { text: `${Math.round(night.sunriseHour - night.sunsetHour)} hours of darkness` })),
      ),
      missionChart({ compact: true }),
      el('p', { class: 'small', text: 'In 2023, India\'s Vikram lander worked here for one lunar day, slept through the night, and never woke up. Can your crew last until sunrise?' }),
    ),
  );
}

function screenBuild() {
  const m = massBreakdown(state.build);
  const rows = [
    ['arrayKw', 'Solar array', 'Sun-tracking panels. More panels charge the batteries faster.', 'arrayKgPerKw'],
    ['batteryKwh', 'Batteries', 'Your only power at night.', 'batteryWhPerKg'],
    ['shelterWaterKg', 'Storm shelter water wall', 'Water blocks solar storm particles.', 'shelterBestFactor'],
    ['greenhouseModules', 'Greenhouse modules', 'Grows food, but its lights use a lot of power.', 'greenhouseKcalPerModuleDay'],
    ['o2Days', 'Oxygen supply', `${C.o2ActiveKgPerPersonDay.value} kg per person per day.`, 'o2ActiveKgPerPersonDay'],
    ['waterDays', 'Water supply', `${C.waterKgPerPersonDay.value} kg per person per day.`, 'waterKgPerPersonDay'],
    ['foodDays', 'Food supply', `${C.foodKcalPerPersonDay.value.toLocaleString()} kcal per person per day.`, 'foodKcalPerPersonDay'],
  ];
  const partKey = { arrayKw: 'array', batteryKwh: 'battery', shelterWaterKg: 'shelter', greenhouseModules: 'greenhouse', o2Days: 'oxygen', waterDays: 'water', foodDays: 'food' };
  const missionDays = Math.round((REC.missionEndHour - REC.missionStartHour) / 24);
  const pct = Math.min(100, (m.total / m.budget) * 100);
  return el(
    'section',
    { class: 'build' },
    el('header', { class: 'screenhead' }, el('h2', { text: 'Pack the lander' }), el('p', { text: `Everything has to fit in ${m.budget.toLocaleString()} kg. The mission lasts about ${missionDays} days, and about half of that is night.` })),
    el(
      'div',
      { id: 'massbar', class: 'massbar' + (m.over ? ' over' : ''), role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': m.budget, 'aria-valuenow': Math.round(m.total), 'aria-label': 'Cargo mass' },
      el('div', { class: 'fill', style: `width:${pct}%` }),
      el('span', { class: 'masstext', text: `${Math.round(m.total).toLocaleString()} kg of ${m.budget.toLocaleString()} kg${m.over ? ' — too heavy to launch' : ''}` }),
    ),
    el(
      'div',
      { class: 'sliders' },
      ...rows.map(([k, name, help, ck]) => {
        const lim = BUILD_LIMITS[k];
        const id = `b-${k}`;
        return el(
          'div',
          { class: 'slider' },
          el('label', { for: id }, el('span', { class: 'sname', text: name }), infoTip(ck)),
          el('output', { for: id, id: `out-${k}`, class: 'sval', text: `${state.build[k]} ${lim.unit}` }),
          el('input', {
            id,
            type: 'range',
            min: lim.min,
            max: lim.max,
            step: lim.step,
            value: state.build[k],
            oninput: (e) => {
              state.build[k] = Number(e.target.value);
              saveLocal();
              updateBuildReadouts();
            },
          }),
          el('p', { class: 'shelp' }, help, ' ', el('span', { class: 'kg', id: `kg-${k}`, text: `${Math.round(m.parts[partKey[k]]).toLocaleString()} kg` })),
        );
      }),
    ),
    el('div', { class: 'next' }, el('button', { id: 'build-next', class: 'primary', disabled: m.over, onclick: () => go('rules') }, m.over ? 'Too heavy: remove some cargo' : 'Next: write your flight rules')),
  );
}

const PART_KEY = { arrayKw: 'array', batteryKwh: 'battery', shelterWaterKg: 'shelter', greenhouseModules: 'greenhouse', o2Days: 'oxygen', waterDays: 'water', foodDays: 'food' };
function updateBuildReadouts() {
  const m = massBreakdown(state.build);
  for (const k of Object.keys(PART_KEY)) {
    const out = document.getElementById(`out-${k}`);
    if (out) out.textContent = `${state.build[k]} ${BUILD_LIMITS[k].unit}`;
    const kg = document.getElementById(`kg-${k}`);
    if (kg) kg.textContent = `${Math.round(m.parts[PART_KEY[k]]).toLocaleString()} kg`;
  }
  const bar = $('#massbar');
  bar.classList.toggle('over', m.over);
  bar.setAttribute('aria-valuenow', Math.round(m.total));
  $('.fill', bar).style.width = `${Math.min(100, (m.total / m.budget) * 100)}%`;
  $('.masstext', bar).textContent = `${Math.round(m.total).toLocaleString()} kg of ${m.budget.toLocaleString()} kg${m.over ? ' — too heavy to launch' : ''}`;
  const nb = $('#build-next');
  nb.disabled = m.over;
  nb.textContent = m.over ? 'Too heavy: remove some cargo' : 'Next: write your flight rules';
}

function ruleCard(rule, i) {
  const c = CONDITIONS[rule.if];
  const condSel = el(
    'select',
    {
      id: `r${i}-if`,
      'aria-label': `Rule ${i + 1} condition`,
      onchange: (e) => {
        rule.if = e.target.value;
        const nc = CONDITIONS[rule.if];
        if (nc.needsValue) rule.value = rule.value ?? nc.def;
        else delete rule.value;
        saveLocal();
        render();
      },
    },
    ...Object.entries(CONDITIONS).map(([k, x]) => el('option', { value: k, selected: k === rule.if }, x.text)),
  );
  const valInput = c.needsValue
    ? el('span', { class: 'valwrap' }, el('input', {
        id: `r${i}-val`, type: 'number', min: c.min, max: c.max, value: rule.value, 'aria-label': `Rule ${i + 1} number`,
        onchange: (e) => { rule.value = Number(e.target.value); saveLocal(); render(); },
      }), el('span', { class: 'unit', text: c.unit }))
    : null;
  const actSel = el(
    'select',
    { id: `r${i}-then`, 'aria-label': `Rule ${i + 1} action`, onchange: (e) => { rule.then = e.target.value; saveLocal(); render(); } },
    ...Object.entries(ACTIONS).map(([k, x]) => el('option', { value: k, selected: k === rule.then }, x.text)),
  );
  const move = (d) => {
    const j = i + d;
    if (j < 0 || j >= state.rules.length) return;
    [state.rules[i], state.rules[j]] = [state.rules[j], state.rules[i]];
    saveLocal();
    render();
  };
  return el(
    'li',
    { class: 'rulecard', 'data-rule': i },
    el('span', { class: 'rnum', text: String(i + 1).padStart(2, '0') }),
    el('div', { class: 'rbody' }, el('span', { class: 'kw', text: 'IF' }), condSel, valInput, el('span', { class: 'kw', text: 'THEN' }), actSel),
    el(
      'div',
      { class: 'rtools' },
      el('button', { class: 'icon', 'aria-label': `Move rule ${i + 1} up`, disabled: i === 0, onclick: () => move(-1) }, '↑'),
      el('button', { class: 'icon', 'aria-label': `Move rule ${i + 1} down`, disabled: i === state.rules.length - 1, onclick: () => move(1) }, '↓'),
      el('button', { class: 'icon', 'aria-label': `Delete rule ${i + 1}`, onclick: () => { state.rules.splice(i, 1); saveLocal(); render(); } }, '×'),
    ),
  );
}

function screenRules() {
  const errs = validateRulebook(state.rules);
  const hints = [
    { if: 'sunDown', then: 'greenhouseOff' },
    { if: 'sunDown', then: 'heatSurvival' },
    { if: 'batteryBelow', value: 40, then: 'scienceOff' },
    { if: 'batteryAbove', value: 70, then: 'scienceOn' },
  ].filter((h) => !state.rules.some((r) => r.if === h.if && r.then === h.then));
  return el(
    'section',
    { class: 'rules' },
    el(
      'header',
      { class: 'screenhead' },
      el('h2', { text: 'Write your flight rules' }),
      el('p', { text: 'Every hour the outpost reads your rules from top to bottom. If a rule is true, it acts. If two rules switch the same system, the higher one wins. A system stays as it is until a rule changes it.' }),
    ),
    el(
      'div',
      { class: 'binder' },
      el('div', { class: 'binderhead' }, el('span', { text: 'FLIGHT RULES' }), el('span', { text: `${REC.name.toUpperCase()} · ${state.rules.length}/${MAX_RULES}` })),
      state.rules.length
        ? el('ol', { class: 'rulelist' }, ...state.rules.map(ruleCard))
        : el('p', { class: 'empty', text: 'No rules yet. Without rules, every system stays on all mission long.' }),
      el(
        'div',
        { class: 'addrow' },
        el('button', {
          class: 'secondary',
          disabled: state.rules.length >= MAX_RULES,
          onclick: () => { state.rules.push({ if: 'batteryBelow', value: 30, then: 'scienceOff' }); saveLocal(); render(); },
        }, state.rules.length >= MAX_RULES ? 'Rulebook full (6 rules)' : '+ Add a rule'),
      ),
    ),
    hints.length && state.flights > 0 && state.rules.length < MAX_RULES
      ? el('div', { class: 'hints' }, el('p', { class: 'eyebrow', text: 'Ideas from other flight controllers' }), ...hints.slice(0, 3).map((h) => el('button', { class: 'hint', onclick: () => { state.rules.push({ ...h }); saveLocal(); render(); } }, '+ ', ruleText(h))))
      : null,
    errs.length ? el('ul', { class: 'errors', role: 'alert' }, ...errs.map((e) => el('li', { text: e }))) : null,
    el('div', { class: 'next' }, el('button', { class: 'ghostbtn', onclick: () => go('build') }, 'Back to packing'), el('button', { class: 'primary', disabled: errs.length > 0, onclick: startFlight }, state.flights ? 'Fly the same record again' : 'Fly the mission')),
  );
}

// ---------------- flight ----------------
function startFlight() {
  if (validateBuild(state.build).length) return go('build');
  if (validateRulebook(state.rules).length) return go('rules');
  if (state.result) state.prev = state.result;
  state.result = simulate(REC, state.build, state.rules);
  state.flights += 1;
  state.play.i = 0;
  state.screen = 'fly';
  render();
  window.scrollTo({ top: 0 });
  resumePlay();
}
function stopPlay() {
  if (state.play.timer) clearInterval(state.play.timer);
  state.play.timer = null;
}
function resumePlay() {
  stopPlay();
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const stepPer = reduce ? 6 : 1;
  state.play.timer = setInterval(() => {
    const n = state.result.series.length;
    state.play.i = Math.min(n - 1, state.play.i + stepPer);
    updateFly();
    if (state.play.i >= n - 1) {
      stopPlay();
      updateFly(true);
    }
  }, state.play.speed);
}

const SYS_LABELS = {
  greenhouse: ['Greenhouse', (x) => (x ? 'ON' : 'OFF')],
  science: ['Science', (x) => (x ? 'ON' : 'PAUSED')],
  heat: ['Heaters', (x) => (x === 'normal' ? 'NORMAL' : 'SURVIVAL')],
  shelter: ['Crew', (x) => (x ? 'IN SHELTER' : 'IN HABITAT')],
  exercise: ['Exercise', (x) => (x ? 'ON' : 'REST')],
  ration: ['Rations', (x) => (x ? 'REDUCED' : 'FULL')],
};

function screenFly() {
  return el(
    'section',
    { class: 'fly' },
    el(
      'header',
      { class: 'flyhead' },
      el('div', {}, el('p', { class: 'eyebrow', id: 'fly-day', text: '' }), el('h2', { id: 'fly-date', text: '' })),
      el(
        'div',
        { class: 'controls', role: 'group', 'aria-label': 'Playback' },
        el('button', { id: 'pp', class: 'secondary', onclick: () => (state.play.timer ? (stopPlay(), updateFly()) : resumePlay()) }, 'Pause'),
        el(
          'select',
          { id: 'speed', 'aria-label': 'Playback speed', onchange: (e) => { state.play.speed = Number(e.target.value); if (state.play.timer) resumePlay(); } },
          ...[[80, 'Slow'], [40, 'Normal'], [12, 'Fast']].map(([ms, t]) => el('option', { value: ms, selected: ms === state.play.speed }, t)),
        ),
        el('button', { class: 'secondary', onclick: () => { state.play.i = state.result.series.length - 1; stopPlay(); updateFly(true); } }, 'Skip to end'),
      ),
    ),
    el('div', { id: 'fly-chart' }),
    el(
      'div',
      { class: 'flygrid' },
      el('div', { class: 'gauges', id: 'gauges' }),
      el('div', { class: 'side' }, el('h3', { text: 'Your rulebook' }), el('ol', { class: 'minirules', id: 'minirules' }, ...state.rules.map((r, i) => el('li', { 'data-rule': i }, el('span', { class: 'rnum', text: String(i + 1).padStart(2, '0') }), ruleText(r)))), state.rules.length ? null : el('p', { class: 'small', text: 'No rules: every system stays on.' }), el('h3', { text: 'Systems' }), el('div', { class: 'systems', id: 'systems' })),
    ),
    el('div', { class: 'logwrap' }, el('h3', { text: 'Mission log' }), el('ol', { class: 'log', id: 'log', 'aria-live': 'polite' })),
    el('div', { class: 'next', id: 'fly-next', hidden: true }, el('button', { class: 'primary', onclick: () => go('debrief') }, 'Open the debrief')),
  );
}

function gauge(label, value, unit, pct, status, note) {
  return el(
    'div',
    { class: `gauge ${status}` },
    el('span', { class: 'glabel', text: label }),
    el('span', { class: 'gval' }, el('b', { text: value }), ' ', unit),
    el('span', { class: 'gbar' }, el('span', { style: `width:${Math.max(0, Math.min(100, pct))}%` })),
    el('span', { class: 'gnote', text: `${note} · ${status === 'crit' ? 'critical' : status === 'warn' ? 'watch' : 'ok'}` }),
  );
}

function updateFly(done = false) {
  const r = state.result;
  const i = state.play.i;
  const p = r.series[i];
  if (!p) return;
  $('#fly-day').textContent = `Mission day ${missionDay(p.h)} · ${p.sunElev > 0 ? 'Sun up' : 'Night'}${p.stormActive ? ' · Solar storm' : ''}`;
  $('#fly-date').textContent = fmtDate(p.h);
  $('#fly-chart').replaceChildren(missionChart({ result: r, prev: state.prev, playH: p.h }));
  const lvl = (x, warn, crit) => (x <= crit ? 'crit' : x <= warn ? 'warn' : 'ok');
  const budget = C.doseBudgetMSv.value;
  $('#gauges').replaceChildren(
    gauge('Battery', p.batteryPct.toFixed(0), '%', p.batteryPct, lvl(p.batteryPct, 30, 10), `${state.build.batteryKwh} kWh capacity`),
    gauge('Power in / out', `${p.genKw.toFixed(1)} / ${p.loadKw.toFixed(1)}`, 'kW', (p.genKw / Math.max(p.loadKw, 0.1)) * 50, p.powered ? (p.genKw >= p.loadKw ? 'ok' : 'warn') : 'crit', p.powered ? 'solar vs. load' : 'BLACKOUT'),
    gauge('Oxygen', p.o2Days.toFixed(1), 'days left', (p.o2Days / 30) * 100, lvl(p.o2Days, 5, 2), 'at current use'),
    gauge('Water', p.waterDays.toFixed(1), 'days left', (p.waterDays / 30) * 100, lvl(p.waterDays, 5, 2), 'at current use'),
    gauge('Food', p.foodDays.toFixed(1), 'days left', (p.foodDays / 30) * 100, lvl(p.foodDays, 5, 2), 'at current use'),
    gauge('Crew dose', p.doseMSv.toFixed(1), 'mSv', (p.doseMSv / budget) * 100, p.doseMSv > budget ? 'crit' : p.doseMSv > budget * 0.8 ? 'warn' : 'ok', `budget ${budget} mSv`),
    gauge('Morale', p.morale.toFixed(0), '/ 100', p.morale, lvl(p.morale, 35, 15), 'cold and cramps lower it'),
  );
  $('#systems').replaceChildren(
    ...Object.entries(SYS_LABELS).map(([k, [name, fmt]]) => {
      const val = p.systems[k];
      const isDefault = { greenhouse: true, science: true, heat: 'normal', shelter: false, exercise: true, ration: false }[k] === val;
      return el('div', { class: 'sys' + (isDefault ? '' : ' changed') }, el('span', { text: name }), el('b', { text: k === 'greenhouse' && state.build.greenhouseModules === 0 ? 'NONE' : fmt(val) }));
    }),
  );
  // rule flashes this hour
  const firedNow = new Set(r.events.filter((e) => e.kind === 'rule' && e.h === p.h).map((e) => e.ruleIndex));
  document.querySelectorAll('#minirules li').forEach((li) => li.classList.toggle('fired', firedNow.has(Number(li.dataset.rule))));
  // log
  const shown = r.events.filter((e) => e.h <= p.h);
  const log = $('#log');
  if (log.childElementCount !== shown.length) {
    log.replaceChildren(
      ...shown.slice().reverse().map((e) =>
        el(
          'li',
          { class: `ev ${e.kind}` },
          el('time', { text: fmtDate(e.h) }),
          el('span', { text: e.kind === 'rule' ? `Rule ${e.ruleIndex + 1}: ${ruleText(e.rule)}` : e.text }),
          el('span', { class: 'src', text: { horizons: 'OBSERVED', donki: 'OBSERVED', sim: 'SIMULATED' }[e.source] || 'YOUR RULE' }),
        ),
      ),
    );
  }
  const pp = $('#pp');
  if (pp) pp.textContent = state.play.timer ? 'Pause' : 'Play';
  if (done || i >= r.series.length - 1) {
    $('#fly-next').hidden = false;
    if (pp) pp.disabled = true;
  }
}

// ---------------- debrief ----------------
function screenDebrief() {
  const r = state.result;
  const d = firstDomino(r, REC);
  const o = r.outcome;
  const code = encodeShare(state.build, state.rules);
  const survivedHours = o.atHour - REC.missionStartHour;
  const ghostSleep = REC.ghost.find((g) => g.label === 'Vikram sleeps');
  const stat = (label, value, sub) => el('div', { class: 'stat' }, el('span', { class: 'glabel', text: label }), el('b', { text: value }), el('span', { class: 'gnote', text: sub }));
  return el(
    'section',
    { class: 'debrief' },
    el(
      'header',
      { class: 'screenhead verdict ' + o.status },
      el('p', { class: 'eyebrow', text: `Flight ${state.flights} debrief` }),
      el('h2', { text: d.headline }),
      el('p', { text: o.status === 'survived' ? `Your crew lasted all ${Math.round(survivedHours / 24)} days and saw the Sun come back.` : `${o.text} That was ${fmtDate(o.atHour)}, day ${missionDay(o.atHour)} of ${Math.round((REC.missionEndHour - REC.missionStartHour) / 24)}.` }),
    ),
    el(
      'div',
      { class: 'dominos' },
      el('h3', { text: o.status === 'survived' ? 'How close it was' : 'What knocked it over' }),
      el('ol', { class: 'chain' }, ...d.chain.map((c) => el('li', { text: c }))),
    ),
    missionChart({ result: r, prev: state.prev, playH: null }),
    el(
      'div',
      { class: 'stats' },
      stat('Science done', `${o.scienceHours} h`, 'instrument hours'),
      stat('Crew dose', `${o.doseMSv.toFixed(1)} mSv`, o.overDoseBudget ? `over the ${C.doseBudgetMSv.value} mSv budget` : `within the ${C.doseBudgetMSv.value} mSv budget`),
      stat('Lowest battery', `${o.minBatteryPct.toFixed(0)}%`, 'closest call'),
      stat('Morale', `${o.morale.toFixed(0)} / 100`, 'at the end'),
    ),
    el(
      'aside',
      { class: 'ghostnote' },
      el('h3', { text: 'What really happened here' }),
      el('p', {}, `ISRO put Vikram to sleep on ${fmtDay(hourOf(REC, ghostSleep.timeUTC))}, about ${Math.round(nightLength(REC).sunsetHour - hourOf(REC, ghostSleep.timeUTC))} hours before local sunset. It was built for one lunar day. When ISRO tried to wake it on Sep 22, after the Sun returned, it did not answer. Your outpost had to stay awake and keep four people warm through the same night.`),
    ),
    el(
      'div',
      { class: 'share' },
      el('h3', { text: 'Share this rulebook' }),
      el('p', { class: 'small', text: 'Paste this code into another browser to fly the same build and rules. It holds no names or personal data.' }),
      el('div', { class: 'coderow' }, el('input', { id: 'sharecode', readonly: true, value: code, 'aria-label': 'Share code' }), el('button', { class: 'secondary', onclick: copyCode }, 'Copy')),
      el('div', { class: 'coderow' }, el('input', { id: 'loadcode', placeholder: 'Paste a classmate\'s code', 'aria-label': 'Load a share code' }), el('button', { class: 'secondary', onclick: loadCode }, 'Load')),
      el('p', { class: 'small', id: 'codemsg', role: 'status' }),
    ),
    el('div', { class: 'next' }, el('button', { class: 'ghostbtn', onclick: () => go('build') }, 'Change the cargo'), el('button', { class: 'primary', onclick: () => go('rules') }, 'Edit rules and fly again')),
  );
}
async function copyCode() {
  const inp = $('#sharecode');
  try {
    await navigator.clipboard.writeText(inp.value);
    $('#codemsg').textContent = 'Copied.';
  } catch {
    inp.select();
    $('#codemsg').textContent = 'Select the code and copy it with your keyboard.';
  }
}
function loadCode() {
  const got = decodeShare($('#loadcode').value);
  if (!got) {
    $('#codemsg').textContent = 'That code is not valid. Check that you pasted all of it.';
    return;
  }
  state.build = got.build;
  state.rules = got.rules;
  saveLocal();
  $('#codemsg').textContent = 'Loaded. Open "Write rules" to see them, then fly.';
}

// ---------------- sources ----------------
function screenSources() {
  const rows = Object.entries(C).map(([k, c]) =>
    el('tr', {}, el('td', { text: k }), el('td', { class: 'num', text: `${c.value} ${c.unit}` }), el('td', {}, el('span', { class: 'tag ' + c.label.replace(' ', '-').toLowerCase(), text: c.label })), el('td', {}, c.url ? el('a', { href: c.url, target: '_blank', rel: 'noopener' }, c.source) : c.source)),
  );
  return el(
    'section',
    { class: 'sources' },
    el('header', { class: 'screenhead' }, el('h2', { text: 'Where every number comes from' }), el('p', { text: 'The environment is real. The outpost is a simplified model. Every number is labelled so you can tell which is which.' })),
    el(
      'div',
      { class: 'legend' },
      el('p', {}, el('span', { class: 'tag observed', text: 'OBSERVED' }), ' measured or computed by a space agency for the real dates and place'),
      el('p', {}, el('span', { class: 'tag published', text: 'PUBLISHED' }), ' a value from a cited NASA standard or science paper'),
      el('p', {}, el('span', { class: 'tag derived', text: 'DERIVED' }), ' worked out from published values or physics'),
      el('p', {}, el('span', { class: 'tag game-estimate', text: 'GAME ESTIMATE' }), ' chosen to make the game playable; a sensible size, not a design value'),
      el('p', {}, el('span', { class: 'tag simulated', text: 'SIMULATED' }), ' what the model computes from your build and rules'),
    ),
    el('h3', { text: 'Environment record: ' + REC.name }),
    el('ul', { class: 'srclist' }, ...REC.meta.sources.map((s) => el('li', {}, el('span', { class: 'tag observed', text: s.label }), ' ', el('b', { text: `${s.agency}: ` }), el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name), el('br'), el('span', { class: 'small', text: s.notes })))),
    el('p', { class: 'small', text: `Retrieved ${REC.meta.retrievedUTC}. Sun and Earth elevations are 6-hourly Horizons values, interpolated to hours (max error 0.011°).` }),
    el('h3', { text: 'Model constants' }),
    el('div', { class: 'tablewrap' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Name' }), el('th', { text: 'Value' }), el('th', { text: 'Label' }), el('th', { text: 'Source' }))), el('tbody', {}, ...rows))),
    el('div', { class: 'next' }, el('button', { class: 'primary', onclick: () => go(state.result ? 'debrief' : 'intro') }, 'Back')),
  );
}

// ---------------- render ----------------
function render() {
  renderNav();
  const main = $('#main');
  const screens = { intro: screenIntro, build: screenBuild, rules: screenRules, fly: screenFly, debrief: screenDebrief, sources: screenSources };
  main.replaceChildren(screens[state.screen]());
  if (state.screen === 'fly') updateFly();
}

loadLocal();
$('#brand').addEventListener('click', () => go('intro'));
$('#srcbtn').addEventListener('click', () => go('sources'));
render();
