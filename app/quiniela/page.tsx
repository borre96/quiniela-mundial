"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BonusStatusDashboard from "./BonusStatusDashboard";
import KnockoutBracketSection from "./KnockoutBracketSection";

type Team = {
  id: string;
  name: string;
  short_name: string;
  flag_emoji: string;
};

type Match = {
  id: string;
  match_number: number;
  group_name: string | null;
  kickoff_at: string;
  prediction_deadline: string;
  status: "scheduled" | "live" | "finished";
  home_team: Team;
  away_team: Team;
};

type Prediction = {
  id?: string;
  match_id: string;
  home_score_pred: number | "";
  away_score_pred: number | "";
  points_awarded?: number;
  is_exact?: boolean;
  is_correct_outcome?: boolean;
  scored_at?: string | null;
};

type MatchResult = {
  match_id: string;
  home_score: number;
  away_score: number;
  is_final: boolean;
};

type SpecialPickType = {
  id: string;
  code: string;
  name: string;
  points: number;
};

type Player = {
  id: string;
  team_id: string | null;
  full_name: string;
  display_name: string | null;
  position: "goalkeeper" | "defender" | "midfielder" | "forward";
  is_young_player_eligible: boolean;
  is_active: boolean;
  team?: Team | null;
};

type GlobalStats = {
  total_points: number;
  exact_hits: number;
  correct_outcomes: number;
  ranking_position: number;
};

type GroupRanking = {
  group_id: string;
  group_name: string;
  ranking_position: number;
};

type ViewMode = "matches" | "knockouts" | "bonus";

type RoundFilter =
  | "unfilled"
  | "urgent"
  | "exact"
  | "correct"
  | "wrong"
  | "all";

const BONUS_ORDER = [
  "champion",
  "runner_up",
  "third_place",
  "top_scorer",
  "best_player",
  "best_goalkeeper",
  "best_young_player",
];

