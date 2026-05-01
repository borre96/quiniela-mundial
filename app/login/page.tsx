"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Journey = "login" | "code";
type AccessScope = "group_invite" | "global" | "group_creator";
type CodeStep = "enter_code" | "create_user" | "creator_group" | "creator_success";

type AccessCodeData = {
  code: string;
  access_scope: AccessScope;
  group_id: string | null;
  group_name: string | null;
  used: boolean;
};

const ACCESS_COPY: Record<
  AccessScope,
  {
    eyebrow: string;
    title: string;
    description: string;
    cta: string;
  }
> = {
  group_invite: {
    eyebrow: "INVITACIÓN",
    title: "Fuiste invitado a:",
    description: "Crea tu usuario y empieza tu quiniela dentro de este grupo.",
    cta: "Crear mi quiniela",
  },
  global: {
    eyebrow: "LA FIESTA DE TODOS",
    title: "Te estás uniendo a:",
    description: "Crea tu usuario para unirte a La Tanda.",
    cta: "Unirme a La Tanda",
  },
  group_creator: {
    eyebrow: "CREADOR",
    title: "Vas a crear:",
    description:
      "Primero crea tu usuario. Después vas a nombrar tu Tanda privada y recibir tu código para invitar a tu banda.",
    cta: "Crear mi usuario",
  },
};

