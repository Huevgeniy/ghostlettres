import { supabase } from './supabase';
import {
  type Room,
  type Player,
  type RoomSettings,
  type RoomGameState,
  type CategoryKey,
  type ClueCard,
  type TableClue,
  type Ballot,
  type GamePhase,
  buildDeck,
  shuffle,
  randomCode,
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
} from './game';

function asRoom(data: Room): Room {
  return {
    ...data,
    settings: data.settings ?? {},
    state: data.state ?? {},
  } as Room;
}

function asPlayer(data: Player): Player {
  return {
    ...data,
    hand: data.hand ?? [],
    submitted_clue: data.submitted_clue ?? null,
    is_ready: Boolean(data.is_ready),
  };
}

export async function fetchPlayers(roomId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('game_players')
    .select()
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => asPlayer(p as Player));
}

export async function fetchRoom(roomId: string): Promise<Room> {
  const { data, error } = await supabase.from('game_rooms').select().eq('id', roomId).maybeSingle();
  if (error || !data) throw new Error('Комната не найдена');
  return asRoom(data as Room);
}

export async function patchRoom(roomId: string, updater: (room: Room) => { state: RoomGameState; phase?: GamePhase; player_count?: number }) {
  const room = await fetchRoom(roomId);
  const next = updater(room);
  const body: Record<string, unknown> = {
    state: next.state,
    updated_at: new Date().toISOString(),
  };
  if (next.phase) body.phase = next.phase;
  if (typeof next.player_count === 'number') body.player_count = next.player_count;
  const { error } = await supabase.from('game_rooms').update(body).eq('id', roomId);
  if (error) throw new Error(error.message);
}

export async function updatePlayer(playerId: string, patch: Partial<Player>) {
  const { error } = await supabase.from('game_players').update(patch).eq('id', playerId);
  if (error) throw new Error(error.message);
}

