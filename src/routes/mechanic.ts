import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthRequest } from '../middleware/auth';

const router = Router();

// PATCH /mechanic — montir set online/offline + lokasi
router.patch('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== 'MONTIR' && req.user!.role !== 'ADMIN') {
      res.status(403).json({ message: 'Hanya montir yang bisa mengubah status online.' });
      return;
    }
    const isOnline = Boolean(req.body?.isOnline);
    const lat = req.body?.lat ?? req.body?.currentLat;
    const lng = req.body?.lng ?? req.body?.currentLng;

    const detail = await prisma.mechanicDetail.upsert({
      where: { userId: req.user!.userId },
      update: {
        isOnline,
        status: isOnline ? 'online' : 'offline',
        ...(Number.isFinite(Number(lat)) ? { currentLat: Number(lat) } : {}),
        ...(Number.isFinite(Number(lng)) ? { currentLng: Number(lng) } : {}),
      },
      create: {
        userId: req.user!.userId,
        isOnline,
        status: isOnline ? 'online' : 'offline',
      },
    });

    await prisma.activityLog
      .create({
        data: {
          userId: req.user!.userId,
          activityType: isOnline ? 'ONLINE' : 'OFFLINE',
          description: isOnline ? 'Montir online' : 'Montir offline',
        },
      })
      .catch(() => undefined);

    res.json(detail);
  } catch (err) {
    console.error('[mechanic/setOnline]', err);
    res.status(500).json({ message: 'Gagal mengubah status online.' });
  }
});

// GET /mechanic/profile — profil + detail montir
router.get('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { profile: true, mechanicDetail: true },
    });
    if (!user) {
      res.status(404).json({ message: 'Akun tidak ditemukan.' });
      return;
    }
    const { password: _password, ...safe } = user as typeof user & { password?: unknown };
    res.json(safe);
  } catch (err) {
    console.error('[mechanic/profile]', err);
    res.status(500).json({ message: 'Gagal memuat profil montir.' });
  }
});

export default router;
