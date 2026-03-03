import { Router } from 'express';
import { store } from '../store';

export const taskRouter = Router();

taskRouter.get('/', (req, res) => {
  const ownerId = req.userContext!.userId;
  const instanceId = req.query.instanceId as string | undefined;
  const tasks = store.getTasks(ownerId, instanceId);
  res.json(tasks);
});

taskRouter.get('/:id', (req, res) => {
  const ownerId = req.userContext!.userId;
  const task = store.getTask(req.params.id);
  if (!task || task.ownerId !== ownerId) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});
