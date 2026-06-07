import { Response } from 'express';

export class SSEBroadcaster {
  private connections: Map<string, Set<Response>> = new Map();

  subscribe(projectId: string, res: Response): void {
    if (!this.connections.has(projectId)) {
      this.connections.set(projectId, new Set());
    }
    this.connections.get(projectId)!.add(res);
  }

  unsubscribe(projectId: string, res: Response): void {
    this.connections.get(projectId)?.delete(res);
    if (this.connections.get(projectId)?.size === 0) {
      this.connections.delete(projectId);
    }
  }

  broadcast(projectId: string, eventType: string, data: object): void {
    const conns = this.connections.get(projectId);
    if (!conns || conns.size === 0) return;
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    conns.forEach(res => {
      try { res.write(payload); } catch { /* connection closed — ignore */ }
    });
  }

  heartbeat(projectId: string): void {
    this.broadcast(projectId, 'heartbeat', { timestamp: new Date().toISOString() });
  }
}

export const sseBroadcaster = new SSEBroadcaster();
