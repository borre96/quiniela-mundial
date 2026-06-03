type SpecialPickType = {
  id: string;
  code: string;
  name: string;
  points: number;
};

type BonusPickMeta = Record<
  string,
  {
    points_awarded: number | null;
    scored_at: string | null;
  }
>;

type TeamOption = {
  id: string;
  name: string;
  short_name: string;
  flag_emoji: string;
};

type PlayerOption = {
  id: string;
  team_id: string | null;
  full_name: string;
  display_name: string | null;
  position: "goalkeeper" | "defender" | "midfielder" | "forward";
  is_young_player_eligible: boolean;
  is_active: boolean;
  team?: TeamOption | null;
};

type BonusStatusDashboardProps = {
  pickTypes: SpecialPickType[];
  bonusPickMeta: BonusPickMeta;
  bonusSelections: Record<string, string>;
  teamOptions: TeamOption[];
  getPlayerOptionsForPick: (code: string) => PlayerOption[];
  updateBonus: (pickTypeId: string, value: string) => void;
  updateCustomBonus: (pickTypeId: string, value: string) => void;
  saveBonus: () => void;
  saving: boolean;
  bonusLocked: boolean;
};

const TEAM_BONUS_CODES = ["champion", "runner_up", "third_place"];

const PLAYER_BONUS_CODES = [
  "top_scorer",
  "best_player",
  "best_goalkeeper",
  "best_young_player",
];

