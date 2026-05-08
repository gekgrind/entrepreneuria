import { AppGrid } from "@/components/command-center/apps/AppGrid";
import { ClickSpark } from "@/components/ui/click-spark";
import { HoverGlowCard } from "@/components/ui/hover-glow-card";

export function CommandCenterShell() {
  return (
    <main className="command-center-blueprint min-h-screen text-white">
      <ClickSpark />
      <div className="mx-auto grid min-h-screen max-w-[1900px] gap-8 px-5 py-10 sm:px-8 sm:py-14 xl:grid-cols-[minmax(0,1fr)_340px]">
        <AppGrid />

        <aside className="grid gap-6 md:grid-cols-3 xl:block xl:space-y-6">
          <HoverGlowCard className="rounded-[28px] border border-cyan-300/25 bg-[#07172c]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <h3 className="text-xl font-bold">Business Health Score</h3>
            <div className="mt-8 flex items-center gap-6">
              <div className="flex aspect-square h-28 w-28 shrink-0 items-center justify-center rounded-full border-[10px] border-cyan-300/80 bg-cyan-300/5 text-3xl font-bold shadow-[0_0_40px_rgba(0,212,255,0.18)]">
                82
              </div>
              <div>
                <p className="font-semibold text-emerald-300">
                  +5 from last week
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Your business is performing well. Focus on the actions below.
                </p>
              </div>
            </div>
          </HoverGlowCard>

          <HoverGlowCard className="rounded-[28px] border border-cyan-300/25 bg-[#07172c]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <h3 className="text-xl font-bold">AI Activity</h3>
            <div className="mt-6 space-y-5 text-sm text-slate-300">
              <p>
                <span className="font-semibold text-white">Prospra</span> is
                analyzing new growth opportunities.
              </p>
              <p>
                <span className="font-semibold text-white">Architecta</span>{" "}
                completed a strategy report.
              </p>
              <p>
                <span className="font-semibold text-white">Synceri</span> is
                queued for CRM sync.
              </p>
            </div>
          </HoverGlowCard>

          <HoverGlowCard className="rounded-[28px] border border-cyan-300/25 bg-[#07172c]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <h3 className="text-xl font-bold">Quick Actions</h3>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {[
                "Generate Content",
                "Analyze Website",
                "Start Strategy",
                "Quick Automation",
              ].map((action) => (
                <button
                  key={action}
                  className="rounded-2xl border border-cyan-300/10 bg-white/[0.045] p-5 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:bg-cyan-300/10 hover:text-white"
                >
                  {action}
                </button>
              ))}
            </div>
          </HoverGlowCard>
        </aside>
      </div>
    </main>
  );
}
