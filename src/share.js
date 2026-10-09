// Share codes: a rulebook + build packed into a short URL-safe string. No accounts, no personal data.
import { validateRulebook } from './sim/rules.js';
import { validateBuild } from './sim/engine.js';

const KEYS = ['arrayKw', 'batteryKwh', 'shelterWaterKg', 'greenhouseModules', 'o2Days', 'waterDays', 'foodDays'];

function toB64Url(s) {
  const b64 = typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
}

export function encodeShare(build, rules) {
  const payload = {
    v: 1,
    b: KEYS.map((k) => build[k]),
    r: rules.map((r) => (r.value !== undefined ? [r.if, r.then, r.value] : [r.if, r.then])),
  };
  return toB64Url(JSON.stringify(payload));
}

export function decodeShare(code) {
  try {
    const p = JSON.parse(fromB64Url(String(code).trim()));
    if (p.v !== 1 || !Array.isArray(p.b) || !Array.isArray(p.r)) return null;
    const build = Object.fromEntries(KEYS.map((k, i) => [k, Number(p.b[i])]));
    const rules = p.r.map((x) => (x.length === 3 ? { if: x[0], then: x[1], value: Number(x[2]) } : { if: x[0], then: x[1] }));
    if (validateBuild(build).length || validateRulebook(rules).length) return null;
    return { build, rules };
  } catch {
    return null;
  }
}
