import { Trophy, RotateCcw } from 'lucide-react';
import { type Room, type Player, CATEGORIES } from '@/lib/game';

type Props = {
  room: Room;
  players: Player[];
  onRestart: () => void;
  onExit: () => void;
};

export default function Results({ room, players, onRestart, onExit }: Props) {
  const summary = room.state.resultSummary;
  const winners = room.state.winners;
  const killer = players.find((p) => p.role === 'killer');
  const categories = CATEGORIES.filter((cat) => cat.key !== 'secret' || room.settings.secretCategory);
  const checks = summary ? [summary.weapon.correct, summary.location.correct, summary.motive.correct, ...(summary.secret ? [summary.secret.correct] : []), summary.killer.correct].filter(Boolean).length : 0;
  const detectivesWin = winners === 'detectives';

  return (
    <div className="relative min-h-screen bg-[#071821] text-slate-100">
      <div className="fog" />
      <div className="relative mx-auto max-w-3xl px-6 py-12 text-center">
        <Trophy size={32} className="mx-auto text-amber-300" />
        <h1 className="ornate-title mt-3 text-4xl font-bold text-teal-50">
          {detectivesWin ? 'Детективы победили' : 'Победа убийцы'}
        </h1>
        <p className="mt-3 text-slate-300">
          {detectivesWin
            ? `Сыщики отгадали ${checks} из ${categories.length + 1} пунктов — правда восторжествовала.`
            : `Удалось отгадать лишь ${checks} из ${categories.length + 1}. Убийце удалось скрыться.`}
        </p>

        {killer && (
          <p className="mt-4 text-sm text-rose-200">
            Убийцей был: <span className="font-semibold">{killer.nickname}</span>
          </p>
        )}

        {summary && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {categories.map((cat) => {
              const s = summary![cat.key];
              if (!s) return null;
              return (
                <div key={cat.key} className={`rounded-xl border p-4 text-left ${s.correct ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-rose-800/50 bg-rose-950/20'}`}>
                  <p className="text-xs uppercase tracking-widest text-slate-400">{cat.title}</p>
                  <p className="mt-1 font-semibold text-slate-100">{s.chosen ?? '—'}</p>
                  <p className={`mt-1 text-sm ${s.correct ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {s.correct ? 'Верно' : 'Неверно'}
                  </p>
                </div>
              );
            })}
            <div className={`rounded-xl border p-4 text-left ${summary.killer.correct ? 'border-emerald-700/50 bg-emerald-950/30' : 'border-rose-800/50 bg-rose-950/20'}`}>
              <p className="text-xs uppercase tracking-widest text-slate-400">Убийца</p>
              <p className="mt-1 font-semibold text-slate-100">{summary.killer.chosen ? players.find((p) => p.id === summary.killer!.chosen)?.nickname ?? '—' : '—'}</p>
              <p className={`mt-1 text-sm ${summary.killer.correct ? 'text-emerald-300' : 'text-rose-300'}`}>
                {summary.killer.correct ? 'Верно' : 'Неверно'}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={onRestart} className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-semibold text-[#071821] hover:bg-amber-300">
            <RotateCcw size={18} /> Новая партия
          </button>
          <button onClick={onExit} className="rounded-xl px-6 py-3 text-slate-300 ring-1 ring-slate-600 hover:bg-slate-800/40">
            Выйти в меню
          </button>
        </div>

        <div className="mt-10 text-xs text-slate-500">
          {players.map((p) => (
            <span key={p.id} className="mr-3">
              {p.nickname} — {p.role ?? ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