function QuinielaPageContent() {
  const [viewMode, setViewMode] = useState<ViewMode>("matches");
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId");
  const [groupName, setGroupName] = useState<string | null>(null);

  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [results, setResults] = useState<Record<string, MatchResult>>({});

const [pickTypes, setPickTypes] = useState<SpecialPickType[]>([]);

const [bonusSelections, setBonusSelections] =
  useState<Record<string, string>>({});

const [bonusPickMeta, setBonusPickMeta] = useState<
  Record<
    string,
    {
      points_awarded: number | null;
      scored_at: string | null;
    }
  >
>({});

const [players, setPlayers] = useState<Player[]>([]);

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [groupRankings, setGroupRankings] = useState<GroupRanking[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lockedMatches, setLockedMatches] = useState<Record<string, boolean>>({});
  const [bonusLocked, setBonusLocked] = useState(false);

  const [roundFilter, setRoundFilter] = useState<RoundFilter>("unfilled");

  useEffect(() => {
    loadPage();
  }, [groupId]);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    setUserId(user.id);

    if (groupId) {
      const { data: myGroupsData, error: myGroupsError } = await supabase.rpc(
        "get_my_groups"
      );

      if (myGroupsError) {
        setMessage(myGroupsError.message);
        setLoading(false);
        return;
      }

      const activeGroup = (myGroupsData || []).find(
        (group: { group_id: string }) => group.group_id === groupId
      );

      if (!activeGroup) {
        setMessage("No tienes acceso a esta Tanda.");
        setLoading(false);
        return;
      }

      setGroupName(activeGroup.group_name);
    } else {
      setGroupName(null);
    }

    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select(`
        id,
        match_number,
        group_name,
        kickoff_at,
        prediction_deadline,
        status,
        home_team:teams!matches_home_team_id_fkey (
          id,
          name,
          short_name,
          flag_emoji
        ),
        away_team:teams!matches_away_team_id_fkey (
          id,
          name,
          short_name,
          flag_emoji
        )
      `)
      .eq("stage", "group")
      .order("match_number", { ascending: true });

    if (matchesError) {
      setMessage(matchesError.message);
      setLoading(false);
      return;
    }

    setMatches((matchesData || []) as unknown as Match[]);

    const { data: predictionsData, error: predictionsError } = await supabase
      .from("predictions")
      .select(`
        id,
        match_id,
        home_score_pred,
        away_score_pred,
        points_awarded,
        is_exact,
        is_correct_outcome,
        scored_at
      `)
      .eq("user_id", user.id);

    if (predictionsError) {
      setMessage(predictionsError.message);
      setLoading(false);
      return;
    }

    const mappedPredictions: Record<string, Prediction> = {};

    for (const prediction of predictionsData || []) {
      mappedPredictions[prediction.match_id] = prediction;
    }

    setPredictions(mappedPredictions);

    const { data: resultsData, error: resultsError } = await supabase
      .from("match_results")
      .select("match_id, home_score, away_score, is_final");

    if (resultsError) {
      setMessage(resultsError.message);
      setLoading(false);
      return;
    }

    const mappedResults: Record<string, MatchResult> = {};

    for (const result of resultsData || []) {
      mappedResults[result.match_id] = result;
    }

    setResults(mappedResults);

   const { data: globalData } = await supabase
  .from("leaderboard_global_v")
  .select("total_points, exact_hits, correct_outcomes, ranking_position")
  .eq("user_id", user.id)
  .maybeSingle();

if (globalData) {
  setGlobalStats(globalData as GlobalStats);
}

const { data: groupRankData, error: groupRankError } = await supabase
  .from("leaderboard_group_v")
  .select("group_id, group_name, ranking_position")
  .eq("user_id", user.id)
  .order("group_name", { ascending: true });

if (groupRankError) {
  setMessage(groupRankError.message);
  setLoading(false);
  return;
}

const mappedGroupRankings = (groupRankData || []) as GroupRanking[];

setGroupRankings(mappedGroupRankings);

if (mappedGroupRankings.length > 0) {
  setSelectedGroupId((current) => current || mappedGroupRankings[0].group_id);
} else {
  setSelectedGroupId("");
}

const { data: bonusTypesData, error: bonusTypesError } = await supabase
  .from("special_pick_types")
  .select("id, code, name, points");

if (bonusTypesError) {
  setMessage(bonusTypesError.message);
  setLoading(false);
  return;
}

    setPickTypes((bonusTypesData || []) as SpecialPickType[]);

    const { data: userBonusData, error: userBonusError } = await supabase
      .from("user_special_picks")
      .select("pick_type_id, selection, points_awarded, scored_at")
      .eq("user_id", user.id);

    if (userBonusError) {
      setMessage(userBonusError.message);
      setLoading(false);
      return;
    }

    const mappedBonus: Record<string, string> = {};
    const mappedBonusMeta: Record<
      string,
      { points_awarded: number | null; scored_at: string | null }
    > = {};

    for (const bonus of userBonusData || []) {
      mappedBonus[bonus.pick_type_id] = bonus.selection || "";
      mappedBonusMeta[bonus.pick_type_id] = {
        points_awarded: bonus.points_awarded ?? null,
        scored_at: bonus.scored_at ?? null,
      };
    }

    setBonusSelections(mappedBonus);
    setBonusPickMeta(mappedBonusMeta);

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select(`
        id,
        team_id,
        full_name,
        display_name,
        position,
        is_young_player_eligible,
        is_active,
        team:teams (
          id,
          name,
          short_name,
          flag_emoji
        )
      `)
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (playersError) {
      setMessage(playersError.message);
      setLoading(false);
      return;
    }

    setPlayers((playersData || []) as unknown as Player[]);

    const lockMap: Record<string, boolean> = {};

    for (const match of matchesData || []) {
      const fallbackLocked =
        new Date() >= new Date(match.prediction_deadline) ||
        match.status !== "scheduled";

      try {
        const { data, error } = await supabase.rpc("is_match_locked", {
          p_match_id: match.id,
        });

        lockMap[match.id] = error ? fallbackLocked : !!data;
      } catch {
        lockMap[match.id] = fallbackLocked;
      }
    }

    setLockedMatches(lockMap);

    try {
      const { data, error } = await supabase.rpc("is_bonus_locked");
      setBonusLocked(error ? false : !!data);
    } catch {
      setBonusLocked(false);
    }

    setLoading(false);
  }

  function isLocked(match: Match) {
    if (match.id in lockedMatches) {
      return lockedMatches[match.id];
    }

    return (
      new Date() >= new Date(match.prediction_deadline) ||
      match.status !== "scheduled"
    );
  }

  function isUnfilled(match: Match) {
    const prediction = predictions[match.id];

    if (!prediction) return true;
    if (!prediction.id) return true;

    return (
      prediction.home_score_pred === "" ||
      prediction.away_score_pred === ""
    );
  }

  function isUrgentUnfilled(match: Match) {
    const now = Date.now();
    const deadline = new Date(match.prediction_deadline).getTime();

    return (
      isUnfilled(match) &&
      deadline > now &&
      deadline <= now + 24 * 60 * 60 * 1000
    );
  }

  function predictionStatus(matchId: string) {
    const prediction = predictions[matchId];

    if (!prediction) return "unfilled";
    if (!prediction.scored_at) return "pending";
    if (prediction.is_exact) return "exact";
    if (prediction.is_correct_outcome) return "correct";

    return "wrong";
  }

  function getStatusBadge(matchId: string) {
    const status = predictionStatus(matchId);

    if (status === "exact") {
      return {
        label: "Exacto +3",
        className: "border border-emerald-700/25 bg-emerald-100 text-emerald-900",
      };
    }

    if (status === "correct") {
      return {
        label: "Acierto +1",
        className: "border border-emerald-700/25 bg-emerald-100 text-emerald-900",
      };
    }

    if (status === "wrong") {
      return {
        label: "Error +0",
        className: "border border-red-800/25 bg-red-100 text-red-900",
      };
    }

    if (status === "pending") {
      return {
        label: "Por calificar",
        className: "border border-amber-800/20 bg-amber-100 text-amber-900",
      };
    }

    return {
      label: "Sin llenar",
      className: "border border-white/20 bg-white/10 text-[#F5F1E8]/75",
    };
  }

  function getMatchTone(matchId: string, matchLocked: boolean) {
    const status = predictionStatus(matchId);

    if (status === "exact" || status === "correct") {
      return {
        card: "border-emerald-400/45 bg-[#101812] text-[#F5F1E8] shadow-[0_22px_60px_rgba(6,95,70,0.22)]",
        band: "bg-emerald-500",
        team: "border border-emerald-300/20 bg-[#17251d] text-[#F5F1E8]",
        input: "border border-emerald-400/45 bg-[#F5F1E8] text-[#111] focus:border-emerald-300",
        vs: "text-emerald-200/70",
      };
    }

    if (status === "wrong") {
      return {
        card: "border-red-400/40 bg-[#1B1111] text-[#F5F1E8] shadow-[0_22px_60px_rgba(127,29,29,0.20)]",
        band: "bg-[#9F1D16]",
        team: "border border-red-300/15 bg-[#281717] text-[#F5F1E8]/70",
        input: "border border-red-400/35 bg-[#F5F1E8] text-[#111] focus:border-red-300",
        vs: "text-red-100/55",
      };
    }

    if (status === "pending") {
      return {
        card: "border-amber-300/35 bg-[#1D1810] text-[#F5F1E8] shadow-[0_22px_60px_rgba(146,64,14,0.16)]",
        band: "bg-[#C9A24D]",
        team: "border border-amber-200/15 bg-[#2A2418] text-[#F5F1E8]",
        input: "border border-amber-300/35 bg-[#F5F1E8] text-[#111] focus:border-amber-300",
        vs: "text-amber-100/60",
      };
    }

    if (matchLocked) {
      return {
        card: "border-black/20 bg-[#2A2925] text-[#F5F1E8] opacity-80",
        band: "bg-[#6F6A5D]",
        team: "border border-white/10 bg-white/5 text-[#F5F1E8]/45",
        input: "border border-white/10 bg-white/5 text-[#F5F1E8]/35",
        vs: "text-[#F5F1E8]/35",
      };
    }

    return {
      card: "border-black bg-[#111] text-[#F5F1E8] shadow-[0_24px_70px_rgba(17,17,17,0.22)]",
      band: "bg-[#9F1D16]",
      team: "border border-white/10 bg-white/[0.07] text-[#F5F1E8]",
      input: "border border-white/20 bg-[#F5F1E8] text-[#111] focus:border-[#C9A24D]",
      vs: "text-[#F5F1E8]/55",
    };
  }

  function updatePrediction(
    matchId: string,
    field: "home_score_pred" | "away_score_pred",
    value: string
  ) {
    const cleanValue = value === "" ? "" : Number(value);

    setPredictions((current) => ({
      ...current,
      [matchId]: {
        ...current[matchId],
        match_id: matchId,
        home_score_pred:
          field === "home_score_pred"
            ? cleanValue
            : current[matchId]?.home_score_pred ?? "",
        away_score_pred:
          field === "away_score_pred"
            ? cleanValue
            : current[matchId]?.away_score_pred ?? "",
      },
    }));
  }

  async function savePrediction(match: Match) {
    setMessage("");

    if (!userId) return;

    if (isLocked(match)) {
      setMessage("Partido bloqueado.");
      return;
    }

    const prediction = predictions[match.id];

    if (
      !prediction ||
      prediction.home_score_pred === "" ||
      prediction.away_score_pred === ""
    ) {
      setMessage("Completa ambos marcadores.");
      return;
    }

    setSavingMatchId(match.id);

    const { error } = await supabase.from("predictions").upsert(
      {
        user_id: userId,
        match_id: match.id,
        home_score_pred: prediction.home_score_pred,
        away_score_pred: prediction.away_score_pred,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,match_id",
      }
    );

       setSavingMatchId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Pick guardado.");
    await loadPage();
  }

  function updateBonus(pickId: string, value: string) {
    setBonusSelections((current) => ({
      ...current,
      [pickId]: value,
    }));
  }

  function updateCustomBonus(pickId: string, value: string) {
    setBonusSelections((current) => ({
      ...current,
      [pickId]: value ? `custom_player:${value}` : "custom_player:",
    }));
  }

  async function saveBonus() {
    setMessage("");

    if (!userId) return;

    if (bonusLocked) {
      setMessage("Selecciones bonus cerradas.");
      return;
    }

    const missing = pickTypes.filter((pickType) => !bonusSelections[pickType.id]);

    if (missing.length > 0) {
      setMessage("Completa todas las preguntas bonus.");
      return;
    }
    setSaving(true);

    const rows = pickTypes.map((pickType) => ({
      user_id: userId,
      pick_type_id: pickType.id,
      selection: bonusSelections[pickType.id],
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("user_special_picks").upsert(rows, {
      onConflict: "user_id,pick_type_id",
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Preguntas bonus guardadas.");
    await loadPage();
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  }

  function getPlayerOptionsForPick(code: string) {

  if (code === "best_goalkeeper") {
    return players
      .filter(
        (player) =>
          player.position === "goalkeeper"
      )
      .sort(
        (a,b)=>
          a.full_name.localeCompare(
            b.full_name,
            "es"
          )
      );
  }

  if (code === "best_young_player") {
    return players
      .filter(
        (player) =>
          player.is_young_player_eligible
      )
      .sort(
        (a,b)=>
          a.full_name.localeCompare(
            b.full_name,
            "es"
          )
      );
  }

  if (code === "top_scorer") {
    return players
      .filter(
        (player)=>
          player.position==="forward" ||
          player.position==="midfielder"
      )
      .sort(
        (a,b)=>
          a.full_name.localeCompare(
            b.full_name,
            "es"
          )
      );
  }

  if (code === "best_player") {
    return players
      .filter(
        (player)=>
          player.position==="forward" ||
          player.position==="midfielder" ||
          player.position==="defender"
      )
      .sort(
        (a,b)=>
          a.full_name.localeCompare(
            b.full_name,
            "es"
          )
      );
  }

  return players.sort(
    (a,b)=>
      a.full_name.localeCompare(
        b.full_name,
        "es"
      )
  );
}

  const counts = useMemo(() => {
    const unfilled = matches.filter((match) => isUnfilled(match)).length;
    const urgent = matches.filter((match) => isUrgentUnfilled(match)).length;
    const exact = matches.filter(
      (match) => predictionStatus(match.id) === "exact"
    ).length;
    const correct = matches.filter(
      (match) => predictionStatus(match.id) === "correct"
    ).length;
    const wrong = matches.filter(
      (match) => predictionStatus(match.id) === "wrong"
    ).length;

    return {
      unfilled,
      urgent,
      exact,
      correct,
      wrong,
    };
  }, [matches, predictions, lockedMatches]);

  const orderedPickTypes = useMemo(() => {
  return [...pickTypes].sort(
    (a, b) => BONUS_ORDER.indexOf(a.code) - BONUS_ORDER.indexOf(b.code)
  );
}, [pickTypes]);

const teamOptions = useMemo(() => {
  const teamsById = new Map<string, Team>();

  for (const match of matches) {
    teamsById.set(match.home_team.id, match.home_team);
    teamsById.set(match.away_team.id, match.away_team);
  }

  return [...teamsById.values()].sort((a, b) => a.name.localeCompare(b.name));
}, [matches]);

const visibleMatches = useMemo(() => {
  let rows = [...matches];

  if (roundFilter === "unfilled") {
    rows = rows.filter((match) => isUnfilled(match));
  }

  if (roundFilter === "urgent") {
    rows = rows.filter((match) => isUrgentUnfilled(match));
  }

  if (roundFilter === "exact") {
    rows = rows.filter((match) => predictionStatus(match.id) === "exact");
  }

  if (roundFilter === "correct") {
    rows = rows.filter((match) => predictionStatus(match.id) === "correct");
  }

  if (roundFilter === "wrong") {
    rows = rows.filter((match) => predictionStatus(match.id) === "wrong");
  }

  return rows;
}, [matches, predictions, roundFilter, lockedMatches]);

const filterButtons: { key: RoundFilter; label: string; count: number }[] = [
  { key: "all", label: "Todos", count: matches.length },
  { key: "unfilled", label: "Sin llenar", count: counts.unfilled },
  { key: "urgent", label: "Urgentes 24h", count: counts.urgent },
  { key: "exact", label: "Exactos", count: counts.exact },
  { key: "correct", label: "Aciertos", count: counts.correct },
  { key: "wrong", label: "Errores", count: counts.wrong },
  
];

const selectedGroupRanking = useMemo(() => {
  return (
    groupRankings.find(
      (group) => group.group_id === selectedGroupId
    ) || null
  );
}, [groupRankings, selectedGroupId]);

const groupStagePoints = useMemo(() => {
  return matches.reduce((total, match) => {
    return total + (predictions[match.id]?.points_awarded || 0);
  }, 0);
}, [matches, predictions]);

const groupStageTotalPoints = useMemo(() => {
  return matches.length * 3;
}, [matches]);

if (loading) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F1E8] text-[#111]">
      <div className="text-center">
        <img
          src="/brand/logo-extendido-header.png"
          alt="LA TANDA"
          className="mx-auto h-[72px] w-auto object-contain"
        />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-black/45">
          Cargando tu quiniela...
        </p>
      </div>
    </main>
  );
}

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#111] [background-image:radial-gradient(circle_at_top_left,rgba(159,29,22,0.08),transparent_32%),linear-gradient(180deg,#F5F1E8_0%,#EFE6D6_100%)]">
      <nav className="border-b border-black/10 bg-[#F5F1E8]">
        <div className="mx-auto flex h-[88px] max-w-7xl items-center justify-between px-5 md:px-8">
          <div className="flex min-w-0 items-center gap-5">
            <a href="/" aria-label="LA TANDA" className="shrink-0">
              <img
                src="/brand/logo-extendido-header.png"
                alt="LA TANDA"
                className="h-[64px] w-auto object-contain md:h-[76px]"
              />
            </a>

            <div className="hidden min-w-0 border-l border-black/10 pl-5 md:block">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9F1D16]">
                Haz que cada punto cuente
              </p>
              <h1 className="mt-1 max-w-[360px] truncate text-2xl font-black uppercase tracking-[-0.04em]">
                {groupName || "Mi quiniela"}
              </h1>
            </div>
          </div>

          <a
            href="/grupos"
            className="rounded-full border border-black/20 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-black transition hover:bg-[#111] hover:text-[#F5F1E8]"
          >
            volver a Mis Tandas
          </a>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-5 py-6 md:px-8">
        <div className="mb-6 border border-black/15 bg-[#FFF9EE] p-5 shadow-[0_24px_70px_rgba(17,17,17,0.14)] md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9F1D16]">
                {groupName || "Tu Tanda"}
              </p>

              <h2 className="mt-2 text-4xl font-black uppercase tracking-[-0.05em]">
                {viewMode === "matches"
                  ? "Partidos"
                  : viewMode === "knockouts"
                    ? "Eliminatorias"
                    : "Bonus"}
              </h2>

              <p className="mt-2 text-sm font-semibold text-black/55">
                {viewMode === "matches"
                  ? "Llena tus marcadores antes del cierre."
                  : viewMode === "knockouts"
                    ? "Tu llave final del Mundial."
                    : "Selecciones especiales que suman al ranking."}
              </p>
            </div>

            <div className="grid w-full gap-3 lg:max-w-[720px] lg:grid-cols-[1fr_1fr_1.25fr]">
              <div className="rounded-none border border-black/10 bg-[#EFE6D6] px-5 py-4 text-center">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#111]/40">
                  Ranking grupo
                </p>

                <p className="mt-1 text-3xl font-black">
                  #{selectedGroupRanking?.ranking_position ?? "-"}
                </p>

                {groupRankings.length > 0 ? (
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="mt-2 w-full rounded-none border border-black/10 bg-[#F5F1E8]/70 px-2 py-1 text-center text-[11px] font-bold text-[#9F1D16] outline-none"
                  >
                    {groupRankings.map((group) => (
                      <option key={group.group_id} value={group.group_id}>
                        {group.group_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-[10px] text-[#111]/35">
                    sin grupo activo
                  </p>
                )}
              </div>

              <div className="rounded-none border border-black/10 bg-[#EFE6D6] px-5 py-4 text-center">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#111]/40">
                  Ranking global
                </p>

                <p className="mt-1 text-3xl font-black">
                  #{globalStats?.ranking_position ?? "-"}
                </p>

                <p className="mt-2 text-[10px] font-bold text-[#111]/35">
                  posición general
                </p>
              </div>

              <div className="rounded-none border border-black/15 bg-[#111] px-6 py-4 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#F5F1E8]/70">
                  Puntos totales
                </p>

                <p className="mt-1 text-4xl font-black text-[#F5F1E8]">
                  {globalStats?.total_points ?? 0}
                </p>

                <p className="mt-1 text-[11px] font-bold text-[#F5F1E8]/55">
                  grupos + eliminatorias + bonus
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setViewMode("matches")}
              className={`rounded-none px-4 py-3 font-bold ${
                viewMode === "matches"
                  ? "bg-[#111] text-[#F5F1E8]"
                  : "bg-black/[0.05] text-[#111]/80"
              }`}
            >
              Partidos
            </button>

            <button
              onClick={() => setViewMode("knockouts")}
              className={[
                "rounded-none px-5 py-3 font-black transition",
                viewMode === "knockouts"
                  ? "bg-[#111] text-[#F5F1E8]"
                  : "bg-black/[0.05] text-[#111] hover:bg-black/[0.08]",
              ].join(" ")}
            >
              Eliminatorias
            </button>

            <button
              onClick={() => setViewMode("bonus")}
              className={`rounded-none px-4 py-3 font-bold ${
                viewMode === "bonus"
                  ? "bg-[#111] text-[#F5F1E8]"
                  : "bg-black/[0.05] text-[#111]/80"
              }`}
            >
              Preguntas bonus
            </button>
          </div>

          {viewMode === "matches" && (
            <div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="relative overflow-hidden rounded-none border border-[#111]/25 bg-[#111] p-5 text-[#F5F1E8] shadow-[0_18px_45px_rgba(17,17,17,0.18)]">
                  <div className="absolute left-0 top-0 h-full w-2 bg-[#C9A24D]" />
                  <p className="pl-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#F5F1E8]/55">
                    Puntos grupos
                  </p>

                  <p className="mt-4 pl-2 text-5xl font-black tracking-[-0.06em] text-[#C9A24D]">
                    {groupStagePoints}/{groupStageTotalPoints}
                  </p>

                  <p className="mt-3 pl-2 text-xs font-semibold text-[#F5F1E8]/55">
                    puntos de esta sección
                  </p>
                </div>

                <div className="relative overflow-hidden rounded-none border border-[#111]/20 bg-[#1B1B1B] p-5 text-[#F5F1E8] shadow-[0_14px_35px_rgba(17,17,17,0.14)]">
                  <div className="absolute left-0 top-0 h-full w-2 bg-[#F5F1E8]/35" />
                  <p className="pl-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#F5F1E8]/55">
                    Sin llenar
                  </p>

                  <p className="mt-4 pl-2 text-5xl font-black tracking-[-0.06em] text-[#F5F1E8]">
                    {counts.unfilled}
                  </p>

                  <p className="mt-3 pl-2 text-xs font-semibold text-[#F5F1E8]/55">
                    partidos pendientes
                  </p>
                </div>

                <div className="relative overflow-hidden rounded-none border border-[#9F1D16]/45 bg-[#2A1110] p-5 text-[#F5F1E8] shadow-[0_14px_35px_rgba(159,29,22,0.18)]">
                  <div className="absolute left-0 top-0 h-full w-2 bg-[#9F1D16]" />
                  <p className="pl-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#F5F1E8]/55">
                    Urgentes
                  </p>

                  <p className="mt-4 pl-2 text-5xl font-black tracking-[-0.06em] text-[#FFB4A8]">
                    {counts.urgent}
                  </p>

                  <p className="mt-3 pl-2 text-xs font-semibold text-[#F5F1E8]/55">
                    Cierran en las próximas 24 horas
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t border-black/10 pt-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-black/35">
                  Filtrar partidos
                </p>

                <div className="flex flex-wrap gap-2">
                  {filterButtons.map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setRoundFilter(filter.key)}
                      className={[
                        "border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition",
                        roundFilter === filter.key
                          ? "border-[#111] bg-[#111] text-[#F5F1E8]"
                          : "border-black/10 bg-transparent text-[#111]/45 hover:border-black/30 hover:bg-white/50 hover:text-[#111]",
                      ].join(" ")}
                    >
                      {filter.label}
                      <span className="ml-2 opacity-70">{filter.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {message && (
          <div className="mb-5 rounded-none border border-black/15 bg-[#FFF9EE] px-4 py-3 text-sm font-bold text-[#9F1D16]">
            {message}
          </div>
        )}

        {viewMode === "matches" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 border-y border-black/15 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-black/45">
                Boletos de partido
              </p>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#9F1D16]">
                Verde acierto · Rojo error · Dorado por calificar
              </p>
            </div>
            {visibleMatches.map((match) => {
              const matchLocked = isLocked(match);
              const badge = getStatusBadge(match.id);
              const tone = getMatchTone(match.id, matchLocked);
              const prediction = predictions[match.id];
              const awardedPoints = prediction?.points_awarded ?? 0;
              const hasScoredPoints = Boolean(prediction?.scored_at);

              return (
                <div
                  key={match.id}
                  className={[
                    "relative overflow-hidden rounded-none border p-5 transition",
                    tone.card,
                  ].join(" ")}
                >
                  <div className={["absolute left-0 top-0 h-full w-2", tone.band].join(" ")} />
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 pl-2 text-sm text-[#F5F1E8]/70">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#C9A24D]">
                        Boleto #{String(match.match_number).padStart(2, "0")} · Grupo {match.group_name ?? "-"}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-[#F5F1E8]/45">
                        Fecha: {formatDate(match.kickoff_at)} · Cierre:{" "}
                        {formatDate(match.prediction_deadline)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {matchLocked && (
                        <span className="inline-flex rounded-full border border-red-300/35 bg-red-500/15 px-3 py-1 text-xs font-bold text-red-100">
                          🔒 Cerrado
                        </span>
                      )}
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                          badge.className,
                        ].join(" ")}
                      >
                        {badge.label}
                      </span>

                      {hasScoredPoints && (
                        <span
                          className={[
                            "inline-flex rounded-full border px-3 py-1 text-xs font-black",
                            awardedPoints > 0
                              ? "border-emerald-700/25 bg-emerald-100 text-emerald-900"
                              : "border-red-800/25 bg-red-100 text-red-900",
                          ].join(" ")}
                        >
                          Puntos vivos: +{awardedPoints}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 pl-2 md:grid-cols-[1fr_64px_28px_64px_1fr_auto]">
                    <div className={["rounded-none p-3 font-bold", tone.team].join(" ")}>
                      {match.home_team.flag_emoji} {match.home_team.name}
                    </div>

                    <input
                      type="number"
                      disabled={matchLocked}
                      value={predictions[match.id]?.home_score_pred ?? ""}
                      onChange={(e) =>
                        updatePrediction(
                          match.id,
                          "home_score_pred",
                          e.target.value
                        )
                      }
                      className={[
                        "h-12 rounded-none text-center font-black outline-none",
                        matchLocked
                          ? "cursor-not-allowed border border-white/10 bg-white/5 text-[#F5F1E8]/35"
                          : tone.input,
                      ].join(" ")}
                    />

                    <div className={["flex items-center justify-center text-center text-xs font-black uppercase tracking-[0.16em]", tone.vs].join(" ")}>
                      vs
                    </div>

                    <input
                      type="number"
                      disabled={matchLocked}
                      value={predictions[match.id]?.away_score_pred ?? ""}
                      onChange={(e) =>
                        updatePrediction(
                          match.id,
                          "away_score_pred",
                          e.target.value
                        )
                      }
                      className={[
                        "h-12 rounded-none text-center font-black outline-none",
                        matchLocked
                          ? "cursor-not-allowed border border-white/10 bg-white/5 text-[#F5F1E8]/35"
                          : tone.input,
                      ].join(" ")}
                    />

                    <div className={["rounded-none p-3 font-bold", tone.team].join(" ")}>
                      {match.away_team.flag_emoji} {match.away_team.name}
                    </div>

                    <button
                      onClick={() => savePrediction(match)}
                      disabled={matchLocked || savingMatchId === match.id}
                      className={[
                        "rounded-none px-4 font-bold",
                        matchLocked || savingMatchId === match.id
                          ? "cursor-not-allowed border border-white/10 bg-white/5 text-[#F5F1E8]/35"
                          : "bg-[#F5F1E8] text-[#111] shadow-[0_10px_25px_rgba(0,0,0,0.18)] hover:bg-[#C9A24D]",
                      ].join(" ")}
                    >
                      {matchLocked
                        ? "Cerrado"
                        : savingMatchId === match.id
                          ? "Guardando..."
                          : "Guardar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "knockouts" && userId && (
          <KnockoutBracketSection userId={userId} />
        )}

        {viewMode === "bonus" && (
          <BonusStatusDashboard
            pickTypes={orderedPickTypes}
            bonusPickMeta={bonusPickMeta}
            bonusSelections={bonusSelections}
            teamOptions={teamOptions}
            getPlayerOptionsForPick={getPlayerOptionsForPick}
            updateBonus={updateBonus}
            updateCustomBonus={updateCustomBonus}
            saveBonus={saveBonus}
            saving={saving}
            bonusLocked={bonusLocked}
          />
        )}
      </section>
    </main>
  );
}

export default function QuinielaPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#111111] text-[#F5F1E8]">
          <p className="text-sm font-black uppercase tracking-[0.22em]">
            Cargando La Tanda...
          </p>
        </main>
      }
    >
      <QuinielaPageContent />
    </Suspense>
  );
}
