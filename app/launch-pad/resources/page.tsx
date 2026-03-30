import fs from "fs"
import path from "path"
import Link from "next/link"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/PageHeader"

type ResourceSection = {
  key:
    | "funding-resources"
    | "growth-playbooks"
    | "startup-frameworks"
    | "team-building"
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
  "business-model-template":
    "A comprehensive canvas to map out your business model, including value propositions, customer segments, revenue streams, and key activities.",
  "lean-startup-canvas-example":
    "Real-world example of a completed Lean Startup Canvas showing how successful startups validated their business hypotheses.",
  "lean-startup-canvas-template":
    "Strategic one-page template to identify problems, solutions, key metrics, and value propositions for rapid iteration and validation.",
  "mvp-planning-template":
    "Step-by-step guide to define, build, and launch your Minimum Viable Product with minimal waste and maximum learning.",
  "startup-validation":
    "Proven frameworks and methodologies to validate your startup idea before investing significant time and resources.",
  "due-diligence-checklist":
    "Complete checklist for investor due diligence covering legal, financial, technical, and operational aspects of your startup.",
  "entrepreneuria-financial-model":
    "AI-assisted financial projection template with built-in formulas for revenue forecasting, expense planning, and cash flow analysis.",
  "the-ultimate-pitch-deck-template-for-entrepreneurs":
    "Investor-ready pitch deck template with proven frameworks used by successful startups to raise seed rounds and Series A funding.",
  "founders-pmf-playbook":
    "Comprehensive playbook to achieve and measure Product-Market Fit, including customer discovery, retention metrics, and growth indicators.",
  "from-hustler-to-ceo-the-scaling-operations-playbook":
    "Operational frameworks and systems to transition from founder-led chaos to scalable, repeatable business processes.",
  "the-growth-hacking-toolkit":
    "Marketing tactics, automation frameworks, and growth loops to expand your reach and accelerate customer acquisition.",
  "culture-building-kit":
    "Core values worksheets, mission statement templates, and frameworks to build a thriving company culture from day one.",
  "entrepreneuria-remote-team-guide":
    "Best practices for building, managing, and scaling remote teams including communication tools, async workflows, and virtual collaboration.",
  "the-a-player-hiring-playbook":
    "Proven hiring frameworks to attract, interview, and retain top talent while avoiding costly hiring mistakes.",
}

const formatTitle = (str: string) =>
  str.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())

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
        description:
          resourceDescriptions[slug] ||
          "Valuable resource to help grow your business.",
        files: list.map((file) => ({
          label: file.split(".").pop()?.toUpperCase() || "",
          url: `/resources/${section.key}/${file}`,
        })),
      })),
    }
  })

return (
  <div className="relative isolate overflow-hidden bg-background text-white">
    <div className="pointer-events-none absolute inset-0 -z-10 opacity-40 [background-image:linear-gradient(rgba(0,212,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(210,122,44,0.15),transparent_45%),radial-gradient(circle_at_bottom,rgba(0,212,255,0.1),transparent_40%)]" />

      <section className="relative -mt-[calc(var(--header-height)+1rem)] flex min-h-[78vh] items-center justify-center overflow-hidden sm:min-h-[82vh]">
        <PageHeader
        title=""
        subtitle=""
        videoSrc="/videos/resources-hero.mp4"
        imageSrc="/images/home-fallback.jpg"
      />

        <div className="absolute inset-0 z-20 flex items-center justify-center px-4 sm:px-6">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00D4FF] sm:text-sm">
              THE LAUNCHPAD
            </p>

            <h1 className="mt-6 text-4xl font-bold leading-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
              Everything You Need to Build -
              <br />
              Without the Scramble
            </h1>

            <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg md:text-xl">
              Free, comprehensive resources organized so you can stop searching and start doing.
            </p>
          </div>
        </div>
      </section>

      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-5xl space-y-14">
          {sectionData.map((section) => (
            <article
              key={section.key}
              className="rounded-2xl border border-[#1a2942] bg-card/70 backdrop-blur-sm p-6 md:p-10"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d27a2c] md:text-sm">
                {section.eyebrow}
              </p>

              <h2 className="mt-3 text-2xl font-bold text-white md:text-3xl">
                {section.title}
              </h2>

              <p className="mt-4 max-w-3xl leading-7 text-white/90">
                {section.paragraph}
              </p>

              <div className="mt-7">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/80">
                  What&apos;s inside
                </h3>

                <ul className="mt-4 space-y-5">
                  {section.items.map((item) => (
                    <li key={item.slug} className="space-y-3">
                      <p className="leading-7 text-white">
                        <span className="font-semibold">{item.title}</span>
                        {": "}
                        {item.description}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {item.files.map((file) => (
                          <Button
                            key={`${item.slug}-${file.url}`}
                            variant="outline"
                            size="sm"
                            className="border-[#1a2942] text-white hover:bg-[#1a2942]/20 hover:text-white"
                            asChild
                          >
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

      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm text-white/80 md:text-base">
            More resources are added regularly. Bookmark this page and check
            back — the library keeps growing.
          </p>
        </div>
      </section>
    </div>
  )
}