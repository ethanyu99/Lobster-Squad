import type { Request, Response, NextFunction } from 'express';

const requests = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 120;

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = requests.get(ip);

  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS_PER_MINUTE) {
    res.set('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  next();
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of requests) {
    if (now > entry.resetAt) requests.delete(ip);
  }
}, 300_000);
