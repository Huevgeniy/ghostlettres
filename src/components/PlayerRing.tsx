import { type Player, playerColor, ROLE_INFO } from '@/lib/game';

type Props = {
  players: Player[];
  meId: string;
  speakerId?: string | null;
  radioPlayerId?: string | null;
  accusedId?: string | null;
  trueKillerId?: string | null;
  showRoles?: boolean;
  revealKiller?: boolean;
};

export default function PlayerRing({
  players, meId, speakerId, radioPlayerId, accusedId, trueKillerId, showRoles, revealKiller,
}: Props) {
  const n = Math.max(players.length, 1);
  return (
    <div className="player-ring">
      {players.map((p, i) => {
        const angle = (360 / n) * i - 90;
        const rad = (angle * Math.PI) / 180;
        const x = 50 + Math.cos(rad) * 42;
        const y = 50 + Math.sin(rad) * 38;
        const color = playerColor(i);
        const speaking = speakerId === p.id;
        const accused = accusedId === p.id;
        const isTrue = revealKiller && trueKillerId === p.id;
        const mark = revealKiller && accused
          ? (isTrue ? 'ok' : 'bad')
          : accused ? 'chosen' : isTrue ? 'true' : '';
        return (
          <div
            key={p.id}
            className={`seat ${speaking ? 'is-speaking' : ''} ${mark ? `is-${mark}` : ''}`}
            style={{ left: `${x}%`, top: `${y}%`, borderColor: color }}
            title={p.nickname}
          >
            <div className="seat-avatar" style={{ background: color }}>{p.nickname.slice(0, 1).toUpperCase()}</div>
            <div className="seat-name">{p.nickname}{p.id === meId ? ' · вы' : ''}</div>
            {p.role === 'ghost' && <div className="seat-role">Призрак</div>}
            {showRoles && p.role && p.role !== 'ghost' && <div className="seat-role">{ROLE_INFO[p.role].title}</div>}
            {radioPlayerId === p.id && <div className="seat-radio">рация</div>}
          </div>
        );
      })}
    </div>
  );
}
