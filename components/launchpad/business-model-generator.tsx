"use client"

import { FormEvent, type ComponentType, useState } from "react"
import { Brain, Loader2, Sparkles, Target, TrendingUp, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type BusinessModelInsight = {
  valueProposition: string
  revenueStreams: string[]
  keyActivities: string[]
  opportunities: string[]
  risks: string[]
  nextActions: string[]
}

const initialInsight: BusinessModelInsight | null = null

export default function BusinessModelGenerator() {
  const [formData, setFormData] = useState({
    businessIdea: "",
    targetCustomer: "",
    problem: "",
    differentiator: "",
    monetization: "",
  })
  const [insight, setInsight] = useState<BusinessModelInsight | null>(initialInsight)
  const [error, setError] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setInsight(null)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/launch-pad/business-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload.error || "Unable to generate your business model insights right now.")
        return
      }

      setInsight(payload.insight)
    } catch {
      setError("Something went wrong while contacting the AI service. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="py-20 px-6 bg-white/80">
      <div className="max-w-6xl mx-auto grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border border-[#1a2942]/20">
          <CardHeader>
            <Badge className="w-fit bg-[#1a2942] text-white">AI Business Model Generator</Badge>
            <CardTitle className="text-3xl text-[#1a2942] mt-2">Map your business model in minutes</CardTitle>
            <CardDescription>
              Get AI-powered insights for your value proposition, revenue streams, and key activities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  required
                  placeholder="Business idea"
                  value={formData.businessIdea}
                  onChange={(event) => setFormData((prev) => ({ ...prev, businessIdea: event.target.value }))}
                />
                <Input
                  required
                  placeholder="Target customer"
                  value={formData.targetCustomer}
                  onChange={(event) => setFormData((prev) => ({ ...prev, targetCustomer: event.target.value }))}
                />
              </div>

              <Textarea
                required
                placeholder="What core problem are you solving?"
                value={formData.problem}
                onChange={(event) => setFormData((prev) => ({ ...prev, problem: event.target.value }))}
              />

              <Textarea
                placeholder="What makes your solution different?"
                value={formData.differentiator}
                onChange={(event) => setFormData((prev) => ({ ...prev, differentiator: event.target.value }))}
              />

              <Input
                placeholder="How do you plan to make money?"
                value={formData.monetization}
                onChange={(event) => setFormData((prev) => ({ ...prev, monetization: event.target.value }))}
              />

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#4f7ca7] text-white hover:bg-[#3f658a]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating insights...
                  </>
                ) : (
                  <>
                    Generate Business Model
                    <Sparkles className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-[#1a2942]/20 bg-[#f7fbff]">
          <CardHeader>
            <CardTitle className="text-[#1a2942] flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Your AI Insights
            </CardTitle>
            <CardDescription>
              Your generated business model guidance appears here once you submit your idea.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {insight ? (
              <>
                <InsightBlock icon={Target} title="Value Proposition" items={[insight.valueProposition]} />
                <InsightBlock icon={TrendingUp} title="Revenue Streams" items={insight.revenueStreams} />
                <InsightBlock icon={Wrench} title="Key Activities" items={insight.keyActivities} />
                <InsightBlock title="Opportunities" items={insight.opportunities} />
                <InsightBlock title="Risks" items={insight.risks} />
                <InsightBlock title="Next Actions" items={insight.nextActions} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Enter your startup concept and generate personalized strategic recommendations.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function InsightBlock({
  title,
  items,
  icon: Icon,
}: {
  title: string
  items: string[]
  icon?: ComponentType<{ className?: string }>
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-[#1a2942] flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={`${title}-${item}`} className="text-sm text-[#1a2942]/90">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
