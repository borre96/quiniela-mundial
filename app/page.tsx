import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#111]">
      {/* HEADER */}
      <header className="fixed left-0 top-0 z-50 w-full border-b border-black/15 bg-[#F5F1E8]/95 shadow-[0_8px_24px_rgba(17,17,17,0.08)] backdrop-blur-md">
        <div className="mx-auto flex h-[88px] max-w-7xl items-center justify-between px-6 md:px-8">
          <Link href="/" aria-label="LA TANDA">
            <img
              src="/brand/logo-extendido-header.png"
              alt="LA TANDA"
              className="h-[72px] w-auto object-contain md:h-[84px]"
            />
          </Link>

          <div className="flex items-center gap-6">
            <p className="hidden text-xs font-black uppercase tracking-[0.22em] text-black/45 md:block">
              Ya tengo quiniela creada →
            </p>

            <Link
              href="/login"
              className="rounded-full border border-[#D8B45A]/60 bg-[#111] px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-[#F5F1E8] shadow-[0_10px_28px_rgba(17,17,17,0.18)] transition hover:-translate-y-0.5 hover:bg-[#9F1D16]"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-10 px-5 py-8 pt-[112px] md:grid-cols-[1.1fr_0.9fr] md:px-8 md:py-10 md:pt-[112px]">
        {/* IZQUIERDA */}
        <div className="mx-auto max-w-4xl text-center md:text-left">
          <p className="mb-4 text-[11px] font-black uppercase tracking-[0.26em] text-black/50">
            Solo por invitación
          </p>

          <h1 className="text-[3.2rem] font-black leading-[0.92] tracking-[-0.065em] sm:text-[4.5rem] md:text-[5.6rem] lg:text-[6.5rem] xl:text-[7rem]">
            <span className="relative inline-block whitespace-nowrap">
              Nuestro Mundial
              <span className="absolute -bottom-1 left-1 h-[5px] w-[96%] bg-[#9F1D16]" />
            </span>
            <br />
            <span className="relative inline-block whitespace-nowrap">
               Y Nuestra Banda
              <span className="absolute -bottom-1 left-1 h-[5px] w-[96%] bg-[#9F1D16]" />
            </span>
            <br />
            <span className="relative inline-block whitespace-nowrap">
              en...Nuestra Tanda
              <span className="absolute -bottom-1 left-1 h-[5px] w-[96%] bg-[#9F1D16]" />
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base font-semibold text-black/70 md:text-lg">
            Ingresa tu código de acceso
            <span className="mx-2 text-[#9F1D16]">→</span>
            Activa tu quiniela
            <span className="mx-2 text-[#9F1D16]">→</span>
            Compite en tu Tanda.
          </p>

          {/* CTA PREMIUM */}
         <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-start md:items-start">
            <Link
              href="/login"
              className="group inline-flex items-center justify-center gap-3 rounded-lg border border-[#D8B45A]/70 bg-[#111] px-8 py-4 text-sm font-black uppercase tracking-[0.15em] text-[#F5F1E8] shadow-[0_16px_40px_rgba(17,17,17,0.18)] transition hover:-translate-y-0.5 hover:bg-[#9F1D16]"
            >
              <span className="h-2 w-2 rounded-full bg-[#D8B45A] transition group-hover:bg-[#F5F1E8]" />
              Ya tengo código
            </Link>
          </div>

          <p className="mt-4 max-w-xl text-xs font-bold uppercase tracking-[0.16em] text-black/45">
            Tú código es único, hacer mal uso o compartirlo puede arruinar tu experiencia
          </p>
        </div>

        {/* DERECHA */}
        <aside className="relative mx-auto w-full max-w-md md:max-w-lg">
          {/* SELLO */}
          <div className="absolute -right-10 -top-14 z-10 hidden md:block">
            <Image
              src="/brand/Logo-Simple-Negro.png"
              alt="Sello LA TANDA"
              width={180}
              height={180}
              className="w-[180px]"
            />
          </div>

          {/* TARJETA */}
          <div className="border border-black/10 bg-[#F8F3EA] p-6 shadow-[0_24px_70px_rgba(17,17,17,0.10)]">
            <div className="mb-5 flex items-center justify-between border-b border-black/10 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-black/45">
                  Tanda privada
                </p>
                <h2 className="mt-1 text-3xl font-black uppercase tracking-[-0.05em]">
                  La Tabla
                </h2>
              </div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9F1D16]">
                Preview
              </p>
            </div>

            <div className="divide-y divide-black/10">
              {[
                ["01", "Chato", "32"],
                ["02", "Pepe", "28"],
                ["03", "Lucho", "25"],
                ["04", "Charlie", "21"],
              ].map(([pos, name, pts]) => (
                <div
                  key={pos}
                  className="grid grid-cols-[54px_1fr_64px] items-center py-4"
                >
                  <span className="text-3xl font-black tracking-[-0.06em]">
                    {pos}
                  </span>
                  <span className="font-black uppercase tracking-[-0.02em]">
                    {name}
                  </span>
                  <span className="text-right text-2xl font-black">{pts}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-black/10 pt-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-black/45">
                La tabla no miente.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}