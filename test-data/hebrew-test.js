// test-data/hebrew-test.js -- checks for tree-hebrew.js.   Run: node test-data\hebrew-test.js
// Pure ASCII. All dates are synthetic. Hebrew dates are verified by converting the result back through Intl.
'use strict';
var path = require('path');
var H = require(path.join(__dirname, '..', 'tree-hebrew.js'));

var total = 0, bad = 0;
function check(name, ok, info) {
  total++;
  if (!ok) bad++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok ? '' : '   ' + (info || '')));
}
function eq(name, got, exp) { check(name, got === exp, 'got ' + got + ' expected ' + exp); }
var J = JSON.stringify;
function pj(s) { var r = H.parseHebrewDate(s); return r ? J(r) : 'null'; }
function E(d, k, y) { return J({ day: d, monthKey: k, year: y }); }
function hebOf(ts) { return H.gregToHebrew(new Date(ts)); }

// ---- parser and formatter ----
var A13 = '\u05D9\u05D2 \u05E0\u05D9\u05E1\u05DF \u05EA\u05E9\u05DC\u05F4\u05D0';
eq('ordinary date 13 Nisan 5731', pj(A13), E(13, 'nisan', 5731));
eq('Adar II with geresh', pj('\u05D8 \u05D0\u05D3\u05E8 \u05D1\u05F3 \u05EA\u05E9\u05E1\u05F4\u05D4'), E(9, 'adar2', 5765));
eq('year with thousands', pj('\u05D9\u05D2 \u05E0\u05D9\u05E1\u05DF \u05D4\u05F3\u05EA\u05E9\u05DC\u05F4\u05D0'), E(13, 'nisan', 5731));
eq('Latin string -> null', pj('Nisan 13 5731'), 'null');
eq('empty string -> null', pj(''), 'null');
eq('numeric parenthetical agrees', pj(A13 + ' (13 \u05D1\u05E0\u05D9\u05E1\u05DF 5731)'), E(13, 'nisan', 5731));
eq('numeric parenthetical differs -> null', pj(A13 + ' (14 \u05D1\u05E0\u05D9\u05E1\u05DF 5731)'), 'null');
eq('format 13 Nisan 5731', H.formatHebrewDate({ day: 13, monthKey: 'nisan', year: 5731 }), A13);
eq('format 15 Tishri 5786', H.formatHebrewDate({ day: 15, monthKey: 'tishri', year: 5786 }), '\u05D8\u05D5 \u05EA\u05E9\u05E8\u05D9 \u05EA\u05E9\u05E4\u05F4\u05D5');
[{ day: 16, monthKey: 'tishri', year: 5785 }, { day: 30, monthKey: 'shevat', year: 5785 }, { day: 9, monthKey: 'adar2', year: 5787 }].forEach(function (o) {
  eq('round trip ' + J(o), pj(H.formatHebrewDate(o)), J(o));
});

// ---- Intl anchors and leap years ----
check('Intl Hebrew calendar is available', H.isSupported());
eq('8 APR 1971 = 13 Nisan 5731', J(H.gregToHebrew(H.parseGreg('8 APR 1971'))), E(13, 'nisan', 5731));
eq('25 JAN 2021 = 12 Shevat 5781', J(H.gregToHebrew(H.parseGreg('25 JAN 2021'))), E(12, 'shevat', 5781));
eq('5787 is a leap year', H.isLeapYear(5787), true);
eq('5786 is not a leap year', H.isLeapYear(5786), false);
eq('5784 is a leap year', H.isLeapYear(5784), true);
var leaps = 0;
for (var y = 5780; y < 5799; y++) { if (H.isLeapYear(y)) leaps++; }
eq('7 leap years in a 19-year cycle', leaps, 7);

// ---- calendar window 2020..2040 ----
var cal = H.createCalendar(2020, 21);

var ordinary = cal.occurrences({ day: 13, monthKey: 'nisan', year: 5731 });
eq('13 Nisan: one event per year, 21 in the window', ordinary.length, 21);
var okOrd = ordinary.every(function (o) {
  var h = hebOf(o.ts);
  return h.day === 13 && h.monthKey === 'nisan' && h.year === o.hebYear;
});
check('13 Nisan: every date converts back to 13 Nisan', okOrd);
check('events stay inside the window', ordinary.every(function (o) { return o.ymd >= '20200101' && o.ymd <= '20401231'; }));

