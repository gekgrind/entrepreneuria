"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Bot,
  Zap,
  TrendingUp,
  MessageSquare,
  DollarSign,
  Users,
  BarChart3,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Brain,
  Target,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import Link from "next/link"

export default function AgentversePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <main className="relative z-10 pt-24 pb-24">
      {/* Hero Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4 bg-white/20 text-white backdrop-blur-sm">
            The Agentverse
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 text-white text-balance">
            Meet Your AI Dream Team.
          </h1>
          <p className="text-xl mb-8 text-white/90 max-w-3xl mx-auto text-pretty">
            From marketing to admin to growth — the Agentverse connects you with specialized AI agents built to
            supercharge your business.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-8 text-white/90">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#d27a2c]" />
              <span>🤖 Marketing & SEO Agents</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#d27a2c]" />
              <span>📅 Admin & Scheduling Bots</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#d27a2c]" />
              <span>📈 Growth Strategy Assistants</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-[#d27a2c] hover:bg-white/90">
              Explore the Agentverse <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 bg-transparent">
              See Agents in Action
            </Button>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-6 text-white">Why the Agentverse?</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <Bot className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Purpose-Built AI Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">No setup, just results.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Plug-and-Play Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Works with your existing tools.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <Target className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Customizable Intelligence</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Personalize tone & goals.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <DollarSign className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Affordable Automation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Big productivity, small cost.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <Brain className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Ever-Evolving</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Agents learn and improve over time.</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <Sparkles className="h-10 w-10 text-primary mb-3" />
                <CardTitle className="text-xl">Always Available</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">24/7 productivity, no breaks needed.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-6 text-white">Featured AI Agents</h2>
            <p className="text-xl text-white/90 max-w-3xl mx-auto">
              Meet the specialized agents ready to transform your business operations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-2 border-primary hover:border-primary/70 transition-all">
              <CardHeader>
                <Brain className="h-10 w-10 text-primary mb-3" />
                <CardTitle>Prospra Mentor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Strategy & mindset coach</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Business strategy guidance
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Goal setting & tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Mindset coaching
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-all">
              <CardHeader>
                <Calendar className="h-10 w-10 text-primary mb-3" />
                <CardTitle>Synceri Admin</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Scheduling & reminders</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Calendar management
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Task automation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Smart reminders
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-all">
              <CardHeader>
                <TrendingUp className="h-10 w-10 text-primary mb-3" />
                <CardTitle>SEO Genie</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Content briefs & keyword automation</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Keyword research
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Content optimization
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    SEO audits
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-all">
              <CardHeader>
                <MessageSquare className="h-10 w-10 text-primary mb-3" />
                <CardTitle>Social Spark</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Post & engagement manager</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Content creation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Scheduling posts
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Engagement tracking
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-all">
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-3" />
                <CardTitle>LeadFlow SDR</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Client lead qualifier</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Lead qualification
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Automated outreach
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Follow-up sequences
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-all">
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-3" />
                <CardTitle>Analytics Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Data analysis & insights</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Data visualization
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Trend identification
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Predictive insights
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* Agent Types Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold font-sans mb-12 text-center text-white">
            Specialized Agents for Every Business Function
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <TrendingUp className="h-10 w-10 text-primary mb-3" />
                <CardTitle>Marketing Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Automate content creation, social media posting, email campaigns, and SEO optimization.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Content generation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Social media management
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Campaign analytics
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <Users className="h-10 w-10 text-primary mb-3" />
                <CardTitle>Sales Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Qualify leads, schedule meetings, follow up with prospects, and close deals faster.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Lead qualification
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Automated follow-ups
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Pipeline management
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <MessageSquare className="h-10 w-10 text-primary mb-3" />
                <CardTitle>Customer Support Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Provide instant 24/7 customer support, answer FAQs, and escalate complex issues.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    24/7 availability
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Multi-language support
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Smart escalation
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <DollarSign className="h-10 w-10 text-primary mb-3" />
                <CardTitle>Finance Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Track expenses, generate financial reports, and provide real-time budget insights.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Expense tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Financial reporting
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Budget forecasting
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-primary mb-3" />
                <CardTitle>Analytics Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Analyze business data, identify trends, and provide actionable insights automatically.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Data analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Trend identification
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Predictive insights
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:border-primary/70 transition-colors">
              <CardHeader>
                <Calendar className="h-10 w-10 text-primary mb-3" />
                <CardTitle>Operations Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Manage schedules, coordinate tasks, and streamline workflows across your team.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Task automation
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Schedule management
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Workflow optimization
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* How It Works Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold font-sans mb-12 text-center text-white">Deploy Agents in Minutes</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-2 border-primary text-center">
              <CardHeader>
                <div className="bg-primary/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl font-bold text-primary">1</span>
                </div>
                <CardTitle>Choose Your Agent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Select from our library of specialized agents or request a custom agent for your specific needs.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary text-center">
              <CardHeader>
                <div className="bg-primary/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl font-bold text-primary">2</span>
                </div>
                <CardTitle>Train on Your Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Connect your Digital Vault and other data sources to train agents on your business context.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary text-center">
              <CardHeader>
                <div className="bg-primary/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl font-bold text-primary">3</span>
                </div>
                <CardTitle>Deploy & Monitor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Launch your agent and monitor performance with real-time analytics and insights.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* Benefits Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-4xl mx-auto">
          <Card className="border-2 border-primary">
            <CardHeader>
              <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle className="text-3xl text-center mb-4">The Power of AI Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-card-foreground text-lg">10x Productivity</h4>
                    <p className="text-muted-foreground">
                      Automate repetitive tasks and free up your time to focus on strategic growth initiatives
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-card-foreground text-lg">Reduce Costs</h4>
                    <p className="text-muted-foreground">
                      Save on hiring and training costs while maintaining high-quality output across all functions
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-card-foreground text-lg">Scale Faster</h4>
                    <p className="text-muted-foreground">
                      Grow your business without the typical constraints of hiring and managing a large team
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Bot className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-card-foreground text-lg">Always Learning</h4>
                    <p className="text-muted-foreground">
                      Agents continuously improve based on your feedback and new data, getting smarter over time
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* Social Proof section from brief */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-4 text-white">Real Entrepreneurs. Real Results.</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="border-2 border-primary">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#d27a2c] text-[#d27a2c]" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 italic">
                  "My AI SDR booked more calls in a week than I did in a month."
                </p>
                <p className="text-card-foreground font-semibold">— Sales Founder</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary">
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-[#d27a2c] text-[#d27a2c]" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 italic">
                  "Having a personal AI project manager changed everything."
                </p>
                <p className="text-card-foreground font-semibold">— Entrepreneur</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center">
            <Badge variant="secondary" className="text-base px-4 py-2 bg-white/20 text-white backdrop-blur-sm">
              Beta Access Verified • Entrepreneuria AI Certified • Data Privacy Compliant
            </Badge>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold font-sans mb-4 text-white">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "What is the Agentverse?",
                answer: "A marketplace where you can use and customize AI agents built for entrepreneurs.",
              },
              {
                question: "Do I need coding skills?",
                answer: "Nope — everything's plug-and-play.",
              },
              {
                question: "Can I create my own agents?",
                answer: "Soon! The next phase will allow users to build and sell custom AI agents.",
              },
              {
                question: "How do agents integrate with my tools?",
                answer: "Agents connect seamlessly with popular business tools through simple integrations.",
              },
              {
                question: "Is my data secure?",
                answer:
                  "Absolutely. We follow industry-leading security practices and are fully data privacy compliant.",
              },
            ].map((faq, index) => (
              <Card
                key={index}
                className="border-2 border-primary cursor-pointer hover:border-primary/70 transition-colors"
                onClick={() => toggleFaq(index)}
              >
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl">{faq.question}</CardTitle>
                    {openFaq === index ? (
                      <ChevronUp className="h-6 w-6 text-primary" />
                    ) : (
                      <ChevronDown className="h-6 w-6 text-primary" />
                    )}
                  </div>
                </CardHeader>
                {openFaq === index && (
                  <CardContent>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      {/* CTA Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold font-sans mb-6 text-white">
            The future of entrepreneurship is automated — and it starts here.
          </h2>
          <p className="text-xl mb-8 text-white/90">Meet your AI dream team in the Agentverse.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-[#d27a2c] hover:bg-white/90">
              <Link href="/pricing">
                Explore Agents <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 bg-transparent"
            >
              <Link href="/contact">Talk to an Expert</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
