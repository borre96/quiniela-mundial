"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type GlobalRow = {
  user_id: string;
  display_name: string;
  match_points: number;
  bonus_points: number;
  knockout_points?: number;
  total_points: number;
  exact_hits: number;
  correct_outcomes: number;
  ranking_position: number;
};

type GroupRow = {
  group_id: string;
  group_name: string;
  invite_code: string;
  user_id: string;
  display_name: string;
  match_points?: number;
  bonus_points?: number;
  knockout_points?: number;
  total_points: number;
  exact_hits: number;
  correct_outcomes: number;
  ranking_position: number;
};

type LeaderboardRow = {
  scope_key: string;
  user_id: string;
  display_name: string;
  match_points: number;
  bonus_points: number;
  knockout_points: number;
  total_points: number;
  exact_hits: number;
  correct_outcomes: number;
  ranking_position: number;
};

type GroupTab = {
  id: string;
  name: string;
  rows: LeaderboardRow[];
};

export default function RankingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<string>("global");
  const [requestedGroupId, setRequestedGroupId] = useState<string | null>(null);
  const [globalRows, setGlobalRows] = useState<GlobalRow[]>([]);
  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const groupId = params.get("groupId");

    if (groupId) {
      setRequestedGroupId(groupId);
      setActiveScope(groupId);
    }

    loadRankings();
  }, []);

  async function loadRankings() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      setUserId(user.id);

      const globalRes = await supabase
        .from("leaderboard_global_v")
        .select("*")
        .order("ranking_position", { ascending: true });

      if (globalRes.error) throw globalRes.error;

      setGlobalRows(globalRes.data || []);

      const membershipsRes = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

      if (membershipsRes.error) throw membershipsRes.error;

      const groupIds = membershipsRes.data?.map((row) => row.group_id) || [];

      if (groupIds.length === 0) {
        setGroupRows([]);
        setLoading(false);
        return;
      }

      const groupsRes = await supabase
        .from("leaderboard_group_v")
        .select("*")
        .in("group_id", groupIds)
        .order("group_name", { ascending: true })
        .order("ranking_position", { ascending: true });

      if (groupsRes.error) throw groupsRes.error;

      setGroupRows(groupsRes.data || []);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error cargando rankings");
    } finally {
      setLoading(false);
    }
  }

  const normalizedGlobalRows: LeaderboardRow[] = globalRows.map((row) => ({
    scope_key: "global",
    user_id: row.user_id,
    display_name: row.display_name,
    match_points: row.match_points || 0,
    bonus_points: row.bonus_points || 0,
    knockout_points: row.knockout_points || 0,
    total_points: row.total_points || 0,
    exact_hits: row.exact_hits || 0,
    correct_outcomes: row.correct_outcomes || 0,
    ranking_position: row.ranking_position || 0,
  }));

  const groupTabs: GroupTab[] = useMemo(() => {
    const grouped = groupRows.reduce<Record<string, GroupTab>>((acc, row) => {
      if (!acc[row.group_id]) {
        acc[row.group_id] = {
          id: row.group_id,
          name: row.group_name,
          rows: [],
        };
      }

      acc[row.group_id].rows.push({
        scope_key: row.group_id,
        user_id: row.user_id,
        display_name: row.display_name,
        match_points: row.match_points || 0,
        bonus_points: row.bonus_points || 0,
        knockout_points: row.knockout_points || 0,
        total_points: row.total_points || 0,
        exact_hits: row.exact_hits || 0,
        correct_outcomes: row.correct_outcomes || 0,
        ranking_position: row.ranking_position || 0,
      });

      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => {
      if (requestedGroupId && a.id === requestedGroupId) return -1;
      if (requestedGroupId && b.id === requestedGroupId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [groupRows, requestedGroupId]);

  const activeGroup = groupTabs.find((group) => group.id === activeScope);
  const activeRows = activeScope === "global" ? normalizedGlobalRows : activeGroup?.rows || [];
  const activeTitle = activeScope === "global" ? "Tabla general" : activeGroup?.name || "Tu Tanda";
  const activePositionLabel = activeScope === "global" ? "Tu posición global" : `Tu posición · ${activeGroup?.name || "Tu Tanda"}`;
  const myActiveRow = activeRows.find((row) => row.user_id === userId);
  const top3 = activeRows.slice(0, 3);

  function changeScope(scope: string) {
    setActiveScope(scope);

    const url = new URL(window.location.href);

    if (scope === "global") {
      url.searchParams.delete("groupId");
    } else {
      url.searchParams.set("groupId", scope);
    }

    window.history.replaceState({}, "", url.toString());
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F1E8] text-[#111]">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-black/45">
          Cargando La Tabla...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#111]">
      <nav className="border-b border-black/10 bg-[#F5F1E8]">
        <div className="mx-auto flex h-[88px] max-w-6xl items-center justify-between px-6 md:px-8">
          <a href="/" aria-label="LA TANDA">
            <img
              src="/brand/logo-extendido-header.png"
              alt="LA TANDA"
              className="h-[72px] w-auto object-contain md:h-[84px]"
            />
          </a>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="/grupos"
              className="border border-black/20 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition hover:bg-white/60"
            >
              Mis Tandas
            </a>

            <a
              href="/quiniela"
              className="bg-[#111] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#F5F1E8] transition hover:-translate-y-0.5"
            >
              Quiniela
            </a>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div className="mb-8 border border-black/10 bg-[#F8F3EA] p-6 shadow-[0_24px_70px_rgba(17,17,17,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#9F1D16]">
            Ranking en vivo
          </p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.94] tracking-[-0.06em] md:text-7xl">
            La Tabla
          </h1>
          <p className="mt-5 text-base font-semibold text-black/60">
            Así va tu Tanda.
          </p>
        </div>

        {myActiveRow && (
          <div className="mb-8 rounded-none border border-black/15 bg-[#111] p-6 text-[#F5F1E8]">
            <p className="text-sm font-bold uppercase tracking-wide text-[#D8B45A]">
              {activePositionLabel}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-6">
              <div>
                <p className="text-sm text-current/50">Ranking</p>
                <p className="text-3xl font-black">#{myActiveRow.ranking_position}</p>
              </div>

              <div>
                <p className="text-sm text-current/50">Total</p>
                <p className="text-3xl font-black text-[#D8B45A]">{myActiveRow.total_points}</p>
              </div>

              <div>
                <p className="text-sm text-current/50">Partidos</p>
                <p className="text-3xl font-black">{myActiveRow.match_points}</p>
              </div>

              <div>
                <p className="text-sm text-current/50">Bonus</p>
                <p className="text-3xl font-black text-[#D8B45A]">{myActiveRow.bonus_points}</p>
              </div>

              <div>
                <p className="text-sm text-current/50">Eliminatorias</p>
                <p className="text-3xl font-black">{myActiveRow.knockout_points}</p>
              </div>

              <div>
                <p className="text-sm text-current/50">Exactos</p>
                <p className="text-3xl font-black">{myActiveRow.exact_hits}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 flex flex-wrap gap-3">
          <button
            onClick={() => changeScope("global")}
            className={`rounded-none px-5 py-3 text-sm font-black uppercase tracking-[0.12em] transition ${
              activeScope === "global" ? "bg-[#111] text-[#F5F1E8]" : "bg-black/[0.05] hover:bg-black/[0.08]"
            }`}
          >
            Global
          </button>

          {groupTabs.map((group) => (
            <button
              key={group.id}
              onClick={() => changeScope(group.id)}
              className={`rounded-none px-5 py-3 text-sm font-black uppercase tracking-[0.12em] transition ${
                activeScope === group.id ? "bg-[#111] text-[#F5F1E8]" : "bg-black/[0.05] hover:bg-black/[0.08]"
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-none border border-red-400/30 bg-red-500/10 p-4 text-[#9F1D16]">
            {error}
          </div>
        )}

        {activeRows.length > 0 ? (
          <>
            <div className="mb-10 grid gap-5 md:grid-cols-3">
              {top3.map((player, index) => {
                const isMe = player.user_id === userId;

                return (
                  <div
                    key={`${player.scope_key}-top-${player.user_id}`}
                    className={`rounded-none border p-6 ${
                      isMe ? "border-[#9F1D16]/50 bg-[#9F1D16]/10" : "border-black/10 bg-[#F8F3EA]"
                    }`}
                  >
                    <div className="mb-4 text-5xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </div>

                    <p className="text-sm text-current/50">#{player.ranking_position}</p>

                    <h3 className="mt-2 text-2xl font-bold">
                      {player.display_name}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-[#9F1D16] px-2 py-1 text-xs text-[#F5F1E8]">
                          Tú
                        </span>
                      )}
                    </h3>

                    <p className="mt-4 text-4xl font-black text-[#D8B45A]">{player.total_points}</p>

                    <p className="mt-2 text-sm text-current/50">
                      {player.match_points} partidos · {player.bonus_points} bonus
                      {player.knockout_points > 0 ? ` · ${player.knockout_points} eliminatorias` : ""}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-none border border-black/10 bg-[#F8F3EA]">
              <div className="border-b border-black/10 p-5">
                <h3 className="text-xl font-black uppercase tracking-[-0.03em]">{activeTitle}</h3>
              </div>

              <div className="divide-y divide-black/10">
                {activeRows.map((row) => {
                  const isMe = row.user_id === userId;

                  return (
                    <div
                      key={`${row.scope_key}-row-${row.user_id}`}
                      className={`flex items-center justify-between gap-4 p-5 ${isMe ? "bg-[#9F1D16]/10" : ""}`}
                    >
                      <div>
                        <p className="font-bold">
                          #{row.ranking_position} {row.display_name}
                          {isMe && (
                            <span className="ml-2 rounded-full bg-[#9F1D16] px-2 py-1 text-xs text-[#F5F1E8]">
                              Tú
                            </span>
                          )}
                        </p>

                        <p className="mt-1 text-xs text-current/45">
                          {row.exact_hits} exactos · {row.correct_outcomes} aciertos
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-black text-[#D8B45A]">{row.total_points}</p>

                        <p className="mt-1 text-xs text-current/45">
                          {row.match_points} partidos · {row.bonus_points} bonus
                          {row.knockout_points > 0 ? ` · ${row.knockout_points} eliminatorias` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-none border border-black/10 bg-[#F8F3EA] p-8 text-center font-bold text-black/50">
            {activeScope === "global" ? "Aún no hay jugadores en la tabla." : "Aún no hay jugadores en esta Tanda."}
          </div>
        )}
      </section>
    </main>
  );
}
