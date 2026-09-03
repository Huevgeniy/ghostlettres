import { type Role, ROLE_IMAGES } from '@/lib/game';

type Props = {
  role: Role;
  onClose: () => void;
};

export default function RoleReveal({ role, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-6 py-8 backdrop-blur-md">
      <div className="relative w-full max-w-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.35em] text-gold">Ваша роль</p>
          <button onClick={onClose} className="btn-primary text-sm">Я понял</button>
        </div>
        <div className="overflow-hidden rounded-2xl ring-2 ring-teal-600/40 shadow-2xl">
          <img src={ROLE_IMAGES[role]} alt={`Роль: ${role}`} className="block w-full object-contain" draggable={false} />
        </div>
      </div>
    </div>
  );
}
