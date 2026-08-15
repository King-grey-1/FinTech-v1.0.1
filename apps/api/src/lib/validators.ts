import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const DepositSchema = z.object({
  userId: z.string().uuid(),
  amount: z.string().refine((value) => Number(value) > 0, 'Amount must be positive'),
  currency: z.enum(['USD', 'EUR', 'GBP']),
});

export const WithdrawalSchema = z.object({
  userId: z.string().uuid(),
  amount: z.string().refine((value) => Number(value) > 0, 'Withdrawal must be positive'),
  currency: z.enum(['USD', 'EUR', 'GBP']),
  idempotencyKey: z.string().min(1),
});
