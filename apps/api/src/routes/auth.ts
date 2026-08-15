import { Router } from 'express';
import { z } from 'zod';
import { RegisterSchema } from '../lib/validators';
import { failure, success } from '../lib/api-response';
import { hashPassword, signToken } from '../lib/security';

const router = Router();

router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(failure('INVALID_INPUT', 'Registration payload is invalid.'));
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);

    const token = signToken({ email: parsed.data.email }, process.env.JWT_SECRET || 'dev-secret', '15m');

    return res.status(201).json(success({
      email: parsed.data.email,
      passwordHash,
      token,
      message: 'User registered in demo mode. Complete KYC and risk onboarding before real-money operation.',
    }));
  } catch (error) {
    return res.status(500).json(failure('REGISTRATION_FAILED', 'Unable to complete registration.'));
  }
});

router.post('/login', (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(12) });
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json(failure('INVALID_CREDENTIALS', 'Email or password is invalid.'));
  }

  const token = signToken({ email: parsed.data.email }, process.env.JWT_SECRET || 'dev-secret', '15m');

  return res.json(success({ token, email: parsed.data.email, message: 'Signed in successfully.' }));
});

export default router;