// 30 Heshvan / 30 Kislev (default rule: the 29th in a short month)
['heshvan', 'kislev'].forEach(function (key) {
  var occ = cal.occurrences({ day: 30, monthKey: key, year: 5700 });
  var shortSeen = 0, longSeen = 0, allOk = true;
  occ.forEach(function (o) {
    var len = cal.monthLength(o.hebYear, key);
    var h = hebOf(o.ts);
    if (len === 29) shortSeen++; else if (len === 30) longSeen++;
    var expDay = (len === 30) ? 30 : 29;
    if (h.monthKey !== key || h.day !== expDay) allOk = false;
  });
  check('30 ' + key + ': both short and long months occur in the window', shortSeen > 0 && longSeen > 0, 'short ' + shortSeen + ' long ' + longSeen);
  check('30 ' + key + ': 30th in a long month, 29th in a short month', allOk);
});

// alternative rule: the 1st of the next month
var calAlt = H.createCalendar(2020, 21, { DAY30_SHORT_MONTH: 'next_day1' });
var altOcc = calAlt.occurrences({ day: 30, monthKey: 'heshvan', year: 5700 });
var altOk = altOcc.every(function (o) {
  var len = calAlt.monthLength(o.hebYear, 'heshvan');
  var h = hebOf(o.ts);
  return (len === 30) ? (h.monthKey === 'heshvan' && h.day === 30) : (h.monthKey === 'kislev' && h.day === 1);
});
check('rule next_day1: 30 Heshvan in a short year -> 1 Kislev', altOk);

// Adar in leap and common years
function adarCase(name, rec, leapKey, commonKey) {
  var occ = cal.occurrences(rec);
  var leapSeen = 0, commonSeen = 0, allOk = true;
  occ.forEach(function (o) {
    var leap = H.isLeapYear(o.hebYear);
    if (leap) leapSeen++; else commonSeen++;
    var expKey = leap ? leapKey : commonKey;
    var expDay = Math.min(rec.day, cal.monthLength(o.hebYear, expKey));
    var h = hebOf(o.ts);
    if (h.monthKey !== expKey || h.day !== expDay || h.year !== o.hebYear) allOk = false;
  });
  check(name + ': leap and common years both occur', leapSeen > 0 && commonSeen > 0, 'leap ' + leapSeen + ' common ' + commonSeen);
  check(name + ': month is ' + leapKey + ' in a leap year, ' + commonKey + ' in a common year', allOk);
}
adarCase('Adar II 9', { day: 9, monthKey: 'adar2', year: 5765 }, 'adar2', 'adar');
adarCase('plain Adar 9', { day: 9, monthKey: 'adar', year: 5765 }, 'adar2', 'adar');
adarCase('Adar I 9', { day: 9, monthKey: 'adar1', year: 5765 }, 'adar1', 'adar');
adarCase('Adar I 30 (no 30th in Adar of a common year)', { day: 30, monthKey: 'adar1', year: 5765 }, 'adar1', 'adar');

// plain Adar can be switched to Adar I with one constant
var calA1 = H.createCalendar(2020, 21, { ADAR_PLAIN_IN_LEAP: 'adar1' });
var a1ok = calA1.occurrences({ day: 9, monthKey: 'adar', year: 5765 }).every(function (o) {
  return hebOf(o.ts).monthKey === (H.isLeapYear(o.hebYear) ? 'adar1' : 'adar');
});
check('rule ADAR_PLAIN_IN_LEAP = adar1', a1ok);

// first event is not earlier than the year AFTER the original year
var after = cal.occurrences({ day: 12, monthKey: 'shevat', year: 5781 });
var minHy = Math.min.apply(null, after.map(function (o) { return o.hebYear; }));
eq('yahrzeit: first event in the year after 5781', minHy, 5782);

// unusable records
eq('unknown month key -> no events', cal.occurrences({ day: 1, monthKey: 'nope', year: 5700 }).length, 0);
eq('null record -> no events', cal.occurrences(null).length, 0);

console.log(bad === 0 ? ('HEBREW TEST: all ' + total + ' passed') : ('HEBREW TEST: ' + bad + ' of ' + total + ' FAILED'));
process.exitCode = bad === 0 ? 0 : 1;