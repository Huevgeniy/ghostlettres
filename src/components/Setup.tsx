import { useMemo, useState } from 'react';
import { Check, Eye } from 'lucide-react';
import { type Room, type Player, type CategoryKey, CATEGORIES, ROLE_INFO } from '@/lib/game';
import { buildDeck, drawHand } from '@/lib/game';

type Props = {
  room: Room;
  players: Player[];
  me: Player;
  onLayTable: (table: import('@/lib/game').TableClue[]) => void;
  onKillerChoose: (choices: Partial<Record<CategoryKey, string>>) => void;
  onStartRound: () => void;
};

export default function Setup({
  room, players, me, onLayTable, onKillerChoose, onStartRound,
}: Props) {
  const isKiller = me.role === 'killer';
  const isGhost = me.role === 'ghost';
  const table = room.state.table ?? [];
  const killerChoices = room.state.killerChoices ?? {};

  const deck = useMemo(() => buildDeck(), []);
  const [killerSel, setKillerSel] = useState<Partial<Record<CategoryKey, string>>>(killerChoices as Partial<Record<CategoryKey, string>>);

  const categories = CATEGORIES.filter((cat) => cat.key !== 'secret' || room.settings.secretCategory);
  const requiredClues = categories.length * 5;
  const tableReady = table.length >= requiredClues;
  const killerReady = !room.settings.hasKiller || Object.keys(killerChoices).length === categories.length;

  function addClue(_cat: CategoryKey, _card: { id: string; label: string }) {
    // intentionally unused; detectives lay all clues at once via confirmTable
  }

  function confirmTable() {
    const out: import('@/lib/game').TableClue[] = [];
    categories.forEach((cat) => {
      const chosen = drawHand(deck, 5);
      chosen.forEach((card, i) => {
        out.push({
          id: `${cat.key}-${i}-${card.id}`,
          category: cat.key,
          label: card.label,
          cardId: card.id,
          authorId: me.id,
          authorName: me.nickname,
        });
      });
    });
    onLayTable(out);
  }

  function confirmKiller() {
    onKillerChoose(killerSel);
  }

  if (isGhost) {
    return (
      <div className="relative min-h-screen bg-[#071821] text-slate-100">
        <div className="fog" />
        <div className="relative mx-auto max-w-2xl px-6 py-16 text-center">
          <Eye size={28} className="mx-auto text-teal-300" />
          <h1 className="ornate-title mt-2 text-3xl font-bold text-teal-50">Призрак ждёт</h1>
          <p className="mt-3 text-slate-300">Игроки раскладывают улики на столе, а убийца тайно выбирает истинные. Когда все будут готовы, начнётся первый круг.</p>
          <div className="mt-6 space-y-2 text-left text-sm">
            <div className="flex items-center justify-between rounded-lg bg-[#0b2634]/70 px-4 py-2">
              <span>Улики на столе</span>
              <span className={tableReady ? 'text-emerald-300' : 'text-slate-400'}>{table.length}/{requiredClues} {tableReady && '✓'}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#0b2634]/70 px-4 py-2">
              <span>Выбор убийцы</span>
              <span className={killerReady ? 'text-emerald-300' : 'text-slate-400'}>{room.settings.hasKiller ? `${Object.keys(killerChoices).length}/${categories.length}` : 'Не используется'} {killerReady && '✓'}</span>
            </div>
          </div>
          {tableReady && killerReady && (
            <button onClick={onStartRound} className="mt-8 rounded-xl bg-amber-400 px-6 py-3 font-semibold text-[#071821] hover:bg-amber-300">
              Начать первый круг
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isKiller) {
    const grouped: Record<CategoryKey, typeof table> = { weapon: [], location: [], motive: [], secret: [] };
    table.forEach((c) => grouped[c.category].push(c));
    return (
      <div className="relative min-h-screen bg-[#071821] text-slate-100">
        <div className="fog" />
        <div className="relative mx-auto max-w-5xl px-4 py-8">
          <h1 className="ornate-title text-2xl font-bold text-rose-200">Выберите истинные улики</h1>
          <p className="mt-1 text-sm text-slate-400">Отметьте по одной улике в каждой категории. Их увидит только призрак.</p>
          {!tableReady && (
            <p className="mt-4 rounded-lg bg-rose-950/30 px-4 py-3 text-sm text-rose-200">Сначала дождитесь, пока детективы выложат все улики на стол.</p>
          )}
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {categories.map((cat) => (
              <section key={cat.key} className="rounded-2xl border border-teal-800/40 bg-[#0b2634]/50 p-4">
                <h3 className="ornate-title text-lg font-semibold text-amber-200">{cat.title}</h3>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {grouped[cat.key].map((clue) => {
                    const picked = killerSel[cat.key] === clue.id;
                    return (
                      <button
                        key={clue.id}
                        disabled={!tableReady}
                        onClick={() => setKillerSel((s) => ({ ...s, [cat.key]: clue.id }))}
                        className={`clue-card flex aspect-[2/3] items-center justify-center rounded-md p-1 text-center text-[10px] font-medium leading-tight transition ${picked ? 'ring-2 ring-rose-400' : 'opacity-70'} disabled:opacity-40`}
                      >
                        {clue.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <button
            onClick={confirmKiller}
            disabled={Object.keys(killerSel).length !== categories.length}
            className="mt-6 flex items-center gap-2 rounded-lg bg-rose-400 px-5 py-2.5 font-semibold text-[#071821] hover:bg-rose-300 disabled:opacity-50"
          >
            <Check size={16} /> Подтвердить выбор
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#071821] text-slate-100">
      <div className="fog" />
      <div className="relative mx-auto max-w-5xl px-4 py-8">
        <h1 className="ornate-title text-2xl font-bold text-teal-50">Разложите улики на столе</h1>
        <p className="mt-1 text-sm text-slate-400">Заполните каждую категорию пятью карточками с ассоциацией.</p>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {categories.map((cat) => (
            <section key={cat.key} className="rounded-2xl border border-teal-800/40 bg-[#0b2634]/50 p-4">
              <h3 className="ornate-title text-lg font-semibold text-amber-200">{cat.title}</h3>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const placed = groupedExisting(cat.key)[i];
                  if (placed) return <div key={i} className="clue-card flex aspect-[2/3] items-center justify-center rounded-md p-1 text-center text-[10px] font-medium">{placed.label}</div>;
                  return (
                    <div key={i} className="aspect-[2/3] rounded-md border border-dashed border-teal-700/50 text-[10px] text-slate-500 flex items-center justify-center">?</div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">Любой детектив может нажать «Выложить на стол», чтобы заполнить все категории.</p>
            </section>
          ))}
        </div>

        <button
          onClick={confirmTable}
          disabled={table.length >= requiredClues}
          className="mt-6 flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-2.5 font-semibold text-[#071821] hover:bg-teal-300 disabled:opacity-50"
        >
          <Check size={16} /> {table.length >= requiredClues ? 'Улики выложены' : 'Выложить на стол'}
        </button>
      </div>
    </div>
  );

  function groupedExisting(cat: CategoryKey) {
    return table.filter((c) => c.category === cat);
  }
}