function EmojiFlag({ value }: { value?: string | null }) {
  return (
    <span
      className="inline-block leading-none"
      style={{
        fontFamily:
          '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      }}
      aria-hidden="true"
    >
      {value || "🏳️"}
    </span>
  );
}

function TeamLabel({ team }: { team?: TeamOption | null }) {
  if (!team) return <span>Sin selección</span>;

  return (
    <span className="inline-flex items-center gap-2">
      <EmojiFlag value={team.flag_emoji} />
      <span>{team.name || team.short_name}</span>
    </span>
  );
}

function getSelectionLabel(
  pick: SpecialPickType,
  value: string,
  teamOptions: TeamOption[],
) {
  if (!value) return "Sin selección";

  if (TEAM_BONUS_CODES.includes(pick.code)) {
    const team = teamOptions.find((option) => option.id === value);

    return team ? (
      <TeamLabel team={team} />
    ) : (
      value
    );
  }

  if (value.startsWith("custom_player:")) {
    const playerName = value.replace("custom_player:", "").trim();

    return playerName || "Sin selección";
  }

  return value;
}

function getCardTone({
  hasSelection,
  isScored,
  pointsAwarded,
}: {
  hasSelection: boolean;
  isScored: boolean;
  pointsAwarded: number;
}) {
  if (isScored && pointsAwarded > 0) {
    return {
      shell: "border-emerald-800/30 bg-emerald-50",
      badge: "border-emerald-800/25 bg-emerald-100 text-emerald-900",
      halo: "shadow-[inset_0_0_0_2px_rgba(6,95,70,0.08)]",
      label: "Acierto",
    };
  }

  if (isScored) {
    return {
      shell: "border-[#9F1D16]/35 bg-red-50",
      badge: "border-[#9F1D16]/25 bg-red-100 text-[#9F1D16]",
      halo: "shadow-[inset_0_0_0_2px_rgba(159,29,22,0.08)]",
      label: "Falló",
    };
  }

  if (hasSelection) {
    return {
      shell: "border-black/10 bg-[#F8F3EA]",
      badge: "border-black/10 bg-[#111] text-[#F5F1E8]",
      halo: "shadow-[0_14px_30px_rgba(17,17,17,0.05)]",
      label: "Guardado",
    };
  }

  return {
    shell: "border-[#D8B45A]/55 bg-[#FFF9EE]",
    badge: "border-[#D8B45A]/50 bg-[#D8B45A]/15 text-[#111]",
    halo: "shadow-[inset_0_0_0_2px_rgba(216,180,90,0.1)]",
    label: "Pendiente",
  };
}

export default function BonusStatusDashboard({
  pickTypes,
  bonusPickMeta,
  bonusSelections,
  teamOptions,
  getPlayerOptionsForPick,
  updateBonus,
  updateCustomBonus,
  saveBonus,
  saving,
  bonusLocked,
}: BonusStatusDashboardProps) {
  const total = pickTypes.length;
  const totalPossible = pickTypes.reduce((sum, pick) => sum + pick.points, 0);

  const completed = pickTypes.filter((pick) => {
    const selection = bonusSelections[pick.id];

    if (!selection) return false;
    if (selection === "custom_player:") return false;

    return true;
  }).length;

  const pending = Math.max(total - completed, 0);

  const pointsAwarded = pickTypes.reduce((sum, pick) => {
    return sum + (bonusPickMeta[pick.id]?.points_awarded || 0);
  }, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-none border border-black/15 bg-[#FFF9EE] p-6 shadow-[0_18px_45px_rgba(17,17,17,0.06)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9F1D16]">
              Bonus
            </p>

            <h2 className="mt-2 text-4xl font-black uppercase tracking-[-0.06em] text-[#111] md:text-5xl">
              Las Bonus
            </h2>

            <p className="mt-2 max-w-xl text-sm font-semibold text-[#111]/55">
              Las que pueden mover la tabla al final. Elige tus selecciones
              especiales antes de que cierre la quiniela.
            </p>
          </div>

          <div className="flex flex-wrap items-stretch justify-end gap-3">
            <div className="min-w-[170px] rounded-none border border-[#D8B45A]/20 bg-[#111] px-6 py-6 text-right text-[#F5F1E8]">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#F5F1E8]/45">
                Puntos bonus
              </p>
              <p className="mt-2 text-5xl font-black tracking-[-0.06em] text-[#D8B45A] md:text-6xl">
                {pointsAwarded}/{totalPossible}
              </p>
            </div>

            <div className="min-w-[140px] border border-black/10 bg-[#F5F1E8] px-5 py-6 text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#111]/35">
                Contestadas
              </p>
              <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#111] md:text-4xl">
                {completed}/{total}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {pickTypes.map((pick, index) => {
          const isTeamBonus = TEAM_BONUS_CODES.includes(pick.code);
          const isPlayerBonus = PLAYER_BONUS_CODES.includes(pick.code);
          const currentSelection = bonusSelections[pick.id] || "";
          const hasSelection =
            Boolean(currentSelection) && currentSelection !== "custom_player:";
          const isCustomPlayer = currentSelection.startsWith("custom_player:");
          const playerInputValue = isCustomPlayer
            ? currentSelection.replace("custom_player:", "")
            : "";
          const meta = bonusPickMeta[pick.id];
          const isScored = Boolean(meta?.scored_at);
          const awarded = meta?.points_awarded || 0;
          const tone = getCardTone({
            hasSelection,
            isScored,
            pointsAwarded: awarded,
          });
          const datalistId = `players-${pick.id}`;
          const playerOptions = isPlayerBonus
            ? getPlayerOptionsForPick(pick.code)
            : [];
          const selectionLabel = getSelectionLabel(
            pick,
            currentSelection,
            teamOptions,
          );

          return (
            <article
              key={pick.id}
              className={[
                "rounded-none border p-5 transition md:p-6",
                tone.shell,
                tone.halo,
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#111]/35">
                    Selección especial {String(index + 1).padStart(2, "0")}
                  </p>

                  <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.04em] text-[#111]">
                    {pick.name}
                  </h3>

                  <p className="mt-1 text-sm font-semibold text-[#111]/45">
                    Vale {pick.points} pts
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                      tone.badge,
                    ].join(" ")}
                  >
                    {tone.label}
                  </span>

                  {isScored && (
                    <span
                      className={[
                        "border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                        awarded > 0
                          ? "border-emerald-800/25 bg-emerald-100 text-emerald-900"
                          : "border-[#9F1D16]/25 bg-red-100 text-[#9F1D16]",
                      ].join(" ")}
                    >
                      {awarded}/{pick.points} pts
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px]">
                <div>
                  {isTeamBonus && (
                    <select
                      value={currentSelection}
                      disabled={bonusLocked}
                      onChange={(event) =>
                        updateBonus(pick.id, event.target.value)
                      }
                      className={[
                        "h-12 w-full rounded-none border px-4 text-sm font-bold outline-none",
                        bonusLocked
                          ? "cursor-not-allowed border-black/10 bg-black/[0.04] text-[#111]/40"
                          : "border-black/15 bg-[#F5F1E8] text-[#111] focus:border-[#111]",
                      ].join(" ")}
                    >
                      <option value="">Elige tu selección</option>

                      {teamOptions.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.flag_emoji || "🏳️"}{" "}
                          {team.name || team.short_name}
                        </option>
                      ))}
                    </select>
                  )}

                  {isPlayerBonus && (
                    <>
                      <input
                        value={playerInputValue}
                        disabled={bonusLocked}
                        list={datalistId}
                        onChange={(event) =>
                          updateCustomBonus(pick.id, event.target.value)
                        }
                        placeholder="Escribe o selecciona un jugador"
                        className={[
                          "h-12 w-full rounded-none border px-4 text-sm font-bold outline-none",
                          bonusLocked
                            ? "cursor-not-allowed border-black/10 bg-black/[0.04] text-[#111]/40"
                            : "border-black/15 bg-[#F5F1E8] text-[#111] placeholder:text-[#111]/35 focus:border-[#111]",
                        ].join(" ")}
                      />

                      <datalist id={datalistId}>
                        {playerOptions.map((player) => (
                          <option
                            key={player.id}
                            value={player.display_name || player.full_name}
                          >
                            {player.team?.flag_emoji
                              ? `${player.team.flag_emoji} ${
                                  player.team.name || player.team.short_name
                                }`
                              : "Jugador"}
                          </option>
                        ))}
                      </datalist>

                      <p className="mt-2 text-xs font-semibold text-[#111]/40">
                        Puedes escribir o elegir de la lista. Las opciones se
                        acotan según el tipo de bonus.
                      </p>
                    </>
                  )}

                  {!isTeamBonus && !isPlayerBonus && (
                    <input
                      value={currentSelection}
                      disabled={bonusLocked}
                      onChange={(event) =>
                        updateCustomBonus(pick.id, event.target.value)
                      }
                      placeholder="Escribe tu respuesta"
                      className={[
                        "h-12 w-full rounded-none border px-4 text-sm font-bold outline-none",
                        bonusLocked
                          ? "cursor-not-allowed border-black/10 bg-black/[0.04] text-[#111]/40"
                          : "border-black/15 bg-[#F5F1E8] text-[#111] placeholder:text-[#111]/35 focus:border-[#111]",
                      ].join(" ")}
                    />
                  )}
                </div>

                <div className="border border-black/10 bg-[#F5F1E8]/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#111]/35">
                    Tu pick
                  </p>

                  <p className="mt-2 break-words text-lg font-black text-[#111]">
                    {selectionLabel}
                  </p>

                  {isScored && (
                    <div className="mt-4 border-t border-black/10 pt-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#111]/35">
                        Resultado real
                      </p>
                      <p className="mt-1 text-sm font-black text-[#111]">
                        Calificado
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-none border border-black/15 bg-[#111] p-4 text-[#F5F1E8] shadow-[0_18px_50px_rgba(0,0,0,0.16)] md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#F5F1E8]/45">
              Guardado de bonus
            </p>
            <p className="mt-1 text-sm font-semibold text-[#F5F1E8]/70">
              {bonusLocked
                ? "Las selecciones especiales ya están cerradas."
                : pending > 0
                  ? `Te faltan ${pending} selección${
                      pending === 1 ? "" : "es"
                    } por llenar.`
                  : "Todo listo para guardar tus selecciones especiales."}
            </p>
          </div>

          <button
            onClick={saveBonus}
            disabled={saving || bonusLocked}
            className={[
              "w-full rounded-none border px-5 py-3 text-sm font-black uppercase tracking-[0.12em] transition md:w-auto",
              saving || bonusLocked
                ? "cursor-not-allowed border-white/10 bg-white/5 text-[#F5F1E8]/35"
                : "border-[#D8B45A]/40 bg-[#F5F1E8] text-[#111] hover:bg-[#D8B45A]",
            ].join(" ")}
          >
            {bonusLocked
              ? "Bonus cerrado"
              : saving
                ? "Guardando..."
                : "Guardar bonus"}
          </button>
        </div>
      </section>
    </div>
  );
}