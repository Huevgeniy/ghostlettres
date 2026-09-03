import { useCallback, useEffect, useMemo, useState } from 'react';
import Home from '@/components/Home';
import Lobby from '@/components/Lobby';
import RoleReveal from '@/components/RoleReveal';
import GameTable from '@/components/GameTable';
import { useRoom } from '@/hooks/useRoom';
import {
  startGame, placeTableClue, chooseTrueClues, ghostOpening, submitClue,
  ghostResolveMailbox, discardAndRefill, passSpeech, startNextRoundOrVote,
  lockBallot, revealTruth, expireTimer, updateRoomSettings, leaveRoom, joinRoom,
  resetToLobby, setReady, chooseCharacter,
  activateAbility, cancelAbility, abilityOwnerPick, abilityGhostPick, abilityGhostNumber, abilityFinish,
  abilityCopy, abilityOwnerDiscard, abilitySendToGhost, abilityPlayerSubmit, abilityGhostSkip,
  politicianExtraVote,
} from '@/lib/api';
import { type Player } from '@/lib/game';
import { clearSession, loadSession, saveSession, sessionFromPlayer } from '@/lib/session';

export default function App() {
  const session = loadSession();
  const [roomId, setRoomId] = useState<string | null>(session?.roomId ?? null);
  const [roomCode, setRoomCode] = useState(session?.roomCode ?? '');
  const [playerId, setPlayerId] = useState<string | null>(session?.playerId ?? null);
  const [showRole, setShowRole] = useState(false);
  const [seenRole, setSeenRole] = useState(false);
  const { room, players, loading, error } = useRoom(roomId);

  // Если комната оказалась устаревшей (например, сервер перезапускался), очищаем
  // сессию и автоматически возвращаемся на главный экран.
  useEffect(() => {
    if (error && /не найдена|больше не существует/i.test(error)) {
      clearSession();
      setRoomId(null);
      setPlayerId(null);
      setRoomCode('');
    }
  }, [error]);

  const me = useMemo(
    () => players.find((p) => p.id === playerId) ?? null,
    [players, playerId],
  );

  useEffect(() => {
    if (room && me?.role && !seenRole && room.phase !== 'lobby') {
      setShowRole(true);
      setSeenRole(true);
    }
  }, [room, me, seenRole]);

  function enter(r: { id: string; code: string }, player: Player) {
    setRoomId(r.id);
    setRoomCode(r.code);
    setPlayerId(player.id);
    setSeenRole(false);
    saveSession(sessionFromPlayer(player, r.code));
  }

  const handleTimerExpire = useCallback(() => {
    if (!room) return;
    void expireTimer(room.id);
  }, [room]);

  async function handleLeave() {
    if (room && me) await leaveRoom(room.id, me.id);
    clearSession();
    setRoomId(null);
    setPlayerId(null);
    setRoomCode('');
  }

  async function handleToLobby() {
    if (!room) return;
    await resetToLobby(room.id);
    setSeenRole(false);
  }

  if (!roomId) return <Home onEnter={enter} />;
  if (loading || !room) return <Centered>Загрузка комнаты…</Centered>;
  if (error) {
    return (
      <Centered>
        <p>{error}</p>
        <button className="btn-ghost mt-3" onClick={() => { clearSession(); setRoomId(null); setPlayerId(null); setRoomCode(''); }}>
          В меню
        </button>
      </Centered>
    );
  }
  if (!me) {
    return (
      <Centered>
        <p>Сессия не найдена в этой комнате.</p>
        <Reconnect code={roomCode} onEnter={enter} onGiveUp={handleLeave} />
      </Centered>
    );
  }

  if (room.phase === 'lobby') {
    return (
      <Lobby
        room={room}
        players={players}
        currentNickname={me.nickname}
        onStart={() => startGame(room, players)}
        onLeave={handleLeave}
        onSettings={(s) => updateRoomSettings(room.id, s)}

        onReady={(ready) => me && room && setReady(room.id, me.id, ready)}
      />
    );
  }

  if (showRole && me.role) {
    return <RoleReveal role={me.role} onClose={() => setShowRole(false)} />;
  }

  if (room.phase === 'character_choice') {
    return (
      <CharacterPicker
        role={me.role}
        offers={room.state.charOffers?.[me.id] ?? []}
        chosen={me.character}
        onPick={(cid) => room && chooseCharacter(room.id, me.id, cid)}
      />
    );
  }

  return (
    <GameTable
      room={room}
      players={players}
      me={me}
      onPlaceClue={(cat, note) => placeTableClue(room.id, me.id, cat, note)}
      onTrueChoose={(choices, commit) => chooseTrueClues(room.id, choices, commit)}
      onGhostOpening={(card) => ghostOpening(room.id, card)}
      onSubmitClue={(card) => submitClue(room.id, me, card)}
      onGhostResolve={(ids) => ghostResolveMailbox(room.id, ids)}
      onRefreshHand={(id) => discardAndRefill(room.id, me, id)}
      onPassSpeech={() => passSpeech(room.id)}
      onAdvance={() => startNextRoundOrVote(room.id)}
      onLockVote={(picks, killerId) => lockBallot(room.id, me.id, picks, killerId)}
      onRevealTruth={() => revealTruth(room.id)}
      onActivateAbility={(playerId) => room && activateAbility(room.id, playerId)}
      onCancelAbility={(playerId) => room && cancelAbility(room.id, playerId)}
      onAbilityOwnerPick={(playerId, choice) => room && abilityOwnerPick(room.id, playerId, choice)}
      onAbilityGhostPick={(playerId, picks) => room && abilityGhostPick(room.id, playerId, picks)}
      onAbilityGhostNumber={(playerId, n) => room && abilityGhostNumber(room.id, playerId, n)}
      onAbilityFinish={(playerId) => room && abilityFinish(room.id, playerId)}
      onPoliticianExtraVote={(category, clueId) => room && politicianExtraVote(room.id, me.id, category, clueId)}
      onAbilityCopy={(playerId, charId) => room && abilityCopy(room.id, playerId, charId)}
      onAbilityOwnerDiscard={(playerId, ids) => room && abilityOwnerDiscard(room.id, playerId, ids)}
      onAbilitySendToGhost={(playerId, ids) => room && abilitySendToGhost(room.id, playerId, ids)}
      onAbilityPlayerSubmit={(playerId, cardId) => room && abilityPlayerSubmit(room.id, playerId, cardId)}
      onAbilityGhostSkip={(playerId) => room && abilityGhostSkip(room.id, playerId)}
      onTimerExpire={(me.nickname === room.host_name || me.role === 'ghost') ? handleTimerExpire : () => undefined}
      onRestart={() => { setSeenRole(false); startGame(room, players); }}
      onExit={handleLeave}
      onToLobby={handleToLobby}
    />
  );
}

