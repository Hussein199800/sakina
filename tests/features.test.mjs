import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { occurrences, describe } from '../src/reminders.js';
import { toHijri } from '../src/dates.js';
import { state } from '../src/store.js';
import { startKhatma, pageRead, todayRange, readToday, daysLeft } from '../src/khatma.js';
import { VERSION, VERSION_CODE } from '../src/version.js';
import { CHANGELOG } from '../src/data/changelog.js';

// الأربعاء ٢٨ أكتوبر ٢٠٢٦، الساعة ١٠ صباحاً
const NOW = new Date(2026, 9, 28, 10, 0);

test('تذكير صيام الاثنين والخميس في الليلة السابقة', () => {
  const o = occurrences({ kind: 'monthu', on: true, time: '21:00', mode: 'eve' }, NOW, 7);
  // الخميس ٢٩ ← التذكير مساء الأربعاء ٢٨، والاثنين ٢ نوفمبر ← مساء الأحد ١ نوفمبر
  assert.deepEqual(o.map((x) => [x.at.getDate(), x.at.getDay(), x.at.getHours()]), [[28, 3, 21], [1, 0, 21]]);
  assert.match(o[0].title, /غداً الخميس/);
});

test('تذكير صيام الاثنين والخميس صباح اليوم نفسه', () => {
  const o = occurrences({ kind: 'monthu', on: true, time: '06:00', mode: 'day' }, NOW, 7);
  assert.deepEqual(o.map((x) => x.at.getDay()), [4, 1]);
  assert.match(o[0].title, /اليوم الخميس/);
});

test('تذكير الأيام البيض يوافق ١٣ و١٤ و١٥ من الشهر الهجري', () => {
  const o = occurrences({ kind: 'white', on: true, time: '21:00', mode: 'eve' }, NOW, 40);
  assert.equal(o.length, 3);
  for (const x of o) {
    const fast = new Date(x.at.getFullYear(), x.at.getMonth(), x.at.getDate() + 1);
    const h = toHijri({ y: fast.getFullYear(), m: fast.getMonth() + 1, d: fast.getDate() });
    assert.ok(h.d >= 13 && h.d <= 15, `يوم هجري ${h.d}`);
  }
});

test('تذكير الكهف ليلة الجمعة أو يومها، والتذكير المخصّص بأنواعه', () => {
  const eve = occurrences({ kind: 'kahf', on: true, time: '20:00', mode: 'eve' }, NOW, 7);
  assert.equal(eve[0].at.getDay(), 4);
  const day = occurrences({ kind: 'kahf', on: true, time: '10:00', mode: 'day' }, NOW, 7);
  assert.equal(day[0].at.getDay(), 5);
  const weekly = occurrences({ kind: 'custom', on: true, time: '18:00', repeat: 'weekly', days: [0, 3], title: 'صلة الرحم' }, NOW, 6);
  assert.deepEqual(weekly.map((x) => x.at.getDay()), [3, 0]);
  const once = occurrences({ kind: 'custom', on: true, time: '09:00', repeat: 'once', date: '2026-10-30', title: 'موعد' }, NOW, 7);
  assert.equal(once.length, 1);
  const past = occurrences({ kind: 'custom', on: true, time: '09:00', repeat: 'daily', title: 'x' }, NOW, 0);
  assert.equal(past.length, 0, 'لا يُجدول تذكير في وقت مضى');
  assert.equal(occurrences({ kind: 'qiyam', on: false, time: '03:30' }, NOW, 7).length, 0);
  assert.equal(describe({ kind: 'custom', repeat: 'daily' }), 'يومياً');
});

test('الختمة: ورد اليوم والتقدّم والإتمام', () => {
  startKhatma({ perDay: 5, time: '20:00', remind: false, fromPage: 1 });
  assert.deepEqual(todayRange(), { from: 1, to: 5 });
  assert.equal(pageRead(3), null, 'قراءة صفحة غير صفحة الختمة لا تُحسب');
  for (let p = 1; p <= 5; p++) assert.equal(pageRead(p), 'advanced');
  assert.equal(readToday(), 5);
  assert.deepEqual(todayRange(), { from: 1, to: 5 }, 'ورد اليوم يبقى كما هو بعد إتمامه');
  assert.equal(daysLeft(), Math.ceil(600 / 5));
  state.khatma.page = 604;
  const done = state.khatmaDone;
  assert.equal(pageRead(604), 'finished');
  assert.equal(state.khatma, null);
  assert.equal(state.khatmaDone, done + 1);
});

test('رقم الإصدار متطابق في التطبيق وأندرويد وملف التحديث وسجل الجديد', () => {
  const gradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  assert.match(gradle, new RegExp(`versionCode ${VERSION_CODE}\\b`));
  assert.match(gradle, new RegExp(`versionName "${VERSION.replace(/\./g, '\\.')}"`));
  const v = JSON.parse(readFileSync(new URL('../version.json', import.meta.url), 'utf8'));
  assert.equal(v.versionCode, VERSION_CODE);
  assert.equal(v.versionName, VERSION);
  assert.equal(CHANGELOG[0].version, VERSION);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version, VERSION);
});
