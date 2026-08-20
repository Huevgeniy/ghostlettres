import { type ClueCard, clueTone } from '@/lib/game';

type Props = {
  card: ClueCard;
  className?: string;
  selected?: boolean;
  highlighted?: boolean;
  marked?: 'correct' | 'wrong' | 'chosen' | null;
  onClick?: () => void;
  disabled?: boolean;
};

export default function ClueFace({ card, className = '', selected, highlighted, marked, onClick, disabled }: Props) {
  const tone = clueTone(card.id);
  const cls = `clue-face ${selected ? 'is-selected' : ''} ${highlighted ? 'is-hint' : ''} ${marked ? `is-${marked}` : ''} ${className}`;
  const style = { background: `linear-gradient(160deg, ${tone.from}, ${tone.to})` };
  const inner = (
    <>
      <span className="clue-face-label">{card.label}</span>
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
