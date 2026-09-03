import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, LogOut, Megaphone, RefreshCw, Send, Settings2, SkipForward, Trophy, Vote, X } from 'lucide-react';
import {
  type CategoryKey,
  type ClueCard,
  type Player,
  type Room,
  type TableClue,
  activeCategories,
  cluesPerCategory,
  clockwiseOrder,
  ROLE_INFO,
  ROLE_IMAGES,
  CHARACTER_ABILITIES,
} from '@/lib/game';
import ClueFace from './ClueFace';
import PlayerRing from './PlayerRing';

type Props = {
  room: Room;
  players: Player[];
  me: Player;
  onPlaceClue: (category: CategoryKey, note?: string) => void;
  onTrueChoose: (choices: Partial<Record<CategoryKey, string>>, commit?: boolean) => void;
  onGhostOpening: (card: ClueCard | null) => void;
  onSubmitClue: (card: ClueCard) => void;
  onGhostResolve: (keepIds: string[]) => void;
  onRefreshHand: (discardId: string | null) => void;
  onPassSpeech: () => void;
  onAdvance: () => void;
  onLockVote: (picks: Partial<Record<CategoryKey, string>>, killerId: string | null) => void;
  onRevealTruth: () => void;
  onPoliticianExtraVote: (category: CategoryKey, clueId: string) => void;
  onActivateAbility: (playerId: string) => void;
  onCancelAbility: (playerId: string) => void;
  onAbilityOwnerPick: (playerId: string, choice: string) => void;
  onAbilityGhostPick: (playerId: string, picks: string[]) => void;
  onAbilityGhostNumber: (playerId: string, n: number) => void;
  onAbilityFinish: (playerId: string) => void;
  onAbilityCopy: (playerId: string, charId: string) => void;
  onAbilityOwnerDiscard: (playerId: string, ids: string[]) => void;
  onAbilitySendToGhost: (playerId: string, ids: string[]) => void;
  onAbilityPlayerSubmit: (playerId: string, cardId: string) => void;
  onAbilityGhostSkip: (playerId: string) => void;
  onTimerExpire: () => void;
  onRestart: () => void;
  onExit: () => void;
  onToLobby: () => void;
};