export async function createRoom(hostName: string, settings: RoomSettings): Promise<{ room: Room; player: Player }> {
  const code = randomCode();
  const { data, error } = await supabase
    .from('game_rooms')
    .insert({
      code,
      host_name: hostName,
      player_count: 1,
      settings,
      phase: 'lobby',
      state: { events: addEvent({}, `${hostName} создал комнату`) },
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Не удалось создать комнату');
  const { data: player, error: playerError } = await supabase
    .from('game_players')
    .insert({ room_id: data.id, nickname: hostName, hand: [] })
    .select()
    .single();
  if (playerError || !player) throw new Error('Комната создана, но не удалось добавить хозяина');
  return { room: asRoom(data as Room), player: asPlayer(player as Player) };
}

export async function joinRoom(code: string, nickname: string, existingPlayerId?: string): Promise<{ room: Room; player: Player; players: Player[] }> {
  const { data: roomRow, error } = await supabase
    .from('game_rooms')
    .select()
    .eq('code', code.toUpperCase().trim())
    .maybeSingle();
  if (error || !roomRow) throw new Error('Комната с таким кодом не найдена');
  const room = asRoom(roomRow as Room);

  if (existingPlayerId) {
    const { data: mine } = await supabase.from('game_players').select().eq('id', existingPlayerId).maybeSingle();
    if (mine && mine.room_id === room.id) {
      const players = await fetchPlayers(room.id);
      return { room, player: asPlayer(mine as Player), players };
    }
  }

  const { data: sameNick } = await supabase
    .from('game_players')
    .select()
    .eq('room_id', room.id)
    .eq('nickname', nickname)
    .maybeSingle();

  if (sameNick) {
    const players = await fetchPlayers(room.id);
    return { room, player: asPlayer(sameNick as Player), players };
  }

  if (room.phase !== 'lobby') throw new Error('Партия уже началась');
  if ((room.player_count ?? 0) >= room.settings.playerCount) throw new Error('Комната заполнена');

  const { data: player, error: insertErr } = await supabase
    .from('game_players')
    .insert({ room_id: room.id, nickname, hand: [] })
    .select()
    .single();
  if (insertErr || !player) throw new Error('Не удалось присоединиться к комнате');

  const players = await fetchPlayers(room.id);
  await supabase.from('game_rooms').update({
    player_count: players.length,
    state: { ...(room.state ?? {}), events: addEvent(room.state, `${nickname} присоединился`) },
    updated_at: new Date().toISOString(),
  }).eq('id', room.id);

  return { room: { ...room, player_count: players.length }, player: asPlayer(player as Player), players };
}

export function subscribeToRoom(roomId: string, onChange: (room: Room, players: Player[]) => void, onError?: (message: string) => void): () => void {
  let alive = true;
  const pull = async () => {
    if (!alive) return;
    try {
      const [room, players] = await Promise.all([fetchRoom(roomId), fetchPlayers(roomId)]);
      if (alive) onChange(room, players);
    } catch (e) {
      if (alive) onError?.(e instanceof Error ? e.message : 'Ошибка загрузки комнаты');
    }
  };

  const channel = supabase
    .channel(`room-${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` }, () => { void pull(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `room_id=eq.${roomId}` }, () => { void pull(); })
    .subscribe();

  const poll = window.setInterval(() => { void pull(); }, 1500);
  void pull();

  return () => {
    alive = false;
    window.clearInterval(poll);
    void supabase.removeChannel(channel);
  };
}

export async function updateRoomSettings(roomId: string, settings: RoomSettings) {
  const { error } = await supabase.from('game_rooms').update({ settings, updated_at: new Date().toISOString() }).eq('id', roomId);
  if (error) throw new Error(error.message);
}

function withDeadline(state: RoomGameState, phase: GamePhase, settings: RoomSettings): RoomGameState {
  const seconds = timerSecondsForPhase(phase, settings);
  return { ...state, deadlineAt: seconds ? deadlineFromNow(seconds) : null };
}

export async function startGame(room: Room, players: Player[]) {
  const roles = shuffle(rolesForGame(players.length, room.settings));
  await Promise.all(players.map((p, i) => updatePlayer(p.id, {
    role: roles[i],
    hand: [],
    submitted_clue: null,
    is_ready: false,
  })));
  const ghost = players[roles.indexOf('ghost')];
  const drawn = takeCards({ deck: shuffle(buildDeck()), discard: [] }, 1);
  await patchRoom(room.id, () => ({
    phase: 'setup',
    state: withDeadline({
      deck: drawn.state.deck,
      discard: [],
      vanished: [],
      hints: [],
      table: [],
      layingCard: drawn.cards[0] ?? null,
      layingPlayerId: ghost?.id ?? players[0]?.id,
      trueChoices: null,
      round: 0,
      radioPlayerId: null,
      speakerId: null,
      spokenIds: [],
      ballots: {},
      tally: null,
      winners: null,
      resultSummary: null,
      events: addEvent(room.state, 'Роли розданы. Призрак открыт. Собираем улики на стол.'),
    }, 'setup', room.settings),
  }));
}

export async function placeTableClue(roomId: string, playerId: string, category: CategoryKey) {
  const players = await fetchPlayers(roomId);
  await patchRoom(roomId, (room) => {
    const settings = room.settings;
    const per = cluesPerCategory(settings);
    const table = [...(room.state.table ?? [])];
    if (room.state.layingPlayerId !== playerId) return { state: room.state };
    const card = room.state.layingCard;
    if (!card) return { state: room.state };
    if (table.filter((c) => c.category === category).length >= per) return { state: room.state };
    const me = players.find((p) => p.id === playerId);
    table.push({
      id: `${category}-${table.length}-${card.id}`,
      category,
      card,
      authorId: playerId,
      authorName: me?.nickname ?? '',
    });
    const needed = tableSize(settings);
    if (table.length >= needed) {
      return {
        phase: 'true_choice',
        state: {
          ...room.state,
          table,
          layingCard: null,
          layingPlayerId: null,
          events: addEvent(room.state, 'Улики собраны. Выбор истинных улик.'),
        },
      };
    }
    const order = clockwiseOrder(players);
    const next = nextPlayer(order, playerId);
    const drawn = takeCards(room.state, 1);
    return {
      state: {
        ...drawn.state,
        table,
        layingCard: drawn.cards[0] ?? null,
        layingPlayerId: next?.id ?? playerId,
      },
    };
  });
}

export async function chooseTrueClues(roomId: string, choices: Partial<Record<CategoryKey, string>>, commit = false) {
  const players = await fetchPlayers(roomId);
  const room = await fetchRoom(roomId);
  const cats = activeCategories(room.settings);
  if (!commit || Object.keys(choices).length !== cats.length) {
    await patchRoom(roomId, (r) => ({ state: { ...r.state, trueChoices: choices } }));
    return;
  }
  let state: RoomGameState = { ...room.state, trueChoices: choices };
  const hands: { id: string; hand: ClueCard[] }[] = [];
  for (const p of players) {
    const filled = refillHand({ ...p, hand: [] }, state, 5);
    state = filled.state;
    hands.push({ id: p.id, hand: filled.player.hand });
  }
  await Promise.all(hands.map((h) => updatePlayer(h.id, { hand: h.hand, submitted_clue: null })));
  await patchRoom(roomId, (r) => ({
    phase: 'ghost_opening',
    state: withDeadline({
      ...state,
      deck: state.deck,
      discard: state.discard,
      events: addEvent(r.state, 'Истинные улики выбраны. Призрак может дать первую зацепку.'),
    }, 'ghost_opening', r.settings),
  }));
}

export async function ghostOpening(roomId: string, card: ClueCard | null) {
  const players = await fetchPlayers(roomId);
  const room = await fetchRoom(roomId);
  let state = { ...room.state };
  const ghost = players.find((p) => p.role === 'ghost');
  if (card && ghost) {
    const hand = ghost.hand.filter((c) => c.id !== card.id);
    const filled = refillHand({ ...ghost, hand }, state, 5);
    state = filled.state;
    await updatePlayer(ghost.id, { hand: filled.player.hand });
    state.hints = [...(state.hints ?? []), card];
    state.events = addEvent(state, 'Призрак дал первую зацепку.');
  }
  await patchRoom(roomId, (r) => beginSubmit(r, players, { ...state, deck: state.deck, discard: state.discard }, 1));
}

function beginSubmit(room: Room, _players: Player[], state: RoomGameState, round: number) {
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

export async function submitClue(roomId: string, player: Player, card: ClueCard) {
  const players = await fetchPlayers(roomId);
  const me = players.find((p) => p.id === player.id);
  if (!me || me.submitted_clue) return;
  const hand = me.hand.filter((c) => c.id !== card.id);
  await updatePlayer(me.id, {
    hand,
    submitted_clue: { playerId: me.id, nickname: me.nickname, card },
  });
  const after = await fetchPlayers(roomId);
  await patchRoom(roomId, (room) => {
    let radio = room.state.radioPlayerId ?? null;
    if (!radio && me.role !== 'ghost') radio = me.id;
    const allIn = after.length > 0 && after.every((p) => p.submitted_clue);
    const state = {
      ...room.state,
      radioPlayerId: radio,
      events: addEvent(room.state, `${me.nickname} отправил улику в почтовый ящик.`),
    };
    if (allIn) {
      return {
        phase: 'ghost_review',
        state: withDeadline({ ...state, events: addEvent(state, 'Все улики в ящике. Призрак выбирает подсказки.') }, 'ghost_review', room.settings),
      };
    }
    return { state };
  });
}

export async function ghostResolveMailbox(roomId: string, keepCardIds: string[]) {
  const players = await fetchPlayers(roomId);
  await patchRoom(roomId, (room) => {
    const mailed = players.map((p) => p.submitted_clue?.card).filter(Boolean) as ClueCard[];
    const keep = mailed.filter((c) => keepCardIds.includes(c.id));
    const vanish = mailed.filter((c) => !keepCardIds.includes(c.id));
    const state: RoomGameState = {
      ...room.state,
      hints: [...(room.state.hints ?? []), ...keep],
      vanished: [...(room.state.vanished ?? []), ...vanish],
      events: addEvent(room.state, `Призрак открыл ${keep.length} подсказок. Исчезло: ${vanish.length}.`),
    };
    return {
      phase: 'refresh',
      state: withDeadline(state, 'refresh', room.settings),
    };
  });
  await Promise.all(players.map((p) => updatePlayer(p.id, { submitted_clue: null })));
}

export async function discardAndRefill(roomId: string, player: Player, discardCardId: string | null) {
  const players = await fetchPlayers(roomId);
  const live = await fetchRoom(roomId);
  let state = live.state;
  const me = players.find((p) => p.id === player.id);
  const already = (state.refreshedIds ?? []).includes(player.id);
  if (!me || already) return;
  let hand = [...me.hand];
  if (discardCardId) {
    const card = hand.find((c) => c.id === discardCardId);
    if (card) {
      hand = hand.filter((c) => c.id !== card.id);
      state = { ...state, discard: [...(state.discard ?? []), card] };
    }
  }
  const filled = refillHand({ ...me, hand }, state, 5);
  await updatePlayer(me.id, { hand: filled.player.hand });
  const refreshedIds = [...(filled.state.refreshedIds ?? []), me.id];
  const allDone = players.every((p) => refreshedIds.includes(p.id));
  await patchRoom(roomId, (room) => {
    const nextState = {
      ...filled.state,
      refreshedIds,
      events: addEvent(room.state, `${me.nickname} обновил руку.`),
    };
    if (!allDone) return { state: nextState };
    const radio = nextState.radioPlayerId ?? clockwiseOrder(players).find((p) => p.role !== 'ghost')?.id ?? players[0]?.id ?? null;
    return {
      phase: 'discussion',
      state: withDeadline({
        ...nextState,
        speakerId: radio,
        spokenIds: radio ? [radio] : [],
        refreshedIds: [],
        events: addEvent(nextState, `Обсуждение. Первым говорит ${players.find((p) => p.id === radio)?.nickname ?? ''}.`),
      }, 'discussion', room.settings),
    };
  });
}

export async function passSpeech(roomId: string) {
  const players = await fetchPlayers(roomId);
  await patchRoom(roomId, (room) => {
    const nxt = nextSpeaker(players, room.state.speakerId);
    const spoken = [...(room.state.spokenIds ?? [])];
    if (nxt && !spoken.includes(nxt.id)) spoken.push(nxt.id);
    return { state: { ...room.state, speakerId: nxt?.id ?? room.state.speakerId, spokenIds: spoken } };
  });
}

export async function startNextRoundOrVote(roomId: string) {
  const players = await fetchPlayers(roomId);
  await patchRoom(roomId, (room) => {
    const round = room.state.round ?? 1;
    if (round >= room.settings.rounds) {
      const ballots: Record<string, Ballot> = {};
      players.filter((p) => p.role !== 'ghost').forEach((p) => {
        ballots[p.id] = { playerId: p.id, nickname: p.nickname, picks: {}, killerId: null, locked: false };
      });
      return {
        phase: 'voting',
        state: withDeadline({
          ...room.state,
          ballots,
          tally: null,
          events: addEvent(room.state, 'Финальное голосование. Призрак не голосует.'),
        }, 'voting', room.settings),
      };
    }
    return beginSubmit(room, players, { ...room.state, refreshedIds: [] }, round + 1);
  });
  await Promise.all(players.map((p) => updatePlayer(p.id, { submitted_clue: null, is_ready: false })));
}

export async function lockBallot(
  roomId: string,
  playerId: string,
  picks: Ballot['picks'],
  killerId: string | null,
) {
  const players = await fetchPlayers(roomId);
  await patchRoom(roomId, (room) => {
    const ballots = { ...(room.state.ballots ?? {}) };
    if (!ballots[playerId] || ballots[playerId].locked) return { state: room.state };
    const cats = activeCategories(room.settings);
    const needKiller = room.settings.hasKiller;
    if (cats.some((c) => !picks[c.key]) || (needKiller && !killerId)) return { state: room.state };
    const b = { ...ballots[playerId], picks, killerId, locked: true };
    ballots[playerId] = b;
    const voters = players.filter((p) => p.role !== 'ghost');
    const allLocked = voters.every((p) => ballots[p.id]?.locked);
    const state = { ...room.state, ballots, events: addEvent(room.state, `${b.nickname} нажал «Проголосовать».`) };
    if (!allLocked) return { state };
    return revealVotes(room, state, players);
  });
}

function revealVotes(room: Room, state: RoomGameState, players: Player[]) {
  const cats = activeCategories(room.settings);
  const tally = computeTally(Object.values(state.ballots ?? {}), cats);
  return {
    phase: 'tally' as const,
    state: {
      ...state,
      tally,
      deadlineAt: null,
      events: addEvent(state, 'Голоса открыты. Большинство зафиксировано на поле.'),
    },
  };
}

export async function expireTimer(roomId: string) {
  const players = await fetchPlayers(roomId);
  const room = await fetchRoom(roomId);
  if (room.phase === 'submit') {
    const missing = players.filter((p) => !p.submitted_clue);
    for (const p of missing) {
      if (!p.hand[0]) continue;
      await submitClue(roomId, p, p.hand[0]);
    }
    return;
  }
  if (room.phase === 'ghost_opening') {
    await ghostOpening(roomId, null);
    return;
  }
  if (room.phase === 'ghost_review') {
    await ghostResolveMailbox(roomId, []);
    return;
  }
  if (room.phase === 'refresh') {
    const done = room.state.refreshedIds ?? [];
    for (const p of players.filter((x) => !done.includes(x.id))) {
      await discardAndRefill(roomId, p, null);
    }
    return;
  }
  if (room.phase === 'discussion') {
    await startNextRoundOrVote(roomId);
    return;
  }
  if (room.phase === 'voting') {
    await patchRoom(roomId, (r) => {
      const ballots = { ...(r.state.ballots ?? {}) };
      Object.keys(ballots).forEach((id) => {
        ballots[id] = { ...ballots[id], locked: true };
      });
      return revealVotes(r, { ...r.state, ballots }, players);
    });
  }
}

export async function revealTruth(roomId: string) {
  const players = await fetchPlayers(roomId);
  await patchRoom(roomId, (room) => {
    const tally = room.state.tally ?? computeTally(Object.values(room.state.ballots ?? {}), activeCategories(room.settings));
    const summary = evaluateCase({ ...room, state: { ...room.state, tally } }, players, tally);
    return {
      phase: 'results',
      state: {
        ...room.state,
        tally,
        resultSummary: summary,
        winners: summary.winners,
        deadlineAt: null,
        events: addEvent(room.state, summary.caseSolved
          ? `Дело раскрыто. Угадано ${summary.guessed} из ${summary.total}. Победа мирных.`
          : `Дело не раскрыто. Угадано ${summary.guessed} из ${summary.total}. Победа убийцы.`),
      },
    };
  });
}

export async function leaveRoom(roomId: string, playerId: string) {
  await supabase.from('game_players').delete().eq('id', playerId);
  const players = await fetchPlayers(roomId);
  await supabase.from('game_rooms').update({ player_count: players.length, updated_at: new Date().toISOString() }).eq('id', roomId);
}

export async function deleteRoom(roomId: string) {
  await supabase.from('game_rooms').delete().eq('id', roomId);
}
