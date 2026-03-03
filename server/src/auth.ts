import type { Request, Response, NextFunction } from 'express';

export interface UserContext {
  userId: string;
}

declare global {
  namespace Express {
    interface Request {
      userContext?: UserContext;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const accessToken = process.env.ACCESS_TOKEN;
  if (accessToken) {
    const bearer = req.headers['authorization'];
    if (bearer !== `Bearer ${accessToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    res.status(400).json({ error: 'X-User-Id header is required' });
    return;
  }

  req.userContext = { userId };
  next();
}
