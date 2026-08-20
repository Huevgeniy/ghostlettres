import { useCallback, useEffect, useState } from 'react';
import { type Player, type Room } from '@/lib/game';
import { fetchPlayers, fetchRoom, subscribeToRoom } from '@/lib/api';

export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const [r, p] = await Promise.all([fetchRoom(roomId), fetchPlayers(roomId)]);
      setRoom(r);
      setPlayers(p);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки комнаты');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToRoom(roomId, (r, p) => {
      setRoom(r);
      setPlayers(p);
      setLoading(false);
      setError(null);
    });
    return () => unsub();
  }, [roomId]);

  return { room, players, loading, error, refresh, setRoom, setPlayers };
}
