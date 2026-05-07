"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type GroupRow = {
  group_id: string;
  group_name: string;
  invite_code: string;
  role: "owner" | "member";
  joined_at?: string;
  members_count: number;
};

type ActiveMode = "join" | "create";

type CreatedGroupModal = {
  groupName: string;
  inviteCode: string;
};

export default function GruposPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupName, setGroupName] = useState("");
  const [licenseCode, setLicenseCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeMode, setActiveMode] = useState<ActiveMode>("join");
  const [createdModal, setCreatedModal] = useState<CreatedGroupModal | null>(
    null
  );

  useEffect(() => {
    async function bootstrap() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        setMessage("Inicia sesión para ver tus Tandas.");
        return;
      }

      await loadGroups();
    }

    bootstrap();
  }, []);

  async function loadGroups() {
    setLoading(true);

    const { data, error } = await supabase.rpc("get_my_groups");

    if (error) {
      setMessage(error.message);
      setGroups([]);
      setLoading(false);
      return;
    }

    setGroups((data || []) as GroupRow[]);
    setLoading(false);
  }

  async function copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage("Código copiado.");
    } catch {
      setCopyMessage("No se pudo copiar.");
    }
  }

  async function createGroup() {
    setMessage("");
    setCopyMessage("");

    if (!groupName.trim()) {
      setMessage("Ponle nombre a tu Tanda.");
      return;
    }

    if (!licenseCode.trim()) {
      setMessage("Ingresa tu código de creación.");
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.rpc("create_group_with_license", {
      p_group_name: groupName.trim(),
      p_license_code: licenseCode.trim().toUpperCase(),
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    const created = Array.isArray(data) ? data[0] : null;

    setGroupName("");
    setLicenseCode("");

    if (created?.invite_code) {
      setCreatedModal({
        groupName: created.group_name,
        inviteCode: created.invite_code,
      });
    }

    setMessage("Tanda creada.");
    await loadGroups();
    setSubmitting(false);
  }

  async function joinGroup() {
    setMessage("");
    setCopyMessage("");

    if (!joinCode.trim()) {
      setMessage("Ingresa tu código de grupo.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.rpc("join_group_by_code", {
      p_invite_code: joinCode.trim().toUpperCase(),
    });

    if (error) {
      setMessage(error.message);
      setSubmitting(false);
      return;
    }

    setJoinCode("");
    setMessage("Listo. Ya estás dentro.");
    await loadGroups();
    setSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#111]">
      {createdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg border border-black/15 bg-[#F8F3EA] p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#9F1D16]">
              Tanda creada
            </p>

            <h2 className="mt-3 text-4xl font-black uppercase leading-none tracking-[-0.05em]">
              Comparte este código
            </h2>

            <p className="mt-4 text-sm font-semibold leading-6 text-black/60">
              Para entrar a{" "}
              <span className="font-black text-black">
                {createdModal.groupName}
              </span>
              , tu grupo necesita este código.
            </p>

            <div className="mt-6 border border-black/15 bg-[#F5F1E8] p-5 text-center">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-black/45">
                Código
              </p>

              <p className="mt-3 select-all text-5xl font-black tracking-[0.18em]">
                {createdModal.inviteCode}
              </p>
            </div>

            {copyMessage && (
              <p className="mt-3 text-center text-sm font-black text-[#9F1D16]">
                {copyMessage}
              </p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => copyToClipboard(createdModal.inviteCode)}
                className="bg-[#111] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-[#F5F1E8] transition hover:-translate-y-0.5"
              >
                Copiar código
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreatedModal(null);
                  setCopyMessage("");
                }}
                className="border border-black/25 px-5 py-4 text-sm font-black uppercase tracking-[0.14em] transition hover:bg-white/60"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-black/10">
        <div className="mx-auto flex h-[88px] max-w-7xl items-center justify-between px-6 md:px-8">
          <Link href="/" aria-label="LA TANDA">
            <img
              src="/brand/logo-extendido-header.png"
              alt="LA TANDA"
              className="h-[72px] w-auto object-contain md:h-[84px]"
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/rankings"
              className="border border-black/20 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition hover:bg-white/60"
            >
              La Tabla
            </Link>

            <Link
              href="/quiniela"
              className="bg-[#111] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#F5F1E8] transition hover:-translate-y-0.5"
            >
              Quiniela
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-10">
        <section className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-black/45">
              Grupos privados
            </p>

            <h1 className="mt-4 text-5xl font-black uppercase leading-[0.94] tracking-[-0.06em] md:text-7xl">
              Tus Tandas
              <br />
              del Mundial.
            </h1>

            <p className="mt-7 max-w-xl text-base font-semibold leading-relaxed text-black/60">
              Entra con código, crea un grupo privado o continúa jugando en una
              Tanda existente.
            </p>

            {message && (
              <div className="mt-6 border border-black/15 bg-[#F8F3EA] px-5 py-4 text-sm font-black text-[#9F1D16]">
                {message}
              </div>
            )}
          </div>

          <section className="border border-black/10 bg-[#F8F3EA] p-5 shadow-[0_24px_70px_rgba(17,17,17,0.08)] md:p-6">
            <div className="grid gap-2 border border-black/10 bg-[#F5F1E8] p-1 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setActiveMode("join");
                  setMessage("");
                }}
                className={`px-4 py-4 text-sm font-black uppercase tracking-[0.14em] transition ${
                  activeMode === "join"
                    ? "bg-[#111] text-[#F5F1E8]"
                    : "text-black/55 hover:bg-white/60"
                }`}
              >
                Tengo código
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMode("create");
                  setMessage("");
                }}
                className={`px-4 py-4 text-sm font-black uppercase tracking-[0.14em] transition ${
                  activeMode === "create"
                    ? "bg-[#111] text-[#F5F1E8]"
                    : "text-black/55 hover:bg-white/60"
                }`}
              >
                Crear Tanda
              </button>
            </div>

            {activeMode === "join" && (
              <div className="mt-8">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9F1D16]">
                  Entrar
                </p>

                <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em]">
                  Usa tu código
                </h2>

                <p className="mt-3 text-sm font-semibold leading-6 text-black/55">
                  Si ya te invitaron, pega aquí el código de tu grupo.
                </p>

                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Código de grupo"
                  className="mt-6 w-full border border-black/15 bg-[#F5F1E8] px-4 py-4 text-lg font-black uppercase tracking-[0.14em] outline-none placeholder:text-black/30 focus:border-black"
                />

                <button
                  onClick={joinGroup}
                  disabled={submitting}
                  className="mt-4 w-full bg-[#111] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-[#F5F1E8] transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {submitting ? "Entrando..." : "Entrar a mi Tanda"}
                </button>
              </div>
            )}

            {activeMode === "create" && (
              <div className="mt-8">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9F1D16]">
                  Crear
                </p>

                <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em]">
                  Abre tu Tanda
                </h2>

                <p className="mt-3 text-sm font-semibold leading-6 text-black/55">
                  Ponle nombre al grupo y usa tu código de creación.
                </p>

                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nombre de tu Tanda"
                  className="mt-6 w-full border border-black/15 bg-[#F5F1E8] px-4 py-4 text-base font-bold outline-none placeholder:text-black/30 focus:border-black"
                />

                <input
                  value={licenseCode}
                  onChange={(e) => setLicenseCode(e.target.value)}
                  placeholder="Código de creación"
                  className="mt-4 w-full border border-black/15 bg-[#F5F1E8] px-4 py-4 text-base font-black uppercase tracking-[0.14em] outline-none placeholder:text-black/30 focus:border-black"
                />

                <button
                  onClick={createGroup}
                  disabled={submitting}
                  className="mt-4 w-full bg-[#111] px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-[#F5F1E8] transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {submitting ? "Creando..." : "Crear mi Tanda"}
                </button>
              </div>
            )}
          </section>
        </section>

        <section className="mt-10 border border-black/10 bg-[#F8F3EA] p-5 md:p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/45">
                Mis Tandas
              </p>

              <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em]">
                {loading
                  ? "Cargando..."
                  : `${groups.length} grupo${groups.length === 1 ? "" : "s"}`}
              </h2>
            </div>

            <button
              onClick={loadGroups}
              className="border border-black/20 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition hover:bg-white/60"
            >
              Actualizar
            </button>
          </div>

          {!loading && groups.length === 0 && (
            <div className="border border-dashed border-black/20 p-8 text-center text-sm font-semibold text-black/45">
              Aún no estás en ninguna Tanda.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map((group) => (
              <article
                key={group.group_id}
                className="border border-black/10 bg-[#F5F1E8] p-5 transition hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(17,17,17,0.10)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9F1D16]">
                      {group.role === "owner" ? "Organizador" : "Participante"}
                    </p>

                    <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.04em] md:text-3xl">
                      {group.group_name}
                    </h3>
                  </div>

                  <span className="shrink-0 border border-black/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/45">
                    {group.members_count} miembro{group.members_count === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                  <Link
                    href={`/rankings?groupId=${group.group_id}`}
                    className="flex min-h-[72px] items-center justify-center bg-[#111] px-5 py-5 text-center text-sm font-black uppercase tracking-[0.16em] text-[#F5F1E8] shadow-[0_14px_34px_rgba(17,17,17,0.14)] transition hover:-translate-y-0.5 hover:bg-[#9F1D16]"
                  >
                    Ver La Tabla
                  </Link>

                  <Link
                    href={`/quiniela?groupId=${group.group_id}`}
                    className="flex min-h-[72px] items-center justify-center border border-black/25 px-5 py-5 text-center text-sm font-black uppercase tracking-[0.14em] transition hover:bg-white/60"
                  >
                    Ajustar quiniela
                  </Link>
                </div>

                {group.role === "owner" && (
                  <div className="mt-5 border-t border-black/10 pt-4">
                    <div className="flex flex-col gap-3 text-black/45 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em]">
                          Código para invitar
                        </p>

                        <p className="mt-1 select-all text-sm font-black uppercase tracking-[0.16em] text-black/60">
                          {group.invite_code}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(group.invite_code)}
                        className="self-start border border-black/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-black/55 transition hover:border-black/30 hover:bg-white/60 sm:self-auto"
                      >
                        Copiar código
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
