import { type Player } from './game';

export type Session = {
  playerId: string;
  roomId: string;
  roomCode: string;
  nickname: string;
};

const KEY = 'ghost_letters_session';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Session;
    if (!data.playerId || !data.roomId) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
  localStorage.removeItem('ghost_letters_player');
}

export function sessionFromPlayer(player: Player, code: string): Session {
  return { playerId: player.id, roomId: player.room_id, roomCode: code, nickname: player.nickname };
}