function Reconnect({ code, onEnter, onGiveUp }: {
  code: string;
  onEnter: (r: { id: string; code: string }, player: Player) => void;
  onGiveUp: () => void;
}) {
  const [name, setName] = useState('');
  return (
    <div>
      <p className="mb-3">Войдите снова с тем же ником в комнату {code}</p>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Никнейм" />
      <button
        className="btn-primary mt-3"
        onClick={async () => {
          const session = loadSession();
          const res = await joinRoom(code, name.trim(), session?.playerId);
          onEnter({ id: res.room.id, code: res.room.code }, res.player);
        }}
      >
        Войти
      </button>
      <button className="btn-ghost mt-2" onClick={onGiveUp}>В меню</button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#071821] px-6 text-center text-slate-300">
      <div>{children}</div>
    </div>
  );
}

function CharacterPicker({ role, offers, chosen, onPick }: {
  role: Player['role'];
  offers: { id: string; title: string; img: string }[];
  chosen: string | null;
  onPick: (id: string) => void;
}) {
  if (role === 'ghost') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#071821] px-6 text-center text-slate-300">
        <p>Призрак ждёт, пока детективы выберут персонажей…</p>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#071821] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow text-gold">Выбор персонажа</p>
        <h1 className="mt-1 text-3xl font-bold">Выберите 1 персонажа на всю партию</h1>
        <p className="mt-3 text-slate-400">Прочитайте обе карточки и выберите одну. Её способность станет видна всем на столе.</p>
        {chosen ? (
          <p className="mt-6 rounded-xl bg-emerald-900/30 px-4 py-3 text-emerald-200">Выбранный персонаж сохраняется. Ожидаем остальных.</p>
        ) : offers.length === 0 ? (
          <p className="mt-6 text-slate-400">Нет доступных карточек…</p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {offers.map((c) => (
              <button key={c.id} onClick={() => onPick(c.id)} className="group relative overflow-hidden rounded-2xl ring-1 ring-teal-700/40 transition hover:ring-2 hover:ring-teal-400">
                <img src={c.img} alt={c.title} className="block w-full object-contain" draggable={false} />
              </button>
            ))}
          </div>
        )}
        <p className="mt-6 text-sm text-slate-500">Выбранные карты уже заняты и не повторятся у других.</p>
      </div>
    </div>
  );
}
