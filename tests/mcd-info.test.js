import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCalendarDay} from '../mcd-info.js';

test('calendar selects today, next available day, or last archive day without changing source',()=>{
  const days=[{date:'2026-10-16'},{date:'2026-10-12'},{date:'2026-10-15'}];
  assert.equal(selectCalendarDay(days,'2026-10-15').date,'2026-10-15');
  assert.equal(selectCalendarDay(days,'2026-10-13').date,'2026-10-15');
  assert.equal(selectCalendarDay(days,'2026-11-01').date,'2026-10-16');
  assert.equal(days[0].date,'2026-10-16');
  assert.equal(selectCalendarDay([],'2026-10-15'),undefined);
});
