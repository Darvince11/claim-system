import { describe, expect, it } from 'vitest';
import { fullWeekCoverage, overloadHours, submissionPolicy, totalHours } from '../apps/api/src/modules/claims/claim-policy';
describe('claim calculations',()=>{
  it('keeps fractional teaching hours exact',()=>{expect(totalHours([{weeklyHours:'0.1',weeks:3},{weeklyHours:'0.2',weeks:3}]).toString()).toBe('0.9');});
  it('aggregates full weekly workload before computing overload',()=>{expect(overloadHours([{weeklyHours:'8',weeks:4},{weeklyHours:'10',weeks:4}],'12').toString()).toBe('24');});
  it('does not create negative eligible hours',()=>{expect(overloadHours([{weeklyHours:'8',weeks:4}],'12').toString()).toBe('0');});
  it('rejects incompatible durations for the common-period policy',()=>{expect(()=>overloadHours([{weeklyHours:'8',weeks:4},{weeklyHours:'10',weeks:3}],'12')).toThrow();});
  it('requires dates to cover the declared number of complete weeks',()=>{expect(fullWeekCoverage({startsOn:'2026-09-07',endsOn:'2026-10-04',weeks:4})).toBe(true);expect(fullWeekCoverage({startsOn:'2026-09-07',endsOn:'2026-10-03',weeks:4})).toBe(false);});
  it('does not accept unconfigured or unsupported eligibility policy',()=>{expect(submissionPolicy.safeParse({}).success).toBe(false);expect(submissionPolicy.safeParse({eligibility:'ASSUME_ALL_HOURS'}).success).toBe(false);});
});
