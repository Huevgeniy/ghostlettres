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
  resetToLobby, setReady,
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
  if (error) return <Centered>{error}</Centered>;
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
        onReady={(ready) => me && setReady(me.id, ready)}
      />
    );
  }

  if (showRole && me.role) {
    return <RoleReveal role={me.role} onClose={() => setShowRole(false)} />;
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
      onTimerExpire={(me.nickname === room.host_name || me.role === 'ghost') ? handleTimerExpire : () => undefined}
      onRestart={() => startGame(room, players)}
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
