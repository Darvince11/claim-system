import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
export function validate<T extends z.ZodTypeAny>(schema:T, input:unknown):z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException({message:'Please check the highlighted information.',fieldErrors:result.error.flatten()});
  return result.data;
}
export const uuid = z.string().uuid();
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v,'Enter a valid date.');
export const decimal = z.string().regex(/^\d{1,8}(\.\d{1,4})?$/);
export const passwordInput = z.string().min(1).refine(value=>Buffer.byteLength(value,'utf8')<=72,'Password must not exceed 72 UTF-8 bytes.');
export const newPassword = passwordInput.refine(value=>value.length>=12,'Use at least 12 characters.');
export const pagination = z.object({page:z.coerce.number().int().min(1).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(10),search:z.string().max(100).default('')});
