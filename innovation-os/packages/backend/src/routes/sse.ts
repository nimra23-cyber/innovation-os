import { Router } from 'express';
import { sseBroadcaster } from '../services/SSEBroadcaster';

export const sseRouter = Router();

// ─── GET /:projectId — SSE stream ─────────────────────────────────────────────

sseRouter.get('/:projectId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.flushHeaders();

  const { projectId } = req.params;
  sseBroadcaster.subscribe(projectId, res);

  // Send initial heartbeat
  res.write(
    'event: heartbeat\ndata: {"timestamp":"' + new Date().toISOString() + '"}\n\n'
  );

  req.on('close', () => {
    sseBroadcaster.unsubscribe(projectId, res);
  });
});
