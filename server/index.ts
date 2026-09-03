// WebSocket-сервер для «Писем призрака».
//
// Держит авторитетное состояние всех комнат в памяти (см. engine.ts) и
// синхронизирует его всем клиентам в комнате в реальном времени.
// Одновременно отдаёт собранные статические файлы из dist/ (если они есть),
// чтобы игру можно было выложить на любой хостинг, поддерживающий Node.js.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  createRoom,
  handleJoin,
  handleRejoin,
  updateRoomSettings,
  setReady,
  leaveRoom,
  startGame,
  chooseCharacter,
  activateAbility,
  cancelAbility,
  abilityCopy,
  abilityOwnerPick,
  abilityOwnerDiscard,
  abilitySendToGhost,
  abilityPlayerSubmit,
  abilityGhostPick,
  abilityGhostSkip,
  abilityGhostNumber,
  politicianExtraVote,
  abilityFinish,
  placeTableClue,
  chooseTrueClues,
  ghostOpening,
  submitClue,
  ghostResolveMailbox,
  discardAndRefill,
  passSpeech,
  startNextRoundOrVote,
  lockBallot,
  revealTruth,
  resetToLobby,
  expireTimer,
  ROOMS,
  type RoomAgg,
} from './engine';

const PORT = Number(process.env.PORT || 3001);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');

