type TeamLabelTeam = {
  name?: string | null;
  short_name?: string | null;
  flag_emoji?: string | null;
};

export function TeamLabel({
  team,
  compact = false,
  className = "",
}: {
  team?: TeamLabelTeam | null;
  compact?: boolean;
  className?: string;
}) {
  if (!team) {
    return <span className={className}>Por definir</span>;
  }

  const label = compact
    ? team.short_name || team.name || "Por definir"
    : team.name || team.short_name || "Por definir";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="text-lg leading-none"
        style={{
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        }}
        aria-hidden="true"
      >
        {team.flag_emoji || "🏳️"}
      </span>

      <span>{label}</span>
    </span>
  );
}