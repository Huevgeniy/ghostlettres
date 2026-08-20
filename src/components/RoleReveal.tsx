import { Ghost, Skull, Search } from 'lucide-react';
import { type Role, ROLE_INFO } from '@/lib/game';

type Props = {
  role: Role;
  onClose: () => void;
};

const ICONS: Record<Role, typeof Ghost> = {
  ghost: Ghost,
  killer: Skull,
  detective: Search,
};

export default function RoleReveal({ role, onClose }: Props) {
  const info = ROLE_INFO[role];
  const Icon = ICONS[role];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6 backdrop-blur-md">
      <div className="card-glow relative w-full max-w-md rounded-3xl border border-teal-700/40 bg-gradient-to-b from-[#0f2d3b] to-[#071821] p-8 text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full ring-2" style={{ borderColor: info.color, boxShadow: `0 0 40px ${info.color}40` }}>
          <Icon size={44} style={{ color: info.color }} />
        </div>
        <p className="text-xs uppercase tracking-[0.45em] text-slate-400">Ваша роль</p>
        <h2 className="ornate-title mt-2 text-4xl font-bold" style={{ color: info.color }}>{info.title}</h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">{info.blurb}</p>
        <button
          onClick={onClose}
          className="mt-8 w-full rounded-xl bg-teal-500/20 px-4 py-3 font-semibold text-teal-100 ring-1 ring-teal-400/40 transition hover:bg-teal-500/30"
        >
          Я понял
        </button>
      </div>
    </div>
  );
}
