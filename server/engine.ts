 // Серверный игровой движок. Владеет авторитетным состоянием комнаты и
// применяет к нему игровые действия. Все данные хранятся в памяти сервера
// и синхронизируются клиентам через WebSocket.

import {
  type Room,
  type Player,
  type RoomSettings,
  type Role,
  type ClueCard,
  type Ballot,
  type TallyResult,
  type AbilityState,
  type CharacterInfo,
  type SubmittedClue,
  randomCode,
  shuffle,
  rolesForGame,
  takeCards,
  refillHand,
  clockwiseOrder,
  nextPlayer,
  nextSpeaker,
  cluesPerCategory,
  activeCategories,
  tableSize,
  addEvent,
  deadlineFromNow,
  timerSecondsForPhase,
  computeTally,
  evaluateCase,
  buildDeck,
  randomCharacters,
  CHARACTER_ABILITIES,
} from '../src/lib/game';

export type RoomAgg = {
  id: string;
  code: string;
  room: Room;
  players: Player[];
};

export const ROOMS = new Map<string, RoomAgg>();

let roomCounter = 0;
export function nextRoomId(): string {
  roomCounter += 1;
  return `room-${Date.now().toString(36)}-${roomCounter}`;
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function makePlayer(playerId: string, roomId: string, nickname: string): Player {
  return {
    id: playerId,
    room_id: roomId,
    nickname,
    role: null,
    hand: [],
    submitted_clue: null,
    is_ready: false,
    character: null,
    joined_at: new Date().toISOString(),
  };
}

function getPlayer(agg: RoomAgg, id: string): Player | null {
  return agg.players.find((p) => p.id === id) ?? null;
}

export function createRoom(nickname: string, settings: RoomSettings): { room: Room; player: Player; agg: RoomAgg } {
  const id = nextRoomId();
  const code = uniqueCode();
  const host: Player = makePlayer(newId('p'), id, nickname);
  const room: Room = {
    id,
    code,
    host_name: nickname,
    player_count: 1,
    settings: { ...settings },
    phase: 'lobby',
    state: { events: addEvent({}, `${nickname} создал комнату`) },
    created_at: new Date().toISOString(),
  };
  const agg: RoomAgg = { id, code, room, players: [host] };
  ROOMS.set(id, agg);
  return { room, player: host, agg };
}

export function handleJoin(code: string, nickname: string, existingPlayerId?: string): { room: Room; player: Player; agg: RoomAgg } {
  const agg = [...ROOMS.values()].find((a) => a.code.toUpperCase() === code.toUpperCase().trim());
  if (!agg) throw new Error('Комната с таким кодом не найдена');
  if (existingPlayerId && agg.players.some((p) => p.id === existingPlayerId)) {
    const mine = agg.players.find((p) => p.id === existingPlayerId)!;
    return { room: agg.room, player: mine, agg };
  }
  const sameNick = agg.players.find((p) => p.nickname === nickname);
  if (sameNick) return { room: agg.room, player: sameNick, agg };
  if (agg.room.phase !== 'lobby') throw new Error('Партия уже началась');
  if ((agg.room.player_count ?? 0) >= agg.room.settings.playerCount) throw new Error('Комната заполнена');
  const p = makePlayer(newId('p'), agg.id, nickname);
  agg.players.push(p);
  agg.room.player_count = agg.players.length;
  agg.room.state.events = addEvent(agg.room.state, `${nickname} присоединился`);
  return { room: agg.room, player: p, agg };
}

export function handleRejoin(roomId: string, playerId: string): RoomAgg {
  const agg = ROOMS.get(roomId);
  if (!agg) throw new Error('Комната не найдена');
  // Валидацию сессии выполняет клиент: если игрока нет в комнате,
  // App покажет экран восстановления сессии. Здесь просто отдаём состояние.
  return agg;
}

function uniqueCode(): string {
  for (let i = 0; i < 100; i++) {
    const c = randomCode();
    if (![...ROOMS.values()].some((a) => a.code === c)) return c;
  }
  return randomCode();
}

function withDeadline(state: Room['state'], phase: Room['phase'], settings: RoomSettings): Room['state'] {
  const seconds = timerSecondsForPhase(phase, settings);
  return { ...state, deadlineAt: seconds ? deadlineFromNow(seconds) : null };
}

// ---- действия над настройками / готовностью ----

export function updateRoomSettings(agg: RoomAgg, settings: RoomSettings): void {
  agg.room.settings = { ...settings };
}

export function setReady(agg: RoomAgg, playerId: string, ready: boolean): void {
  const p = getPlayer(agg, playerId);
  if (p) p.is_ready = ready;
}

export function leaveRoom(agg: RoomAgg, playerId: string): void {
  agg.players = agg.players.filter((p) => p.id !== playerId);
  agg.room.player_count = agg.players.length;
  if (agg.players.length === 0) {
    ROOMS.delete(agg.id);
  }
}

// ---- старт игры ----

function assignRoles(players: Player[], settings: RoomSettings): { roles: (Role | null)[]; discardedRole: Role | null } {
  let roles = shuffle(rolesForGame(players.length, settings));
  let discardedRole: Role | null = null;
  if (settings.discardRole && settings.hasKiller && players.length <= 6) {
    const ghost = roles.filter((r) => r === 'ghost');
    const rest = roles.filter((r) => r !== 'ghost');
    const deck = shuffle([...rest, 'detective' as Role]);
    discardedRole = deck.pop() ?? null;
    const finalDeck = shuffle([...deck, ...ghost]);
    if (finalDeck.length === players.length) roles = finalDeck;
  }
  return { roles, discardedRole };
}

export function startGame(agg: RoomAgg): RoomAgg {
  const { room, players } = agg;
  const settings = room.settings;
  if (room.phase !== 'lobby') throw new Error('Партия уже началась');
  const assigned = assignRoles(players, settings);
  const roles = assigned.roles;
  players.forEach((p, i) => {
    p.role = roles[i] ?? null;
    p.hand = [];
    p.submitted_clue = null;
    p.is_ready = false;
    p.character = null;
  });
  const ghostId = players.find((_, i) => roles[i] === 'ghost')?.id ?? players[0]?.id;

  const baseState: Room['state'] = {
    deck: [],
    discard: [],
    vanished: [],
    hints: [],
    table: [],
    layingCard: null,
    layingPlayerId: null,
    trueChoices: null,
    round: 0,
    radioPlayerId: null,
    speakerId: null,
    spokenIds: [],
    refreshedIds: [],
    ballots: {},
    tally: null,
    voteRound: 1,
    voteScope: activeCategories(settings).map((c) => c.key),
    voteScopeKiller: settings.hasKiller,
    voteDecided: {},
    winners: null,
    resultSummary: null,
    discardedRole: assigned.discardedRole,
    events: addEvent(room.state, 'Роли розданы. Призрак открыт.'),
  };

  if (settings.characters) {
    const charOffers: Record<string, CharacterInfo[]> = {};
    const used: string[] = [];
    players.forEach((p, i) => {
      if ((roles[i] ?? null) === 'ghost') { charOffers[p.id] = []; return; }
      const two = randomCharacters(2, used);
      two.forEach((c) => used.push(c.id));
      charOffers[p.id] = two;
    });
    room.phase = 'character_choice';
    room.state = withDeadline({ ...baseState, charOffers, layingCard: null }, 'voting', settings);
    return agg;
  }

  const drawn = takeCards({ deck: shuffle(buildDeck()), discard: [] }, 1);
  room.phase = 'setup';
  room.state = withDeadline({
    ...baseState,
    deck: drawn.state.deck,
    layingCard: drawn.cards[0] ?? null,
    layingPlayerId: ghostId,
    events: addEvent(room.state, 'Роли розданы. Собираем улики на стол.'),
  }, 'setup', settings);
  return agg;
}

// ---- выбор персонажей ----

export function chooseCharacter(agg: RoomAgg, playerId: string, characterId: string): RoomAgg {
  const { room, players } = agg;
  const me = players.find((p) => p.id === playerId);
  if (!me || me.role === 'ghost') return agg;
  if (me.character) return agg;
  const offer = room.state.charOffers?.[playerId] ?? [];
  if (!offer.some((c) => c.id === characterId)) return agg;
  me.character = characterId;
  const nonGhost = players.filter((p) => p.role !== 'ghost');
  const allChose = nonGhost.every((p) => !!p.character);
  if (!allChose) return agg;
  if (room.phase !== 'character_choice') return agg;
  const ghost = players.find((p) => p.role === 'ghost');
  const drawn = takeCards({ deck: shuffle(buildDeck()), discard: [] }, 1);
  room.phase = 'setup';
  room.state = withDeadline({
    ...room.state,
    charOffers: undefined,
    deck: drawn.state.deck,
    layingCard: drawn.cards[0] ?? null,
    layingPlayerId: ghost?.id ?? players[0]?.id ?? null,
    events: addEvent(room.state, 'Персонажи выбраны. Собираем улики на стол.'),
  }, 'setup', room.settings);
  return agg;
}

// ==== способности персонажей ====

function used(state: Room['state'], id: string): boolean {
  return (state.usedAbilities ?? []).includes(id);
}

export function activateAbility(agg: RoomAgg, playerId: string): RoomAgg {
  const { room } = agg;
  const me = getPlayer(agg, playerId);
  if (!me || me.role === 'ghost' || !me.character) return agg;
  const def = CHARACTER_ABILITIES[me.character];
  if (!def) return agg;
  if (used(room.state, me.character)) return agg;
  if (room.state.ability) return agg;

  const base: AbilityState = {
    ownerId: playerId,
    characterId: me.character,
    kind: def.kind,
    step: 'owner_target',
    resumePhase: room.phase,
    revealed: [],
    ghostPicks: [],
    pickedPlayers: [],
  };

  if (def.kind === 'send_two' || def.kind === 'extra_vote') {
    room.state = { ...room.state, usedAbilities: [...(room.state.usedAbilities ?? []), def.id], events: addEvent(room.state, `${me.nickname} (${def.title}) готов использовать способность.`) };
    return agg;
  }
  if (def.kind === 'discard_hand') {
    room.state = { ...room.state, ability: { ...base, step: 'owner_discard', revealTo: 'owner', revealed: me.hand }, usedAbilities: [...(room.state.usedAbilities ?? []), def.id] };
    return agg;
  }
  if (def.kind === 'copy_other') {
    room.state = { ...room.state, ability: { ...base, step: 'copy_pick' } };
    return agg;
  }
  if (def.kind === 'show_deck3') {
    const drawn = takeCards(room.state, 3);
    room.state = { ...room.state, deck: drawn.state.deck, ability: { ...base, step: 'reveal_pick', revealTo: 'owner_ghost', revealed: drawn.cards, done: drawn.cards.map((c) => c.id) } };
    return agg;
  }
  if (def.kind === 'send_deck3') {
    const drawn = takeCards(room.state, 3);
    room.state = { ...room.state, ability: { ...base, step: 'send_to_ghost', revealTo: 'owner', revealed: drawn.cards }, deck: drawn.state.deck };
    return agg;
  }
  if (def.kind === 'view_discard3') {
    const pick = shuffle(room.state.discard ?? []).slice(0, 3);
    room.state = { ...room.state, ability: { ...base, step: 'owner_view', revealTo: 'owner', revealed: pick } };
    return agg;
  }
  if (def.kind === 'ghost_from_discard') {
    const discardPool = (room.state.discard ?? []).map((c) => c.id);
    room.state = { ...room.state, ability: { ...base, step: 'ghost_action', revealTo: 'ghost', done: discardPool } };
    return agg;
  }
  if (def.kind === 'reveal_hand_left' || def.kind === 'reveal_hand_point') {
    room.state = { ...room.state, ability: { ...base, step: 'ghost_action', revealTo: 'ghost', handRevealed: me.hand, done: me.hand.map((c) => c.id) } };
    return agg;
  }
  if (def.kind === 'trainer') {
    room.state = { ...room.state, ability: base };
    return agg;
  }
  const step: AbilityState['step'] = def.ownerTargets?.length ? 'owner_target' : 'ghost_action';
  room.state = { ...room.state, ability: { ...base, step } };
  return agg;
}

export function cancelAbility(agg: RoomAgg, playerId: string): RoomAgg {
  const { room } = agg;
  const ab = room.state.ability;
  if (!ab || ab.ownerId !== playerId) return agg;
  let state: Room['state'] = { ...room.state, ability: null };
  if (ab.kind === 'show_deck3' || ab.kind === 'send_deck3') {
    const returned = ab.revealed ?? [];
    state = { ...state, discard: [...(state.discard ?? []), ...returned] };
  }
  if (ab.characterId === 'актер') {
    state.usedAbilities = (state.usedAbilities ?? []).filter((c) => c !== ab.characterId);
  }
  room.state = state;
  return agg;
}

export function abilityCopy(agg: RoomAgg, playerId: string, characterId: string): RoomAgg {
  const { room, players } = agg;
  const ab = room.state.ability;
  const me = players.find((p) => p.id === playerId);
  if (!ab || ab.kind !== 'copy_other' || !me || !me.character) return agg;
  const target = players.find((p) => p.character === characterId && p.id !== me.id);
  const targetDef = CHARACTER_ABILITIES[characterId];
  if (!target || !targetDef) return agg;
  room.state = { ...room.state, ability: { ...ab, characterId, kind: targetDef.kind, step: targetDef.ownerTargets?.length ? 'owner_target' : 'ghost_action', copiedId: characterId, done: [] } };
  return agg;
}

export function abilityOwnerPick(agg: RoomAgg, playerId: string, choice: string): RoomAgg {
  const { room, players } = agg;
  const ab = room.state.ability;
  if (!ab || ab.ownerId !== playerId || ab.step !== 'owner_target') return agg;
  const def = CHARACTER_ABILITIES[ab.characterId];
  if (!def) return agg;
  if (ab.kind === 'discard_hand') return agg;
  if (ab.kind === 'trainer') {
    const ids = choice.split(',').filter(Boolean).slice(0, 3);
    const playersToSubmit = players.filter((p) => ids.includes(p.id) && p.role !== 'ghost' && p.id !== playerId);
    room.state = { ...room.state, ability: { ...ab, step: 'player_submit', pickedPlayers: playersToSubmit.map((p) => p.id) } };
    return agg;
  }
  const next = def.ownerTargets?.length ? 'ghost_action' : 'owner_view';
  room.state = { ...room.state, ability: { ...ab, step: next, ownerChoice: choice } };
  return agg;
}

export function abilityOwnerDiscard(agg: RoomAgg, playerId: string, ids: string[]): RoomAgg {
  const { room } = agg;
  const ab = room.state.ability;
  const me = getPlayer(agg, playerId);
  if (!ab || ab.ownerId !== playerId || ab.kind !== 'discard_hand' || ab.step !== 'owner_discard' || !me) return agg;
  const toDiscard = me.hand.filter((c) => ids.includes(c.id));
  const remaining = me.hand.filter((c) => !ids.includes(c.id));
  let state: Room['state'] = { ...room.state, discard: [...(room.state.discard ?? []), ...toDiscard] };
  const filled = refillHand({ ...me, hand: remaining }, state, 5);
  me.hand = filled.player.hand;
  room.state = { ...filled.state, events: addEvent(room.state, `${me.nickname} (Дезинсектор) сбросил карты и доборал руку.`) };
  return abilityFinish(agg, playerId);
}

export function abilitySendToGhost(agg: RoomAgg, playerId: string, ids: string[]): RoomAgg {
  const { room } = agg;
  const ab = room.state.ability;
  const me = getPlayer(agg, playerId);
  if (!ab || ab.ownerId !== playerId || ab.kind !== 'send_deck3' || ab.step !== 'send_to_ghost' || !me) return agg;
  const toSend = (ab.revealed ?? []).filter((c) => ids.includes(c.id));
  const toDiscard = (ab.revealed ?? []).filter((c) => !ids.includes(c.id));
  let state: Room['state'] = { ...room.state, discard: [...(room.state.discard ?? []), ...toDiscard] };
  state.hints = [...(state.hints ?? []), ...toSend];
  state.events = addEvent(state, `${me.nickname} (Повар) отправил призраку карты из колоды.`);
  room.state = { ...state, ability: null };
  return abilityFinish(agg, playerId);
}

export function abilityPlayerSubmit(agg: RoomAgg, playerId: string, cardId: string): RoomAgg {
  const { room } = agg;
  const ab = room.state.ability;
  const me = getPlayer(agg, playerId);
  if (!ab || ab.kind !== 'trainer' || ab.step !== 'player_submit' || !me) return agg;
  if (!(ab.pickedPlayers ?? []).includes(playerId)) return agg;
  const card = me.hand.find((c) => c.id === cardId);
  if (!card) return agg;
  const done = [...(ab.done ?? []), cardId];
  const subs = [...(ab.copies ?? [])];
  const idx = subs.findIndex((s) => s.playerId === playerId);
  if (idx >= 0) subs[idx] = { playerId, card }; else subs.push({ playerId, card });
  me.hand = me.hand.filter((c) => c.id !== cardId);
  const allIn = (ab.pickedPlayers ?? []).every((id) => subs.some((s) => s.playerId === id));
  room.state = { ...room.state, ability: { ...ab, step: allIn ? 'ghost_action' : 'player_submit', done, copies: subs, pickedPlayers: allIn ? [] : (ab.pickedPlayers ?? []).filter((id) => id !== playerId) } };
  return agg;
}

export function abilityGhostPick(agg: RoomAgg, playerId: string, picks: string[]): RoomAgg {
  const { room } = agg;
  const ab = room.state.ability;
  const me = getPlayer(agg, playerId);
  if (!ab || !me || me.role !== 'ghost') return agg;
  if (ab.kind === 'show_deck3') {
    const revealed = ab.revealed ?? [];
    const discard = [...(room.state.discard ?? [])];
    let hints = [...(room.state.hints ?? [])];
    if (picks.length) { const k = revealed.find((c) => c.id === picks[0]); if (k) hints = [...hints, k]; }
    discard.push(...revealed.filter((c) => c.id !== picks[0]));
    room.state = { ...room.state, ability: { ...ab, step: 'owner_view', ghostPicks: picks, done: [] }, hints, discard, events: addEvent(room.state, 'Игрок использовал способность: карты из колоды открыты.') };
    return agg;
  }
  if (ab.kind === 'ghost_from_discard') {
    const pick = (room.state.discard ?? []).find((c) => c.id === picks[0]) ?? null;
    room.state = { ...room.state, ability: { ...ab, step: 'owner_view', revealTo: 'owner', revealed: pick ? [pick] : [], ghostPicks: picks } };
    return agg;
  }
  if (ab.kind === 'reveal_hand_left') {
    const picked = (ab.handRevealed ?? []).filter((c) => picks.includes(c.id));
    room.state = { ...room.state, ability: { ...ab, step: 'owner_view', ghostPicks: picks, toDiscard: picked } };
    return agg;
  }
  if (ab.kind === 'reveal_hand_point') {
    const pick = (ab.handRevealed ?? []).find((c) => c.id === picks[0]) ?? null;
    room.state = { ...room.state, ability: { ...ab, step: 'owner_view', revealTo: 'owner', revealed: pick ? [pick] : [], ghostPicks: picks } };
    return agg;
  }
  if (ab.kind === 'trainer') {
    const subs = ab.copies ?? [];
    const best = subs.find((s) => s.card.id === picks[0])?.card ?? null;
    room.state = { ...room.state, ability: { ...ab, step: 'owner_view', revealTo: 'owner', revealed: best ? [best] : [], ghostPicks: picks } };
    return agg;
  }
  if (ab.step === 'ghost_action') {
    room.state = { ...room.state, ability: { ...ab, step: 'owner_view', ghostPicks: picks, done: [] } };
    return agg;
  }
  return agg;
}

export function abilityGhostSkip(agg: RoomAgg, playerId: string): RoomAgg {
  const { room } = agg;
  const ab = room.state.ability;
  const me = getPlayer(agg, playerId);
  if (!ab || !me || me.role !== 'ghost') return agg;
  if (ab.kind === 'show_deck3') {
    const discard = [...(room.state.discard ?? [])];
    discard.push(...(ab.revealed ?? []));
    room.state = { ...room.state, ability: { ...ab, step: 'owner_view', ghostPicks: [], done: [] }, discard };
    return agg;
  }
  if (ab.kind === 'reveal_hand_point') {
    room.state = { ...room.state, ability: { ...ab, step: 'owner_view', revealed: [], ghostPicks: [] } };
    return agg;
  }
  return agg;
}

export function abilityGhostNumber(agg: RoomAgg, playerId: string, n: number): RoomAgg {
  const { room } = agg;
  const ab = room.state.ability;
  const me = getPlayer(agg, playerId);
  if (!ab || !me || me.role !== 'ghost' || ab.step !== 'ghost_action') return agg;
  room.state = { ...room.state, ability: { ...ab, step: 'owner_view', resultNumber: n, ghostPicks: [] } };
  return agg;
}

export function politicianExtraVote(agg: RoomAgg, playerId: string, category: string, clueId: string): RoomAgg {
  const { room } = agg;
  const me = getPlayer(agg, playerId);
  if (!me || me.character !== 'политик') return agg;
  if (used(room.state, 'политик')) return agg;
  if (room.phase !== 'voting') return agg;
  room.state = {
    ...room.state,
    politicianExtra: { ...(room.state.politicianExtra ?? {}), [category]: clueId },
    usedAbilities: [...(room.state.usedAbilities ?? []), 'политик'],
    events: addEvent(room.state, `${me.nickname} (Политик) добавил дополнительный голос.`),
  };
  return agg;
}

export function abilityFinish(agg: RoomAgg, playerId: string): RoomAgg {
  const { room, players } = agg;
  const ab = room.state.ability;
  if (!ab || ab.ownerId !== playerId) return agg;
  let state: Room['state'] = { ...room.state };
  if (ab.kind === 'reveal_hand_left') {
    const me = getPlayer(agg, playerId);
    if (me) {
      const removeIds = ab.ghostPicks ?? [];
      const hand = me.hand.filter((c) => !removeIds.includes(c.id));
      const toDiscardCards = (ab.handRevealed ?? []).filter((c) => removeIds.includes(c.id));
      state = { ...state, discard: [...(state.discard ?? []), ...toDiscardCards] };
      const filled = refillHand({ ...me, hand }, state, 5);
      me.hand = filled.player.hand;
      state = filled.state;
      state.events = addEvent(state, `${me.nickname} (Писатель) обменял карты с призраком.`);
    }
  }
  if (ab.kind === 'trainer') {
    const sent = (ab.copies ?? []).map((s) => s.card);
    state = { ...state, discard: [...(state.discard ?? []), ...sent] };
  }
  const owner = players.find((p) => p.id === playerId);
  const usedList = new Set(state.usedAbilities ?? []);
  if (owner?.character) usedList.add(owner.character);
  state = { ...state, ability: null, usedAbilities: [...usedList] };
  if (ab.resumePhase && ab.resumePhase !== 'setup') room.phase = ab.resumePhase;
  room.state = state;
  return agg;
}

// ==== основные фазы ====

export function placeTableClue(agg: RoomAgg, playerId: string, category: string, note?: string): RoomAgg {
  const { room, players } = agg;
  const settings = room.settings;
  const per = cluesPerCategory(settings);
  const table = [...(room.state.table ?? [])];
  if (room.state.layingPlayerId !== playerId) return agg;
  const card = room.state.layingCard;
  if (!card) return agg;
  if (table.filter((c) => c.category === category).length >= per) return agg;
  const me = players.find((p) => p.id === playerId);
  table.push({ id: `${category}-${table.length}-${card.id}`, category: category as never, card, authorId: playerId, authorName: me?.nickname ?? '', note: note?.trim() || undefined });
  const needed = tableSize(settings);
  if (table.length >= needed) {
    room.phase = 'true_choice';
    room.state = { ...room.state, table, layingCard: null, layingPlayerId: null, events: addEvent(room.state, 'Улики собраны. Выбор истинных улик.') };
    return agg;
  }
  const order = clockwiseOrder(players);
  const next = nextPlayer(order, playerId);
  const drawn = takeCards(room.state, 1);
  room.state = { ...drawn.state, table, layingCard: drawn.cards[0] ?? null, layingPlayerId: next?.id ?? playerId };
  return agg;
}

export function chooseTrueClues(agg: RoomAgg, choices: Record<string, string>, commit: boolean): RoomAgg {
  const { room, players } = agg;
  const cats = activeCategories(room.settings);
  if (!commit || Object.keys(choices).length !== cats.length) {
    room.state = { ...room.state, trueChoices: choices };
    return agg;
  }
  let state: Room['state'] = { ...room.state, trueChoices: choices };
  for (const p of players) {
    const filled = refillHand({ ...p, hand: [] }, state, 5);
    state = filled.state;
    p.hand = filled.player.hand;
    p.submitted_clue = null;
  }
  room.phase = 'ghost_opening';
  room.state = withDeadline({ ...state, events: addEvent(room.state, 'Истинные улики выбраны. Призрак может дать первую зацепку.') }, 'ghost_opening', room.settings);
  return agg;
}

export function ghostOpening(agg: RoomAgg, card: ClueCard | null): RoomAgg {
  const { room, players } = agg;
  let state = { ...room.state };
  const ghost = players.find((p) => p.role === 'ghost');
  if (card && ghost) {
    const hand = ghost.hand.filter((c) => c.id !== card.id);
    const filled = refillHand({ ...ghost, hand }, state, 5);
    state = filled.state;
    ghost.hand = filled.player.hand;
    state.hints = [...(state.hints ?? []), card];
    state.events = addEvent(state, 'Призрак дал первую зацепку.');
  }
  const nxt = beginSubmit(agg, state);
  room.phase = nxt.phase;
  room.state = nxt.state;
  return agg;
}

function beginSubmit(agg: RoomAgg, state: Room['state']) {
  const room = agg.room;
  return {
    phase: 'submit' as const,
    state: withDeadline({
      ...state,
      round: 1,
      radioPlayerId: null,
      speakerId: null,
      spokenIds: [],
      refreshedIds: [],
      events: addEvent(state, 'Раунд 1: отправьте по 1 улике призраку.'),
    }, 'submit', room.settings),
  };
}

export function submitClue(agg: RoomAgg, playerId: string, card: ClueCard): RoomAgg {
  const { room, players } = agg;
  const me = players.find((p) => p.id === playerId);
  if (!me) return agg;
  const isCourierSecond = me.character === 'курьер' && me.submitted_clue && !me.submitted_clue.card2;
  if (me.submitted_clue && !isCourierSecond) return agg;
  me.hand = me.hand.filter((c) => c.id !== card.id);
  me.submitted_clue = isCourierSecond && me.submitted_clue
    ? { ...me.submitted_clue, card2: card }
    : { playerId: me.id, nickname: me.nickname, card };
  let radio = room.state.radioPlayerId ?? null;
  if (!radio && me.role !== 'ghost') radio = me.id;
  const allIn = players.length > 0 && players.every((p) => p.submitted_clue);
  const state = { ...room.state, radioPlayerId: radio, events: addEvent(room.state, `${me.nickname} отправил улику в почтовый ящик.`) };
  if (allIn) {
    room.phase = 'ghost_review';
    room.state = withDeadline({ ...state, events: addEvent(state, 'Все улики в ящике. Призрак выбирает подсказки.') }, 'ghost_review', room.settings);
    return agg;
  }
  room.state = state;
  return agg;
}

export function ghostResolveMailbox(agg: RoomAgg, keepCardIds: string[]): RoomAgg {
  const { room, players } = agg;
  const mailed = players.flatMap((p) => {
    const a: ClueCard[] = [];
    if (p.submitted_clue?.card) a.push(p.submitted_clue.card);
    if (p.submitted_clue?.card2) a.push(p.submitted_clue.card2);
    return a;
  });
  const keep = mailed.filter((c) => keepCardIds.includes(c.id));
  const vanish = mailed.filter((c) => !keepCardIds.includes(c.id));
  room.state = { ...room.state, hints: [...(room.state.hints ?? []), ...keep], vanished: [...(room.state.vanished ?? []), ...vanish], events: addEvent(room.state, `Призрак открыл ${keep.length} подсказок. Исчезло: ${vanish.length}.`) };
  room.phase = 'refresh';
  room.state = withDeadline(room.state, 'refresh', room.settings);
  players.forEach((p) => { p.submitted_clue = null; });
  return agg;
}

export function discardAndRefill(agg: RoomAgg, player: Player, discardCardId: string | null): RoomAgg {
  const { room } = agg;
  const id = player.id;
  const me = getPlayer(agg, id);
  if (!me) return agg;
  let state: Room['state'] = { ...room.state };
  if ((state.refreshedIds ?? []).includes(id)) return agg;
  let hand = [...me.hand];
  if (discardCardId) {
    const card = hand.find((c) => c.id === discardCardId);
    if (card) {
      hand = hand.filter((c) => c.id !== card.id);
      state = { ...state, discard: [...(state.discard ?? []), card] };
    }
  }
  const filled = refillHand({ ...me, hand }, state, 5);
  me.hand = filled.player.hand;
  state = filled.state;
  const refreshedIds = [...(state.refreshedIds ?? []), id];
  const allDone = agg.players.every((p) => refreshedIds.includes(p.id));
  const nextState = { ...state, refreshedIds, events: addEvent(room.state, `${me.nickname} обновил руку.`) };
  if (!allDone) {
    room.state = nextState;
    return agg;
  }
  const radio = nextState.radioPlayerId ?? clockwiseOrder(agg.players).find((p) => p.role !== 'ghost')?.id ?? agg.players[0]?.id ?? null;
  room.phase = 'discussion';
  room.state = withDeadline({
    ...nextState,
    speakerId: radio,
    spokenIds: radio ? [radio] : [],
    refreshedIds: [],
    events: addEvent(nextState, `Обсуждение. Первым говорит ${agg.players.find((p) => p.id === radio)?.nickname ?? ''}.`),
  }, 'discussion', room.settings);
  return agg;
}

export function passSpeech(agg: RoomAgg): RoomAgg {
  const { room, players } = agg;
  const nxt = nextSpeaker(players, room.state.speakerId);
  const spoken = [...(room.state.spokenIds ?? [])];
  if (nxt && !spoken.includes(nxt.id)) spoken.push(nxt.id);
  room.state = { ...room.state, speakerId: nxt?.id ?? room.state.speakerId, spokenIds: spoken };
  return agg;
}

function beginSubmitRound(agg: RoomAgg, state: Room['state'], round: number) {
  const room = agg.room;
  return {
    phase: 'submit' as const,
    state: withDeadline({
      ...state,
      round,
      radioPlayerId: null,
      speakerId: null,
      spokenIds: [],
      refreshedIds: [],
      events: addEvent(state, `Раунд ${round}: отправьте по 1 улике призраку.`),
    }, 'submit', room.settings),
  };
}

export function startNextRoundOrVote(agg: RoomAgg): RoomAgg {
  const { room, players } = agg;
  const round = room.state.round ?? 1;
  if (round >= room.settings.rounds) {
    const cats = activeCategories(room.settings);
    const ballots: Record<string, Ballot> = {};
    players.filter((p) => p.role !== 'ghost').forEach((p) => {
      ballots[p.id] = { playerId: p.id, nickname: p.nickname, picks: {}, killerId: null, locked: false };
    });
    room.phase = 'voting';
    room.state = withDeadline({
      ...room.state,
      ballots,
      tally: null,
      voteRound: 1,
      voteScope: cats.map((c) => c.key),
      voteScopeKiller: room.settings.hasKiller,
      voteDecided: {},
      events: addEvent(room.state, 'Финальное голосование. Призрак не голосует.'),
    }, 'voting', room.settings);
  } else {
    const nxt = beginSubmitRound(agg, { ...room.state, refreshedIds: [] }, round + 1);
    room.phase = nxt.phase;
    room.state = nxt.state;
  }
  players.forEach((p) => { p.submitted_clue = null; p.is_ready = false; });
  return agg;
}

export function lockBallot(agg: RoomAgg, playerId: string, picks: Ballot['picks'], killerId: string | null): RoomAgg {
  const { room, players } = agg;
  const ballots = { ...(room.state.ballots ?? {}) };
  if (!ballots[playerId] || ballots[playerId].locked) return agg;
  if (killerId && killerId === playerId) return agg;
  const allCats = activeCategories(room.settings);
  const scopeKeys = room.state.voteScope && room.state.voteScope.length ? room.state.voteScope : allCats.map((c) => c.key);
  const scope = allCats.filter((c) => scopeKeys.includes(c.key));
  const needKiller = room.settings.hasKiller && !(room.state.voteScopeKiller === false);
  if (scope.some((c) => !picks[c.key]) || (needKiller && !killerId)) return agg;
  const scopedPicks: Ballot['picks'] = {};
  scope.forEach((c) => { if (picks[c.key]) scopedPicks[c.key] = picks[c.key]; });
  const b = { ...ballots[playerId], picks: scopedPicks, killerId, locked: true };
  ballots[playerId] = b;
  const voters = players.filter((p) => p.role !== 'ghost');
  const allLocked = voters.every((p) => ballots[p.id]?.locked);
  const state = { ...room.state, ballots, events: addEvent(room.state, `${b.nickname} нажал «Проголосовать».`) };
  if (!allLocked) {
    room.state = state;
    return agg;
  }
  const r = resolveVote(agg, state, players);
  room.phase = r.phase;
  room.state = r.state;
  return agg;
}

function resolveVote(agg: RoomAgg, state: Room['state'], players: Player[]): { phase: Room['phase']; state: Room['state'] } {
  const { room } = agg;
  const allCats = activeCategories(room.settings);
  const round = state.voteRound ?? 1;
  const scopeKeys = state.voteScope && state.voteScope.length ? state.voteScope : allCats.map((c) => c.key);
  const scope = allCats.filter((c) => scopeKeys.includes(c.key));
  const scopeKiller = room.settings.hasKiller && !(state.voteScopeKiller === false);
  const extra = state.politicianExtra ?? {};
  const extraBallots: Ballot[] = Object.entries(extra).map(([cat, clueId]) => ({
    playerId: 'politician-extra',
    nickname: 'Политик',
    picks: { [cat as never]: clueId },
    killerId: null,
    locked: true,
  }));
  const tally = computeTally([...Object.values(state.ballots ?? {}), ...extraBallots], scope);
  const undecidedCats = scope.filter((c) => !tally.picks[c.key]);
  const killerUndecided = scopeKiller && !tally.killerId;
  const decided = { ...(state.voteDecided ?? {}) } as Partial<Record<string, string | null>>;
  scope.forEach((c) => { if (tally.picks[c.key]) decided[c.key] = tally.picks[c.key]; });
  if (scopeKiller && tally.killerId) decided.killer = tally.killerId;

  if ((undecidedCats.length > 0 || killerUndecided) && round < 3) {
    const ballots: Record<string, Ballot> = {};
    players.filter((p) => p.role !== 'ghost').forEach((p) => {
      ballots[p.id] = { playerId: p.id, nickname: p.nickname, picks: {}, killerId: null, locked: false };
    });
    const desc = [
      ...(undecidedCats.length ? [undecidedCats.map((c) => c.title).join(', ')] : []),
      ...(killerUndecided ? ['убийца'] : []),
    ].join(' и ');
    return {
      phase: 'voting',
      state: withDeadline({
        ...state,
        ballots,
        tally: null,
        voteRound: round + 1,
        voteScope: undecidedCats.map((c) => c.key),
        voteScopeKiller: killerUndecided,
        voteDecided: decided,
        events: addEvent(state, `Переголосование ${round + 1}. Требуется большинство по: ${desc}.`),
      }, 'voting', room.settings),
    };
  }

  const finalTally: TallyResult = { picks: {}, killerId: null, ties: {} };
  allCats.forEach((c) => {
    finalTally.picks[c.key] = (decided[c.key] as string | null) ?? null;
    finalTally.ties[c.key] = !decided[c.key];
  });
  finalTally.killerId = room.settings.hasKiller ? (decided.killer as string | null) ?? null : null;
  finalTally.ties.killer = room.settings.hasKiller && !decided.killer;

  return {
    phase: 'tally',
    state: {
      ...state,
      tally: finalTally,
      deadlineAt: null,
      events: addEvent(state, 'Голоса открыты. Пункты без большинства не засчитаны.'),
    },
  };
}

export function revealTruth(agg: RoomAgg): RoomAgg {
  const { room, players } = agg;
  const tally = room.state.tally ?? computeTally(Object.values(room.state.ballots ?? {}), activeCategories(room.settings));
  const summary = evaluateCase({ ...room, state: { ...room.state, tally } }, players, tally);
  room.phase = 'results';
  room.state = {
    ...room.state,
    tally,
    resultSummary: summary,
    winners: summary.winners,
    deadlineAt: null,
    events: addEvent(room.state, summary.caseSolved
      ? `Дело раскрыто. Угадано ${summary.guessed} из ${summary.total}. Победа мирных.`
      : `Дело не раскрыто. Угадано ${summary.guessed} из ${summary.total}. Победа убийцы.`),
  };
  return agg;
}

export function resetToLobby(agg: RoomAgg): RoomAgg {
  agg.room.phase = 'lobby';
  agg.room.state = { events: addEvent({}, 'Игра возвращена в лобби.') };
  for (const p of agg.players) {
    p.role = null;
    p.hand = [];
    p.submitted_clue = null;
    p.is_ready = false;
    p.character = null;
  }
  return agg;
}

export function expireTimer(agg: RoomAgg): RoomAgg {
  const { room, players } = agg;
  if (room.phase === 'submit') {
    for (const p of players.filter((x) => !x.submitted_clue)) {
      const card = p.hand[0];
      if (!card) continue;
      submitClue(agg, p.id, card);
    }
    return agg;
  }
  if (room.phase === 'ghost_opening') return ghostOpening(agg, null);
  if (room.phase === 'ghost_review') return ghostResolveMailbox(agg, []);
  if (room.phase === 'refresh') {
    const done = room.state.refreshedIds ?? [];
    for (const p of players.filter((x) => !done.includes(x.id))) {
      discardAndRefill(agg, p, null);
    }
    return agg;
  }
  if (room.phase === 'discussion') return startNextRoundOrVote(agg);
  if (room.phase === 'voting') {
    const ballots = { ...(room.state.ballots ?? {}) };
    Object.keys(ballots).forEach((id) => { ballots[id] = { ...ballots[id], locked: true }; });
    const r = resolveVote(agg, { ...room.state, ballots }, players);
    room.phase = r.phase;
    room.state = r.state;
    return agg;
  }
  return agg;
}

