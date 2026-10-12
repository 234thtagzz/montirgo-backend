import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/auth';

export interface AuthRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token tidak ditemukan. Silakan login.' });
    return;
  }
  const token = header.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ message: 'Token tidak valid atau kedaluwarsa. Silakan login kembali.' });
  }
}
