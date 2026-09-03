// WebSocket-клиент: единый канал связи с игровым сервером.
// Сервер держит авторитетное состояние комнаты и рассылает снапшоты
// {room, players} всем клиентам комнаты в реальном времени.

export type Snapshot = { room: any; players: any[] };

let socket: WebSocket | null = null;
let url = import.meta.env.VITE_WS_URL as string | undefined;
if (!url) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const isLoopback = ['localhost', '127.0.0.1'].includes(location.hostname);
  // Локальная разработка: vite (5173) + отдельный WebSocket-сервер (3001).
  if (isLoopback && (location.port === '5173' || location.port === '5174')) {
    url = `${proto}//${location.hostname}:3001/ws`;
  } else {
    // Продакшен/обычный запуск: фронтенд и WebSocket отдаёт один сервер с этим же
    // origin (location.host уже включает порт, например localhost:3001).
    url = `${proto}//${location.host}/ws`;
  }
}
const SOCKET_URL: string = url as string;

const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
let seq = 0;
let subs = new Set<(snap: Snapshot) => void>();
let onErrorHandler: ((message: string) => void) | null = null;
let onOpenHandler: (() => void) | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;

export function onState(cb: (snap: Snapshot) => void): () => void {
  subs.add(cb);
  return () => { subs.delete(cb); };
}
export function onError(cb: (message: string) => void) {
  onErrorHandler = cb;
}
export function onOpen(cb: () => void) {
  onOpenHandler = cb;
}
export function isConnected(): boolean {
  return !!socket && socket.readyState === WebSocket.OPEN;
}

function ensureOpen(): Promise<void> {
  if (isConnected()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (!socket) {
      socket = new WebSocket(SOCKET_URL);
      socket.onopen = () => {
        consecutiveFailures = 0;
        startHeartbeat();
        onOpenHandler?.();
        resolve();
      };
      socket.onmessage = (ev) => handleMessage(String(ev.data));
      socket.onclose = () => {
        stopHeartbeat();
        scheduleReconnect();
      };
      socket.onerror = () => { /* обрабатывается через onclose */ };
    } else if (socket.readyState === WebSocket.CONNECTING) {
      socket.onopen = () => {
        onOpenHandler?.();
        resolve();
      };
    } else {
      reject(new Error('Соединение не установлено'));
    }
    // таймаут ожидания соединения
    setTimeout(() => {
      if (!isConnected()) reject(new Error('Не удалось соединиться с сервером'));
    }, 8000);
  });
}

// Периодический ping, чтобы держать соединение живым и вовремя замечать обрыв.
function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    try {
      if (isConnected() && socket) socket.send(JSON.stringify({ type: 'ping' }));
    } catch { /* ignore */ }
  }, 15000);
}
function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

function scheduleReconnect() {
  socket = null;
  consecutiveFailures++;
  // Если соединение не поднимается несколько раз подряд — сообщаем пользователю,
  // но продолжаем попытки переподключиться автоматически.
  if (consecutiveFailures >= 2) {
    onErrorHandler?.('Нет соединения с игровым сервером. Проверьте, что он запущен.');
  }
  if (reconnectTimer) return; // уже запланировано
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch(() => {});
  }, 1500);
}

/** Устанавливает активное соединение и возвращает состояние сервера немедленно (если уже есть). */
export function connect(): Promise<void> {
  return ensureOpen().catch((e) => { throw e; });
}

function handleMessage(raw: string) {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.type === 'state') {
    const snap: Snapshot = { room: msg.room, players: msg.players };
    subs.forEach((cb) => { cb(snap); });
    return;
  }
  if (msg.type === 'error' && msg.id === undefined) {
    onErrorHandler?.(msg.message);
    return;
  }
  if (msg.id !== undefined) {
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      if (msg.type === 'error') p.reject(new Error(msg.message));
      else p.resolve(msg);
    }
  }
}

export function request<T = any>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const body = { id, type, ...payload };
    if (isConnected()) {
      socket!.send(JSON.stringify(body));
      return;
    }
    connect()
      .then(() => {
        if (socket) socket.send(JSON.stringify(body));
      })
      .catch(() => {
        pending.delete(id);
        reject(new Error('Нет соединения с сервером'));
      });
    // таймаут ответа
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('Сервер не ответил. Попробуйте ещё раз.'));
      }
    }, 10000);
  });
}

/** Одношаговое действие (без ожидания ответа — состояние придёт через state-снапшот). */
export function action(type: string, payload: Record<string, unknown> = {}): void {
  const body = { type, ...payload };
  if (isConnected()) {
    socket!.send(JSON.stringify(body));
    return;
  }
  connect()
    .then(() => { if (socket) socket.send(JSON.stringify(body)); })
    .catch(() => onErrorHandler?.('Нет соединения с сервером'));
}