const server = http.createServer((req, res) => {
  // Статическая отдача собранного фронтенда.
  try {
    if (!fs.existsSync(DIST)) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Сервер работает. Соберите фронтенд командой `npm run build`, чтобы играть. (WebSocket активен)');
      return;
    }
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(DIST)) filePath = path.join(DIST, 'index.html');
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.map': 'application/json',
    };
    res.writeHead(200, { 'content-type': mime[ext] ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String(e));
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

// Каждый сокет привязан к комнате, в которой он находится.
type Client = WebSocket & { roomId?: string };

function broadcast(agg: RoomAgg) {
  const payload = JSON.stringify({ type: 'state', room: agg.room, players: agg.players });
  for (const client of wss.clients) {
    const c = client as Client;
    if (c.readyState === WebSocket.OPEN && c.roomId === agg.id) {
      c.send(payload);
    }
  }
}

function send(w: Client, obj: unknown) {
  if (w.readyState === WebSocket.OPEN) w.send(JSON.stringify(obj));
}

function run(agg: RoomAgg | null, w: Client) {
  if (!agg) return;
  broadcast(agg);
}

wss.on('connection', (rawWs) => {
  const ws = rawWs as Client;
  ws.on('message', (data) => {
    let msg: any;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    const t = msg?.type as string | undefined;
    if (!t) return;

    try {
      switch (t) {
        case 'ping': {
          send(ws, { type: 'pong' });
          break;
        }
        case 'createRoom': {
          const { room, player, agg } = createRoom(msg.nickname, msg.settings);
          ws.roomId = agg.id;
          send(ws, { id: msg.id, type: 'joined', room, player });
          broadcast(agg);
          break;
        }
        case 'joinRoom': {
          const { room, player, agg } = handleJoin(msg.code, msg.nickname, msg.playerId);
          ws.roomId = agg.id;
          send(ws, { id: msg.id, type: 'joined', room, player });
          broadcast(agg);
          break;
        }
        case 'rejoin': {
          const agg = handleRejoin(msg.roomId, msg.playerId ?? '');
          ws.roomId = agg.id;
          send(ws, { id: msg.id, type: 'joined', room: agg.room, players: agg.players });
          broadcast(agg);
          break;
        }
        case 'refresh': {
          const agg = requireAgg(msg.roomId, ws);
          run(agg, ws);
          break;
        }
        case 'updateRoomSettings': {
          const agg = requireAgg(msg.roomId, ws);
          updateRoomSettings(agg, msg.settings);
          run(agg, ws);
          break;
        }
        case 'setReady': {
          const agg = requireAgg(msg.roomId, ws);
          setReady(agg, msg.playerId, msg.ready);
          run(agg, ws);
          break;
        }
        case 'startGame': {
          const agg = requireAgg(msg.roomId, ws);
          run(startGame(agg), ws);
          break;
        }
        case 'chooseCharacter': {
          const agg = requireAgg(msg.roomId, ws);
          run(chooseCharacter(agg, msg.playerId, msg.characterId), ws);
          break;
        }
        case 'activateAbility': {
          const agg = requireAgg(msg.roomId, ws);
          run(activateAbility(agg, msg.playerId), ws);
          break;
        }
        case 'cancelAbility': {
          const agg = requireAgg(msg.roomId, ws);
          run(cancelAbility(agg, msg.playerId), ws);
          break;
        }
        case 'abilityCopy': {
          const agg = requireAgg(msg.roomId, ws);
          run(abilityCopy(agg, msg.playerId, msg.characterId), ws);
          break;
        }
        case 'abilityOwnerPick': {
          const agg = requireAgg(msg.roomId, ws);
          run(abilityOwnerPick(agg, msg.playerId, msg.choice), ws);
          break;
        }
        case 'abilityOwnerDiscard': {
          const agg = requireAgg(msg.roomId, ws);
          run(abilityOwnerDiscard(agg, msg.playerId, msg.ids ?? []), ws);
          break;
        }
        case 'abilitySendToGhost': {
          const agg = requireAgg(msg.roomId, ws);
          run(abilitySendToGhost(agg, msg.playerId, msg.ids ?? []), ws);
          break;
        }
        case 'abilityPlayerSubmit': {
          const agg = requireAgg(msg.roomId, ws);
          run(abilityPlayerSubmit(agg, msg.playerId, msg.cardId), ws);
          break;
        }
        case 'abilityGhostPick': {
          const agg = requireAgg(msg.roomId, ws);
          run(abilityGhostPick(agg, msg.playerId, msg.picks ?? []), ws);
          break;
        }
        case 'abilityGhostSkip': {
          const agg = requireAgg(msg.roomId, ws);
          run(abilityGhostSkip(agg, msg.playerId), ws);
          break;
        }
        case 'abilityGhostNumber': {
          const agg = requireAgg(msg.roomId, ws);
          run(abilityGhostNumber(agg, msg.playerId, msg.n), ws);
          break;
        }
        case 'politicianExtraVote': {
          const agg = requireAgg(msg.roomId, ws);
          run(politicianExtraVote(agg, msg.playerId, msg.category, msg.clueId), ws);
          break;
        }
        case 'abilityFinish': {
          const agg = requireAgg(msg.roomId, ws);
          run(abilityFinish(agg, msg.playerId), ws);
          break;
        }
        case 'placeTableClue': {
          const agg = requireAgg(msg.roomId, ws);
          run(placeTableClue(agg, msg.playerId, msg.category, msg.note), ws);
          break;
        }
        case 'chooseTrueClues': {
          const agg = requireAgg(msg.roomId, ws);
          run(chooseTrueClues(agg, msg.choices ?? {}, Boolean(msg.commit)), ws);
          break;
        }
        case 'ghostOpening': {
          const agg = requireAgg(msg.roomId, ws);
          run(ghostOpening(agg, msg.card ?? null), ws);
          break;
        }
        case 'submitClue': {
          const agg = requireAgg(msg.roomId, ws);
          run(submitClue(agg, msg.playerId, msg.card), ws);
          break;
        }
        case 'ghostResolveMailbox': {
          const agg = requireAgg(msg.roomId, ws);
          run(ghostResolveMailbox(agg, msg.ids ?? []), ws);
          break;
        }
        case 'discardAndRefill': {
          const agg = requireAgg(msg.roomId, ws);
          const player = agg.players.find((p) => p.id === msg.playerId);
          if (player) run(discardAndRefill(agg, player, msg.discardCardId ?? null), ws);
          break;
        }
        case 'passSpeech': {
          const agg = requireAgg(msg.roomId, ws);
          run(passSpeech(agg), ws);
          break;
        }
        case 'startNextRoundOrVote': {
          const agg = requireAgg(msg.roomId, ws);
          run(startNextRoundOrVote(agg), ws);
          break;
        }
        case 'lockBallot': {
          const agg = requireAgg(msg.roomId, ws);
          run(lockBallot(agg, msg.playerId, msg.picks ?? {}, msg.killerId ?? null), ws);
          break;
        }
        case 'revealTruth': {
          const agg = requireAgg(msg.roomId, ws);
          run(revealTruth(agg), ws);
          break;
        }
        case 'resetToLobby': {
          const agg = requireAgg(msg.roomId, ws);
          run(resetToLobby(agg), ws);
          break;
        }
        case 'expireTimer': {
          const agg = requireAgg(msg.roomId, ws);
          run(expireTimer(agg), ws);
          break;
        }
        case 'leaveRoom': {
          const agg = requireAgg(msg.roomId, ws);
          leaveRoom(agg, msg.playerId);
          broadcast(agg);
          ws.roomId = undefined;
          break;
        }
        default:
          break;
      }
    } catch (e) {
      send(ws, { id: msg?.id, type: 'error', message: e instanceof Error ? e.message : 'Ошибка обработки' });
    }
  });

  ws.on('close', () => { ws.roomId = undefined; });
});

function requireAgg(roomId: string | undefined, ws: Client): RoomAgg {
  // Сначала пытаемся по явному roomId, затем по комнате, к которой привязан сокет.
  const candidates = [roomId, ws.roomId];
  for (const id of candidates) {
    if (!id) continue;
    const agg = ROOMS.get(id);
    if (agg) return agg;
  }
  throw new Error('Комната не найдена');
}

server.listen(PORT, () => {
  console.log(`Ghost Letters server on ws://localhost:${PORT}/ws`);
});
