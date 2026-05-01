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
  const [globalRows, setGlobalRows] = useState<GlobalRow[]>([]);
  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-white/70">Cargando rankings...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/10 bg-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              Quiniela Mundial
            </p>
            <h1 className="mt-1 text-2xl font-bold">Rankings</h1>
          </div>

          <a
            href="/"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
          >
            Volver
          </a>
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 p-6">
          <h2 className="text-3xl font-bold">Leaderboard</h2>
          <p className="mt-2 text-white/60">
            3 pts exacto · 1 pt resultado correcto · bonus especiales
          </p>
        </div>

        {myGlobalRow && (
          <div className="mb-8 rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-300">
              Tu posición global
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-5">
              <div>
                <p className="text-sm text-white/50">Ranking</p>
                <p className="text-3xl font-black">
                  #{myGlobalRow.ranking_position}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/50">Total</p>
                <p className="text-3xl font-black text-emerald-300">
                  {myGlobalRow.total_points}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/50">Partidos</p>
                <p className="text-3xl font-black">
                  {myGlobalRow.match_points}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/50">Bonus</p>
                <p className="text-3xl font-black text-cyan-300">
                  {myGlobalRow.bonus_points}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/50">Exactos</p>
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
            className={`rounded-2xl px-5 py-3 font-bold ${
              tab === "global" ? "bg-emerald-400 text-slate-950" : "bg-white/10"
            }`}
          >
            Global
          </button>

          <button
            onClick={() => setTab("groups")}
            className={`rounded-2xl px-5 py-3 font-bold ${
              tab === "groups" ? "bg-emerald-400 text-slate-950" : "bg-white/10"
            }`}
          >
            Mis grupos
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
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
                    className={`rounded-3xl border p-6 ${
                      isMe
                        ? "border-emerald-400/50 bg-emerald-400/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="mb-4 text-5xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </div>

                    <p className="text-sm text-white/50">
                      #{player.ranking_position}
                    </p>

                    <h3 className="mt-2 text-2xl font-bold">
                      {player.display_name}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-emerald-400 px-2 py-1 text-xs text-slate-950">
                          Tú
                        </span>
                      )}
                    </h3>

                    <p className="mt-4 text-4xl font-black text-emerald-300">
                      {player.total_points}
                    </p>

                    <p className="mt-2 text-sm text-white/50">
                      {player.match_points} partidos · {player.bonus_points} bonus
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 p-5">
                <h3 className="text-xl font-bold">Tabla general</h3>
              </div>

              <div className="divide-y divide-white/5">
                {globalRows.map((row) => {
                  const isMe = row.user_id === userId;

                  return (
                    <div
                      key={row.user_id}
                      className={`flex items-center justify-between gap-4 p-5 ${
                        isMe ? "bg-emerald-400/10" : ""
                      }`}
                    >
                      <div>
                        <p className="font-bold">
                          #{row.ranking_position} {row.display_name}
                          {isMe && (
                            <span className="ml-2 rounded-full bg-emerald-400 px-2 py-1 text-xs text-slate-950">
                              Tú
                            </span>
                          )}
                        </p>

                        <p className="mt-1 text-xs text-white/45">
                          {row.exact_hits} exactos · {row.correct_outcomes} aciertos
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-black text-emerald-300">
                          {row.total_points}
                        </p>

                        <p className="mt-1 text-xs text-white/45">
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
            {Object.entries(groupedByGroup).map(([groupId, group]) => {
              const myGroupRow = group.rows.find((r) => r.user_id === userId);

              return (
                <div
                  key={groupId}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/5"
                >
                  <div className="border-b border-white/10 p-5">
                    <h3 className="text-2xl font-bold">{group.name}</h3>

                    {myGroupRow && (
                      <p className="mt-2 text-sm text-emerald-300">
                        Tu posición: #{myGroupRow.ranking_position} ·{" "}
                        {myGroupRow.total_points} pts
                      </p>
                    )}
                  </div>

                  <div className="divide-y divide-white/5">
                    {group.rows.map((row) => {
                      const isMe = row.user_id === userId;

                      return (
                        <div
                          key={`${row.group_id}-${row.user_id}`}
                          className={`flex items-center justify-between p-5 ${
                            isMe ? "bg-emerald-400/10" : ""
                          }`}
                        >
                          <div>
                            <p className="text-lg font-bold">
                              #{row.ranking_position} {row.display_name}
                              {isMe && (
                                <span className="ml-2 rounded-full bg-emerald-400 px-2 py-1 text-xs text-slate-950">
                                  Tú
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="text-2xl font-black text-emerald-300">
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
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                Aún no tienes grupos.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}