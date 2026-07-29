import * as React from "react";
import { Link } from "@tanstack/react-router";

function useClock() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const MANIFEST = [
  "Cardápio",
  "Pedidos",
  "Salão",
  "Cozinha",
  "Delivery",
  "Relatórios",
  "Multi-loja",
];

export function ComingSoon() {
  const now = useClock();
  const time = now
    ? now.toLocaleTimeString("pt-BR", { hour12: false })
    : "--:--:--";
  const date = now
    ? now
        .toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
        .replace(/^\w/, (c) => c.toUpperCase())
    : "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-[#e9e4d8] antialiased">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
      />

      {/* Deep gradient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 60% at 50% 0%, rgba(201,168,106,0.10), transparent 55%), radial-gradient(70% 50% at 100% 100%, rgba(120,70,30,0.10), transparent 60%), radial-gradient(60% 45% at 0% 90%, rgba(60,60,80,0.12), transparent 60%)",
        }}
      />
      {/* Slow drifting light */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="drift absolute -top-40 left-1/2 h-[70vh] w-[70vh] -translate-x-1/2 rounded-full opacity-[0.35] blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(201,168,106,0.22), transparent 60%)" }}
        />
      </div>
      {/* Grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* Fine grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(233,228,216,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(233,228,216,0.7) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage:
            "radial-gradient(ellipse at 50% 40%, black 40%, transparent 75%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1280px] flex-col px-6 sm:px-10">
        {/* Header */}
        <header className="flex items-center justify-between pt-8 text-[11px] uppercase tracking-[0.28em] text-[#e9e4d8]/55">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-[#e9e4d8]/25">
              <span
                className="text-[15px] leading-none text-[#e9e4d8]"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                M
              </span>
            </span>
            <span className="text-[#e9e4d8]/80">MenuAtlas</span>
          </div>
          <div className="hidden items-center gap-8 sm:flex">
            <span>São Paulo · BR</span>
            <span className="tabular-nums text-[#e9e4d8]/70">{time}</span>
          </div>
        </header>

        <div className="mt-8 h-px w-full bg-gradient-to-r from-transparent via-[#e9e4d8]/15 to-transparent" />

        {/* Center stage */}
        <main className="flex flex-1 flex-col justify-center py-16">
          <div className="mx-auto max-w-[980px] text-center">

            <h1
              className="fade-up mt-8 text-balance text-[clamp(3.25rem,11vw,9.5rem)] font-normal leading-[0.9] tracking-[-0.025em]"
              style={{ fontFamily: "'Instrument Serif', serif", animationDelay: "80ms" }}
            >
              <span className="shine bg-clip-text text-transparent">
                MenuAtlas
              </span>
              <br />
              <em className="text-[#e9e4d8]/70">está a caminho.</em>
            </h1>

            <p
              className="fade-up mx-auto mt-8 max-w-[560px] text-[15px] leading-[1.75] text-[#e9e4d8]/60"
              style={{ animationDelay: "180ms" }}
            >
              A nova plataforma para restaurantes que tratam serviço como
              detalhe — cardápio, pedidos e operação, em uma só camada.
            </p>

            {/* meta line */}
            <div
              className="fade-up mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-[10.5px] uppercase tracking-[0.3em] text-[#e9e4d8]/45"
              style={{ animationDelay: "280ms" }}
            >
              <span>Vol. 01</span>
              <span className="h-px w-8 bg-[#e9e4d8]/25" />
              <span>Lançamento 2026</span>
              <span className="h-px w-8 bg-[#e9e4d8]/25" />
              <span className="tabular-nums">{date || "—"}</span>
            </div>
          </div>

          {/* Marquee */}
          <div className="fade-up mt-24 overflow-hidden border-y border-[#e9e4d8]/10 py-5" style={{ animationDelay: "380ms" }}>
            <div className="marquee flex min-w-max gap-14 text-[13px] uppercase tracking-[0.35em] text-[#e9e4d8]/40">
              {[...MANIFEST, ...MANIFEST, ...MANIFEST].map((w, i) => (
                <span key={i} className="flex items-center gap-14">
                  <span
                    className="text-[#c9a86a]/80"
                    style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}
                  >
                    {w}
                  </span>
                  <span aria-hidden className="text-[#e9e4d8]/20">✦</span>
                </span>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-4 py-8 text-[10.5px] uppercase tracking-[0.28em] text-[#e9e4d8]/40">
          <span>© {new Date().getFullYear()} MenuAtlas</span>
          <div className="flex items-center gap-6">
            <Link to="/termos" className="transition-colors hover:text-[#e9e4d8]/80">Termos</Link>
            <Link to="/privacidade" className="transition-colors hover:text-[#e9e4d8]/80">Privacidade</Link>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { opacity: 0; animation: fadeUp 1000ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }

        @keyframes shine {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .shine {
          background-image: linear-gradient(100deg, #e9e4d8 0%, #e9e4d8 40%, #c9a86a 50%, #e9e4d8 60%, #e9e4d8 100%);
          background-size: 200% 100%;
          animation: shine 9s linear infinite;
        }

        @keyframes drift {
          0%,100% { transform: translate(-50%, 0) scale(1); }
          50%     { transform: translate(-46%, 6%) scale(1.08); }
        }
        .drift { animation: drift 14s ease-in-out infinite; }

        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-33.333%); }
        }
        .marquee { animation: marquee 38s linear infinite; }
      `}</style>
    </div>
  );
}
