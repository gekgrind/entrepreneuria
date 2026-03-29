const tools = [
  {
    name: "Business Model Blueprint",
    description: "[PASTE EACH TOOL DESCRIPTION EXACTLY]",
  },
  {
    name: "Market Analysis AI",
    description: "[PASTE EACH TOOL DESCRIPTION EXACTLY]",
  },
  {
    name: "Financial Projector",
    description: "[PASTE EACH TOOL DESCRIPTION EXACTLY]",
  },
  {
    name: "Customer Persona Builder",
    description: "[PASTE EACH TOOL DESCRIPTION EXACTLY]",
  },
  {
    name: "Pitch Deck Creator",
    description: "[PASTE EACH TOOL DESCRIPTION EXACTLY]",
  },
  {
    name: "Hiring Assistant",
    description: "[PASTE EACH TOOL DESCRIPTION EXACTLY]",
  },
]

export default function ToolsPage() {
  return (
    <main className="relative isolate overflow-hidden pt-24 pb-24 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00D4FF]/10 via-transparent to-[#d27a2c]/12" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(79,124,167,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(79,124,167,0.16)_1px,transparent_1px)] bg-[size:40px_40px] opacity-35" />
      </div>

      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold tracking-[0.22em] text-[#00D4FF] uppercase">THE LAUNCHPAD — AI TOOLS</p>
          <h1 className="mt-6 text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            Turn Your Ideas Into Action With Intelligent, Startup-Ready AI Systems
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/85 sm:text-xl">
            Six powerful tools built for founders who move fast and think bigger.
          </p>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl space-y-6 text-base leading-8 text-white/88 md:text-lg">
          <p>[PASTE INTRO COPY EXACTLY]</p>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold text-white md:text-4xl">Intelligent Tools for Modern Entrepreneurs</h2>
          <p className="mt-5 text-lg leading-8 text-white/80">
            Explore AI systems built to help you ideate, analyze, and grow faster — without needing a team behind you.
          </p>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-14 md:grid-cols-2">
          {tools.map((tool) => (
            <article key={tool.name} className="border-t border-white/20 pt-7">
              <h3 className="text-2xl font-semibold text-[#d27a2c]">{tool.name}</h3>
              <p className="mt-4 text-base leading-8 text-white/84">{tool.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24 pt-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-base text-white/60 md:text-lg">
            More tools are in development. The Entrepreneuria toolkit is constantly expanding.
          </p>
        </div>
      </section>
    </main>
  )
}
