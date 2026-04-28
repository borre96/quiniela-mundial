"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

type ViewMode = "matches" | "bonus";

type RoundFilter =
  | "unfilled"
  | "urgent"
  | "exact"
  | "correct"
  | "wrong"
  | "all";

const TEAM_BONUS_CODES = ["champion", "runner_up", "third_place"];

const PLAYER_BONUS_CODES = [
  "top_scorer",
  "best_player",
  "best_goalkeeper",
  "best_young_player",
];

const BONUS_ORDER = [
  "champion",
  "runner_up",
  "third_place",
  "top_scorer",
  "best_player",
  "best_goalkeeper",
  "best_young_player",
];

export default function QuinielaPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("matches");

  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [results, setResults] = useState<Record<string, MatchResult>>({});

  const [pickTypes, setPickTypes] = useState<SpecialPickType[]>([]);
  const [bonusSelections, setBonusSelections] = useState<Record<string, string>>(
    {}
  );
  const [players, setPlayers] = useState<Player[]>([]);

  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const [roundFilter, setRoundFilter] = useState<RoundFilter>("unfilled");

  useEffect(() => {
    loadPage();
  }, []);

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
      .select("pick_type_id, selection")
      .eq("user_id", user.id);

    if (userBonusError) {
      setMessage(userBonusError.message);
      setLoading(false);
      return;
    }

    const mappedBonus: Record<string, string> = {};

    for (const bonus of userBonusData || []) {
      mappedBonus[bonus.pick_type_id] = bonus.selection || "";
    }

    setBonusSelections(mappedBonus);

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
    setLoading(false);
  }

  function isLocked(match: Match) {
    return (
      new Date() >= new Date(match.prediction_deadline) ||
      match.status !== "scheduled"
    );
  }

  function isUnfilled(match: Match) {
    const prediction = predictions[match.id];

    return (
      !prediction ||
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
        label: "Resultado exacto +3",
        className: "bg-emerald-400/15 text-emerald-300",
      };
    }

    if (status === "correct") {
      return {
        label: "Acierto +1",
        className: "bg-cyan-400/15 text-cyan-300",
      };
    }

    if (status === "wrong") {
      return {
        label: "Error +0",
        className: "bg-red-400/15 text-red-300",
      };
    }

    if (status === "pending") {
      return {
        label: "Pendiente",
        className: "bg-yellow-400/15 text-yellow-200",
      };
    }

    return {
      label: "Sin llenar",
      className: "bg-white/10 text-white/70",
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
  }, [matches, predictions]);

  const bonusCompleted = useMemo(() => {
    return pickTypes.filter((pickType) => bonusSelections[pickType.id]).length;
  }, [pickTypes, bonusSelections]);

  const totalBonusPoints = useMemo(() => {
    return pickTypes.reduce((total, pickType) => total + pickType.points, 0);
  }, [pickTypes]);

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
  }, [matches, predictions, roundFilter]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Cargando quiniela...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
              Quiniela Mundial 2026
            </p>
            <h1 className="mt-1 text-xl font-bold">Mi Quiniela</h1>
          </div>

          <a
            href="/"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Volver
          </a>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-6 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
                Tu desempeño
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {viewMode === "matches" ? "Quiniela en juego" : "Preguntas bonus"}
              </h2>

              <p className="mt-2 text-sm text-white/60">
                {viewMode === "matches"
                  ? "Picks partido por partido"
                  : "Puntos extra que suman al mismo ranking"}
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 px-5 py-4 text-center">
              <p className="text-xs text-white/50">Global</p>
              <p className="text-4xl font-black text-emerald-300">
                {globalStats?.ranking_position
                  ? `#${globalStats.ranking_position}`
                  : "-"}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setViewMode("matches")}
              className={`rounded-xl px-4 py-3 font-bold ${
                viewMode === "matches"
                  ? "bg-emerald-400 text-slate-950"
                  : "bg-white/10 text-white/80"
              }`}
            >
              Partidos
            </button>

            <button
              onClick={() => setViewMode("bonus")}
              className={`rounded-xl px-4 py-3 font-bold ${
                viewMode === "bonus"
                  ? "bg-emerald-400 text-slate-950"
                  : "bg-white/10 text-white/80"
              }`}
            >
              Preguntas bonus
            </button>
          </div>

          {viewMode === "matches" && (
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl bg-white/8 p-4">
                <p className="text-xs text-white/45">Puntos acumulados</p>
                <p className="mt-2 text-3xl font-black">
                  {globalStats?.total_points ?? 0}
                </p>
              </div>

              <div className="rounded-2xl bg-white/8 p-4">
                <p className="text-xs text-white/45">Resultados exactos</p>
                <p className="mt-2 text-3xl font-black">{counts.exact}</p>
              </div>

              <div className="rounded-2xl bg-white/8 p-4">
                <p className="text-xs text-white/45">Partidos sin llenar</p>
                <p className="mt-2 text-3xl font-black">{counts.unfilled}</p>
              </div>

              <div className="rounded-2xl bg-white/8 p-4">
                <p className="text-xs text-white/45">Por llenar urgentes</p>
                <p className="mt-1 text-[11px] text-white/35">
                  Próximas 24 horas
                </p>
                <p className="mt-2 text-3xl font-black text-red-300">
                  {counts.urgent}
                </p>
              </div>
            </div>
          )}

          {viewMode === "bonus" && (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-white/8 p-4">
                <p className="text-xs text-white/45">Preguntas contestadas</p>
                <p className="mt-2 text-3xl font-black">
                  {bonusCompleted}/{pickTypes.length}
                </p>
              </div>

              <div className="rounded-2xl bg-white/8 p-4">
                <p className="text-xs text-white/45">Puntos bonus posibles</p>
                <p className="mt-2 text-3xl font-black text-emerald-300">
                  {totalBonusPoints}
                </p>
              </div>

              <div className="rounded-2xl bg-white/8 p-4">
                <p className="text-xs text-white/45">Estado</p>
                <p className="mt-3 text-xl font-black">
                  {bonusCompleted === pickTypes.length ? "Completo" : "Pendiente"}
                </p>
              </div>
            </div>
          )}
        </div>

        {bonusCompleted < pickTypes.length && (
          <div className="mb-5 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-bold text-yellow-200">
                  Te faltan preguntas bonus por completar
                </p>
                <p className="mt-1 text-sm text-white/60">
                  Estas preguntas suman al mismo ranking general.
                </p>
              </div>

              <button
                onClick={() => setViewMode("bonus")}
                className="rounded-xl bg-yellow-300 px-4 py-2 font-bold text-slate-950"
              >
                Ir a bonus
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        )}

        {viewMode === "matches" && (
          <>
            <div className="mb-5 flex flex-wrap gap-2">
              {[
                ["unfilled", `Partidos sin llenar (${counts.unfilled})`],
                ["urgent", `Por llenar urgentes (${counts.urgent})`],
                ["exact", `Resultados exactos (${counts.exact})`],
                ["correct", `Aciertos (${counts.correct})`],
                ["wrong", `Errores (${counts.wrong})`],
                ["all", "Todos"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setRoundFilter(value as RoundFilter)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    roundFilter === value
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-white/10 text-white/75 hover:bg-white/15"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {visibleMatches.map((match) => {
                const prediction = predictions[match.id];
                const result = results[match.id];
                const locked = isLocked(match);
                const urgent = isUrgentUnfilled(match);
                const badge = getStatusBadge(match.id);

                return (
                  <div
                    key={match.id}
                    className={`rounded-3xl border p-5 ${
                      urgent
                        ? "border-red-500/30 bg-red-500/10"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-white/60">
                        Partido {match.match_number} · Grupo {match.group_name} ·
                        Deadline {formatDate(match.prediction_deadline)}
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="grid items-center gap-3 md:grid-cols-[1fr_64px_28px_64px_1fr_auto]">
                      <div className="rounded-xl bg-white/8 p-3">
                        {match.home_team.flag_emoji} {match.home_team.name}
                      </div>

                      <input
                        type="number"
                        min="0"
                        disabled={locked}
                        value={prediction?.home_score_pred ?? ""}
                        onChange={(event) =>
                          updatePrediction(
                            match.id,
                            "home_score_pred",
                            event.target.value
                          )
                        }
                        className="h-12 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-bold outline-none disabled:opacity-40"
                      />

                      <div className="text-center text-sm font-bold text-white/35">
                        vs
                      </div>

                      <input
                        type="number"
                        min="0"
                        disabled={locked}
                        value={prediction?.away_score_pred ?? ""}
                        onChange={(event) =>
                          updatePrediction(
                            match.id,
                            "away_score_pred",
                            event.target.value
                          )
                        }
                        className="h-12 rounded-xl border border-white/10 bg-white/10 text-center text-xl font-bold outline-none disabled:opacity-40"
                      />

                      <div className="rounded-xl bg-white/8 p-3 md:text-right">
                        {match.away_team.flag_emoji} {match.away_team.name}
                      </div>

                      <button
                        onClick={() => savePrediction(match)}
                        disabled={locked || savingMatchId === match.id}
                        className="h-12 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {savingMatchId === match.id ? "..." : "Guardar"}
                      </button>
                    </div>

                    {result && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <p className="text-xs text-white/45">Tu pick</p>
                            <p className="mt-1 text-xl font-black">
                              {prediction?.home_score_pred ?? "-"} -{" "}
                              {prediction?.away_score_pred ?? "-"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-white/45">
                              Resultado oficial
                            </p>
                            <p className="mt-1 text-xl font-black">
                              {result.home_score} - {result.away_score}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-white/45">
                              Puntos aportados
                            </p>
                            <p className="mt-1 text-2xl font-black text-emerald-300">
                              +{prediction?.points_awarded ?? 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleMatches.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-white/55">
                  No hay partidos con este filtro.
                </div>
              )}
            </div>
          </>
        )}

       {viewMode === "bonus" && (
<div className="space-y-6">

<div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
<h2 className="text-2xl font-black">
Preguntas bonus
</h2>

<p className="mt-3 text-white/60">
Versión segura temporal para validar build.
</p>

<div className="mt-8 space-y-4">

{orderedPickTypes.map((pick)=>(
<div
key={pick.id}
className="rounded-2xl border border-white/10 bg-white/5 p-5"
>

<h3 className="font-black text-xl">
{pick.name}
</h3>

<p className="text-sm text-white/45 mt-1">
Vale {pick.points} pts
</p>

{TEAM_BONUS_CODES.includes(pick.code) && (
<select
value={bonusSelections[pick.id] || ""}
onChange={(e)=>
updateBonus(
pick.id,
e.target.value
)
}
className="mt-4 h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-4"
>
<option value="">
Selecciona equipo
</option>

{teamOptions.map(team=>(
<option
key={team.id}
value={`team:${team.id}`}
>
{team.name}
</option>
))}

</select>
)}

{PLAYER_BONUS_CODES.includes(pick.code) && (
<div className="mt-4 space-y-4">

<input
list={`players-${pick.id}`}
placeholder="Busca jugador por nombre o apellido"
className="h-12 w-full rounded-xl border border-emerald-400/30 bg-slate-900 px-4"
onChange={(e)=>{

const typed=e.target.value.trim();

if(!typed) return;

if(
typed==="Otro jugador no listado"
){
updateBonus(
pick.id,
"custom_player:"
);
return;
}

const found=
getPlayerOptionsForPick(
pick.code
).find(
p=>
p.full_name
.toLowerCase()
.includes(
typed.toLowerCase()
)
);

if(found){
updateBonus(
pick.id,
`player:${found.id}`
);
}

}}
/>

<datalist id={`players-${pick.id}`}>
{getPlayerOptionsForPick(
pick.code
).map(player=>(
<option
key={player.id}
value={player.full_name}
/>
))}
<option value="Otro jugador no listado"/>
</datalist>

{bonusSelections[pick.id]?.startsWith("player:") && (
<p className="text-sm font-semibold text-emerald-300">
✓ Jugador seleccionado
</p>
)}

{bonusSelections[pick.id]?.startsWith("custom_player:") && (
<div>
<input
type="text"
value={
  bonusSelections[pick.id]?.replace("custom_player:", "") || ""
}
onChange={(e)=>
updateCustomBonus(
pick.id,
e.target.value
)
}
placeholder="Escribe nombre y apellido del jugador"
className="h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-4"
/>

<p className="mt-2 text-xs text-yellow-200/80">
Jugador manual sujeto a validación.
</p>
</div>
)}

</div>
)}

</div>
))}

</div>

<div className="mt-8">
<button
onClick={saveBonus}
disabled={saving}
className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950"
>
{saving
? "Guardando..."
: "Guardar bonus"}
</button>
</div>

</div>

</div>
)}
      </section>
    </main>
  );
}