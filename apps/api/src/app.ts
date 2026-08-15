import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import adminRoutes from './routes/admin';
import walletsRoutes from './routes/wallets';
import depositsRoutes from './routes/deposits';
import investmentsRoutes from './routes/investments';
import tradingRoutes from './routes/trading';
import withdrawalsRoutes from './routes/withdrawals';
import adminWithdrawalsRoutes from './routes/admin-withdrawals';
import webhooksRoutes from './routes/webhooks';

export const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'platform-api', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/wallets', walletsRoutes);
app.use('/api/deposits', depositsRoutes);
app.use('/api/investments', investmentsRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/withdrawals', withdrawalsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminWithdrawalsRoutes);
app.use('/webhooks', webhooksRoutes);

app.get('/api/hello', (_req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Secure trading platform API is running.',
      mode: 'demo',
      financialNotice: 'Investment performance is subject to market and strategy risk. Target returns are configurable and not guaranteed.',
    },
  });
});
