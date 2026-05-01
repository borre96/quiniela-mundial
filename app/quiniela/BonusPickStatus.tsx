type BonusPickMeta = {
  pick_type?: string;
  label?: string;
  name?: string;
  value_label?: string | null;
  selected_label?: string | null;
  points_awarded?: number | null;
  scored_at?: string | null;
};

type BonusPickStatusProps = {
  meta?: BonusPickMeta | null;
};

export default function BonusPickStatus({ meta }: BonusPickStatusProps) {
  const hasBeenScored = Boolean(meta?.scored_at);
  const points = Number(meta?.points_awarded ?? 0);

  if (!hasBeenScored) {
    return (
      <span className="inline-flex items-center rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2.5 py-1 text-xs font-semibold text-yellow-200">
        ⏳ Pendiente
      </span>
    );
  }

  if (points > 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
        ✅ Acertado (+{points})
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-1 text-xs font-semibold text-red-200">
      ❌ Fallado
    </span>
  );
}