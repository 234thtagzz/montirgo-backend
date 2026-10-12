import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { comparePassword, hashPassword, sanitizeUser, signToken } from '../lib/auth';
import { requireAuth, type AuthRequest } from '../middleware/auth';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeRole(input: unknown): 'CLIENT' | 'MONTIR' {
  if (typeof input === 'string' && input.toUpperCase() === 'MONTIR') return 'MONTIR';
  return 'CLIENT';
}

function isDbUnreachable(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return (
    msg.includes("Can't reach database server") ||
    msg.includes('P1001') ||
    msg.includes('mysql.railway.internal')
  );
}

// POST /auth/register -> langsung tersimpan ke MySQL (Railway) via Prisma
router.post('/register', async (req, res) => {
  try {
    const { name, fullName, email, password, phone, phoneNumber, role } = req.body ?? {};

    const displayName = (typeof name === 'string' ? name : fullName ?? '').trim();
    const cleanEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();
    const cleanPhone = (typeof phone === 'string' ? phone : phoneNumber ?? '').trim();
    const userRole = normalizeRole(role);

    if (!displayName) {
      res.status(400).json({ message: 'Nama lengkap wajib diisi.' });
      return;
    }
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      res.status(400).json({ message: 'Email tidak valid.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ message: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      res.status(409).json({ message: 'Email sudah terdaftar. Silakan login.' });
      return;
    }

    const hashed = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        fullName: displayName,
        email: cleanEmail,
        password: hashed,
        phoneNumber: cleanPhone || null,
        role: userRole,
        profile: { create: { phoneNumber: cleanPhone || null } },
        ...(userRole === 'MONTIR'
          ? { mechanicDetail: { create: { status: 'offline', isOnline: false } } }
          : {}),
      },
      include: { profile: true, mechanicDetail: true },
    });

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        activityType: 'REGISTER',
        description: `Registrasi akun ${userRole}`,
      },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.status(201).json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error('[auth/register]', err);
    if (isDbUnreachable(err)) {
      res.status(503).json({
        code: 'DB_UNREACHABLE',
        message:
          'Database tidak terjangkau. Untuk dev lokal pakai Public URL MySQL dari Railway (bukan mysql.railway.internal).',
      });
      return;
    }
    res.status(500).json({ message: 'Gagal mendaftar. Coba lagi nanti.' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const cleanEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();

    if (!cleanEmail || typeof password !== 'string' || !password) {
      res.status(400).json({ message: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      res.status(404).json({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Akun tidak ditemukan. Belum punya akun? Silakan daftar.',
      });
      return;
    }

    const ok = await comparePassword(password, user.password);
    if (!ok) {
      res.status(401).json({ message: 'Email atau kata sandi salah.' });
      return;
    }

    await prisma.activityLog.create({
      data: { userId: user.id, activityType: 'LOGIN', description: 'Login berhasil' },
    }).catch(() => undefined);

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error('[auth/login]', err);
    if (isDbUnreachable(err)) {
      res.status(503).json({
        code: 'DB_UNREACHABLE',
        message:
          'Database tidak terjangkau. Untuk dev lokal pakai Public URL MySQL dari Railway (bukan mysql.railway.internal).',
      });
      return;
    }
    res.status(500).json({ message: 'Gagal login. Coba lagi nanti.' });
  }
});

// GET /auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { profile: true, mechanicDetail: true },
    });
    if (!user) {
      res.status(404).json({ message: 'Akun tidak ditemukan.' });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error('[auth/me]', err);
    res.status(500).json({ message: 'Gagal memuat profil.' });
  }
});

export default router;
