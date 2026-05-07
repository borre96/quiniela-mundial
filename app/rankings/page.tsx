"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type GlobalRow = {
  user_id: string;
  display_name: string;
  match_points: number;
  bonus_points: number;
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
  total_points: number;
  exact_hits: number;
  correct_outcomes: number;
  ranking_position: number;
};

export default function RankingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<"global" | "groups">("global");
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
      setTab("groups");
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

  const top3 = globalRows.slice(0, 3);
  const myGlobalRow = globalRows.find((row) => row.user_id === userId);

  const groupedByGroup = groupRows.reduce<
    Record<string, { name: string; rows: GroupRow[] }>
  >((acc, row) => {
    if (!acc[row.group_id]) {
      acc[row.group_id] = {
        name: row.group_name,
        rows: [],
      };
    }

    acc[row.group_id].rows.push(row);
    return acc;
  }, {});

  const orderedGroups = Object.entries(groupedByGroup).sort(([a], [b]) => {
    if (requestedGroupId && a === requestedGroupId) return -1;
    if (requestedGroupId && b === requestedGroupId) return 1;
    return groupedByGroup[a].name.localeCompare(groupedByGroup[b].name);
  });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F5F1E8] text-[#111]">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-black/45">Cargando La Tabla...</p>
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

        {myGlobalRow && (
          <div className="mb-8 rounded-none border border-black/15 bg-[#111] p-6 text-[#F5F1E8]">
            <p className="text-sm font-bold uppercase tracking-wide text-[#D8B45A]">
              Tu posición global
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-5">
              <div>
                <p className="text-sm text-current/50">Ranking</p>
                <p className="text-3xl font-black">
                  #{myGlobalRow.ranking_position}
                </p>
              </div>

              <div>
                <p className="text-sm text-current/50">Total</p>
                <p className="text-3xl font-black text-[#D8B45A]">
                  {myGlobalRow.total_points}
                </p>
              </div>

              <div>
                <p className="text-sm text-current/50">Partidos</p>
                <p className="text-3xl font-black">
                  {myGlobalRow.match_points}
                </p>
              </div>

              <div>
                <p className="text-sm text-current/50">Bonus</p>
                <p className="text-3xl font-black text-[#D8B45A]">
                  {myGlobalRow.bonus_points}
                </p>
              </div>

              <div>
                <p className="text-sm text-current/50">Exactos</p>
                <p className="text-3xl font-black">
                  {myGlobalRow.exact_hits}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8 flex gap-3">
          <button
            onClick={() => setTab("global")}
            className={`rounded-none px-5 py-3 font-bold ${
              tab === "global" ? "bg-[#111] text-[#F5F1E8]" : "bg-black/[0.05]"
            }`}
          >
            Global
          </button>

          <button
            onClick={() => setTab("groups")}
            className={`rounded-none px-5 py-3 font-bold ${
              tab === "groups" ? "bg-[#111] text-[#F5F1E8]" : "bg-black/[0.05]"
            }`}
          >
            Mi Tanda
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-none border border-red-400/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        {tab === "global" && (
          <>
            <div className="mb-10 grid gap-5 md:grid-cols-3">
              {top3.map((player, index) => {
                const isMe = player.user_id === userId;

                return (
                  <div
                    key={player.user_id}
                    className={`rounded-none border p-6 ${
                      isMe
                        ? "border-[#9F1D16]/50 bg-[#9F1D16]/10"
                        : "border-black/10 bg-[#F8F3EA]"
                    }`}
                  >
                    <div className="mb-4 text-5xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </div>

                    <p className="text-sm text-current/50">
                      #{player.ranking_position}
                    </p>

                    <h3 className="mt-2 text-2xl font-bold">
                      {player.display_name}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-[#9F1D16] px-2 py-1 text-xs text-[#F5F1E8]">
                          Tú
                        </span>
                      )}
                    </h3>

                    <p className="mt-4 text-4xl font-black text-[#D8B45A]">
                      {player.total_points}
                    </p>

                    <p className="mt-2 text-sm text-current/50">
                      {player.match_points} partidos · {player.bonus_points} bonus
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-none border border-black/10 bg-[#F8F3EA]">
              <div className="border-b border-black/10 p-5">
                <h3 className="text-xl font-black uppercase tracking-[-0.03em]">Tabla general</h3>
              </div>

              <div className="divide-y divide-black/10">
                {globalRows.map((row) => {
                  const isMe = row.user_id === userId;

                  return (
                    <div
                      key={row.user_id}
                      className={`flex items-center justify-between gap-4 p-5 ${
                        isMe ? "bg-[#9F1D16]/10" : ""
                      }`}
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
                        <p className="text-2xl font-black text-[#D8B45A]">
                          {row.total_points}
                        </p>

                        <p className="mt-1 text-xs text-current/45">
                          {row.match_points} partidos · {row.bonus_points} bonus
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {tab === "groups" && (
          <div className="space-y-8">
            {orderedGroups.map(([groupId, group]) => {
              const myGroupRow = group.rows.find((r) => r.user_id === userId);

              return (
                <div
                  key={groupId}
                  className="overflow-hidden rounded-none border border-black/10 bg-[#F8F3EA]"
                >
                  <div className="border-b border-black/10 p-5">
                    <h3 className="text-2xl font-black uppercase tracking-[-0.04em]">{group.name}</h3>

                    {myGroupRow && (
                      <p className="mt-2 text-sm text-[#D8B45A]">
                        Tu posición: #{myGroupRow.ranking_position} ·{" "}
                        {myGroupRow.total_points} pts
                      </p>
                    )}
                  </div>

                  <div className="divide-y divide-black/10">
                    {group.rows.map((row) => {
                      const isMe = row.user_id === userId;

                      return (
                        <div
                          key={`${row.group_id}-${row.user_id}`}
                          className={`flex items-center justify-between p-5 ${
                            isMe ? "bg-[#9F1D16]/10" : ""
                          }`}
                        >
                          <div>
                            <p className="text-lg font-bold">
                              #{row.ranking_position} {row.display_name}
                              {isMe && (
                                <span className="ml-2 rounded-full bg-[#9F1D16] px-2 py-1 text-xs text-[#F5F1E8]">
                                  Tú
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="text-2xl font-black text-[#D8B45A]">
                            {row.total_points}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {groupRows.length === 0 && (
              <div className="rounded-none border border-black/10 bg-[#F8F3EA] p-8 text-center">
                Aún no tienes grupos.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}