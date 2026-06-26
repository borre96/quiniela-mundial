"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type RoundCode =
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "final"
  | "third_place";

type Team = {
  id: string;
  name: string;
  short_name: string | null;
  flag_emoji: string | null;
};

type KnockoutRound = {
  id: string;
  code: RoundCode;
  name: string;
  sort_order: number;
  points_per_correct_pick: number;
  is_open: boolean;
};

type KnockoutTie = {
  id: string;
  round_id: string;
  tie_number: number;
  slot_a_label: string;
  slot_b_label: string;
  team_a_id: string | null;
  team_b_id: string | null;
  source_tie_a_id: string | null;
  source_tie_b_id: string | null;
  winner_team_id: string | null;
  starts_at: string | null;
  prediction_deadline: string | null;
  is_published: boolean;
  round?: KnockoutRound;
};

type UserPick = {
  id: string;
  user_id: string;
  tie_id: string;
  picked_winner_team_id: string | null;
  points_awarded: number;
  scored_at: string | null;
};

type SlotTeam = {
  id: string | null;
  name: string;
  short_name: string | null;
  flag_emoji: string | null;
};

type Props = {
  userId: string;
};

type TieStatus = "pending" | "picked" | "correct" | "wrong";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TeamLabel({
  team,
  compact = false,
}: {
  team: SlotTeam;
  compact?: boolean;
}) {
  const label = compact
    ? team.short_name || team.name || "Por definir"
    : team.name || team.short_name || "Por definir";

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="shrink-0 text-sm leading-none"
        style={{
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        }}
        aria-hidden="true"
      >
        {team.flag_emoji || "🏳️"}
      </span>

      <span className="truncate font-black leading-tight">{label}</span>
    </span>
  );
}

const BRACKET_GRID =
  "grid-cols-[168px_150px_140px_128px_190px_128px_140px_150px_168px]";

const phaseLabels = [
  "Dieciseisavos",
  "Octavos",
  "Cuartos",
  "Semifinales",
  "Final",
  "Semifinales",
  "Cuartos",
  "Octavos",
  "Dieciseisavos",
];

const phasePoints = [
  "1 pt por acierto",
  "2 pts por acierto",
  "4 pts por acierto",
  "6 pts por acierto",
  "8 pts por acierto",
  "6 pts por acierto",
  "4 pts por acierto",
  "2 pts por acierto",
  "1 pt por acierto",
];

const BRACKET_HEIGHT = 840;

const COLUMN_CENTER_Y: Record<RoundCode, number[]> = {
  round_of_32: [50, 155, 260, 365, 475, 580, 685, 790],
  round_of_16: [102.5, 312.5, 527.5, 737.5],
  quarter_final: [207.5, 632.5],
  semi_final: [420],
  final: [220],
  third_place: [640],
};

function getTieCenterY(stageCode: RoundCode, index: number, total: number) {
  const preset = COLUMN_CENTER_Y[stageCode];
  if (preset?.[index] !== undefined) return preset[index];
  if (total <= 1) return BRACKET_HEIGHT / 2;
  const gap = BRACKET_HEIGHT / total;
  return gap / 2 + index * gap;
}

function getTieStatus(tie: KnockoutTie, pick: UserPick | undefined): TieStatus {
  if (!pick?.picked_winner_team_id) return "pending";
  if (!pick.scored_at) return "picked";
  return (pick.points_awarded ?? 0) > 0 ? "correct" : "wrong";
}

