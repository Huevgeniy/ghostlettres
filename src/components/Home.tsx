import { useState } from 'react';
import { LogIn, Plus } from 'lucide-react';
import { createRoom, joinRoom } from '@/lib/api';
import { defaultSettings, type Player } from '@/lib/game';
import { loadSession } from '@/lib/session';

type Props = { onEnter: (room: { id: string; code: string }, player: Player) => void };

export default function Home({ onEnter }: Props) {
  const existing = loadSession();
  const [mode, setMode] = useState<'create' | 'join'>(existing ? 'join' : 'create');
  const [nickname, setNickname] = useState(existing?.nickname ?? '');
  const [code, setCode] = useState(existing?.roomCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const name = nickname.trim();
    if (!name) { setError('Введите никнейм'); return; }
    if (mode === 'join' && code.trim().length !== 5) { setError('Введите код из 5 символов'); return; }
    setLoading(true); setError(null);
    try {
      if (mode === 'create') {
        const result = await createRoom(name, defaultSettings());
        onEnter({ id: result.room.id, code: result.room.code }, result.player);
      } else {
        const result = await joinRoom(code, name, loadSession()?.playerId);
        onEnter({ id: result.room.id, code: result.room.code }, result.player);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink texture text-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
        <section className="panel w-full p-7 sm:p-9">
          <h1 className="display-title text-center text-5xl font-bold text-ice">Письма <span className="text-gold">призрака</span></h1>
          {existing && (
            <p className="mt-3 text-center text-xs text-white/45">Сохранён вход: {existing.nickname} · {existing.roomCode}</p>
          )}
          <div className="mt-8 grid grid-cols-2 gap-2 rounded-lg bg-black/20 p-1">
            <button onClick={() => { setMode('create'); setError(null); }} className={`tab justify-center ${mode === 'create' ? 'tab-active' : ''}`}>Создать комнату</button>
            <button onClick={() => { setMode('join'); setError(null); }} className={`tab justify-center ${mode === 'join' ? 'tab-active' : ''}`}>Войти в комнату</button>
          </div>
          <label className="eyebrow mt-7 block">Никнейм</label>
          <input autoFocus value={nickname} onChange={(e) => setNickname(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} maxLength={18} className="field mt-2" placeholder="Введите имя" />
          {mode === 'join' && (
            <>
              <label className="eyebrow mt-5 block">Код комнаты</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && submit()} maxLength={5} className="field mt-2 text-center text-xl tracking-[.4em]" placeholder="A7K2Q" />
            </>
          )}
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <button onClick={submit} disabled={loading} className="btn-primary mt-7 w-full">
            {mode === 'create' ? <><Plus size={18} /> Создать</> : <><LogIn size={18} /> Войти</>}
          </button>
        </section>
      </div>
    </main>
  );
}
