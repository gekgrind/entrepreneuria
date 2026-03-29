import fs from "fs"
import path from "path"
import Link from "next/link"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

type ResourceSection = {
  key: "funding-resources" | "growth-playbooks" | "startup-frameworks" | "team-building"
  eyebrow: string
  title: string
  paragraph: string
}

const sectionOrder: ResourceSection[] = [
  {
    key: "funding-resources",
    eyebrow: "FUNDING RESOURCES",
    title: "Funding Resources",
    paragraph: "Project Your Startup's Revenue, Costs, and Growth",
  },
  {
    key: "growth-playbooks",
    eyebrow: "GROWTH PLAYBOOKS",
    title: "Growth Playbooks",
    paragraph: "Scrappy, Creative Tactics to Accelerate Growth",
  },
  {
    key: "startup-frameworks",
    eyebrow: "STARTUP FRAMEWORKS",
    title: "Startup Frameworks",
    paragraph: "A Strategic Template for Building Your Business Model",
  },
  {
    key: "team-building",
    eyebrow: "TEAM BUILDING",
    title: "Team Building",
    paragraph: "Build and Manage High-Performing Distributed Teams",
  },
]

const resourceDescriptions: Record<string, string> = {
  "business-model-template": "A comprehensive canvas to map out your business model, including value propositions, customer segments, revenue streams, and key activities.",
  "lean-startup-canvas-example": "Real-world example of a completed Lean Startup Canvas showing how successful startups validated their business hypotheses.",
  "lean-startup-canvas-template": "Strategic one-page template to identify problems, solutions, key metrics, and value propositions for rapid iteration and validation.",
  "mvp-planning-template": "Step-by-step guide to define, build, and launch your Minimum Viable Product with minimal waste and maximum learning.",
  "startup-validation": "Proven frameworks and methodologies to validate your startup idea before investing significant time and resources.",
  "due-diligence-checklist": "Complete checklist for investor due diligence covering legal, financial, technical, and operational aspects of your startup.",
  "entrepreneuria-financial-model": "AI-assisted financial projection template with built-in formulas for revenue forecasting, expense planning, and cash flow analysis.",
  "the-ultimate-pitch-deck-template-for-entrepreneurs": "Investor-ready pitch deck template with proven frameworks used by successful startups to raise seed rounds and Series A funding.",
  "founders-pmf-playbook": "Comprehensive playbook to achieve and measure Product-Market Fit, including customer discovery, retention metrics, and growth indicators.",
  "from-hustler-to-ceo-the-scaling-operations-playbook": "Operational frameworks and systems to transition from founder-led chaos to scalable, repeatable business processes.",
  "the-growth-hacking-toolkit": "Marketing tactics, automation frameworks, and growth loops to expand your reach and accelerate customer acquisition.",
  "culture-building-kit": "Core values worksheets, mission statement templates, and frameworks to build a thriving company culture from day one.",
  "entrepreneuria-remote-team-guide": "Best practices for building, managing, and scaling remote teams including communication tools, async workflows, and virtual collaboration.",
  "the-a-player-hiring-playbook": "Proven hiring frameworks to attract, interview, and retain top talent while avoiding costly hiring mistakes.",
}

const formatTitle = (str: string) =>
  str
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())

export default function ResourcesPage() {
  const basePath = path.join(process.cwd(), "public", "resources")

  const sectionData = sectionOrder.map((section) => {
    const folderPath = path.join(basePath, section.key)
    const files = fs.readdirSync(folderPath)

    const groupedFiles = files.reduce<Record<string, string[]>>((acc, file) => {
      const nameWithoutExtension = file.replace(/\.(pdf|docx|xlsx)$/i, "")
      if (!acc[nameWithoutExtension]) acc[nameWithoutExtension] = []
      acc[nameWithoutExtension].push(file)
      return acc
    }, {})

    return {
      ...section,
      items: Object.entries(groupedFiles).map(([slug, list]) => ({
        slug,
        title: formatTitle(slug),
        description: resourceDescriptions[slug] || "Valuable resource to help grow your business.",
        files: list.map((file) => ({
          label: file.split(".").pop()?.toUpperCase() || "",
          url: `/resources/${section.key}/${file}`,
        })),
      })),
    }
  })

  return (
    <div className="relative overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(0,212,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(210,122,44,0.15),transparent_45%),radial-gradient(circle_at_bottom,rgba(0,212,255,0.1),transparent_40%)]" />

      <section className="relative py-24 px-4">
        <div className="mx-auto max-w-4xl text-center space-y-6">
          <p className="text-xs md:text-sm tracking-[0.18em] font-semibold uppercase text-[#00D4FF]">THE LAUNCHPAD</p>
          <h1 className="text-4xl md:text-6xl font-bold text-accent-navy leading-tight">
            Everything You Need to Build — Without the Scramble
          </h1>
          <p className="text-base md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Free, comprehensive resources organized so you can stop searching and start doing.
          </p>
        </div>
      </section>

      <section className="relative py-20 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-base md:text-lg text-muted-foreground leading-8">
            Free, comprehensive resources organized so you can stop searching and start doing.
          </p>
        </div>
      </section>

      <section className="relative py-20 px-4">
        <div className="mx-auto max-w-5xl space-y-14">
          {sectionData.map((section) => (
            <article key={section.key} className="rounded-2xl border border-[#00D4FF]/20 bg-card/70 backdrop-blur-sm p-6 md:p-10">
              <p className="text-xs md:text-sm tracking-[0.14em] font-semibold uppercase text-[#d27a2c]">{section.eyebrow}</p>
              <h2 className="mt-3 text-2xl md:text-3xl font-bold text-accent-navy">{section.title}</h2>
              <p className="mt-4 text-muted-foreground leading-7 max-w-3xl">{section.paragraph}</p>

              <div className="mt-7">
                <h3 className="text-sm uppercase tracking-[0.12em] font-semibold text-accent-navy/80">What&apos;s inside</h3>
                <ul className="mt-4 space-y-5">
                  {section.items.map((item) => (
                    <li key={item.slug} className="space-y-3">
                      <p className="text-foreground leading-7">
                        <span className="font-semibold">{item.title}</span>
                        {": "}
                        {item.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.files.map((file) => (
                          <Button key={`${item.slug}-${file.url}`} variant="outline" size="sm" className="border-[#00D4FF]/35 text-accent-navy hover:bg-[#00D4FF]/10" asChild>
                            <Link href={file.url} download>
                              <Download className="mr-2 h-4 w-4" />
                              {file.label}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="relative py-20 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm md:text-base text-muted-foreground">
            More resources are added regularly. Bookmark this page and check back — the library keeps growing.
          </p>
        </div>
      </section>
    </div>
  )
}