function generateInviteCode() {
  return `TANDA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;

  if (typeof err === "object" && err !== null) {
    const possibleError = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    return (
      possibleError.message ||
      possibleError.details ||
      possibleError.hint ||
      possibleError.code ||
      JSON.stringify(possibleError)
    );
  }

  return "Ocurrió un error inesperado.";
}

export default function LoginPage() {
  const [journey, setJourney] = useState<Journey>("login");
  const [codeStep, setCodeStep] = useState<CodeStep>("enter_code");

  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [accessCodeData, setAccessCodeData] = useState<AccessCodeData | null>(
    null
  );

  const [fullName, setFullName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [creatorUserId, setCreatorUserId] = useState<string | null>(null);
  const [createdInviteCode, setCreatedInviteCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const cleanEmail = email.trim().toLowerCase();
  const cleanAccessCode = accessCodeInput.trim().toUpperCase();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");

    if (mode === "code") setJourney("code");
    if (mode === "login") setJourney("login");
  }, []);

  const destinationLabel = useMemo(() => {
    if (!accessCodeData) return "";

    if (accessCodeData.access_scope === "group_invite") {
      return accessCodeData.group_name || "Grupo privado";
    }

    if (accessCodeData.access_scope === "global") {
      return "La Tanda";
    }

    return "Tu propia Tanda";
  }, [accessCodeData]);

  function switchJourney(nextJourney: Journey) {
    setJourney(nextJourney);
    setCodeStep("enter_code");
    setAccessCodeData(null);
    setAccessCodeInput("");
    setFullName("");
    setGroupName("");
    setEmail("");
    setPassword("");
    setCreatorUserId(null);
    setCreatedInviteCode("");
    setMessage("");
  }

  async function ensureProfile(userId: string) {
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      email: cleanEmail,
      full_name: fullName.trim(),
      role: "user",
    });

    if (error) throw error;
  }

  async function validateAccessCode() {
    setMessage("");

    if (!cleanAccessCode) {
      setMessage("Escribe tu código para entrar a La Tanda.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("access_codes")
      .select("code, access_scope, group_id, group_name, used")
      .eq("code", cleanAccessCode)
      .maybeSingle();

    setLoading(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    if (!data) {
      setMessage("Ese código no existe. Revísalo e intenta de nuevo.");
      return;
    }

    if (data.used && data.access_scope !== "group_invite") {
      setMessage("Ese código ya fue usado.");
      return;
    }

    if (
      !["group_invite", "global", "group_creator"].includes(data.access_scope)
    ) {
      setMessage("Ese código no tiene un tipo de acceso válido.");
      return;
    }

    setAccessCodeData(data as AccessCodeData);
    setCodeStep("create_user");
  }

  async function completeGlobalAccess(userId: string) {
    if (!accessCodeData) throw new Error("No hay código validado.");

    const { error } = await supabase.from("global_participants").upsert({
      user_id: userId,
      access_code: accessCodeData.code,
    });

    if (error) throw error;

    const { error: codeError } = await supabase
      .from("access_codes")
      .update({
        used: true,
        used_at: new Date().toISOString(),
        user_id: userId,
      })
      .eq("code", accessCodeData.code);

    if (codeError) throw codeError;
  }

  async function completeInviteAccess(userId: string) {
    if (!accessCodeData) throw new Error("No hay código validado.");

    if (!accessCodeData.group_id) {
      throw new Error("Este código no tiene grupo asignado.");
    }

    const { error } = await supabase.from("group_members").upsert({
      group_id: accessCodeData.group_id,
      user_id: userId,
      role: "member",
    });

    if (error) throw error;
  }

  async function handleLogin() {
    setMessage("");

    if (!cleanEmail || !password) {
      setMessage("Escribe correo y contraseña.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    window.location.href = "/quiniela";
  }

  async function handleCreateUserWithCode() {
    setMessage("");

    if (!accessCodeData) {
      setMessage("Primero valida tu código.");
      return;
    }

    if (!fullName.trim() || !cleanEmail || !password) {
      setMessage("Completa nombre, correo y contraseña.");
      return;
    }

    if (password.length < 6) {
      setMessage("La contraseña debe tener mínimo 6 caracteres.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      setLoading(false);
      setMessage(`Error: ${error.message}`);
      return;
    }

    if (!data.user) {
      setLoading(false);
      setMessage("Cuenta creada. Revisa tu correo para confirmar el acceso.");
      return;
    }

    try {
      await ensureProfile(data.user.id);

      if (accessCodeData.access_scope === "global") {
        await completeGlobalAccess(data.user.id);
        setLoading(false);
        window.location.href = "/quiniela";
        return;
      }

      if (accessCodeData.access_scope === "group_invite") {
        await completeInviteAccess(data.user.id);
        setLoading(false);
        window.location.href = "/quiniela";
        return;
      }

      if (accessCodeData.access_scope === "group_creator") {
        setCreatorUserId(data.user.id);
        setCodeStep("creator_group");
        setLoading(false);
        return;
      }
    } catch (err) {
      setLoading(false);
      setMessage(getErrorMessage(err) || "No se pudo activar tu código.");
    }
  }

  async function handleCreatePrivateGroup() {
    setMessage("");

    if (!accessCodeData) {
      setMessage("Primero valida tu código.");
      return;
    }

    if (!creatorUserId) {
      setMessage("No encontramos tu usuario. Intenta iniciar sesión.");
      return;
    }

    if (!groupName.trim()) {
      setMessage("Ponle nombre a tu Tanda.");
      return;
    }

    setLoading(true);

    const inviteCode = generateInviteCode();

    try {
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: groupName.trim(),
          created_by: creatorUserId,
          created_by_user_id: creatorUserId,
          invite_code: inviteCode,
          is_private: true,
          max_members: 100,
        })
        .select("id")
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: creatorUserId,
          role: "owner",
        });

      if (memberError) throw memberError;

      const { error: inviteCodeError } = await supabase
        .from("access_codes")
        .insert({
          code: inviteCode,
          access_scope: "group_invite",
          group_id: group.id,
          group_name: groupName.trim(),
          used: false,
        });

      if (inviteCodeError) throw inviteCodeError;

      const { error: creatorCodeError } = await supabase
        .from("access_codes")
        .update({
          used: true,
          used_at: new Date().toISOString(),
          user_id: creatorUserId,
          group_id: group.id,
          group_name: groupName.trim(),
        })
        .eq("code", accessCodeData.code);

      if (creatorCodeError) throw creatorCodeError;

      setCreatedInviteCode(inviteCode);
      setCodeStep("creator_success");
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setMessage(getErrorMessage(err) || "No se pudo crear tu Tanda.");
    }
  }

  async function copyInviteCode() {
    if (!createdInviteCode) return;

    await navigator.clipboard.writeText(createdInviteCode);
    setMessage("Código copiado. Compártelo solo con tu banda.");
  }

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#111111]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden bg-[#111111] p-8 text-[#F5F1E8] lg:min-h-screen lg:p-12">
          <Link href="/" className="relative z-10 inline-flex w-fit">
            <img
              src="/brand/logo-extendido-header.png"
              alt="LA TANDA"
              className="h-[96px] w-auto object-contain md:h-[112px]"
            />
          </Link>

          <div className="relative z-10">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#D8B45A]">
              Quiniela Mundial 2026
            </p>

            <h1 className="mt-8 max-w-xl text-5xl font-black uppercase leading-[0.95] tracking-[-0.04em] md:text-7xl">
              {journey === "login" ? (
                <>
                  Ya eres
                  <br />
                  de la banda
                </>
              ) : codeStep === "creator_group" ? (
                <>
                  Nombra
                  <br />
                  tu Tanda
                </>
              ) : codeStep === "creator_success" ? (
                <>
                  Tanda
                  <br />
                  lista
                </>
              ) : (
                <>
                  Activa
                  <br />
                  tu código
                </>
              )}
            </h1>

            <p className="mt-6 max-w-md text-lg font-semibold text-[#F5F1E8]/80">
              {journey === "login"
                ? "Entra con tu correo y contraseña para seguir llenando tu quiniela."
                : codeStep === "creator_group"
                  ? "Ahora crea tu grupo privado. Ese será el espacio de tu banda."
                  : codeStep === "creator_success"
                    ? "Comparte tu código solo con quienes quieras dentro de tu Tanda privada."
                    : "Tu código define si creas una Tanda, te unes a un grupo o compites en La Tanda."}
            </p>
          </div>

          <div className="relative z-10 mt-12 grid max-w-xl gap-3 text-sm font-bold uppercase tracking-[0.12em] text-[#F5F1E8]/75 sm:grid-cols-3">
            <div className="border-t border-[#F5F1E8]/20 pt-3">Código</div>
            <div className="border-t border-[#F5F1E8]/20 pt-3">Quiniela</div>
            <div className="border-t border-[#F5F1E8]/20 pt-3">Competencia</div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9F1D16]">
                Acceso
              </p>

              <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.03em]">
                {journey === "login"
                  ? "Iniciar sesión"
                  : codeStep === "enter_code"
                    ? "Tengo código"
                    : codeStep === "create_user"
                      ? "Crea tu usuario"
                      : codeStep === "creator_group"
                        ? "Crea tu Tanda"
                        : "Comparte tu código"}
              </h2>

              <p className="mt-2 text-sm font-medium text-[#6F6A61]">
                {journey === "login"
                  ? "Para quienes ya tienen quiniela creada."
                  : codeStep === "enter_code"
                    ? "Ingresa tu código para activar tu lugar."
                    : codeStep === "create_user"
                      ? "Tus datos crean tu cuenta y tu quiniela."
                      : codeStep === "creator_group"
                        ? "Este será el grupo privado de tu banda."
                        : "Este código es para invitar a tu grupo privado."}
              </p>
            </div>

            {codeStep !== "creator_success" && (
              <div className="mb-5 grid grid-cols-2 rounded-[22px] border border-black/15 bg-[#F8F3EA] p-1 shadow-[6px_6px_0_rgba(17,17,17,0.08)]">
                <button
                  type="button"
                  onClick={() => switchJourney("login")}
                  className={`rounded-[18px] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${
                    journey === "login"
                      ? "bg-[#111111] text-[#F5F1E8]"
                      : "text-[#6F6A61] hover:text-[#111111]"
                  }`}
                >
                  Ya soy de la banda
                </button>

                <button
                  type="button"
                  onClick={() => switchJourney("code")}
                  className={`rounded-[18px] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${
                    journey === "code"
                      ? "bg-[#9F1D16] text-[#F5F1E8]"
                      : "text-[#6F6A61] hover:text-[#111111]"
                  }`}
                >
                  Tengo código
                </button>
              </div>
            )}

            {journey === "login" && (
              <div className="rounded-[28px] border border-black/15 bg-[#F8F3EA] p-6 shadow-[8px_8px_0_rgba(17,17,17,0.10)]">
                <div className="mb-6 rounded-3xl border border-black/10 bg-[#F5F1E8] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9F1D16]">
                    LOGIN
                  </p>
                  <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.03em]">
                    Ya tengo quiniela
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-[#6F6A61]">
                    Entra con tu correo y contraseña. Aquí no necesitas código.
                  </p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#6F6A61]">
                      Correo
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="tu@email.com"
                      className="w-full rounded-2xl border border-black/15 bg-[#F5F1E8] px-4 py-3 text-sm font-semibold outline-none placeholder:text-[#6F6A61]/60 focus:border-[#9F1D16]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#6F6A61]">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Tu contraseña"
                      className="w-full rounded-2xl border border-black/15 bg-[#F5F1E8] px-4 py-3 text-sm font-semibold outline-none placeholder:text-[#6F6A61]/60 focus:border-[#9F1D16]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full rounded-2xl bg-[#111111] px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-[#F5F1E8] transition hover:bg-[#9F1D16] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Entrando..." : "Entrar a La Tanda"}
                  </button>

                  <button
                    type="button"
                    onClick={() => switchJourney("code")}
                    className="w-full text-center text-xs font-black uppercase tracking-[0.12em] text-[#9F1D16]"
                  >
                    Soy nuevo y tengo código
                  </button>
                </div>
              </div>
            )}

            {journey === "code" && (
              <div className="rounded-[32px] border border-[#D8B45A]/60 bg-[#111111] p-6 text-[#F5F1E8] shadow-[10px_10px_0_rgba(159,29,22,0.22)]">
                {codeStep === "enter_code" && (
                  <div className="space-y-5">
                    <div className="rounded-3xl border border-[#D8B45A]/30 bg-[#F5F1E8]/5 p-5">
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-[#D8B45A]">
                        Acceso exclusivo
                      </p>
                      <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.03em]">
                        Soy nuevo y tengo código
                      </h3>
                      <p className="mt-2 text-sm font-semibold text-[#F5F1E8]/70">
                        Primero validamos tu código. Después el sistema te dice
                        si vas a La Tanda, a un grupo o a crear tu privada.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#D8B45A]">
                        Código
                      </label>
                      <input
                        type="text"
                        value={accessCodeInput}
                        onChange={(event) =>
                          setAccessCodeInput(event.target.value)
                        }
                        placeholder="Ej. TANDA-AB12CD34"
                        className="w-full rounded-2xl border border-[#D8B45A]/50 bg-[#F5F1E8] px-4 py-4 text-center text-lg font-black uppercase tracking-[0.14em] text-[#111111] outline-none placeholder:text-sm placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-[#6F6A61]/60 focus:border-[#D8B45A]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={validateAccessCode}
                      disabled={loading}
                      className="w-full rounded-2xl border border-[#D8B45A]/70 bg-[#F5F1E8] px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-[#111111] transition hover:bg-[#D8B45A] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? "Validando..." : "Validar código"}
                    </button>

                    <button
                      type="button"
                      onClick={() => switchJourney("login")}
                      className="w-full text-center text-xs font-black uppercase tracking-[0.12em] text-[#D8B45A]"
                    >
                      Ya soy de la banda, iniciar sesión
                    </button>
                  </div>
                )}

                {codeStep === "create_user" && accessCodeData && (
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-[#D8B45A]/40 bg-[#F5F1E8] p-5 text-[#111111]">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9F1D16]">
                        {ACCESS_COPY[accessCodeData.access_scope].eyebrow}
                      </p>

                      <p className="mt-3 text-sm font-black uppercase tracking-[0.12em] text-[#6F6A61]">
                        {ACCESS_COPY[accessCodeData.access_scope].title}
                      </p>

                      <h3 className="mt-1 text-2xl font-black uppercase tracking-[-0.03em]">
                        {destinationLabel}
                      </h3>

                      <p className="mt-2 text-sm font-semibold text-[#6F6A61]">
                        {ACCESS_COPY[accessCodeData.access_scope].description}
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setCodeStep("enter_code");
                          setAccessCodeData(null);
                          setAccessCodeInput("");
                          setMessage("");
                        }}
                        className="mt-4 text-xs font-black uppercase tracking-[0.12em] text-[#9F1D16]"
                      >
                        Regresar al menú anterior
                      </button>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#D8B45A]">
                          Nombre
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          placeholder="Tu nombre"
                          className="w-full rounded-2xl border border-[#D8B45A]/40 bg-[#F5F1E8] px-4 py-3 text-sm font-semibold text-[#111111] outline-none placeholder:text-[#6F6A61]/60 focus:border-[#D8B45A]"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#D8B45A]">
                          Correo
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="tu@email.com"
                          className="w-full rounded-2xl border border-[#D8B45A]/40 bg-[#F5F1E8] px-4 py-3 text-sm font-semibold text-[#111111] outline-none placeholder:text-[#6F6A61]/60 focus:border-[#D8B45A]"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#D8B45A]">
                          Contraseña
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="mínimo 6 caracteres"
                          className="w-full rounded-2xl border border-[#D8B45A]/40 bg-[#F5F1E8] px-4 py-3 text-sm font-semibold text-[#111111] outline-none placeholder:text-[#6F6A61]/60 focus:border-[#D8B45A]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleCreateUserWithCode}
                        disabled={loading}
                        className="w-full rounded-2xl border border-[#D8B45A]/70 bg-[#F5F1E8] px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-[#111111] transition hover:bg-[#D8B45A] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading
                          ? "Creando..."
                          : ACCESS_COPY[accessCodeData.access_scope].cta}
                      </button>
                    </div>
                  </div>
                )}

                {codeStep === "creator_group" && accessCodeData && (
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-[#D8B45A]/40 bg-[#F5F1E8] p-5 text-[#111111]">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9F1D16]">
                        GRUPO PRIVADO
                      </p>

                      <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.03em]">
                        Ahora crea tu Tanda
                      </h3>

                      <p className="mt-2 text-sm font-semibold text-[#6F6A61]">
                        Ponle nombre a tu Tanda. Una vez terminado, recibirás un
                        código para invitar a tu banda.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#D8B45A]">
                        Nombre de tu Tanda
                      </label>
                      <input
                        type="text"
                        value={groupName}
                        onChange={(event) => setGroupName(event.target.value)}
                        placeholder="Ej. La Tanda del Chato"
                        className="w-full rounded-2xl border border-[#D8B45A]/40 bg-[#F5F1E8] px-4 py-4 text-sm font-semibold text-[#111111] outline-none placeholder:text-[#6F6A61]/60 focus:border-[#D8B45A]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleCreatePrivateGroup}
                      disabled={loading}
                      className="w-full rounded-2xl border border-[#D8B45A]/70 bg-[#F5F1E8] px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-[#111111] transition hover:bg-[#D8B45A] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? "Creando Tanda..." : "Crear mi Tanda privada"}
                    </button>
                  </div>
                )}

                {codeStep === "creator_success" && (
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-[#D8B45A]/40 bg-[#F5F1E8] p-5 text-[#111111]">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9F1D16]">
                        TU TANDA ESTÁ LISTA
                      </p>

                      <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.03em]">
                        {groupName}
                      </h3>

                      <p className="mt-2 text-sm font-semibold text-[#6F6A61]">
                        Comparte este código solo con la banda que quieras en tu
                        privada.
                      </p>
                    </div>

                    <div className="rounded-3xl border border-[#D8B45A]/50 bg-[#F5F1E8] p-5 text-center text-[#111111]">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9F1D16]">
                        Código para invitar
                      </p>

                      <p className="mt-3 break-all text-3xl font-black uppercase tracking-[0.08em]">
                        {createdInviteCode}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={copyInviteCode}
                      className="w-full rounded-2xl border border-[#D8B45A]/70 bg-[#F5F1E8] px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-[#111111] transition hover:bg-[#D8B45A]"
                    >
                      Copiar código
                    </button>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Link
                        href="/quiniela"
                        className="inline-flex items-center justify-center rounded-2xl bg-[#F5F1E8] px-4 py-4 text-center text-xs font-black uppercase tracking-[0.12em] text-[#111111] transition hover:bg-[#D8B45A]"
                      >
                        Crear mi quiniela
                      </Link>

                      <Link
                        href="/grupos"
                        className="inline-flex items-center justify-center rounded-2xl border border-[#D8B45A]/70 px-4 py-4 text-center text-xs font-black uppercase tracking-[0.12em] text-[#D8B45A] transition hover:bg-[#F5F1E8] hover:text-[#111111]"
                      >
                        Ver mi grupo
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {message && (
              <div className="mt-5 rounded-2xl border border-black/10 bg-[#F8F3EA] p-4 text-sm font-semibold text-[#111111] shadow-[5px_5px_0_rgba(17,17,17,0.08)]">
                {message}
              </div>
            )}

            <p className="mt-5 text-center text-xs font-semibold text-[#6F6A61]">
              Cada código es único.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}