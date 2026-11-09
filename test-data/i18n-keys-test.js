// test-data/i18n-keys-test.js
// Every key added by the port must be defined exactly once at the TOP LEVEL of each language block (ru / en / he).
// Parsing is by bracket depth and string-aware, so nested fields (h, items, children...) are not counted.
// Pre-existing keys are not checked.
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function ok(c, m) { if (c) { passed++; } else { failed++; console.log('FAIL: ' + m); } }

const text = fs.readFileSync(path.join(__dirname, '..', 'tree-i18n.js'), 'utf8').replace(/^\uFEFF/, '');
const ADDED = [
  'rc2_title', 'rc2_intro', 'rc2_b1', 'rc2_warn_off', 'rc2_warn_on', 'rc2_me_lbl', 'rc2_me_hint',
  'rc2_radius', 'rc2_p1a', 'rc2_p1b', 'rc2_p2a', 'rc2_p2b', 'rc2_p3', 'rc2_inc', 'rc2_lvl_0', 'rc2_lvl_1',
  'rc2_lvl_2', 'rc2_lvl_3', 'rc2_lvl_4', 'rc2_lvl_far', 'rc2_lvl_all', 'rc2_ex_0', 'rc2_ex_1', 'rc2_ex_2',
  'rc2_ex_3', 'rc2_ex_4', 'rc2_ex_far', 'rc2_ex_all', 'rc2_count', 'rc2_count_off', 'rc2_show_who',
  'rc2_mode_full', 'rc2_mode_quiet', 'rc2_people_h', 'rc2_people_p', 'rc2_people_note', 'rc2_people_add',
  'rc2_people_none', 'rc2_ps_radius', 'rc2_ps_now', 'rc2_res_full', 'rc2_res_quiet', 'rc2_res_skip',
  'rc2_ps_always', 'rc2_ps_quiet', 'rc2_ps_never', 'rc2_b2', 'rc2_b2_p', 'rc2_ev_birth', 'rc2_cal_lbl',
  'rc2_cal_greg', 'rc2_cal_he', 'rc2_cal_both', 'rc2_cal_hint', 'rc2_ev_deathhe', 'rc2_ev_deathhe_h',
  'rc2_ev_deathgreg', 'rc2_ev_deathgreg_h', 'rc2_miss_count', 'rc2_miss_sum', 'rc2_miss_birth',
  'rc2_miss_he', 'rc2_miss_greg', 'rc2_b3', 'rc2_f1_t', 'rc2_f1_d', 'rc2_f2_t', 'rc2_f2_d', 'rc2_stat',
  'rc2_empty', 'rc2_dl', 'rc2_notif', 'rc2_foot', 'rc2_save', 'rc2_reset', 'rc2_close', 'rc2_saved',
  'rc2_reset_done', 'rc2_legacy', 'rc2_pick', 'rc2_card_h', 'ev_suffix_he_cal', 'ev_death_greg',
  'ev_death_greg_desc', 'ev_alarm_death_greg', 'toast_cal_skip_year', 'toast_cal_deaths', 'rc2_help',
  'help_circles', 'hebcal_created', 'hebcal_update_summary', 'hebcal_update_desc', 'hebcal_valid_until',
  'hebcal_info_soon', 'hebcal_info_expired', 'hebcal_howto', 'hebcal_toast_soon', 'hebcal_toast_expired',
  'hebcal_win_title', 'hebcal_win_none', 'hebcal_win_last', 'hebcal_win_step1', 'hebcal_win_step2',
  'hebcal_win_step3', 'hebcal_win_download', 'hebcal_win_close', 'help_hebcal', 'hm_tishri', 'hm_heshvan',
  'hm_kislev', 'hm_tevet', 'hm_shevat', 'hm_adar', 'hm_adar1', 'hm_adar2', 'hm_nisan', 'hm_iyar', 'hm_sivan',
  'hm_tamuz', 'hm_av', 'hm_elul', 'hw_day', 'hw_month', 'hw_year_num', 'hw_year_let', 'hw_fill_greg',
  'hw_sunset_note', 'hw_need_greg', 'hw_warn_mismatch', 'hw_legacy_hint', 'hw_legacy_redo', 'hw_clear',
  'hw_err_incomplete', 'hw_err_day', 'hw_extra_mark', 'tooltip_hebrew_calendar', 'tooltip_reminders',
  'rc_login', 'rc_me_saved', 'calendar_no_dates'
];