export default function KnockoutBracketSection({ userId }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [rounds, setRounds] = useState<KnockoutRound[]>([]);
  const [ties, setTies] = useState<KnockoutTie[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<UserPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTieId, setSavingTieId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teamsById = useMemo(() => {
    const map = new Map<string, Team>();
    teams.forEach((team) => map.set(team.id, team));
    return map;
  }, [teams]);

  const picksByTieId = useMemo(() => {
    const map = new Map<string, UserPick>();
    picks.forEach((pick) => map.set(pick.tie_id, pick));
    return map;
  }, [picks]);

  const tiesById = useMemo(() => {
    const map = new Map<string, KnockoutTie>();
    ties.forEach((tie) => map.set(tie.id, tie));
    return map;
  }, [ties]);

  const tiesByRound = useMemo(() => {
    const map = new Map<RoundCode, KnockoutTie[]>();

    ties.forEach((tie) => {
      const code = tie.round?.code;
      if (!code) return;

      const current = map.get(code) ?? [];
      current.push(tie);
      map.set(code, current);
    });

    map.forEach((items) => {
      items.sort((a, b) => a.tie_number - b.tie_number);
    });

    return map;
  }, [ties]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [roundsResult, tiesResult, teamsResult, picksResult] =
      await Promise.all([
        supabase
          .from("knockout_rounds")
          .select("*")
          .order("sort_order", { ascending: true }),

        supabase
          .from("knockout_ties")
          .select("*")
          .eq("is_published", true)
          .order("tie_number", { ascending: true }),

        supabase
          .from("teams")
          .select("id, name, short_name, flag_emoji")
          .order("name", { ascending: true }),

        supabase.from("user_knockout_picks").select("*").eq("user_id", userId),
      ]);

    if (roundsResult.error) {
      setError(roundsResult.error.message);
      setLoading(false);
      return;
    }

    if (tiesResult.error) {
      setError(tiesResult.error.message);
      setLoading(false);
      return;
    }

    if (teamsResult.error) {
      setError(teamsResult.error.message);
      setLoading(false);
      return;
    }

    if (picksResult.error) {
      setError(picksResult.error.message);
      setLoading(false);
      return;
    }

    const loadedRounds = (roundsResult.data ?? []) as KnockoutRound[];
    const roundMap = new Map<string, KnockoutRound>();

    loadedRounds.forEach((round) => {
      roundMap.set(round.id, round);
    });

    const loadedTies = ((tiesResult.data ?? []) as KnockoutTie[]).map(
      (tie) => ({
        ...tie,
        round: roundMap.get(tie.round_id),
      }),
    );

    setRounds(loadedRounds);
    setTies(loadedTies);
    setTeams((teamsResult.data ?? []) as Team[]);
    setPicks((picksResult.data ?? []) as UserPick[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getTeamById(teamId: string | null): SlotTeam | null {
    if (!teamId) return null;

    const team = teamsById.get(teamId);
    if (!team) return null;

    return {
      id: team.id,
      name: team.name,
      short_name: team.short_name,
      flag_emoji: team.flag_emoji,
    };
  }

  function getTeamFromSource(sourceTieId: string | null): SlotTeam | null {
    if (!sourceTieId) return null;

    const sourceTie = tiesById.get(sourceTieId);
    if (!sourceTie) return null;

    const pick = picksByTieId.get(sourceTie.id);
    const pickedTeam = getTeamById(pick?.picked_winner_team_id ?? null);

    if (pickedTeam) return pickedTeam;

    const officialWinner = getTeamById(sourceTie.winner_team_id);
    if (officialWinner) return officialWinner;

    return null;
  }

  function getLoserFromSource(sourceTieId: string | null): SlotTeam | null {
    if (!sourceTieId) return null;

    const sourceTie = tiesById.get(sourceTieId);
    if (!sourceTie) return null;

    const teamsInTie = getSlotTeams(sourceTie);
    const pick = picksByTieId.get(sourceTie.id);
    const winnerId = pick?.picked_winner_team_id ?? sourceTie.winner_team_id;

    if (!winnerId) return null;

    return teamsInTie.find((team) => team.id && team.id !== winnerId) ?? null;
  }

  function getSlotTeams(tie: KnockoutTie): SlotTeam[] {
    if (tie.round?.code === "third_place") {
      const loserA = getLoserFromSource(tie.source_tie_a_id);
      const loserB = getLoserFromSource(tie.source_tie_b_id);

      return [
        loserA ?? {
          id: null,
          name: tie.slot_a_label || "Perdedor semifinal 1",
          short_name: null,
          flag_emoji: null,
        },
        loserB ?? {
          id: null,
          name: tie.slot_b_label || "Perdedor semifinal 2",
          short_name: null,
          flag_emoji: null,
        },
      ];
    }

    const directA = getTeamById(tie.team_a_id);
    const directB = getTeamById(tie.team_b_id);

    const sourceA = getTeamFromSource(tie.source_tie_a_id);
    const sourceB = getTeamFromSource(tie.source_tie_b_id);

    return [
      directA ??
        sourceA ?? {
          id: null,
          name: tie.slot_a_label || "Por definir",
          short_name: null,
          flag_emoji: null,
        },
      directB ??
        sourceB ?? {
          id: null,
          name: tie.slot_b_label || "Por definir",
          short_name: null,
          flag_emoji: null,
        },
    ];
  }

  async function handlePick(tie: KnockoutTie, teamId: string | null) {
    if (!teamId) return;

    setSavingTieId(tie.id);
    setError(null);

    const previousPicks = picks;
    const existingPick = picksByTieId.get(tie.id);

    if (existingPick) {
      setPicks((current) =>
        current.map((pick) =>
          pick.tie_id === tie.id
            ? { ...pick, picked_winner_team_id: teamId }
            : pick,
        ),
      );
    } else {
      setPicks((current) => [
        ...current,
        {
          id: `temp-${tie.id}`,
          user_id: userId,
          tie_id: tie.id,
          picked_winner_team_id: teamId,
          points_awarded: 0,
          scored_at: null,
        },
      ]);
    }

    const { error: rpcError } = await supabase.rpc("upsert_knockout_pick", {
      p_tie_id: tie.id,
      p_team_id: teamId,
    });

    if (rpcError) {
      setPicks(previousPicks);
      setError(rpcError.message);
      setSavingTieId(null);
      return;
    }

    const { data, error: reloadError } = await supabase
      .from("user_knockout_picks")
      .select("*")
      .eq("user_id", userId);

    if (!reloadError) {
      setPicks((data ?? []) as UserPick[]);
    }

    setSavingTieId(null);
  }

  const roundOf32 = tiesByRound.get("round_of_32") ?? [];
  const roundOf16 = tiesByRound.get("round_of_16") ?? [];
  const quarters = tiesByRound.get("quarter_final") ?? [];
  const semis = tiesByRound.get("semi_final") ?? [];
  const final = tiesByRound.get("final")?.[0] ?? null;
  const thirdPlace = tiesByRound.get("third_place")?.[0] ?? null;

  const leftR32 = roundOf32.filter((tie) => tie.tie_number <= 8);
  const rightR32 = roundOf32.filter((tie) => tie.tie_number > 8);

  const leftR16 = roundOf16.filter((tie) => tie.tie_number <= 4);
  const rightR16 = roundOf16.filter((tie) => tie.tie_number > 4);

  const leftQF = quarters.filter((tie) => tie.tie_number <= 2);
  const rightQF = quarters.filter((tie) => tie.tie_number > 2);

  const leftSF = semis.filter((tie) => tie.tie_number === 1);
  const rightSF = semis.filter((tie) => tie.tie_number === 2);

  const knockoutPoints = useMemo(() => {
    return picks.reduce((total, pick) => {
      return total + (pick.points_awarded || 0);
    }, 0);
  }, [picks]);

  const totalKnockoutPoints = 82;

  const knockoutStats = useMemo(() => {
    const publishedTieIds = new Set(ties.map((tie) => tie.id));
    const relevantPicks = picks.filter((pick) =>
      publishedTieIds.has(pick.tie_id),
    );
    const picked = relevantPicks.filter(
      (pick) => pick.picked_winner_team_id,
    ).length;
    const pending = Math.max(ties.length - picked, 0);
    const live = relevantPicks.filter(
      (pick) => pick.picked_winner_team_id && !pick.scored_at,
    ).length;

    return { picked, pending, live, total: ties.length };
  }, [picks, ties]);

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-black/15 bg-[#F5F1E8] p-6 shadow-[0_24px_70px_rgba(17,17,17,0.10)]">
        <div className="h-[420px] animate-pulse rounded-2xl bg-[#111]/10" />
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-black/15 bg-[#F5F1E8] text-[#111] shadow-[0_28px_90px_rgba(17,17,17,0.14)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(159,29,22,0.06),transparent_30%),radial-gradient(circle_at_85%_8%,rgba(216,180,90,0.12),transparent_26%)]" />

      <div className="relative border-b border-black/10 bg-[#F8F3EA] px-6 py-6 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#9F1D16]">
              Fase final
            </p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none tracking-[-0.06em] md:text-5xl">
              Eliminatorias
            </h2>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-black/60">
              Se viene lo bueno!! Elige al ganador de cada serie hasta llegar al campeón.
            </p>
          </div>

          <div className="relative grid gap-3 pr-0 md:grid-cols-[1fr_1fr_1fr_120px] md:items-center">
            <div className="rounded-2xl border border-black/20 bg-[#111] p-5 text-[#111] shadow-[0_18px_45px_rgba(17,17,17,0.18)]">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#F5F1E8]/55">
                Puntos eliminatorias
              </p>
              <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-[#D8B45A]">
                {knockoutPoints}/{totalKnockoutPoints}
              </p>
              <p className="mt-2 text-xs font-semibold text-[#F5F1E8]/55">
                subtotal de esta sección
              </p>
            </div>

            <div className="rounded-2xl border border-black/15 bg-white p-5 text-[#111] shadow-[0_14px_34px_rgba(17,17,17,0.08)]">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">
                Pendientes
              </p>
              <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-[#9F1D16]">
                {knockoutStats.pending}
              </p>
              <p className="mt-2 text-xs font-semibold text-black/50">
                sin elegir todavía
              </p>
            </div>

            <div className="rounded-2xl border border-black/15 bg-white p-5 text-[#111] shadow-[0_14px_34px_rgba(17,17,17,0.08)]">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-black/45">
                En juego
              </p>
              <p className="mt-3 text-4xl font-black tracking-[-0.06em] text-emerald-700">
                {knockoutStats.live}
              </p>
              <p className="mt-2 text-xs font-semibold text-black/50">
                picks guardados
              </p>
            </div>

            <div className="hidden justify-center md:flex">
              <img
                src="/brand/Logo-Simple-Negro.png"
                alt="LA TANDA"
                className="h-45 w-45 object-contain opacity-95"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="relative mx-5 mt-5 rounded-2xl border border-red-700/30 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div
        ref={scrollRef}
        className="relative w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="relative w-full min-w-[1560px] bg-[#F5F1E8] px-8 pb-12 pt-5 text-[#111]">
          <div
            className={cx(
              "sticky top-0 z-20 mb-6 grid items-center gap-6 border-b border-black/10 bg-[#F5F1E8]/95 pb-3 pt-1",
              BRACKET_GRID,
            )}
          >
            {phaseLabels.map((phase, i) => (
              <div key={`${phase}-${i}`} className="text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9F1D16]">
                  {phase}
                </div>

                <div className="mt-1 text-[10px] font-bold text-black/55">
                  {phasePoints[i]}
                </div>

                <div className="mx-auto mt-2 h-px w-16 bg-[#D8B45A]" />
              </div>
            ))}
          </div>

          <div className={cx("relative grid items-center gap-6", BRACKET_GRID)}>
            <BracketColumn
              stageCode="round_of_32"
              ties={leftR32}
              heightClass="h-[690px]"
              getSlotTeams={getSlotTeams}
              picksByTieId={picksByTieId}
              onPick={handlePick}
              savingTieId={savingTieId}
              side="left"
            />

            <BracketColumn
              stageCode="round_of_16"
              ties={leftR16}
              heightClass="h-[560px]"
              getSlotTeams={getSlotTeams}
              picksByTieId={picksByTieId}
              onPick={handlePick}
              savingTieId={savingTieId}
              side="left"
            />

            <BracketColumn
              stageCode="quarter_final"
              ties={leftQF}
              heightClass="h-[430px]"
              getSlotTeams={getSlotTeams}
              picksByTieId={picksByTieId}
              onPick={handlePick}
              savingTieId={savingTieId}
              side="left"
            />

            <BracketColumn
              stageCode="semi_final"
              ties={leftSF}
              heightClass="h-[290px]"
              getSlotTeams={getSlotTeams}
              picksByTieId={picksByTieId}
              onPick={handlePick}
              savingTieId={savingTieId}
              side="left"
            />

            <div
              data-stage="final"
              className="relative flex items-center justify-center"
              style={{ height: BRACKET_HEIGHT }}
            >
              <div
                className="absolute left-0 right-0 flex justify-center"
                style={{
                  top: COLUMN_CENTER_Y.final[0],
                  transform: "translateY(-50%)",
                }}
              >
                {final ? (
                  <TieCard
                    tie={final}
                    compact={false}
                    center
                    getSlotTeams={getSlotTeams}
                    picksByTieId={picksByTieId}
                    onPick={handlePick}
                    savingTieId={savingTieId}
                  />
                ) : (
                  <EmptyCenterCard title="Final por definir" />
                )}
              </div>

              <div
                className="absolute left-0 right-0 flex items-center justify-center"
                style={{
                  top: BRACKET_HEIGHT / 2,
                  transform: "translateY(-50%)",
                }}
              >
                <img
                  src="/brand/public-brand-sello-campeon.png"
                  alt="Campeón Mundial"
                  className="w-[180px] opacity-95"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                    const fallback = event.currentTarget
                      .nextElementSibling as HTMLElement | null;
                    if (fallback) fallback.style.display = "grid";
                  }}
                />
                <div className="hidden h-[180px] w-[180px] place-items-center rounded-full border-4 border-[#111] bg-[#F8F3EA] text-center text-[12px] font-black uppercase leading-tight tracking-[0.12em] text-[#9F1D16] shadow-[5px_5px_0_rgba(17,17,17,0.18)]">
                  Sello
                  <br />
                  Campeón
                </div>
              </div>

              <div
                data-stage="third_place"
                className="absolute left-0 right-0 flex justify-center"
                style={{
                  top: COLUMN_CENTER_Y.third_place[0],
                  transform: "translateY(-50%)",
                }}
              >
                {thirdPlace ? (
                  <TieCard
                    tie={thirdPlace}
                    compact
                    center
                    getSlotTeams={getSlotTeams}
                    picksByTieId={picksByTieId}
                    onPick={handlePick}
                    savingTieId={savingTieId}
                  />
                ) : (
                  <EmptyCenterCard title="3er lugar por definir" />
                )}
              </div>
            </div>

            <BracketColumn
              stageCode="semi_final"
              ties={rightSF}
              heightClass="h-[290px]"
              getSlotTeams={getSlotTeams}
              picksByTieId={picksByTieId}
              onPick={handlePick}
              savingTieId={savingTieId}
              side="right"
            />

            <BracketColumn
              stageCode="quarter_final"
              ties={rightQF}
              heightClass="h-[430px]"
              getSlotTeams={getSlotTeams}
              picksByTieId={picksByTieId}
              onPick={handlePick}
              savingTieId={savingTieId}
              side="right"
            />

            <BracketColumn
              stageCode="round_of_16"
              ties={rightR16}
              heightClass="h-[560px]"
              getSlotTeams={getSlotTeams}
              picksByTieId={picksByTieId}
              onPick={handlePick}
              savingTieId={savingTieId}
              side="right"
            />

            <BracketColumn
              stageCode="round_of_32"
              ties={rightR32}
              heightClass="h-[690px]"
              getSlotTeams={getSlotTeams}
              picksByTieId={picksByTieId}
              onPick={handlePick}
              savingTieId={savingTieId}
              side="right"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function BracketColumn({
  stageCode,
  ties,
  heightClass,
  getSlotTeams,
  picksByTieId,
  onPick,
  savingTieId,
  side,
}: {
  stageCode: RoundCode;
  ties: KnockoutTie[];
  heightClass: string;
  getSlotTeams: (tie: KnockoutTie) => SlotTeam[];
  picksByTieId: Map<string, UserPick>;
  onPick: (tie: KnockoutTie, teamId: string | null) => void;
  savingTieId: string | null;
  side: "left" | "right";
}) {
  return (
    <div
      data-stage={stageCode}
      data-height-class={heightClass}
      className="relative"
      style={{ height: BRACKET_HEIGHT }}
    >
      {ties.map((tie, index) => {
        const centerY = getTieCenterY(stageCode, index, ties.length);

        return (
          <div
            key={tie.id}
            className="absolute left-0 right-0"
            style={{ top: centerY, transform: "translateY(-50%)" }}
          >
            <TieCard
              tie={tie}
              compact
              getSlotTeams={getSlotTeams}
              picksByTieId={picksByTieId}
              onPick={onPick}
              savingTieId={savingTieId}
            />

            <div
              className={cx(
                "pointer-events-none absolute top-1/2 hidden h-px w-12 lg:block",
                side === "left" ? "-right-6" : "-left-6",
                "bg-black/30",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

function TieCard({
  tie,
  compact,
  center = false,
  getSlotTeams,
  picksByTieId,
  onPick,
  savingTieId,
}: {
  tie: KnockoutTie;
  compact: boolean;
  center?: boolean;
  getSlotTeams: (tie: KnockoutTie) => SlotTeam[];
  picksByTieId: Map<string, UserPick>;
  onPick: (tie: KnockoutTie, teamId: string | null) => void;
  savingTieId: string | null;
}) {
  const teams = getSlotTeams(tie);
  const pick = picksByTieId.get(tie.id);
  const selectedTeamId = pick?.picked_winner_team_id ?? null;
  const isSaving = savingTieId === tie.id;
  const status = getTieStatus(tie, pick);

  return (
    <div
      className={cx(
        "group relative overflow-hidden border bg-[#F8F3EA] p-2 transition duration-200 shadow-[4px_4px_0_rgba(17,17,17,0.10)]",
        center ? "w-[190px]" : "w-full",
        status === "pending" && "border-black/18",
        status === "picked" && "border-[#D8B45A] ring-1 ring-[#D8B45A]/45",
        status === "correct" && "border-emerald-400 ring-2 ring-emerald-300/60",
        status === "wrong" && "border-red-400 ring-2 ring-red-300/55",
      )}
    >
      <div
        className={cx(
          "pointer-events-none absolute bottom-0 left-0 top-0 w-1",
          status === "pending" && "bg-black/12",
          status === "picked" && "bg-[#D8B45A]",
          status === "correct" && "bg-emerald-500",
          status === "wrong" && "bg-red-500",
        )}
      />

      <div className="space-y-1.5 pl-1">
        {teams.map((team, index) => {
          const isSelected = Boolean(team.id && selectedTeamId === team.id);
          const isOfficialWinner = Boolean(
            team.id && tie.winner_team_id && tie.winner_team_id === team.id,
          );
          const disabled = !team.id || isSaving;

          return (
            <button
              key={`${tie.id}-${index}-${team.id ?? team.name}`}
              type="button"
              disabled={disabled}
              onClick={() => onPick(tie, team.id)}
              className={cx(
                "relative flex w-full items-center justify-between gap-2 border px-2.5 text-left transition duration-200",
                compact ? "h-8 text-[11px]" : "h-10 text-xs",
                disabled
                  ? "cursor-not-allowed border-black/10 bg-[#EEE7DA] text-black/35"
                  : "border-black/16 bg-[#F5F1E8] text-[#111] hover:border-[#9F1D16]/55 hover:bg-white",
                isSelected &&
                 "border-[#9F1D16] bg-[#F1D27A] text-[#241A10] shadow-[inset_0_0_0_1px_rgba(159,29,22,0.35)]",
                isSelected &&
                  status === "correct" &&
                  "border-emerald-500 bg-emerald-100 text-emerald-800 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]",
                isSelected &&
                  status === "wrong" &&
                  "border-red-500 bg-red-100 text-red-800 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.40)]",
                !isSelected &&
                  status === "wrong" &&
                  isOfficialWinner &&
                  "border-emerald-500 bg-emerald-50 text-emerald-800",
                !isSelected && selectedTeamId && "opacity-55",
              )}
            >
              <TeamLabel team={team} compact={compact} />

              <span
                className={cx(
                  "h-5 w-5 shrink-0 border",
                  isSelected
                    ? "border-[#D8B45A] bg-[#D8B45A]/80"
                    : "border-black/15 bg-transparent",
                  !isSelected &&
                    isOfficialWinner &&
                    status === "wrong" &&
                    "border-emerald-500 bg-emerald-100",
                )}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      {isSaving && (
        <div className="absolute inset-0 grid place-items-center bg-[#F5F1E8]/75 backdrop-blur-[1px]">
          <span className="border border-[#D8B45A] bg-[#111] px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#D8B45A]">
            Guardando
          </span>
        </div>
      )}
    </div>
  );
}

function EmptyCenterCard({ title }: { title: string }) {
  return (
    <div className="w-[190px] border border-dashed border-black/20 bg-[#F8F3EA] p-4 text-center text-xs font-bold text-black/45 shadow-[4px_4px_0_rgba(17,17,17,0.08)]">
      {title}
    </div>
  );
}