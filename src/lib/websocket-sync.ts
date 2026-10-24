// websocket-sync.ts — Real-time sync layer for Marvel Nexus watch parties

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

type MessageType =
  | 'journey-update'
  | 'cursor-move'
  | 'chat'
  | 'sync-request'
  | 'sync-response'
  | 'peer-join'
  | 'peer-leave'
  | 'heartbeat'
  | 'heartbeat-ack'
  | 'peer-list';

interface SyncMessage {
  readonly type: MessageType;
  readonly peerId: string;
  readonly roomId: string;
  readonly sequence: number;
  readonly timestamp: number;
  readonly payload: Record<string, unknown>;
  readonly hash: string;
}

interface PeerInfo {
  readonly id: string;
  readonly name: string;
  readonly joinedAt: number;
  lastSeen: number;
}

type MessageCallback = (type: MessageType, peerId: string, payload: Record<string, unknown>) => void;

const HEARTBEAT_INTERVAL = 15_000;
const PEER_TIMEOUT = 45_000;
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;
const MAX_SEQUENCE_GAP = 1000;
const DEDUP_WINDOW_MS = 30_000;

function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function computeHash(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const buffer = await crypto.subtle.digest('SHA-256', encoded as BufferSource);
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}

class BroadcastChannelTransport {
  private channel: BroadcastChannel | null = null;
  private listeners: Array<(event: MessageEvent) => void> = [];
  private storageKey = '';

  open(roomId: string): void {
    this.channel = new BroadcastChannel(`marvel-nexus-sync-${roomId}`);
    this.storageKey = `marvel-nexus-sync-${roomId}`;
    const handler = (event: MessageEvent) => {
      this.listeners.forEach(fn => fn(event));
    };
    this.channel.addEventListener('message', handler);
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === this.storageKey && event.newValue) {
        const fakeEvent = new MessageEvent('message', { data: event.newValue });
        this.listeners.forEach(fn => fn(fakeEvent));
      }
    });
  }

  onMessage(callback: (data: string) => void): void {
    this.listeners.push((event) => {
      if (typeof event.data === 'string') {
        callback(event.data);
      }
    });
  }

  send(data: string): void {
    if (this.channel) {
      this.channel.postMessage(data);
    }
    if (this.storageKey) {
      try {
        localStorage.setItem(this.storageKey, data);
        localStorage.removeItem(this.storageKey);
      } catch {
        // Storage quota exceeded or blocked — channel-only fallback
      }
    }
  }

  close(): void {
    this.channel?.close();
    this.channel = null;
    this.listeners = [];
    this.storageKey = '';
  }
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url = '';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(data: string) => void> = [];
  private stateListeners: Array<(state: ConnectionState) => void> = [];
  private _state: ConnectionState = 'disconnected';

  get state(): ConnectionState {
    return this._state;
  }

  connect(url: string, protocols?: string[]): void {
    if (this.ws) return;
    this.url = url;
    this.setState('connecting');

    try {
      this.ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
    } catch {
      this.setState('error');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState('connected');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        this.listeners.forEach(fn => fn(event.data));
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.stopHeartbeat();
      this.setState('disconnected');
      this.ws = null;
      if (!event.wasClean) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.setState('error');
    };
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.ws?.close(1000, 'Client disconnect');
    this.ws = null;
    this.setState('disconnected');
  }

  send(data: string): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    return false;
  }

  onMessage(callback: (data: string) => void): void {
    this.listeners.push(callback);
  }

  onStateChange(callback: (state: ConnectionState) => void): void {
    this.stateListeners.push(callback);
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    this.stateListeners.forEach(fn => fn(state));
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.url);
    }, delay);
  }
}

export class RealtimeSync {
  private roomId = '';
  private peerId = '';
  private peerName = '';
  private state: ConnectionState = 'disconnected';
  private sequence = 0;
  private peers = new Map<string, PeerInfo>();
  private messageCallbacks: MessageCallback[] = [];
  private stateCallbacks: Array<(state: ConnectionState) => void> = [];
  private dedupCache = new Map<string, number>();
  private messageBuffer: SyncMessage[] = [];
  private broadcast: BroadcastChannelTransport;
  private wsClient: WebSocketClient;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private peerCleanupTimer: ReturnType<typeof setInterval> | null = null;
  private pendingSyncResolves = new Map<string, (messages: SyncMessage[]) => void>();

  constructor(name: string) {
    this.peerId = generateId();
    this.peerName = name;
    this.broadcast = new BroadcastChannelTransport();
    this.wsClient = new WebSocketClient();
    this.setupBroadcastListener();
    this.setupWebSocketListener();
  }