function skipWs(t, p) {
  const n = t.length;
  while (p < n) {
    const c = t[p];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\uFEFF') { p++; continue; }
    if (c === '/' && p + 1 < n) {
      if (t[p + 1] === '/') { while (p < n && t[p] !== '\n') p++; continue; }
      if (t[p + 1] === '*') { const e = t.indexOf('*/', p + 2); if (e < 0) return n; p = e + 2; continue; }
    }
    break;
  }
  return p;
}
function skipStr(t, p) { const q = t[p]; p++; while (p < t.length && t[p] !== q) { if (t[p] === '\\') p++; p++; } return p + 1; }
function skipTpl(t, p) {
  const n = t.length; p++;
  while (p < n) {
    const c = t[p];
    if (c === '\\') { p += 2; continue; }
    if (c === '`') return p + 1;
    if (c === '$' && t[p + 1] === '{') {
      p += 2; let d = 1;
      while (p < n && d > 0) {
        const c2 = t[p];
        if (c2 === "'" || c2 === '"') { p = skipStr(t, p); continue; }
        if (c2 === '`') { p = skipTpl(t, p); continue; }
        if (c2 === '{') d++; else if (c2 === '}') d--;
        p++;
      }
      continue;
    }
    p++;
  }
  return p;
}
function topLevelKeys(t, open) {
  const keys = []; const n = t.length; let p = open + 1;
  while (true) {
    p = skipWs(t, p);
    if (p >= n || t[p] === '}') break;
    if (t[p] === ',') { p++; continue; }
    let key = '';
    if (t[p] === "'" || t[p] === '"') { const q = t[p]; p++; const kb = p; while (p < n && t[p] !== q) { if (t[p] === '\\') p++; p++; } key = t.slice(kb, p); p++; }
    else { const kb = p; while (p < n && /[\w$]/.test(t[p])) p++; key = t.slice(kb, p); }
    if (!key) throw new Error('cannot read key near: ' + t.slice(p, p + 40));
    p = skipWs(t, p);
    if (t[p] !== ':') throw new Error('expected colon after key ' + key);
    p++;
    let depth = 0;
    while (p < n) {
      const c = t[p];
      if (c === "'" || c === '"') { p = skipStr(t, p); continue; }
      if (c === '`') { p = skipTpl(t, p); continue; }
      if (c === '/' && p + 1 < n) {
        if (t[p + 1] === '/') { while (p < n && t[p] !== '\n') p++; continue; }
        if (t[p + 1] === '*') { const e = t.indexOf('*/', p + 2); p = e < 0 ? n : e + 2; continue; }
      }
      if (c === '{' || c === '[' || c === '(') depth++;
      else if (c === '}' || c === ']' || c === ')') { if (depth === 0) break; depth--; }
      else if (c === ',' && depth === 0) break;
      p++;
    }
    keys.push(key);
    if (p < n && t[p] === ',') p++;
  }
  return keys;
}

ok(new Set(ADDED).size === ADDED.length, 'ADDED list has no repeated names');
const langKeys = {};
['ru', 'en', 'he'].forEach(lang => {
  const re = new RegExp('^[ \\t]*' + lang + '[ \\t]*:[ \\t]*\\{', 'm');
  const m = re.exec(text);
  ok(!!m, lang + ': block found');
  if (!m) return;
  langKeys[lang] = topLevelKeys(text, m.index + m[0].length - 1);
  ok(langKeys[lang].length > 0, lang + ': top-level keys parsed (' + langKeys[lang].length + ')');
});
['ru', 'en', 'he'].forEach(lang => {
  const keys = langKeys[lang] || [];
  ADDED.forEach(k => {
    const c = keys.filter(x => x === k).length;
    ok(c === 1, lang + ': key ' + k + ' defined exactly once (found ' + c + ')');
  });
});
ok((langKeys.ru || []).length === (langKeys.en || []).length && (langKeys.en || []).length === (langKeys.he || []).length, 'ru/en/he have the same number of top-level keys');

if (failed) { console.log('I18N KEYS TEST: ' + failed + ' FAILED, ' + passed + ' passed'); process.exit(1); }
console.log('I18N KEYS TEST: all ' + passed + ' passed');