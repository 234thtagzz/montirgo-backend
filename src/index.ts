import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import authRoutes from './routes/auth';
import serviceRequestRoutes from './routes/serviceRequests';
import mechanicRoutes from './routes/mechanic';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'montirgo-backend', time: new Date().toISOString() });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: process.env.DATABASE_URL ? 'configured' : 'missing' });
});

app.use('/auth', authRoutes);
app.use('/service-requests', serviceRequestRoutes);
app.use('/mechanic', mechanicRoutes);
// Alias kompatibilitas: 2 layar lama frontend memanggil /api/service-requests*
app.use('/api/service-requests', serviceRequestRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[montirgo-backend] listening on :${PORT}`);
});
