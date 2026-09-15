import { describe, expect, it } from 'vitest';
import { date, decimal, newPassword } from '../apps/api/src/common/validation';

describe('foundation input boundaries',()=>{
  it('rejects invalid calendar dates rather than accepting date normalization',()=>{
    expect(date.safeParse('2026-02-29').success).toBe(false);
    expect(date.safeParse('2028-02-29').success).toBe(true);
    expect(date.safeParse('2026-13-01').success).toBe(false);
  });
  it('fits hour inputs into numeric(12,4)',()=>{
    expect(decimal.safeParse('99999999.9999').success).toBe(true);
    for(const value of ['100000000','-1','1e4','0.00001'])expect(decimal.safeParse(value).success).toBe(false);
  });
  it('prevents bcrypt truncation including multibyte passwords',()=>{
    expect(newPassword.safeParse('a'.repeat(72)).success).toBe(true);
    expect(newPassword.safeParse('a'.repeat(73)).success).toBe(false);
    expect(newPassword.safeParse('\u20ac'.repeat(24)).success).toBe(true);
    expect(newPassword.safeParse('\u20ac'.repeat(25)).success).toBe(false);
    expect(newPassword.safeParse('short').success).toBe(false);
  });
});
