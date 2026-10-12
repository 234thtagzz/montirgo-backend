import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthRequest } from '../middleware/auth';

const router = Router();

const VALID_STATUS = [
  'REQUESTED',
  'MATCHING',
  'MECHANIC_ASSIGNED',
  'MECHANIC_ACCEPTED',
  'ON_THE_WAY',
  'ARRIVED',
  'DIAGNOSING',
  'REPAIRING',
  'COMPLETED',
  'CANCELLED',
] as const;

function isDbUnreachable(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return (
    msg.includes("Can't reach database server") ||
    msg.includes('P1001') ||
    msg.includes('mysql.railway.internal') ||
    (err as { code?: string })?.code === 'P1001'
  );
}

function dbErrorMessage(): { status: number; body: object } {
  return {
    status: 503,
    body: {
      code: 'DB_UNREACHABLE',
      message:
        'Database tidak terjangkau (mysql.railway.internal hanya bisa diakses dari Railway). Untuk dev lokal, ganti DATABASE_URL di .env dengan Public URL MySQL dari dashboard Railway.',
    },
  };
}

// Bentuk respons yang diharapkan layar frontend (lihat montirGo/src/lib/api.ts
// + (client)/index.tsx + (mechanic)/active-order/[id].tsx).
function toCard(row: {
  id: string;
  status: string;
  vehicleIssueDescription: string;
  clientLat: number;
  clientLng: number;
  client?: { fullName?: string; phoneNumber?: string | null } | null;
  vehicle?: { brand?: string; model?: string; year?: number | null } | null;
}) {
  return {
    id: row.id,
    status: row.status,
    vehicleIssueDescription: row.vehicleIssueDescription,
    vehicleBrand: row.vehicle?.brand ?? '-',
    vehicleModel: row.vehicle?.model ?? '-',
    vehicleYear: row.vehicle?.year ?? null,
    clientFullName: row.client?.fullName ?? '-',
    clientPhone: row.client?.phoneNumber ?? '-',
    clientLat: row.clientLat,
    clientLng: row.clientLng,
  };
}

// POST /service-requests — client buat permintaan baru
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body ?? {};
    const clientId = (typeof body.clientId === 'string' && body.clientId) || req.user!.userId;
    const issueDescription =
      (typeof body.issueDescription === 'string' && body.issueDescription.trim()) ||
      (typeof body.vehicleIssueDescription === 'string' && body.vehicleIssueDescription.trim()) ||
      '';
    const lat = Number(body.lat ?? body.clientLat);
    const lng = Number(body.lng ?? body.clientLng);
    const address =
      (typeof body.address === 'string' && body.address.trim()) ||
      (typeof body.clientAddress === 'string' && body.clientAddress.trim()) ||
      '';

    if (!issueDescription) {
      res.status(400).json({ message: 'Deskripsi masalah wajib diisi.' });
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ message: 'Lokasi (lat/lng) wajib diisi.' });
      return;
    }
    if (!address) {
      res.status(400).json({ message: 'Alamat wajib diisi.' });
      return;
    }
    // Cegah client membuat order atas nama user lain
    if (clientId !== req.user!.userId && req.user!.role !== 'ADMIN') {
      res.status(403).json({ message: 'Tidak boleh membuat order untuk user lain.' });
      return;
    }

    const created = await prisma.serviceRequest.create({
      data: {
        clientId,
        vehicleId: typeof body.vehicleId === 'string' && body.vehicleId ? body.vehicleId : null,
        clientLat: lat,
        clientLng: lng,
        clientAddress: address,
        vehicleIssueDescription: issueDescription,
        symptoms: typeof body.symptoms === 'string' ? body.symptoms : null,
        status: 'REQUESTED',
        statusHistory: {
          create: { previousStatus: 'REQUESTED', newStatus: 'REQUESTED', changedBy: clientId },
        },
      },
      include: { client: true, vehicle: true },
    });

    await prisma.activityLog
      .create({
        data: {
          userId: clientId,
          activityType: 'CREATE_ORDER',
          description: 'Membuat permintaan servis',
          relatedEntity: 'ServiceRequest',
          relatedId: created.id,
        },
      })
      .catch(() => undefined);

    res.status(201).json(toCard(created));
  } catch (err) {
    console.error('[service-requests/create]', err);
    if (isDbUnreachable(err)) {
      const { status, body } = dbErrorMessage();
      res.status(status).json(body);
      return;
    }
    res.status(500).json({ message: 'Gagal membuat permintaan. Coba lagi nanti.' });
  }
});

