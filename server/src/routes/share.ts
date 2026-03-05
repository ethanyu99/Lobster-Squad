import { Router } from 'express';
import type { ShareDuration } from '../../../shared/types';
import { store } from '../store';

const VALID_DURATIONS: ShareDuration[] = ['1h', '3h', '12h', '1d', '2d', '3d'];

export const shareRouter = Router();

// POST /api/share — create a share link (requires auth)
shareRouter.post('/', (req, res) => {
  const userId = req.userContext!.userId;
  const { shareType, targetId, duration } = req.body as {
    shareType: string;
    targetId: string;
    duration: string;
  };

  if (!shareType || !targetId || !duration) {
    res.status(400).json({ error: 'shareType, targetId, and duration are required' });
    return;
  }

  if (shareType !== 'team' && shareType !== 'instance') {
    res.status(400).json({ error: 'shareType must be "team" or "instance"' });
    return;
  }

  if (!VALID_DURATIONS.includes(duration as ShareDuration)) {
    res.status(400).json({ error: `duration must be one of: ${VALID_DURATIONS.join(', ')}` });
    return;
  }

  if (shareType === 'instance') {
    const inst = store.getInstance(userId, targetId);
    if (!inst) {
      res.status(404).json({ error: 'Instance not found' });
      return;
    }
  } else {
    const team = store.getTeam(userId, targetId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
  }

  const shareToken = store.createShareToken(userId, shareType, targetId, duration as ShareDuration);
  res.json({ shareToken });
});

// GET /api/share — list own share tokens (requires auth)
shareRouter.get('/', (req, res) => {
  const userId = req.userContext!.userId;
  const tokens = store.getShareTokensByOwner(userId);
  res.json({ shareTokens: tokens });
});

// DELETE /api/share/:id — revoke a share token (requires auth)
shareRouter.delete('/:id', (req, res) => {
  const userId = req.userContext!.userId;
  const deleted = store.deleteShareToken(userId, req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Share token not found' });
    return;
  }
  res.json({ ok: true });
});

// GET /api/share/view/:token — resolve a share token (no auth required)
export const shareViewRouter = Router();

shareViewRouter.get('/:token', (req, res) => {
  const st = store.getShareTokenByToken(req.params.token);
  if (!st) {
    res.status(404).json({ error: 'Share link is invalid or expired' });
    return;
  }

  const ownerShortId = st.ownerId.slice(0, 8);

  if (st.shareType === 'instance') {
    const inst = store.getInstance(st.ownerId, st.targetId);
    if (!inst) {
      res.status(404).json({ error: 'Shared instance no longer exists' });
      return;
    }
    // Hide sensitive endpoint info for shared view
    const safeInstance = { ...inst, endpoint: '***', hasToken: false };
    res.json({
      shareType: 'instance',
      ownerShortId,
      instances: [safeInstance],
      stats: { total: 1, online: inst.status === 'online' ? 1 : 0, busy: inst.status === 'busy' ? 1 : 0, offline: inst.status === 'offline' ? 1 : 0 },
      expiresAt: st.expiresAt,
    });
  } else {
    const team = store.getTeam(st.ownerId, st.targetId);
    if (!team) {
      res.status(404).json({ error: 'Shared team no longer exists' });
      return;
    }

    // Get all instances bound to this team
    const teamInstances = store.getInstances(st.ownerId)
      .filter(i => i.teamId === st.targetId)
      .map(i => ({ ...i, endpoint: '***', hasToken: false }));

    const stats = {
      total: teamInstances.length,
      online: teamInstances.filter(i => i.status === 'online').length,
      busy: teamInstances.filter(i => i.status === 'busy').length,
      offline: teamInstances.filter(i => i.status === 'offline').length,
    };

    res.json({
      shareType: 'team',
      ownerShortId,
      team,
      instances: teamInstances,
      stats,
      expiresAt: st.expiresAt,
    });
  }
});
