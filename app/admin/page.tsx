"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Team = {
  id?: string;
  name: string;
  flag_emoji: string | null;
};

type Match = {
  id: string;
  group_name: string | null;
  kickoff_at: string | null;
  home_team: Team | Team[] | null;
  away_team: Team | Team[] | null;
};

type MatchResult = {
  match_id: string;
  home_score: number | null;
  away_score: number | null;
  is_final: boolean;
};

type MatchWithResult = Match & {
  result?: MatchResult | null;
};

type Profile = {
  role: string | null;
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
  team?: Team | Team[] | null;
};

type SpecialResult = {
  pick_type_id: string;
  official_selection: string;
};

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

function normalizeCustomPlayerName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [matches, setMatches] = useState<MatchWithResult[]>([]);
  const [scores, setScores] = useState<
    Record<string, { home: string; away: string; final: boolean }>
  >({});

  const [pickTypes, setPickTypes] = useState<SpecialPickType[]>([]);
  const [specialSelections, setSpecialSelections] = useState<
    Record<string, string>
  >({});
  const [specialInputs, setSpecialInputs] = useState<Record<string, string>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const [message, setMessage] = useState("");
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [savingBonusId, setSavingBonusId] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setUserId(user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<Profile>();

    if (profileError || profile?.role !== "admin") {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);

    await Promise.all([loadMatches(), loadBonusAdminData()]);
    setLoading(false);
  }

  function getTeam(team: Team | Team[] | null) {
    if (Array.isArray(team)) return team[0] ?? null;
    return team;
  }

  async function loadMatches() {
    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select(`
        id,
        group_name,
        kickoff_at,
        home_team:teams!matches_home_team_id_fkey (
          name,
          flag_emoji
        ),
        away_team:teams!matches_away_team_id_fkey (
          name,
          flag_emoji
        )
      `)
      .order("kickoff_at", { ascending: true });

    if (matchesError) {
      setMessage(matchesError.message);
      return;
    }

    const { data: resultsData, error: resultsError } = await supabase
      .from("match_results")
      .select("match_id, home_score, away_score, is_final");

    if (resultsError) {
      setMessage(resultsError.message);
      return;
    }

    const resultsByMatch = new Map<string, MatchResult>();

    resultsData?.forEach((result) => {
      resultsByMatch.set(result.match_id, result);
    });

    const combined: MatchWithResult[] =
      matchesData?.map((match: any) => ({
        ...match,
        result: resultsByMatch.get(match.id) ?? null,
      })) ?? [];

    const initialScores: Record<
      string,
      { home: string; away: string; final: boolean }
    > = {};

    combined.forEach((match) => {
      initialScores[match.id] = {
        home:
          match.result?.home_score !== null &&
          match.result?.home_score !== undefined
            ? String(match.result.home_score)
            : "",
        away:
          match.result?.away_score !== null &&
          match.result?.away_score !== undefined
            ? String(match.result.away_score)
            : "",
        final: match.result?.is_final ?? false,
      };
    });

    setMatches(combined);
    setScores(initialScores);
  }

  async function loadBonusAdminData() {
    const { data: pickTypesData, error: pickTypesError } = await supabase
      .from("special_pick_types")
      .select("id, code, name, points");

    if (pickTypesError) {
      setMessage(pickTypesError.message);
      return;
    }

    const { data: specialResultsData, error: specialResultsError } =
      await supabase
        .from("special_results")
        .select("pick_type_id, official_selection");

    if (specialResultsError) {
      setMessage(specialResultsError.message);
      return;
    }

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name, flag_emoji")
      .order("name", { ascending: true });

    if (teamsError) {
      setMessage(teamsError.message);
      return;
    }

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
          flag_emoji
        )
      `)
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (playersError) {
      setMessage(playersError.message);
      return;
    }

    const mappedSelections: Record<string, string> = {};
    const mappedInputs: Record<string, string> = {};

    const allTeams = (teamsData || []) as Team[];
    const allPlayers = (playersData || []) as unknown as Player[];

    (specialResultsData || []).forEach((result: SpecialResult) => {
      mappedSelections[result.pick_type_id] = result.official_selection;
      mappedInputs[result.pick_type_id] = getSelectionLabel(
        result.official_selection,
        allTeams,
        allPlayers
      );
    });

    setPickTypes((pickTypesData || []) as SpecialPickType[]);
    setTeams(allTeams);
    setPlayers(allPlayers);
    setSpecialSelections(mappedSelections);
    setSpecialInputs(mappedInputs);
  }

  function updateScore(
    matchId: string,
    field: "home" | "away" | "final",
    value: string | boolean
  ) {
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: value,
      },
    }));
  }

  async function saveResult(matchId: string) {
    setMessage("");
    setSavingMatchId(matchId);

    const score = scores[matchId];

    if (!score) {
      setMessage("No encontré el marcador de este partido.");
      setSavingMatchId(null);
      return;
    }

    const homeScore = Number(score.home);
    const awayScore = Number(score.away);

    if (
      score.home === "" ||
      score.away === "" ||
      Number.isNaN(homeScore) ||
      Number.isNaN(awayScore)
    ) {
      setMessage("Captura ambos marcadores como número.");
      setSavingMatchId(null);
      return;
    }

    if (homeScore < 0 || awayScore < 0) {
      setMessage("Los marcadores no pueden ser negativos.");
      setSavingMatchId(null);
      return;
    }

    const { error: upsertError } = await supabase.from("match_results").upsert(
      {
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        is_final: score.final,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "match_id",
      }
    );

    if (upsertError) {
      setMessage(upsertError.message);
      setSavingMatchId(null);
      return;
    }

    const { error: scoreError } = await supabase.rpc("score_match", {
      match_uuid: matchId,
    });

    if (scoreError) {
      setMessage(
        `Resultado guardado, pero falló scoring: ${scoreError.message}`
      );
      setSavingMatchId(null);
      return;
    }

    setMessage("Resultado guardado y scoring recalculado.");
    await loadMatches();
    setSavingMatchId(null);
  }

  function getPlayerTeam(player: Player) {
    if (Array.isArray(player.team)) return player.team[0] ?? null;
    return player.team ?? null;
  }

  function getPlayerOptionsForPick(code: string) {
    if (code === "best_goalkeeper") {
      return players
        .filter((player) => player.position === "goalkeeper")
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
    }

    if (code === "best_young_player") {
      return players
        .filter((player) => player.is_young_player_eligible)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
    }

    if (code === "top_scorer") {
      return players
        .filter(
          (player) =>
            player.position === "forward" || player.position === "midfielder"
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
    }

    return players
      .filter((player) => player.position !== "goalkeeper")
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
  }

  function getSelectionLabel(
    selection: string | undefined,
    teamList = teams,
    playerList = players
  ) {
    if (!selection) return "";

    if (selection.startsWith("team:")) {
      const teamId = selection.replace("team:", "");
      const team = teamList.find((item) => item.id === teamId);
      return team?.name || "";
    }

    if (selection.startsWith("player:")) {
      const playerId = selection.replace("player:", "");
      const player = playerList.find((item) => item.id === playerId);
      return player?.full_name || "";
    }

    if (selection.startsWith("custom_player:")) {
      return selection.replace("custom_player:", "");
    }

    return selection;
  }

  function updateTeamSpecialSelection(pickTypeId: string, value: string) {
    setSpecialSelections((current) => ({
      ...current,
      [pickTypeId]: value,
    }));

    setSpecialInputs((current) => ({
      ...current,
      [pickTypeId]: getSelectionLabel(value),
    }));
  }

  function updatePlayerSpecialSelection(pick: SpecialPickType, typed: string) {
    setSpecialInputs((current) => ({
      ...current,
      [pick.id]: typed,
    }));

    if (!typed.trim()) {
      setSpecialSelections((current) => ({
        ...current,
        [pick.id]: "",
      }));
      return;
    }

    const found = getPlayerOptionsForPick(pick.code).find(
      (player) =>
        player.full_name.toLowerCase().trim() === typed.toLowerCase().trim()
    );

    if (found) {
      setSpecialSelections((current) => ({
        ...current,
        [pick.id]: `player:${found.id}`,
      }));
      return;
    }

    setSpecialSelections((current) => ({
      ...current,
      [pick.id]: `custom_player:${typed}`,
    }));
  }

  async function saveSpecialResult(pick: SpecialPickType) {
    setMessage("");
    setSavingBonusId(pick.id);

    const officialSelection = specialSelections[pick.id];

    if (!officialSelection) {
      setMessage(`Captura resultado oficial para: ${pick.name}`);
      setSavingBonusId(null);
      return;
    }

    const cleanSelection = officialSelection.startsWith("custom_player:")
      ? `custom_player:${normalizeCustomPlayerName(
          officialSelection.replace("custom_player:", "")
        )}`
      : officialSelection;

    const { error: upsertError } = await supabase.from("special_results").upsert(
      {
        pick_type_id: pick.id,
        official_selection: cleanSelection,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      {
        onConflict: "pick_type_id",
      }
    );

    if (upsertError) {
      setMessage(upsertError.message);
      setSavingBonusId(null);
      return;
    }

    const { error: scoringError } = await supabase.rpc("score_special_picks");

    if (scoringError) {
      setMessage(
        `Resultado bonus guardado, pero falló scoring: ${scoringError.message}`
      );
      setSavingBonusId(null);
      return;
    }

    setMessage(`Bonus guardado y recalculado: ${pick.name}`);
    await loadBonusAdminData();
    setSavingBonusId(null);
  }

  const orderedPickTypes = useMemo(() => {
    return [...pickTypes].sort(
      (a, b) => BONUS_ORDER.indexOf(a.code) - BONUS_ORDER.indexOf(b.code)
    );
  }, [pickTypes]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        Cargando admin...
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl bg-slate-900 p-6">
          <h1 className="text-3xl font-bold">Acceso restringido</h1>
          <p className="mt-3 text-slate-400">
            Esta pantalla solo está disponible para usuarios admin.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-xl border border-slate-700 px-4 py-2"
          >
            Volver al dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-300">
              Admin
            </p>
            <h1 className="text-4xl font-bold">Resultados oficiales</h1>
            <p className="mt-2 text-slate-400">
              Captura marcadores y resultados bonus. Cada guardado recalcula
              puntos automáticamente.
            </p>
          </div>

          <Link href="/" className="rounded-xl border border-slate-700 px-4 py-2">
            Volver
          </Link>
        </div>

        {message && (
  <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm font-semibold text-amber-100">
    {message}
  </div>
)}

<section className="mb-10 rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6">
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div>
      <p className="text-sm font-bold uppercase tracking-wide text-amber-300">
        Operación Mundial
      </p>

      <h2 className="mt-1 text-3xl font-bold">
        Publicar eliminatorias
      </h2>

      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Cuando termine la fase de grupos y estén definidos los cruces oficiales,
        publica las eliminatorias para desbloquear picks de bracket.
      </p>
    </div>

    <button
      type="button"
      onClick={async () => {
        setMessage("Eliminatorias publicadas.");

        // TODO:
        // conectar publish real Supabase
      }}
      className="rounded-2xl bg-amber-300 px-5 py-4 font-black uppercase tracking-[0.14em] text-slate-950 transition hover:scale-[1.02]"
    >
      Publicar eliminatorias
    </button>
  </div>

  <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
    <p className="text-sm font-semibold text-slate-300">
      Estado actual:
      <span className="ml-2 font-black text-yellow-300">
        Eliminatorias bloqueadas
      </span>
    </p>

    <p className="mt-2 text-xs text-slate-500">
      Los usuarios no podrán editar bracket hasta publicar cruces oficiales.
    </p>
  </div>
</section>

        <section className="mb-10 rounded-3xl border border-emerald-500/20 bg-slate-900 p-6">
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-300">
              Bonus
            </p>
            <h2 className="mt-1 text-3xl font-bold">Resultados bonus</h2>
            <p className="mt-2 text-sm text-slate-400">
              Guarda el resultado oficial de cada pregunta bonus. El sistema
              compara contra las selecciones de usuarios y asigna puntos.
            </p>
          </div>

          <div className="space-y-4">
            {orderedPickTypes.map((pick) => {
              const isTeamPick = TEAM_BONUS_CODES.includes(pick.code);
              const isPlayerPick = PLAYER_BONUS_CODES.includes(pick.code);
              const currentSelection = specialSelections[pick.id] || "";
              const currentInput =
                specialInputs[pick.id] || getSelectionLabel(currentSelection);

              return (
                <div
                  key={pick.id}
                  className="rounded-2xl border border-slate-700 bg-slate-950 p-5"
                >
                  <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <h3 className="text-xl font-bold">{pick.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Vale {pick.points} pts
                      </p>
                    </div>

                    <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-bold text-emerald-300">
                      {currentSelection ? "Capturado" : "Pendiente"}
                    </div>
                  </div>

                  {isTeamPick && (
                    <select
                      value={currentSelection}
                      onChange={(event) =>
                        updateTeamSpecialSelection(pick.id, event.target.value)
                      }
                      className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-white outline-none"
                    >
                      <option value="">Selecciona equipo oficial</option>

                      {teams.map((team) => (
                        <option key={team.id} value={`team:${team.id}`}>
                          {team.flag_emoji || ""} {team.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {isPlayerPick && (
                    <div className="space-y-3">
                      <input
                        list={`admin-players-${pick.id}`}
                        value={currentInput}
                        onChange={(event) =>
                          updatePlayerSpecialSelection(pick, event.target.value)
                        }
                        placeholder="Ingresa nombre y apellido del jugador"
                        className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-white outline-none"
                      />

                      <datalist id={`admin-players-${pick.id}`}>
                        {getPlayerOptionsForPick(pick.code).map((player) => {
                          const team = getPlayerTeam(player);

                          return (
                            <option
                              key={player.id}
                              value={player.full_name}
                              label={team?.name || ""}
                            />
                          );
                        })}
                      </datalist>

                      {currentSelection.startsWith("player:") && (
                        <p className="text-sm font-semibold text-emerald-300">
                          ✓ Jugador del catálogo seleccionado
                        </p>
                      )}

                      {currentSelection.startsWith("custom_player:") && (
                        <p className="text-sm font-semibold text-yellow-200">
                          Captura manual: se comparará contra usuarios que hayan
                          escrito exactamente el mismo nombre normalizado.
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => saveSpecialResult(pick)}
                    disabled={savingBonusId === pick.id}
                    className="mt-4 rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-60"
                  >
                    {savingBonusId === pick.id
                      ? "Guardando..."
                      : "Guardar bonus"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-wide text-amber-300">
              Partidos
            </p>
            <h2 className="mt-1 text-3xl font-bold">Marcadores oficiales</h2>
            <p className="mt-2 text-sm text-slate-400">
              Captura marcador final y recalcula puntos de partidos.
            </p>
          </div>

          <div className="space-y-4">
            {matches.map((match) => {
              const homeTeam = getTeam(match.home_team);
              const awayTeam = getTeam(match.away_team);
              const score = scores[match.id] ?? {
                home: "",
                away: "",
                final: false,
              };

              return (
                <div key={match.id} className="rounded-3xl bg-slate-900 p-6">
                  <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <p className="text-sm font-bold text-emerald-400">
                        {match.group_name || "Grupo"}
                      </p>
                      <h2 className="mt-1 text-2xl font-bold">
                        {homeTeam?.flag_emoji} {homeTeam?.name} vs{" "}
                        {awayTeam?.flag_emoji} {awayTeam?.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {match.kickoff_at
                          ? new Date(match.kickoff_at).toLocaleString("es-MX")
                          : "Sin fecha"}
                      </p>
                    </div>

                    <div
                      className={`rounded-full px-4 py-2 text-sm font-bold ${
                        score.final
                          ? "bg-emerald-500 text-black"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {score.final ? "Final" : "Borrador"}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
                    <div>
                      <label className="mb-2 block text-sm text-slate-400">
                        {homeTeam?.name}
                      </label>
                      <input
                        value={score.home}
                        onChange={(event) =>
                          updateScore(match.id, "home", event.target.value)
                        }
                        type="number"
                        min="0"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-center text-xl font-bold text-white"
                      />
                    </div>

                    <div className="hidden pb-3 text-center text-slate-500 md:block">
                      vs
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-slate-400">
                        {awayTeam?.name}
                      </label>
                      <input
                        value={score.away}
                        onChange={(event) =>
                          updateScore(match.id, "away", event.target.value)
                        }
                        type="number"
                        min="0"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-center text-xl font-bold text-white"
                      />
                    </div>

                    <div className="flex flex-col gap-3">
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={score.final}
                          onChange={(event) =>
                            updateScore(match.id, "final", event.target.checked)
                          }
                        />
                        Resultado final
                      </label>

                      <button
                        onClick={() => saveResult(match.id)}
                        disabled={savingMatchId === match.id}
                        className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-black disabled:opacity-60"
                      >
                        {savingMatchId === match.id
                          ? "Guardando..."
                          : "Guardar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}