// GET /service-requests/pending — montir lihat order masuk (harus sebelum /:id)
router.get('/pending', requireAuth, async (_req, res) => {
  try {
    const rows = await prisma.serviceRequest.findMany({
      where: { status: { in: ['REQUESTED', 'MATCHING'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { client: true, vehicle: true },
    });
    res.json(rows.map(toCard));
  } catch (err) {
    console.error('[service-requests/pending]', err);
    if (isDbUnreachable(err)) {
      const { status, body } = dbErrorMessage();
      res.status(status).json(body);
      return;
    }
    res.status(500).json({ message: 'Gagal memuat order masuk.' });
  }
});

// GET /service-requests?clientId=... — riwayat order client
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const q = req.query.clientId;
    const clientId = (Array.isArray(q) ? q[0] : q) || req.user!.userId;
    if (clientId !== req.user!.userId && req.user!.role !== 'ADMIN' && req.user!.role !== 'MONTIR') {
      res.status(403).json({ message: 'Tidak boleh melihat order milik user lain.' });
      return;
    }
    const rows = await prisma.serviceRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: { client: true, vehicle: true },
    });
    res.json(rows.map(toCard));
  } catch (err) {
    console.error('[service-requests/list]', err);
    if (isDbUnreachable(err)) {
      const { status, body } = dbErrorMessage();
      res.status(status).json(body);
      return;
    }
    res.status(500).json({ message: 'Gagal memuat daftar permintaan.' });
  }
});

// GET /service-requests/:id — detail untuk client & montir
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const row = await prisma.serviceRequest.findUnique({
      where: { id },
      include: { client: true, vehicle: true },
    });
    if (!row) {
      res.status(404).json({ message: 'Permintaan tidak ditemukan.' });
      return;
    }
    res.json(toCard(row));
  } catch (err) {
    console.error('[service-requests/getById]', err);
    if (isDbUnreachable(err)) {
      const { status, body } = dbErrorMessage();
      res.status(status).json(body);
      return;
    }
    res.status(500).json({ message: 'Gagal memuat detail permintaan.' });
  }
});

// PATCH /service-requests/:id/status — update status + history
router.patch('/:id/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const next = typeof req.body?.status === 'string' ? req.body.status.toUpperCase() : '';
    if (!(VALID_STATUS as readonly string[]).includes(next)) {
      res.status(400).json({ message: `Status tidak valid. Pilihan: ${VALID_STATUS.join(', ')}` });
      return;
    }
    const existing = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ message: 'Permintaan tidak ditemukan.' });
      return;
    }
    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: next as (typeof VALID_STATUS)[number],
        statusHistory: {
          create: {
            previousStatus: existing.status,
            newStatus: next as (typeof VALID_STATUS)[number],
            changedBy: req.user!.userId,
          },
        },
      },
      include: { client: true, vehicle: true },
    });

    await prisma.activityLog
      .create({
        data: {
          userId: req.user!.userId,
          activityType: 'UPDATE_STATUS',
          description: `Status ${existing.status} -> ${next}`,
          relatedEntity: 'ServiceRequest',
          relatedId: updated.id,
        },
      })
      .catch(() => undefined);

    res.json(toCard(updated));
  } catch (err) {
    console.error('[service-requests/updateStatus]', err);
    if (isDbUnreachable(err)) {
      const { status, body } = dbErrorMessage();
      res.status(status).json(body);
      return;
    }
    res.status(500).json({ message: 'Gagal memperbarui status.' });
  }
});

export default router;
