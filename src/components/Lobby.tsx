import { useState } from 'react';
import { Check, Copy, HelpCircle, LogOut, Play, Settings2 } from 'lucide-react';
import { minPlayers, roundsForPlayers, type Player, type Room, type RoomSettings } from '@/lib/game';

type Props = {
  room: Room;
  players: Player[];
  currentNickname: string;
  onStart: () => void;
  onLeave: () => void;
  onSettings: (settings: RoomSettings) => void;
};

export default function Lobby({ room, players, currentNickname, onStart, onLeave, onSettings }: Props) {
  const isHost = room.host_name === currentNickname;
  const settings = room.settings;
  const min = minPlayers(settings);
  const canStart = players.length >= min && players.length <= settings.playerCount;
  const [copied, setCopied] = useState(false);

  function patch(nextPatch: Partial<RoomSettings>) {
    const next = { ...settings, ...nextPatch };
    if (nextPatch.playerCount !== undefined || nextPatch.secretCategory !== undefined) {
      next.rounds = roundsForPlayers(next.playerCount, next.secretCategory);
    }
    onSettings(next);
  }
  function timerPatch(t: Partial<RoomSettings['timer']>) {
    patch({ timer: { ...settings.timer, ...t } });
  }

  return (
    <main className="min-h-screen bg-ink texture text-white">
      <div className="mx-auto max-w-7xl px-5 py-7">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <p className="eyebrow">Лобби расследования</p>
            <h1 className="display-title mt-1 text-4xl font-bold text-ice">Письма <span className="text-gold">призрака</span></h1>
          </div>
          <button onClick={onLeave} className="btn-ghost"><LogOut size={16} /> Выйти</button>
        </header>
        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_390px]">
          <section>
            <div className="panel mb-5 flex flex-wrap items-center justify-between gap-5 p-5">
              <div>
                <p className="eyebrow">Код комнаты</p>
                <button onClick={() => { navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="mt-1 flex items-center gap-3 text-4xl font-extrabold tracking-[.35em] text-gold">
                  {room.code}{copied ? <Check size={21} /> : <Copy size={21} />}
                </button>
                <p className="mt-2 text-sm text-white/45">Сообщите этот код друзьям. После обновления страницы вы останетесь в комнате.</p>
              </div>
              <div className="text-right">
                <p className="eyebrow">Участники</p>
                <p className="mt-1 text-3xl font-bold text-cyan">{players.length}<span className="text-lg text-white/35"> / {settings.playerCount}</span></p>
              </div>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">Игроки</h2>
              <span className="text-sm text-white/40">Хозяин: {room.host_name}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: settings.playerCount }).map((_, i) => {
                const player = players[i];
                return (
                  <div key={player?.id ?? i} className={`player-slot ${player ? 'player-filled' : ''}`}>
                    <span className="slot-number">{i + 1}</span>
                    {player ? (
                      <>
                        <span className="font-semibold">{player.nickname}</span>
                        {player.nickname === room.host_name && <span className="ml-auto badge-gold">Хозяин</span>}
                      </>
                    ) : <span className="text-white/30">Ожидаем игрока…</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 rounded-xl border border-cyan/15 bg-cyan/5 p-4 text-sm text-white/55">
              <HelpCircle className="mr-2 inline text-cyan" size={16} />
              {settings.hasKiller ? `Соревновательный режим: минимум ${min} игрока.` : `Кооператив без убийцы: минимум ${min} игрока.`} Обсуждение за столом, на сайте — колода, руки, таймеры и голосование.
            </div>
            {isHost ? (
              <button onClick={onStart} disabled={!canStart} className="btn-primary mt-6"><Play size={18} /> Начать партию</button>
            ) : (
              <p className="mt-6 text-center text-sm text-white/45">Ждём, когда хозяин начнёт расследование…</p>
            )}
          </section>
          <aside className="panel h-fit p-5">
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <Settings2 size={18} className="text-gold" />
              <h2 className="section-title">Настройки игры</h2>
            </div>
            <p className="eyebrow mt-5">Количество игроков</p>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {[4, 5, 6, 7, 8].map((n) => (
                <button key={n} onClick={() => patch({ playerCount: n })} disabled={!isHost} className={`setting-choice ${settings.playerCount === n ? 'setting-active' : ''}`}>{n}</button>
              ))}
            </div>
            <p className="mt-2 text-xs text-white/40">Раундов: {settings.rounds}{settings.secretCategory ? ' (тайна: +1)' : ''}</p>
            <Toggle label="Убийца" checked={settings.hasKiller} disabled={!isHost} onChange={(v) => patch({ hasKiller: v })} hint="Выключить — кооператив: призрак сам выбирает истинные улики, нужно угадать все категории." />
            <Toggle label="Тайна" checked={settings.secretCategory} disabled={!isHost} onChange={(v) => patch({ secretCategory: v })} hint="Четвёртая категория. Дело раскрыто, если угаданы 4 из 5 пунктов: все 4 улики или 3 улики и убийца. Партия длиннее на 1 раунд." />
            <Toggle label="Дополнительные роли" checked={settings.extraRoles} disabled={!isHost} onChange={(v) => patch({ extraRoles: v })} hint="С 7 игроков: сообщник и свидетель. С 10 — эксперт." />
            <Toggle label="Персонажи" checked={settings.characters} disabled hint="Скоро. С персонажами в категории по 5 улик." />
            <div className="mt-5 border-t border-white/10 pt-5">
              <Toggle label="Использовать таймеры" checked={settings.timer.enabled} disabled={!isHost} onChange={(v) => timerPatch({ enabled: v })} hint="Автопереход хода, если время вышло." />
              {settings.timer.enabled && (
                <div className="space-y-3 pt-2">
                  <TimerSelect label="Отправка улики" value={settings.timer.clueSeconds} options={[30, 60]} onChange={(v) => timerPatch({ clueSeconds: v as 30 | 60 })} />
                  <TimerSelect label="Ход призрака" value={settings.timer.ghostSeconds} options={[30, 60]} onChange={(v) => timerPatch({ ghostSeconds: v as 30 | 60 })} />
                  <TimerSelect label="Обсуждение" value={settings.timer.discussionMinutes} options={[1, 2, 3, 4, 5]} suffix=" мин" onChange={(v) => timerPatch({ discussionMinutes: v as 1 | 2 | 3 | 4 | 5 })} />
                  <TimerSelect label="Голосование" value={settings.timer.votingSeconds} options={[30, 60, 120]} onChange={(v) => timerPatch({ votingSeconds: v as 30 | 60 | 120 })} />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Toggle({ label, checked, disabled, onChange, hint }: { label: string; checked: boolean; disabled?: boolean; onChange?: (value: boolean) => void; hint: string }) {
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{label}</span>
        <button title={hint} disabled={disabled} onClick={() => onChange?.(!checked)} className={`toggle ${checked ? 'toggle-on' : ''} ${disabled ? 'opacity-40' : ''}`}><span /></button>
      </div>
      <p className="mt-1 text-xs leading-5 text-white/38">{hint}</p>
    </div>
  );
}

function TimerSelect({ label, value, options, suffix = ' сек', onChange }: { label: string; value: number; options: number[]; suffix?: string; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center justify-between text-sm text-white/65">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="select-field">
        {options.map((n) => <option key={n} value={n}>{n}{suffix}</option>)}
      </select>
    </label>
  );
}