  connect(roomId: string, wsUrl?: string): void {
    this.disconnect();
    this.roomId = roomId;
    this.sequence = 0;
    this.messageBuffer = [];
    this.dedupCache.clear();
    this.peers.clear();
    this.setState('connecting');

    this.broadcast.open(roomId);
    this.broadcast.onMessage(data => this.handleRawMessage(data));

    if (wsUrl) {
      this.wsClient.onStateChange(state => {
        if (state === 'connected') {
          this.setState('connected');
          this.startHeartbeat();
          this.startPeerCleanup();
          this.broadcastPresence();
        }
      });
      this.wsClient.connect(wsUrl);
    } else {
      this.setState('connected');
      this.startHeartbeat();
      this.startPeerCleanup();
      this.broadcastPresence();
    }
  }

  disconnect(): void {
    this.broadcastLeave();
    this.stopHeartbeat();
    this.stopPeerCleanup();
    this.pendingSyncResolves.forEach(resolve => resolve([]));
    this.pendingSyncResolves.clear();
    this.broadcast.close();
    this.wsClient.disconnect();
    this.peers.clear();
    this.setState('disconnected');
  }

  async send(type: MessageType, payload: Record<string, unknown>): Promise<void> {
    if (this.state !== 'connected') return;

    this.sequence++;
    const rawData = `${this.roomId}:${this.peerId}:${this.sequence}:${type}:${JSON.stringify(payload)}`;
    const hash = await computeHash(rawData);

    const message: SyncMessage = {
      type,
      peerId: this.peerId,
      roomId: this.roomId,
      sequence: this.sequence,
      timestamp: Date.now(),
      payload,
      hash,
    };

    const serialized = JSON.stringify(message);
    this.broadcast.send(serialized);
    this.wsClient.send(serialized);
  }

  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      const index = this.messageCallbacks.indexOf(callback);
      if (index >= 0) this.messageCallbacks.splice(index, 1);
    };
  }

  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      const index = this.stateCallbacks.indexOf(callback);
      if (index >= 0) this.stateCallbacks.splice(index, 1);
    };
  }

  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  getState(): ConnectionState {
    return this.state;
  }

  async requestSync(sinceTimestamp: number): Promise<SyncMessage[]> {
    return new Promise(resolve => {
      const requestId = generateId();
      this.pendingSyncResolves.set(requestId, resolve);

      setTimeout(() => {
        if (this.pendingSyncResolves.has(requestId)) {
          this.pendingSyncResolves.delete(requestId);
          resolve([]);
        }
      }, 5_000);

      void this.send('sync-request', { requestId, sinceTimestamp });
    });
  }

  private setupBroadcastListener(): void {
    this.broadcast.onMessage(data => this.handleRawMessage(data));
  }

  private setupWebSocketListener(): void {
    this.wsClient.onMessage(data => this.handleRawMessage(data));
  }

  private async handleRawMessage(data: string): Promise<void> {
    let message: SyncMessage;
    try {
      message = JSON.parse(data) as SyncMessage;
    } catch {
      return;
    }

    if (message.roomId !== this.roomId) return;
    if (message.peerId === this.peerId) return;
    if (!this.isValidMessageType(message.type)) return;

    const dedupKey = `${message.peerId}:${message.sequence}`;
    if (this.isDuplicate(dedupKey)) return;

    if (message.type === 'peer-join') {
      this.handlePeerJoin(message);
      return;
    }

    if (message.type === 'peer-leave') {
      this.handlePeerLeave(message);
      return;
    }

    if (message.type === 'heartbeat') {
      this.handleHeartbeat(message.peerId);
      this.sendHeartbeatAck(message.peerId);
      return;
    }

    if (message.type === 'heartbeat-ack') {
      this.handleHeartbeat(message.peerId);
      return;
    }

    if (message.type === 'peer-list') {
      this.handlePeerList(message);
      return;
    }

    if (message.type === 'sync-request') {
      this.handleSyncRequest(message);
      return;
    }

    if (message.type === 'sync-response') {
      this.handleSyncResponse(message);
      return;
    }

    this.updatePeerLastSeen(message.peerId);
    this.bufferMessage(message);
    this.messageCallbacks.forEach(fn => fn(message.type, message.peerId, message.payload));
  }

  private handlePeerJoin(message: SyncMessage): void {
    const name = (message.payload['name'] as string) || 'Unknown';
    this.peers.set(message.peerId, {
      id: message.peerId,
      name,
      joinedAt: message.timestamp,
      lastSeen: Date.now(),
    });

    // Respond with peer list so new peer knows who's here
    void this.send('peer-list', {
      peers: this.getPeers().map(p => ({ id: p.id, name: p.name })),
    });

    this.messageCallbacks.forEach(fn => fn('peer-join', message.peerId, message.payload));
  }

  private handlePeerLeave(message: SyncMessage): void {
    this.peers.delete(message.peerId);
    this.messageCallbacks.forEach(fn => fn('peer-leave', message.peerId, message.payload));
  }

  private handlePeerList(message: SyncMessage): void {
    const peersList = message.payload['peers'] as Array<{ id: string; name: string }>;
    if (!Array.isArray(peersList)) return;

    for (const peer of peersList) {
      if (peer.id === this.peerId) continue;
      if (!this.peers.has(peer.id)) {
        this.peers.set(peer.id, {
          id: peer.id,
          name: peer.name,
          joinedAt: message.timestamp,
          lastSeen: Date.now(),
        });
      } else {
        const existing = this.peers.get(peer.id);
        if (existing) existing.lastSeen = Date.now();
      }
    }
  }

  private handleSyncRequest(message: SyncMessage): void {
    const sinceTimestamp = (message.payload['sinceTimestamp'] as number) || 0;
    const requestId = message.payload['requestId'] as string;
    const bufferedMessages = this.messageBuffer.filter(m => m.timestamp >= sinceTimestamp);

    void this.send('sync-response', {
      requestId,
      messages: bufferedMessages,
      responderName: this.peerName,
    });
  }

  private handleSyncResponse(message: SyncMessage): void {
    const requestId = message.payload['requestId'] as string;
    const messages = message.payload['messages'] as SyncMessage[] | undefined;
    if (!requestId || !messages) return;

    const resolve = this.pendingSyncResolves.get(requestId);
    if (resolve) {
      this.pendingSyncResolves.delete(requestId);
      resolve(messages);
      for (const msg of messages) {
        this.messageCallbacks.forEach(fn => fn(msg.type, msg.peerId, msg.payload));
      }
    }
  }

  private handleHeartbeat(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) peer.lastSeen = Date.now();
  }

  private sendHeartbeatAck(targetPeerId: string): void {
    void this.send('heartbeat-ack', { targetPeerId });
  }

  private broadcastPresence(): void {
    void this.send('peer-join', { name: this.peerName });
  }

  private broadcastLeave(): void {
    void this.send('peer-leave', { name: this.peerName });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      void this.send('heartbeat', {});
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startPeerCleanup(): void {
    this.peerCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, peer] of this.peers) {
        if (now - peer.lastSeen > PEER_TIMEOUT) {
          this.peers.delete(id);
          this.messageCallbacks.forEach(fn => fn('peer-leave', id, { name: peer.name }));
        }
      }
    }, PEER_TIMEOUT);
  }

  private stopPeerCleanup(): void {
    if (this.peerCleanupTimer !== null) {
      clearInterval(this.peerCleanupTimer);
      this.peerCleanupTimer = null;
    }
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateCallbacks.forEach(fn => fn(state));
  }

  private isDuplicate(key: string): boolean {
    const now = Date.now();
    const existing = this.dedupCache.get(key);
    if (existing !== undefined && now - existing < DEDUP_WINDOW_MS) {
      return true;
    }
    this.dedupCache.set(key, now);
    // Periodic cleanup of stale entries
    if (this.dedupCache.size > MAX_SEQUENCE_GAP * 2) {
      for (const [k, v] of this.dedupCache) {
        if (now - v > DEDUP_WINDOW_MS) this.dedupCache.delete(k);
      }
    }
    return false;
  }

  private updatePeerLastSeen(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) peer.lastSeen = Date.now();
  }

  private isValidMessageType(type: string): type is MessageType {
    return [
      'journey-update', 'cursor-move', 'chat',
      'sync-request', 'sync-response', 'peer-join',
      'peer-leave', 'heartbeat', 'heartbeat-ack', 'peer-list',
    ].includes(type);
  }

  private bufferMessage(message: SyncMessage): void {
    this.messageBuffer.push(message);
    if (this.messageBuffer.length > MAX_SEQUENCE_GAP) {
      this.messageBuffer = this.messageBuffer.slice(-MAX_SEQUENCE_GAP);
    }
  }
}

export { type ConnectionState, type MessageType, type SyncMessage, type PeerInfo, WebSocketClient };
