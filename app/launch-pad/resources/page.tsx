import fs from "fs"
import path from "path"
import Image from "next/image"
import Link from "next/link"
import PageHeader from "@/components/PageHeader"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// Convert folder-name → Title Case
function formatTitle(str: string) {
  return str
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Resource descriptions mapping
const resourceDescriptions: Record<string, string> = {
  // Startup Frameworks
  "business-model-template": "A comprehensive canvas to map out your business model, including value propositions, customer segments, revenue streams, and key activities.",
  "lean-startup-canvas-example": "Real-world example of a completed Lean Startup Canvas showing how successful startups validated their business hypotheses.",
  "lean-startup-canvas-template": "Strategic one-page template to identify problems, solutions, key metrics, and value propositions for rapid iteration and validation.",
  "mvp-planning-template": "Step-by-step guide to define, build, and launch your Minimum Viable Product with minimal waste and maximum learning.",
  "startup-validation": "Proven frameworks and methodologies to validate your startup idea before investing significant time and resources.",

  // Funding Resources
  "due-diligence-checklist": "Complete checklist for investor due diligence covering legal, financial, technical, and operational aspects of your startup.",
  "entrepreneuria-financial-model": "AI-assisted financial projection template with built-in formulas for revenue forecasting, expense planning, and cash flow analysis.",
  "the-ultimate-pitch-deck-template-for-entrepreneurs": "Investor-ready pitch deck template with proven frameworks used by successful startups to raise seed rounds and Series A funding.",

  // Growth Playbooks
  "founders-pmf-playbook": "Comprehensive playbook to achieve and measure Product-Market Fit, including customer discovery, retention metrics, and growth indicators.",
  "from-hustler-to-ceo-the-scaling-operations-playbook": "Operational frameworks and systems to transition from founder-led chaos to scalable, repeatable business processes.",
  "the-growth-hacking-toolkit": "Marketing tactics, automation frameworks, and growth loops to expand your reach and accelerate customer acquisition.",

  // Team Building
  "culture-building-kit": "Core values worksheets, mission statement templates, and frameworks to build a thriving company culture from day one.",
  "entrepreneuria-remote-team-guide": "Best practices for building, managing, and scaling remote teams including communication tools, async workflows, and virtual collaboration.",
  "the-a-player-hiring-playbook": "Proven hiring frameworks to attract, interview, and retain top talent while avoiding costly hiring mistakes.",
}

export default function ResourcesPage() {
  const basePath = path.join(process.cwd(), "public", "resources")
  const categories = fs.readdirSync(basePath).filter((item) => {
    const itemPath = path.join(basePath, item)
    return fs.statSync(itemPath).isDirectory() && item !== "thumbnails"
  })

  const data = categories.map((category) => {
    const categoryPath = path.join(basePath, category)
    const files = fs.readdirSync(categoryPath)

    // Group files by name (pdf/docx/xlsx pairs)
    const grouped: Record<string, string[]> = {}

    files.forEach((file) => {
      const noExt = file.replace(/\.(pdf|docx|xlsx)$/i, "")
      if (!grouped[noExt]) grouped[noExt] = []
      grouped[noExt].push(file)
    })

    return {
      title: formatTitle(category),
      folder: category,
      items: Object.entries(grouped).map(([name, fileList]) => ({
        name: formatTitle(name),
        description: resourceDescriptions[name] || "Valuable resource to help grow your business.",
        files: fileList.map((file) => ({
          label: file.split(".").pop()?.toUpperCase() || "",
          url: `/resources/${category}/${file}`,
        })),
        thumbnail: `/resources/thumbnails/${category}-${name}.png`,
      })),
    }
  })

  return (
    <div className="pb-24">
      <PageHeader
        title="Resources & Templates"
        subtitle="Your Entrepreneurial Toolkit — Ready to Download & Build With"
      />

      <div className="max-w-7xl mx-auto px-4 mt-16 space-y-20">
        {data.map((section, idx) => (
          <section key={idx}>
            <h2 className="text-3xl font-bold text-brand-blue mb-6">
              {section.title}
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {section.items.map((item, j) => (
                <Card
                  key={j}
                  className="p-5 rounded-2xl shadow-md border border-brand-blue/20 bg-white/60 hover:shadow-xl transition-all backdrop-blur-lg flex flex-col"
                >
                  {/* Thumbnail */}
                  <div className="w-full mb-4 relative h-40 rounded-xl overflow-hidden bg-gradient-to-br from-brand-blue/10 to-accent-orange/10">
                    <Image
                      src={item.thumbnail}
                      fill
                      alt={item.name}
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>

                  <h3 className="text-xl font-semibold mb-3 text-accent-navy">
                    {item.name}
                  </h3>

                  <p className="text-sm text-gray-600 mb-4 flex-grow leading-relaxed">
                    {item.description}
                  </p>

                  <div className="flex flex-wrap gap-3 mt-auto">
                    {item.files.map((file, k) => (
                      <Button
                        key={k}
                        variant="outline"
                        size="sm"
                        className="text-brand-blue border-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
                        asChild
                      >
                        <Link href={file.url} download>
                          <Download className="w-4 h-4 mr-2" />
                          {file.label}
                        </Link>
                      </Button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
