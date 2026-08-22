import { type ClueCard, clueTone } from '@/lib/game';

type Props = {
  card: ClueCard;
  className?: string;
  selected?: boolean;
  highlighted?: boolean;
  marked?: 'correct' | 'wrong' | 'chosen' | null;
  onClick?: () => void;
  disabled?: boolean;
  note?: string;
};

export default function ClueFace({ card, className = '', selected, highlighted, marked, onClick, disabled, note }: Props) {
  const tone = clueTone(card.id);
  const cls = `clue-face ${selected ? 'is-selected' : ''} ${highlighted ? 'is-hint' : ''} ${marked ? `is-${marked}` : ''} ${className}`;
  const style = card.img
    ? undefined
    : { background: `linear-gradient(160deg, ${tone.from}, ${tone.to})` };
  const inner = (
    <>
      {card.img ? (
        <img className="clue-face-img" src={card.img} alt={card.label} draggable={false} />
      ) : (
        <span className="clue-face-label">{card.label}</span>
      )}
      {note && <span className="clue-face-note">{note}</span>}
      {marked === 'correct' && <span className="clue-mark ok">✓</span>}
      {marked === 'wrong' && <span className="clue-mark bad">✕</span>}
      {marked === 'chosen' && <span className="clue-token" />}
    </>
  );
  if (onClick) {
    return (
      <button type="button" disabled={disabled} onClick={onClick} className={cls} style={style}>
        {inner}
      </button>
    );
  }
  return <div className={cls} style={style}>{inner}</div>;
}
