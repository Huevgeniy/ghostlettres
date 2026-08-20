import { useState } from 'react';
import { Vote, Trophy } from 'lucide-react';
import { type Room, type Player, type CategoryKey, CATEGORIES } from '@/lib/game';

type Props = {
  room: Room;
  players: Player[];
  me: Player;
  onVote: (category: CategoryKey, tableClueId: string) => void;
  onVoteKiller: (suspectId: string) => void;
  onFinish: () => void;
};

export default function Voting({ room, players, me, onVote, onVoteKiller, onFinish }: Props) {
  const myVotes = (room.state.votes ?? {})[me.id] ?? {};
  const myKillerVote = (room.state.killerVotes ?? {})[me.id] ?? null;
  const table = room.state.table ?? [];
  const categories = CATEGORIES.filter((cat) => cat.key !== 'secret' || room.settings.secretCategory);
  const grouped: Record<CategoryKey, typeof table> = { weapon: [], location: [], motive: [], secret: [] };
  table.forEach((c) => grouped[c.category].push(c));

  const allVoted =
    Object.keys(room.state.votes ?? {}).length === players.length &&
    Object.keys(room.state.killerVotes ?? {}).length === players.length;

  const [localVotes, setLocalVotes] = useState<Record<CategoryKey, string>>(myVotes as Record<CategoryKey, string>);
  const [localKiller, setLocalKiller] = useState<string | null>(myKillerVote);

  function pick(cat: CategoryKey, id: string) {
    setLocalVotes((v) => ({ ...v, [cat]: id }));
    onVote(cat, id);
  }

  function pickKiller(id: string) {
    setLocalKiller(id);
    onVoteKiller(id);
  }

  return (
    <div className="relative min-h-screen bg-[#071821] text-slate-100">
      <div className="fog" />
      <div className="relative mx-auto max-w-5xl px-4 py-8">
        <header className="text-center">
          <Vote size={28} className="mx-auto text-amber-300" />
          <h1 className="ornate-title mt-2 text-3xl font-bold text-teal-50">Голосование</h1>
          <p className="mt-2 text-sm text-slate-400">Выберите истинную улику в каждой категории и назовите убийцу.</p>
        </header>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {categories.map((cat) => (
            <section key={cat.key} className="rounded-2xl border border-teal-800/40 bg-[#0b2634]/50 p-4">
              <h3 className="ornate-title text-lg font-semibold text-amber-200">{cat.title}</h3>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {grouped[cat.key].map((clue) => {
                  const picked = localVotes[cat.key] === clue.id;
                  return (
                    <button
                      key={clue.id}
                      onClick={() => pick(cat.key, clue.id)}
                      className={`clue-card flex aspect-[2/3] items-center justify-center rounded-md p-1 text-center text-[10px] font-medium leading-tight transition ${picked ? 'ring-2 ring-amber-300' : 'opacity-70 hover:opacity-100'}`}
                    >
                      {clue.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-rose-800/40 bg-rose-950/20 p-5">
          <h3 className="ornate-title text-lg font-semibold text-rose-200">Кто убийца?</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {players.map((p) => {
              const picked = localKiller === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => pickKiller(p.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${picked ? 'bg-rose-400 text-[#071821]' : 'bg-rose-900/40 text-rose-100 hover:bg-rose-800/60'}`}
                >
                  {p.nickname}
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-6 text-center">
          {allVoted ? (
            me.role === 'ghost' ? (
              <button onClick={onFinish} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-semibold text-[#071821] hover:bg-amber-300">
                <Trophy size={18} /> Объявить итоги
              </button>
            ) : (
              <p className="text-sm text-slate-400">Все проголосовали. Ждём, пока призрак объявит итоги…</p>
            )
          ) : (
            <p className="text-sm text-slate-400">
              Проголосовало: {Object.keys(room.state.killerVotes ?? {}).length}/{players.length}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
