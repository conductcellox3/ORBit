import { getIsoWeekString } from './src/utils/dateHelper.js';

console.log("Week for today (Sun Apr 5, 2026):", getIsoWeekString(new Date('2026-04-05T12:00:00')));
console.log("Week for Monday (Mar 30, 2026):", getIsoWeekString(new Date('2026-03-30T12:00:00')));
