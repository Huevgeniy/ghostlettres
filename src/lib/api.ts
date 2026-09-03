import {
  type Room,
  type Player,
  type RoomSettings,
  type ClueCard,
  type Ballot,
} from './game';
import { request, action, onState, onError as onSocketError, connect, type Snapshot } from './connection';

function asPlayer(p: Player): Player {
  return {
    ...p,
    hand: p.hand ?? [],
    submitted_clue: p.submitted_clue ?? null,
    is_ready: Boolean(p.is_ready),
  };
}

function asRoom(r: Room): Room {
  return { ...r, settings: r.settings ?? {}, state: r.state ?? {} };
}

export async function fetchPlayers(roomId: string): Promise<Player[]> {
  const snap = await request<{ room: Room; players: Player[] }>('rejoin', { roomId });
  return (snap.players ?? []).map(asPlayer);
}

export async function fetchRoom(roomId: string): Promise<Room> {
  const snap = await request<{ room: Room; players: Player[] }>('rejoin', { roomId });
  return asRoom(snap.room);
}

export async function createRoom(hostName: string, settings: RoomSettings): Promise<{ room: Room; player: Player }> {
  const r = await request<{ room: Room; player: Player }>('createRoom', { nickname: hostName, settings });
  return { room: asRoom(r.room), player: asPlayer(r.player) };
}

export async function joinRoom(code: string, nickname: string, existingPlayerId?: string): Promise<{ room: Room; player: Player; players: Player[] }> {
  const r = await request<{ room: Room; player: Player; players: Player[] }>('joinRoom', { code, nickname, playerId: existingPlayerId ?? undefined });
  return { room: asRoom(r.room), player: asPlayer(r.player), players: (r.players ?? []).map(asPlayer) };
}

export function subscribeToRoom(roomId: string, onChange: (room: Room, players: Player[]) => void, onError?: (message: string) => void): () => void {
  onSocketError(onError ?? (() => {}));
  const unsub = onState((snap) => {
    onChange(asRoom(snap.room), (snap.players ?? []).map(asPlayer));
  });
  void connect().then(() => {
    action('refresh', { roomId });
  }).catch((e) => onError?.(e instanceof Error ? e.message : 'Ошибка соединения'));
  return unsub;
}

export async function updateRoomSettings(roomId: string, settings: RoomSettings) {
  action('updateRoomSettings', { roomId, settings });
}

export async function setReady(roomId: string, playerId: string, ready: boolean) {
  action('setReady', { roomId, playerId, ready });
}

export async function startGame(room: Room, _players?: Player[]) {
  action('startGame', { roomId: room.id });
}

export async function chooseCharacter(roomId: string, playerId: string, characterId: string) {
  action('chooseCharacter', { roomId, playerId, characterId });
}

export async function placeTableClue(roomId: string, playerId: string, category: string, note?: string) {
  action('placeTableClue', { roomId, playerId, category, note });
}

export async function chooseTrueClues(roomId: string, choices: Partial<Record<string, string>>, commit = false) {
  action('chooseTrueClues', { roomId, choices, commit });
}

export async function ghostOpening(roomId: string, card: ClueCard | null) {
  action('ghostOpening', { roomId, card });
}

export async function submitClue(roomId: string, player: Player, card: ClueCard) {
  action('submitClue', { roomId, playerId: player.id, card });
}

export async function ghostResolveMailbox(roomId: string, ids: string[]) {
  action('ghostResolveMailbox', { roomId, ids });
}

export async function discardAndRefill(roomId: string, player: Player, discardCardId: string | null) {
  action('discardAndRefill', { roomId, playerId: player.id, discardCardId });
}

export async function passSpeech(roomId: string) {
  action('passSpeech', { roomId });
}

export async function startNextRoundOrVote(roomId: string) {
  action('startNextRoundOrVote', { roomId });
}

export async function lockBallot(roomId: string, playerId: string, picks: Ballot['picks'], killerId: string | null) {
  action('lockBallot', { roomId, playerId, picks, killerId });
}

export async function revealTruth(roomId: string) {
  action('revealTruth', { roomId });
}

export async function resetToLobby(roomId: string) {
  action('resetToLobby', { roomId });
}

export async function expireTimer(roomId: string) {
  action('expireTimer', { roomId });
}

export async function leaveRoom(roomId: string, playerId: string) {
  action('leaveRoom', { roomId, playerId });
}

// ---- способности персонажей ----

export async function activateAbility(roomId: string, playerId: string) {
  action('activateAbility', { roomId, playerId });
}
export async function cancelAbility(roomId: string, playerId: string) {
  action('cancelAbility', { roomId, playerId });
}
export async function abilityOwnerPick(roomId: string, playerId: string, choice: string) {
  action('abilityOwnerPick', { roomId, playerId, choice });
}
export async function abilityGhostPick(roomId: string, playerId: string, picks: string[]) {
  action('abilityGhostPick', { roomId, playerId, picks });
}
export async function abilityGhostNumber(roomId: string, playerId: string, n: number) {
  action('abilityGhostNumber', { roomId, playerId, n });
}
export async function abilityFinish(roomId: string, playerId: string) {
  action('abilityFinish', { roomId, playerId });
}
export async function abilityCopy(roomId: string, playerId: string, characterId: string) {
  action('abilityCopy', { roomId, playerId, characterId });
}
export async function abilityOwnerDiscard(roomId: string, playerId: string, ids: string[]) {
  action('abilityOwnerDiscard', { roomId, playerId, ids });
}
export async function abilitySendToGhost(roomId: string, playerId: string, ids: string[]) {
  action('abilitySendToGhost', { roomId, playerId, ids });
}
export async function abilityPlayerSubmit(roomId: string, playerId: string, cardId: string) {
  action('abilityPlayerSubmit', { roomId, playerId, cardId });
}
export async function abilityGhostSkip(roomId: string, playerId: string) {
  action('abilityGhostSkip', { roomId, playerId });
}
export async function politicianExtraVote(roomId: string, playerId: string, category: string, clueId: string) {
  action('politicianExtraVote', { roomId, playerId, category, clueId });
}