export default function GameTable(props: Props) {
  const { room, players, me } = props;
  const cats = activeCategories(room.settings);
  const per = cluesPerCategory(room.settings);
  const table = room.state.table ?? [];
  const truth = room.state.trueChoices ?? {};
  const hints = room.state.hints ?? [];
  const order = clockwiseOrder(players);
  const isGhost = me.role === 'ghost';
  const isKiller = me.role === 'killer';
  const killerAbsent = room.state.discardedRole === 'killer';
  const ghostChoosesTruth = !room.settings.hasKiller || killerAbsent;
  const seesTruth = isGhost || isKiller || me.role === 'accomplice' || me.role === 'expert';
  const voteCats = (room.state.voteScope && room.state.voteScope.length
    ? cats.filter((c) => room.state.voteScope!.includes(c.key))
    : cats) as typeof cats;
  const needKiller = room.settings.hasKiller && !(room.state.voteScopeKiller === false);
  const suspects = players.filter((p) => p.id !== me.id);
  const round = room.state.round ?? 0;
  const totalRounds = room.settings.rounds;
  const [zoom, setZoom] = useState<{ card: ClueCard; note?: string } | null>(null);
  const [roleCardZoom, setRoleCardZoom] = useState(false);
  const [selectedHand, setSelectedHand] = useState<string | null>(null);
  const [ghostKeep, setGhostKeep] = useState<string[]>([]);
  const [trueSel, setTrueSel] = useState<Partial<Record<CategoryKey, string>>>(truth);
  const [votePicks, setVotePicks] = useState<Partial<Record<CategoryKey, string>>>({});
  const [voteKiller, setVoteKiller] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [abilitySel, setAbilitySel] = useState<string[]>([]);
  const [polExtraCat, setPolExtraCat] = useState<CategoryKey | null>(null);
  const [polExtraPicked, setPolExtraPicked] = useState<Partial<Record<CategoryKey, string>>>({});
  const remaining = useCountdown(room.state.deadlineAt, props.onTimerExpire);

  const grouped = useMemo(() => {
    const g: Record<string, TableClue[]> = {};
    cats.forEach((c) => { g[c.key] = []; });
    table.forEach((c) => { g[c.category]?.push(c); });
    return g;
  }, [table, cats]);

  const banner = useBanner(room, players, me);
  const myBallot = room.state.ballots?.[me.id];
  const summary = room.state.resultSummary;
  const tally = room.state.tally;
  const showVotes = room.phase === 'tally' || room.phase === 'results';

  function markFor(clue: TableClue): 'correct' | 'wrong' | 'chosen' | null {
    if (room.phase === 'results' && summary) {
      const s = summary.clues[clue.category];
      if (!s) return null;
      if (clue.id === s.trueId && clue.id === s.chosenId) return 'correct';
      if (clue.id === s.trueId) return 'correct';
      if (clue.id === s.chosenId) return 'wrong';
      return null;
    }
    if (room.phase === 'tally' && tally?.picks[clue.category] === clue.id) return 'chosen';
    return null;
  }

  const laying = room.phase === 'setup' && room.state.layingPlayerId === me.id && room.state.layingCard;

  return (
    <main className="min-h-screen bg-ink texture text-white">
      {zoom && (
        <div className="zoom-layer" onClick={() => setZoom(null)}>
          <div onClick={(e) => e.stopPropagation()} className="zoom-card">
            <ClueFace card={zoom.card} className="clue-zoom" />
            {zoom.note && <div className="zoom-note"><p className="eyebrow">Ассоциация</p><p>{zoom.note}</p></div>}
            <button className="zoom-close" onClick={() => setZoom(null)}><X size={20} /></button>
          </div>
        </div>
      )}

      {roleCardZoom && me.role && (
        <div className="zoom-layer" onClick={() => setRoleCardZoom(false)}>
          <div onClick={(e) => e.stopPropagation()} className="zoom-card">
            <img src={ROLE_IMAGES[me.role]} alt="Ваша роль" className="role-card-zoom-img" draggable={false} />
            <button className="zoom-close" onClick={() => setRoleCardZoom(false)}><X size={20} /></button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-5">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="eyebrow">Письма призрака</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="display-title text-3xl font-bold text-ice">
                Раунд {Math.max(round, 1)}<span className="text-white/30"> / {totalRounds}</span>
              </h1>
              {remaining !== null && <span className="timer-pill">{formatTime(remaining)}</span>}
            </div>
            <div className="mt-2 flex gap-1.5">
              {Array.from({ length: totalRounds }).map((_, i) => (
                <span key={i} className={`hex-token ${i + 1 === round ? 'hex-now' : i < round ? 'hex-done' : ''}`} />
              ))}
            </div>
            <p className="mt-3 text-sm text-white/70">{banner}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="role-chip">{me.nickname}</div>
                {me.role && (
                  <p className="mt-0.5 text-xs" style={{ color: ROLE_INFO[me.role].color }}>
                    {ROLE_INFO[me.role].title}
                  </p>
                )}
              </div>
              {me.role && (
                <button
                  onClick={() => setRoleCardZoom(true)}
                  className="role-card-mini"
                  title="Открыть карточку роли"
                >
                  <img src={ROLE_IMAGES[me.role]} alt={ROLE_INFO[me.role].title} draggable={false} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {me.nickname === room.host_name && (
                <button onClick={props.onToLobby} className="btn-ghost"><Settings2 size={16} /> В лобби</button>
              )}
              <button onClick={props.onExit} className="btn-ghost"><LogOut size={16} /> Выйти</button>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[220px_1fr_280px]">
          <aside className="panel relative h-[340px] overflow-hidden p-3">
            <p className="eyebrow mb-2">Стол игроков</p>
            <PlayerRing
              players={order}
              meId={me.id}
              speakerId={room.state.speakerId}
              radioPlayerId={room.state.radioPlayerId}
              accusedId={tally?.killerId ?? (showVotes ? tally?.killerId : null)}
              trueKillerId={summary?.killer.trueId ?? null}
              showRoles={room.phase === 'results'}
              revealKiller={room.phase === 'results'}
            />
          </aside>

          <section>
            <div className="mb-4">
              <h2 className="section-title mb-2">Подсказки призрака</h2>
              {hints.length === 0 ? (
                <div className="empty-area py-6 text-sm">Пока нет открытых подсказок</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {hints.map((c) => (
                    <ClueFace key={c.id} card={c} className="clue-hint" highlighted onClick={() => setZoom({ card: c })} />
                  ))}
                </div>
              )}
              {isGhost && room.state.discardedRole && (
                <p className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  Сброшенная роль (видно только вам): <b>{ROLE_INFO[room.state.discardedRole].title}</b>.
                  {killerAbsent ? ' Убийцы нет в игре — вы сами выберете истинные улики.' : ' Этот игрок отсутствует.'}
                </p>
              )}
              {isGhost && (room.state.vanished?.length ?? 0) > 0 && (
                <p className="mt-2 text-xs text-white/40">Исчезло карт (видно только вам): {room.state.vanished?.map((c) => c.label).join(', ')}</p>
              )}
            </div>

            {seesTruth && Object.keys(truth).length > 0 && room.phase !== 'results' && (
              <div className="mb-4 rounded-xl border border-cyan/25 bg-cyan/10 p-3 text-sm text-cyan">
                Истинные улики (только вам): {cats.map((c) => `${c.title}: ${table.find((t) => t.id === truth[c.key])?.card.label ?? '—'}`).join(' · ')}
              </div>
            )}
            {me.role === 'witness' && room.phase !== 'results' && (
              <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
                Свидетель: убийца — {players.find((p) => p.role === 'killer')?.nickname ?? '—'}. Не выдайте себя.
              </div>
            )}

            <h2 className="section-title mb-3">Поле улик</h2>
            <div className="space-y-4">
              {cats.map((cat) => (
                <div key={cat.key} className="flex gap-3">
                  <div className="cat-badge">{cat.title}</div>
                  <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${per}, minmax(0, 1fr))` }}>
                    {Array.from({ length: per }).map((_, i) => {
                      const clue = grouped[cat.key]?.[i];
                      if (!clue) {
                        return (
                          <button
                            key={`${cat.key}-empty-${i}`}
                            disabled={!laying}
                            onClick={() => laying && props.onPlaceClue(cat.key, noteInput)}
                            className="clue-empty flex items-center justify-center text-white/25"
                          >
                            {laying ? '+' : ''}
                          </button>
                        );
                      }
                      const ghostHighlight = seesTruth && truth[cat.key] === clue.id && room.phase !== 'results';
                      return (
                        <ClueFace
                          key={clue.id}
                          card={clue.card}
                          highlighted={ghostHighlight}
                          marked={markFor(clue)}
                          selected={trueSel[cat.key] === clue.id || votePicks[cat.key] === clue.id}
                          onClick={() => {
                            if (room.phase === 'true_choice' && (isKiller || (ghostChoosesTruth && isGhost))) {
                              const next = { ...trueSel, [cat.key]: clue.id };
                              setTrueSel(next);
                              props.onTrueChoose(next, false);
                              return;
                            }
                            if (room.phase === 'voting' && !isGhost && !myBallot?.locked) {
                              if (voteCats.some((c) => c.key === cat.key)) {
                                setVotePicks((s) => ({ ...s, [cat.key]: clue.id }));
                              }
                              return;
                            }
                            setZoom({ card: clue.card, note: clue.note });
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-4">
            {isGhost && (
              <div className="panel max-h-64 overflow-auto p-4">
                <p className="eyebrow">Прошлые карты ({isGhost ? 'видно только вам' : ''})</p>
                {(room.state.discard?.length ?? 0) + (room.state.vanished?.length ?? 0) === 0 ? (
                  <p className="mt-2 text-xs text-white/40">Пока пусто.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[...(room.state.discard ?? []), ...(room.state.vanished ?? [])].map((c) => (
                      <ClueFace key={c.id} card={c} className="clue-hint" onClick={() => setZoom({ card: c })} />
                    ))}
                  </div>
                )}
                {(room.state.discard?.length ?? 0) > 0 && (
                  <p className="mt-2 text-[.65rem] text-white/35">Сброс: {room.state.discard?.length}</p>
                )}
                {(room.state.vanished?.length ?? 0) > 0 && (
                  <p className="text-[.65rem] text-white/35">Исчезло: {room.state.vanished?.length}</p>
                )}
              </div>
            )}
            <div className="panel max-h-64 overflow-auto p-4">
              <p className="eyebrow">Журнал</p>
              <ul className="mt-2 space-y-1.5 text-xs text-white/55">
                {(room.state.events ?? []).slice().reverse().slice(0, 16).map((e) => (
                  <li key={e.id}>{e.text}</li>
                ))}
              </ul>
            </div>
            {showVotes && (
              <div className="panel p-4 text-xs text-white/70">
                <p className="eyebrow mb-2">Кто как проголосовал</p>
                {Object.values(room.state.ballots ?? {}).map((b) => (
                  <p key={b.playerId} className="mb-1">
                    {b.nickname}: {cats.map((c) => table.find((t) => t.id === b.picks[c.key])?.card.label ?? '—').join(' / ')}
                    {room.settings.hasKiller ? ` → ${players.find((p) => p.id === b.killerId)?.nickname ?? '—'}` : ''}
                  </p>
                ))}
              </div>
            )}
          </aside>
        </div>

        {room.phase === 'setup' && room.state.layingCard && (
          <div className="panel mt-5 p-4">
            <p className="font-semibold text-cyan">Текущая улика для стола</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <ClueFace card={room.state.layingCard} className="clue-hand" onClick={() => setZoom({ card: room.state.layingCard! })} />
              <div className="min-w-[16rem] flex-1">
                {room.state.layingPlayerId === me.id ? (
                  <>
                    <p className="text-sm text-white/60">Выберите категорию на поле, куда положить эту карту. Можно добавить короткую ассоциацию (увидит любой, кто откроет карту).</p>
                    <input
                      className="field mt-2"
                      value={noteInput}
                      maxLength={60}
                      placeholder="Короткая ассоциация (необязательно)"
                      onChange={(e) => setNoteInput(e.target.value)}
                    />
                  </>
                ) : (
                  <p className="text-sm text-white/60">Ход: {players.find((p) => p.id === room.state.layingPlayerId)?.nickname ?? '…'}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {room.phase === 'true_choice' && (
          <div className="panel mt-5 p-4">
            {(isKiller || (ghostChoosesTruth && isGhost)) ? (
              <>
                <p className="font-semibold text-rose-200">Отметьте по одной истинной улике в каждой категории.</p>
                <button
                  className="btn-primary mt-3"
                  disabled={cats.some((c) => !trueSel[c.key])}
                  onClick={() => props.onTrueChoose(trueSel, true)}
                >
                  Подтвердить истинные улики
                </button>
              </>
            ) : isGhost ? (
              <p className="text-sm text-white/60">Убийца выбирает истинные улики. Вы видите стол и запомните выбор.</p>
            ) : (
              <p className="text-sm text-white/60">Закройте глаза… Убийца выбирает истинные улики. Ждите сигнала призрака.</p>
            )}
          </div>
        )}

        {room.phase === 'ghost_opening' && (
          <div className="panel mt-5 p-4">
            {isGhost ? (
              <>
                <p className="font-semibold text-cyan">Первая зацепка (по желанию): откройте одну карту из руки или пропустите.</p>
                <Hand me={me} selected={selectedHand} setSelected={setSelectedHand} disabled={false} />
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary" disabled={!selectedHand} onClick={() => {
                    const card = me.hand.find((c) => c.id === selectedHand);
                    if (card) props.onGhostOpening(card);
                  }}><Send size={16} /> Открыть как подсказку</button>
                  <button className="btn-secondary" onClick={() => props.onGhostOpening(null)}><SkipForward size={16} /> Пропустить</button>
                </div>
              </>
            ) : (
              <p className="text-sm text-white/60">Призрак может дать первую зацепку из своей руки.</p>
            )}
          </div>
        )}

        {room.phase === 'submit' && (
          <div className="panel mt-5 p-4">
            {(() => {
              const courierSecond = me.character === 'курьер' && me.submitted_clue && !me.submitted_clue.card2;
              if (me.submitted_clue && !courierSecond) {
                return <p className="text-sm text-white/60">Карта в почтовом ящике. Ожидаем остальных ({players.filter((p) => p.submitted_clue).length}/{players.length}).</p>;
              }
              return (
                <>
                  <p className="font-semibold text-cyan">
                    {courierSecond ? `Курьер: отправьте вторую карту (осталось ${me.hand.length} в руке).` : isGhost ? 'Вы тоже кладёте 1 карту в ящик, затем разберёте все отправления.' : 'Отправьте 1 улику призраку. Не называйте её до обсуждения.'}
                  </p>
                  <Hand me={me} selected={selectedHand} setSelected={setSelectedHand} disabled={false} />
                  <button className="btn-primary mt-3" disabled={!selectedHand} onClick={() => {
                    const card = me.hand.find((c) => c.id === selectedHand);
                    if (card) { props.onSubmitClue(card); setSelectedHand(null); }
                  }}><Send size={16} /> {courierSecond ? 'Отправить вторую' : 'В почтовый ящик'}</button>
                </>
              );
            })()}
          </div>
        )}

        {room.phase === 'ghost_review' && (
          <div className="panel mt-5 p-4">
            {isGhost ? (
              <>
                <p className="font-semibold text-cyan">Выберите карты-ассоциации с истинными уликами. Остальные исчезнут. Можно не открыть ни одной.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {players.map((p) => p.submitted_clue?.card).filter(Boolean).map((c) => (
                    <ClueFace
                      key={c!.id}
                      card={c!}
                      selected={ghostKeep.includes(c!.id)}
                      onClick={() => setGhostKeep((ids) => ids.includes(c!.id) ? ids.filter((x) => x !== c!.id) : [...ids, c!.id])}
                      className="clue-hint"
                    />
                  ))}
                </div>
                <button className="btn-primary mt-4" onClick={() => { props.onGhostResolve(ghostKeep); setGhostKeep([]); }}>
                  <Eye size={16} /> Завершить ход призрака
                </button>
              </>
            ) : (
              <p className="text-sm text-white/60">Ожидаем решение призрака</p>
            )}
          </div>
        )}

        {room.phase === 'refresh' && (
          <div className="panel mt-5 p-4">
            {(room.state.refreshedIds ?? []).includes(me.id) ? (
              <p className="text-sm text-white/60">Рука обновлена. Ждём остальных.</p>
            ) : (
              <>
                <p className="font-semibold text-cyan">Можно сбросить ровно 1 карту, затем рука дополнится до 5. Либо просто доберите.</p>
                <Hand me={me} selected={selectedHand} setSelected={setSelectedHand} disabled={false} />
                <div className="mt-3 flex gap-2">
                  <button className="btn-secondary" disabled={!selectedHand} onClick={() => { props.onRefreshHand(selectedHand); setSelectedHand(null); }}>
                    <RefreshCw size={16} /> Сбросить выбранную
                  </button>
                  <button className="btn-primary" onClick={() => props.onRefreshHand(null)}>Добрать без сброса</button>
                </div>
              </>
            )}
          </div>
        )}

        {room.phase === 'discussion' && (
          <div className="panel mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-white/70">
              <Megaphone size={16} className="mr-2 inline text-gold" />
              Речь: {players.find((p) => p.id === room.state.speakerId)?.nickname ?? '—'}
              {isGhost ? ' (призрак молчит и передаёт слово).' : ''}
            </p>
            <div className="flex gap-2">
              {(me.id === room.state.speakerId || isGhost) && (
                <button className="btn-secondary" onClick={props.onPassSpeech}>Передать слово</button>
              )}
              {isGhost && (
                <button className="btn-primary" onClick={props.onAdvance}>
                  {round >= totalRounds ? <><Vote size={16} /> К голосованию</> : <>Следующий раунд</>}
                </button>
              )}
            </div>
          </div>
        )}

        {room.phase === 'voting' && (
          <div className="panel mt-5 p-4">
            {isGhost ? (
              <p className="text-sm text-white/60">Вы не голосуете. Когда все нажмут «Проголосовать» или истечёт таймер, откроются итоги большинства.</p>
            ) : myBallot?.locked ? (
              <p className="text-sm text-white/60">Голос принят. Ждём остальных ({Object.values(room.state.ballots ?? {}).filter((b) => b.locked).length}/{players.filter((p) => p.role !== 'ghost').length}).</p>
            ) : (
              <>
                <p className="font-semibold text-gold">Выберите истинные улики на поле{needKiller ? ' и кого арестовать' : ''}, затем нажмите «Проголосовать». До этого голоса скрыты.{voteCats.length > 0 && voteCats.length < cats.length ? ' Переголосование только по неопределившимся категориям.' : ''}</p>
                {needKiller && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suspects.map((p) => (
                      <button key={p.id} onClick={() => setVoteKiller(p.id)} className={`chip ${voteKiller === p.id ? 'chip-active' : ''}`}>
                        {p.nickname}{p.role === 'ghost' ? ' (призрак / нет убийцы)' : ''}
                      </button>
                    ))}
                  </div>
                )}
                {me.character === 'политик' && !(room.state.usedAbilities ?? []).includes('политик') && (
                  <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                    <p className="text-sm font-semibold text-amber-100">Политик: добавьте ещё 1 голос за любой вариант (один раз за партию).</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cats.map((c) => (
                        <button key={c.key} className={`chip ${polExtraCat === c.key ? 'chip-active' : ''}`} onClick={() => setPolExtraCat(c.key)}>{c.title}</button>
                      ))}
                    </div>
                    {polExtraCat && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {grouped[polExtraCat]?.map((t) => (
                          <button key={t.id} className={`chip ${polExtraPicked[polExtraCat] === t.id ? 'chip-active' : ''}`} onClick={() => setPolExtraPicked((s) => ({ ...s, [polExtraCat!]: t.id }))}>{t.card.label}</button>
                        ))}
                      </div>
                    )}
                    <button
                      className="btn-primary mt-3"
                      disabled={!polExtraCat || !polExtraPicked[polExtraCat!]}
                      onClick={() => { if (polExtraCat && polExtraPicked[polExtraCat]) { props.onPoliticianExtraVote(polExtraCat, polExtraPicked[polExtraCat]); setPolExtraCat(null); } }}
                    >
                      <Vote size={16} /> Зафиксировать доп. голос
                    </button>
                  </div>
                )}
                <button
                  className="btn-primary mt-4"
                  disabled={voteCats.some((c) => !votePicks[c.key]) || (needKiller && !voteKiller)}
                  onClick={() => props.onLockVote(votePicks, voteKiller)}
                >
                  <Vote size={16} /> Проголосовать
                </button>
              </>
            )}
          </div>
        )}

        {room.phase === 'tally' && (
          <div className="panel mt-5 p-4">
            <p className="font-semibold text-cyan">Решение большинства на поле. Призрак пока не называет, угадано ли.</p>
            {isGhost && (
              <button className="btn-primary mt-3" onClick={props.onRevealTruth}><Trophy size={16} /> Подвести итог</button>
            )}
          </div>
        )}

        {room.phase === 'results' && summary && (
          <div className="panel mt-5 p-5 text-center">
            <p className="display-title text-3xl font-bold text-ice">
              Угадано {summary.guessed} из {summary.total}
            </p>
            <p className="mt-2 text-lg text-gold">
              {summary.winners === 'detectives' ? 'Победа мирных' : 'Победа убийцы'}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button className="btn-primary" onClick={props.onRestart}>Новая партия</button>
              <button className="btn-ghost" onClick={props.onExit}>Выйти</button>
            </div>
          </div>
        )}

        <AbilityPanel
          room={room}
          players={players}
          me={me}
          table={table}
          cats={cats}
          truth={truth}
          onOwnerPick={(choice) => props.onAbilityOwnerPick(me.id, choice)}
          onGhostPick={(picks) => props.onAbilityGhostPick(me.id, picks)}
          onGhostNumber={(n) => props.onAbilityGhostNumber(me.id, n)}
          onCancel={() => props.onCancelAbility(me.id)}
          onFinish={() => props.onAbilityFinish(me.id)}
          onAbility={(playerId) => props.onActivateAbility(playerId)}
          onCopy={(charId) => props.onAbilityCopy(me.id, charId)}
          onDiscardHand={(ids) => props.onAbilityOwnerDiscard(me.id, ids)}
          onSendToGhost={(ids) => props.onAbilitySendToGhost(me.id, ids)}
          onPlayerSubmit={(cardId) => props.onAbilityPlayerSubmit(me.id, cardId)}
          onGhostSkip={() => props.onAbilityGhostSkip(me.id)}
          sel={abilitySel}
          setSel={setAbilitySel}
        />
      </div>
    </main>
  );
}

function AbilityPanel({ room, players, me, table, cats, truth, onOwnerPick, onGhostPick, onGhostNumber, onCancel, onFinish, onAbility, onCopy, onDiscardHand, onSendToGhost, onPlayerSubmit, onGhostSkip, sel, setSel }: {
  room: Room;
  players: Player[];
  me: Player;
  table: TableClue[];
  cats: { key: CategoryKey; title: string; hint: string }[];
  truth: Partial<Record<CategoryKey, string>>;
  onOwnerPick: (choice: string) => void;
  onGhostPick: (picks: string[]) => void;
  onGhostNumber: (n: number) => void;
  onCancel: () => void;
  onFinish: () => void;
  onAbility: (playerId: string) => void;
  onCopy: (charId: string) => void;
  onDiscardHand: (ids: string[]) => void;
  onSendToGhost: (ids: string[]) => void;
  onPlayerSubmit: (cardId: string) => void;
  onGhostSkip: () => void;
  sel: string[];
  setSel: (s: string[]) => void;
}) {
  const ab = room.state.ability ?? null;
  const isGhost = me.role === 'ghost';
  const isOwner = !!ab && ab.ownerId === me.id;
  const def = ab ? CHARACTER_ABILITIES[ab.characterId] : null;
  const used = room.state.usedAbilities ?? [];

  // Кнопка активации собственной способности.
  if (!ab && me.character && !used.includes(me.character)) {
    const myDef = CHARACTER_ABILITIES[me.character];
    return (
      <button className="btn-primary mt-5" onClick={() => onAbility(me.id)}>
        Применить способность: {myDef?.title ?? me.character}
      </button>
    );
  }

  if (!ab || !def) return null;

  // ===== ПОЛИТИК: активация доступна, но применяется в момент голосования =====
  if (def.kind === 'extra_vote' && room.phase !== 'voting') {
    return (
      <div className="panel mt-5 p-4">
        <p className="font-semibold text-cyan">Политик · {def.description}. Активируйте в момент одного из голосований.</p>
      </div>
    );
  }

  // ===== КУРЬЕР: применяется в фазе submit (отправить 2) =====
  if (def.kind === 'send_two' && ab.step === 'owner_target' && room.phase === 'submit') {
    return (
      <div className="panel mt-5 p-4">
        <p className="font-semibold text-cyan">Курьер: {def.description}</p>
        <p className="mt-1 text-sm text-white/60">Выберите 2 карты из руки и отправьте призраку.</p>
      </div>
    );
  }

  // ===== АКТЁР: выбор скопированной способности =====
  if (isOwner && ab.step === 'copy_pick') {
    const others = players.filter((p) => p.role !== 'ghost' && p.id !== me.id && p.character);
    return (
      <div className="panel mt-5 p-4">
        <p className="font-semibold text-cyan">Актёр: скопируйте способность другого персонажа.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {others.map((p) => (
            <button key={p.id} className="btn-secondary" onClick={() => onCopy(p.character!)}>
              {players.find((x) => x.id === p.id)?.nickname}: {CHARACTER_ABILITIES[p.character!]?.title ?? p.character}
            </button>
          ))}
        </div>
        <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
      </div>
    );
  }

  // ===== ОТКРЫТЬ КАРТЫ ИЗ КОЛОДЫ (игрок): видят игрок и призрак, ghost может указать 1 =====
  if (ab.kind === 'show_deck3') {
    if (isGhost) {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-rose-200">Способность «{def.title}». Игрок {players.find((p) => p.id === ab.ownerId)?.nickname} открыл 3 карты. Укажите на 1 важную (или пропустите):</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(ab.revealed ?? []).map((c) => <ClueFace key={c.id} card={c} className={`clue-hint ${sel.includes(c.id) ? 'ring-2 ring-rose-300' : ''}`} onClick={() => setSel([c.id])} />)}
          </div>
          <button className="btn-primary mt-4" disabled={sel.length === 0} onClick={() => { onGhostPick(sel); setSel([]); }}>Указать</button>
          <button className="btn-ghost mt-3 ml-2" onClick={onGhostSkip}>Пропустить</button>
        </div>
      );
    }
    if (isOwner) {
      if (ab.step === 'reveal_pick' || ab.step === 'ghost_action') {
        return <p className="mt-5 text-center text-sm text-white/50">Открытые карты: {players.find((p) => p.id === ab.ownerId)?.nickname} и призрак видят 3 из колоды. Призрак решает…</p>;
      }
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Результат «{def.title}»</p>
          <div className="mt-3 flex flex-wrap gap-2">{(ab.revealed ?? []).map((c) => <ClueFace key={c.id} card={c} className="clue-hint" />)}</div>
          <button className="btn-primary mt-4" onClick={onFinish}>Понятно</button>
        </div>
      );
    }
    return null;
  }

  // ===== ПОВАР: открыть 3 и отправить призраку (вместо 1) =====
  if (ab.kind === 'send_deck3') {
    if (isOwner && ab.step === 'send_to_ghost') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">{def.title}: {def.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(ab.revealed ?? []).map((c) => <ClueFace key={c.id} card={c} className={`clue-hand ${sel.includes(c.id) ? 'ring-2 ring-rose-300' : ''}`} onClick={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id])} />)}
          </div>
          <button className="btn-primary mt-4" disabled={sel.length === 0} onClick={() => onSendToGhost(sel)}>Отправить призраку</button>
          <button className="btn-ghost mt-3 ml-2" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
  }

  // ===== СПЕЦАГЕНТ: посмотреть 3 случайные из сброса =====
  if (ab.kind === 'view_discard3') {
    if (isOwner && ab.step === 'owner_view') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">{def.title}: {def.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">{(ab.revealed ?? []).map((c) => <ClueFace key={c.id} card={c} className="clue-hint" />)}</div>
          <button className="btn-primary mt-4" onClick={onFinish}>Понятно</button>
        </div>
      );
    }
  }

  // ===== МЕДИУМ (призрак показывает 1 из сброса) =====
  if (ab.kind === 'ghost_from_discard') {
    if (isGhost && ab.step === 'ghost_action') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-rose-200">{def.title}: укажите 1 карту из сброса для {players.find((p) => p.id === ab.ownerId)?.nickname}.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(room.state.discard ?? []).map((c) => <button key={c.id} className="chip" onClick={() => onGhostPick([c.id])}>{c.label}</button>)}
          </div>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    if (isOwner && ab.step === 'owner_view') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Медиум: призрак показал вам карту из сброса.</p>
          <div className="mt-3 flex flex-wrap gap-2">{(ab.revealed ?? []).map((c) => <ClueFace key={c.id} card={c} className="clue-hint" />)}</div>
          <button className="btn-primary mt-4" onClick={onFinish}>Понятно</button>
        </div>
      );
    }
  }

  // ===== ПИСАТЕЛЬ (призрак убирает 3 из руки) =====
  if (ab.kind === 'reveal_hand_left') {
    if (isGhost && ab.step === 'ghost_action') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-rose-200">{def.title}: выберите 3 карты из руки {players.find((p) => p.id === ab.ownerId)?.nickname} в сброс.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(ab.handRevealed ?? []).map((c) => <ClueFace key={c.id} card={c} className={`clue-hand ${sel.includes(c.id) ? 'ring-2 ring-rose-300' : ''}`} onClick={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id])} />)}
          </div>
          <button className="btn-primary mt-4" disabled={sel.length !== 3} onClick={() => { onGhostPick(sel); setSel([]); }}>Убрать 3</button>
          <button className="btn-ghost mt-3 ml-2" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    if (isOwner && ab.step === 'owner_view') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">{def.title}: призрак убрал 3 карты, добор уже сделан.</p>
          <button className="btn-primary mt-4" onClick={onFinish}>Понятно</button>
        </div>
      );
    }
  }

  // ===== АНТИКВАР (призрак указывает 1 важную из руки или пропускает) =====
  if (ab.kind === 'reveal_hand_point') {
    if (isGhost && ab.step === 'ghost_action') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-rose-200">{def.title}: укажите 1 важную карту из руки {players.find((p) => p.id === ab.ownerId)?.nickname} (или пропустите):</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(ab.handRevealed ?? []).map((c) => <ClueFace key={c.id} card={c} className={`clue-hand ${sel.includes(c.id) ? 'ring-2 ring-rose-300' : ''}`} onClick={() => setSel([c.id])} />)}
          </div>
          <button className="btn-primary mt-4" disabled={sel.length === 0} onClick={() => { onGhostPick(sel); setSel([]); }}>Указать</button>
          <button className="btn-ghost mt-3 ml-2" onClick={onGhostSkip}>Пропустить</button>
        </div>
      );
    }
    if (isOwner && ab.step === 'owner_view') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Антиквар: важная карта по мнению призрака.</p>
          <div className="mt-3 flex flex-wrap gap-2">{(ab.revealed ?? []).map((c) => <ClueFace key={c.id} card={c} className="clue-hint" />)}</div>
          <button className="btn-primary mt-4" onClick={onFinish}>Понятно</button>
        </div>
      );
    }
  }

  // ===== ТРЕНЕР (игроки кладут карты, призрак показывает лучшую) =====
  if (ab.kind === 'trainer') {
    if (isOwner && ab.step === 'owner_target') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Тренер: выберите до 3 игроков (кроме призрака и себя).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {players.filter((p) => p.role !== 'ghost' && p.id !== me.id).map((p) => (
              <button key={p.id} className={`chip ${sel.includes(p.id) ? 'chip-active' : ''}`} onClick={() => { setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : (sel.length >= 3 ? sel : [...sel, p.id])); }}>{p.nickname}</button>
            ))}
          </div>
          <button className="btn-primary mt-3" disabled={sel.length === 0} onClick={() => onOwnerPick(sel.join(','))}>Подтвердить</button>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    if (!isGhost && !isOwner && (ab.pickedPlayers ?? []).includes(me.id)) {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Тренер: {players.find((p) => p.id === ab.ownerId)?.nickname} выбрал вас. Положите 1 карту взакрытую призраку.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {me.hand.map((c) => <button key={c.id} className="chip" onClick={() => onPlayerSubmit(c.id)}>{c.label}</button>)}
          </div>
        </div>
      );
    }
    if (isGhost && ab.step === 'ghost_action') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-rose-200">Тренер: игроки положили карты взакрытую. Выберите 1 лучшую для {players.find((p) => p.id === ab.ownerId)?.nickname}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(ab.copies ?? []).map((s) => <button key={s.card.id} className="chip" onClick={() => onGhostPick([s.card.id])}>{s.card.label}</button>)}
          </div>
        </div>
      );
    }
    if (isOwner && ab.step === 'owner_view') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Тренер: лучшая карта от игроков.</p>
          <div className="mt-3 flex flex-wrap gap-2">{(ab.revealed ?? []).map((c) => <ClueFace key={c.id} card={c} className="clue-hint" />)}</div>
          <button className="btn-primary mt-4" onClick={onFinish}>Понятно</button>
        </div>
      );
    }
  }

  // ===== ДЕЗИНСЕКТОР (сбросить часть руки) =====
  if (ab.kind === 'discard_hand') {
    if (isOwner && ab.step === 'owner_discard') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Дезинсектор: выберите карты для сброса (можно ни одной). Рука потом доберётся до 5.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {me.hand.map((c) => <ClueFace key={c.id} card={c} className={`clue-hand ${sel.includes(c.id) ? 'ring-2 ring-rose-300' : ''}`} onClick={() => setSel(sel.includes(c.id) ? sel.filter((x) => x !== c.id) : [...sel, c.id])} />)}
          </div>
          <button className="btn-primary mt-4" onClick={() => onDiscardHand(sel)}>Подтвердить сброс</button>
          <button className="btn-ghost mt-3 ml-2" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
  }

  // ===== Владелец: фаза owner_target (выбор категории/улики/игрока) =====
  if (isOwner && ab.step === 'owner_target') {
    const needsCat = ['бродяга', 'врач', 'официант', 'ученый', 'шериф'].includes(ab.characterId);
    if (needsCat) {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Выберите категорию: <b>{def.title}</b> — {def.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c.key} className="btn-secondary" onClick={() => onOwnerPick(c.key)}>{c.title}</button>
            ))}
          </div>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    if (ab.characterId === 'хакер') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Укажите на подсказку на поле: <b>{def.title}</b></p>
          <div className="mt-2 flex flex-wrap gap-1.5">{table.map((t) => <button key={t.id} className="chip chip-active" onClick={() => onOwnerPick(t.id)}>{t.card.label}</button>)}</div>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    if (ab.characterId === 'библиотекарь') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Укажите на подсказку: <b>{def.title}</b></p>
          <div className="mt-2 flex flex-wrap gap-1.5">{table.map((t) => <button key={t.id} className="chip" onClick={() => onOwnerPick(t.id)}>{t.card.label}</button>)}</div>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    if (ab.characterId === 'тренер') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-cyan">Выберите до 3 игроков (кроме призрака и себя): <b>{def.title}</b></p>
          <div className="mt-3 flex flex-wrap gap-2">
            {players.filter((p) => p.role !== 'ghost' && p.id !== me.id).map((p) => (
              <button key={p.id} className={`chip ${sel.includes(p.id) ? 'chip-active' : ''}`} onClick={() => { setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : (sel.length >= 3 ? sel : [...sel, p.id])); }}>{p.nickname}</button>
            ))}
          </div>
          <button className="btn-primary mt-3" disabled={sel.length === 0} onClick={() => onOwnerPick(sel.join(','))}>Подтвердить</button>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    return null;
  }

  // ===== Оператора: фаза owner_view (просмотр результата) =====
  if (isOwner && ab.step === 'owner_view') {
    const ghostPicks = ab.ghostPicks ?? [];
    return (
      <div className="panel mt-5 p-4">
        <p className="font-semibold text-cyan">Результат способности «{def.title}»</p>
        {def.kind === 'point_number' ? (
          <p className="mt-3 text-2xl font-bold text-gold">{ab.resultNumber ?? '—'}</p>
        ) : ghostPicks.length === 0 ? (
          <p className="mt-2 text-sm text-white/60">Призрак не указал ничего.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {table.filter((t) => ghostPicks.includes(t.id)).map((t) => <ClueFace key={t.id} card={t.card} className="clue-hint" highlighted />)}
            {players.flatMap((p) => p.hand).filter((c) => ghostPicks.includes(c.id)).map((c) => <ClueFace key={c.id} card={c} className="clue-hint" />)}
          </div>
        )}
        <button className="btn-primary mt-4" onClick={onFinish}>Понятно</button>
      </div>
    );
  }

  // ===== Призрак: фаза ghost_action (указание на улики/категорию/число/игрока) =====
  if (isGhost && ab.step === 'ghost_action') {
    if (def.kind === 'point_number') {
      const maxN = Math.max(players.length - 1, 1);
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-rose-200">Способность «{def.title}» от {players.find((p) => p.id === ab.ownerId)?.nickname}. Укажите число:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: maxN + 1 }).map((_, i) => (
              <button key={i} className="btn-secondary" onClick={() => onGhostNumber(i)}>{i}</button>
            ))}
          </div>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    if (def.kind === 'point_category') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-rose-200">Способность «{def.title}» от {players.find((p) => p.id === ab.ownerId)?.nickname}. Укажите категорию:</p>
          <div className="mt-3 flex flex-wrap gap-2">{cats.map((c) => <button key={c.key} className="btn-secondary" onClick={() => onGhostPick([c.key])}>{c.title}</button>)}</div>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    if (def.kind === 'point_player') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-rose-200">Способность «{def.title}». Укажите игрока (не убийцу):</p>
          <div className="mt-3 flex flex-wrap gap-2">{players.filter((p) => p.role !== 'killer').map((p) => <button key={p.id} className="btn-secondary" onClick={() => onGhostPick([p.id])}>{p.nickname}</button>)}</div>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    if (def.kind === 'point_two_clues') {
      return (
        <div className="panel mt-5 p-4">
          <p className="font-semibold text-rose-200">Способность «{def.title}». Укажите 2 связанные улики:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{table.map((t) => <button key={t.id} className={`chip ${sel.includes(t.id) ? 'chip-active' : ''}`} onClick={() => setSel(sel.includes(t.id) ? sel.filter((x) => x !== t.id) : [...sel, t.id])}>{t.card.label}</button>)}</div>
          <button className="btn-primary mt-3" disabled={sel.length !== 2} onClick={() => { onGhostPick(sel); setSel([]); }}>Готово</button>
          <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
        </div>
      );
    }
    // point_clue (1 улица) — призрак выбирает одну улику на поле.
    return (
      <div className="panel mt-5 p-4">
        <p className="font-semibold text-rose-200">Способность «{def.title}». Укажите улику на поле:</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{table.map((t) => <button key={t.id} className="chip" onClick={() => onGhostPick([t.id])}>{t.card.label}</button>)}</div>
        <button className="btn-ghost mt-3" onClick={onCancel}>Отмена</button>
      </div>
    );
  }

  // Владелец ждёт призрака.
  if (isOwner && ab.step === 'ghost_action') {
    return <p className="mt-5 text-center text-sm text-white/50">Ожидаем призрака…</p>;
  }

  return null;
}

function Hand({ me, selected, setSelected, disabled }: { me: Player; selected: string | null; setSelected: (id: string | null) => void; disabled: boolean }) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {me.hand.map((card) => (
        <ClueFace
          key={card.id}
          card={card}
          selected={selected === card.id}
          disabled={disabled}
          onClick={() => setSelected(selected === card.id ? null : card.id)}
          className="clue-hand"
        />
      ))}
    </div>
  );
}

function useBanner(room: Room, players: Player[], me: Player) {
  const speaker = players.find((p) => p.id === room.state.speakerId)?.nickname;
  if (room.phase === 'setup') return 'Сбор улик: кладите карту в категорию по кругу, начиная с призрака.';
  if (room.phase === 'true_choice') {
    if (!room.settings.hasKiller) return 'Призрак тайно выбирает истинные улики.';
    if (room.state.discardedRole === 'killer') return 'Убийца был сброшен: призрак сам выбирает истинные улики.';
    return 'Убийца тайно выбирает истинные улики.';
  }
  if (room.phase === 'ghost_opening') return 'Призрак может открыть первую зацепку.';
  if (room.phase === 'submit') return me.submitted_clue ? 'Ожидаем остальные карты в почтовом ящике' : 'Отправьте по 1 улике призраку';
  if (room.phase === 'ghost_review') return 'Ожидаем решение призрака';
  if (room.phase === 'refresh') return 'Шаг: обновление улик. Можно сбросить 1 карту и добрать до 5.';
  if (room.phase === 'discussion') return speaker ? `Речь игрока ${speaker}` : 'Обсуждение';
  if (room.phase === 'voting') return 'Финальное голосование. Призрак не голосует.';
  if (room.phase === 'tally') return 'Итог большинства на поле. Призрак может подвести итог.';
  if (room.phase === 'results') return 'Истинные улики и роли открыты.';
  return '';
}

function useCountdown(deadlineAt: string | null | undefined, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!deadlineAt) { setRemaining(null); return; }
    const tick = () => {
      const diff = new Date(deadlineAt).getTime() - Date.now();
      setRemaining(diff > 0 ? Math.ceil(diff / 1000) : 0);
      if (diff <= 0 && fired.current !== deadlineAt) {
        fired.current = deadlineAt;
        onExpire();
      }
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [deadlineAt, onExpire]);
  return remaining;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
