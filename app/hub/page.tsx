"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Download,
  FileText,
  Users,
  TrendingUp,
  DollarSign,
  UserPlus,
  Brain,
  MessageSquare,
  Calendar,
  Star,
  ArrowRight,
} from "lucide-react"

export default function HubPage() {
  const [activeTab, setActiveTab] = useState("tools")

  return (
    <main className="relative z-10 pt-24 pb-24">
      {/* Hero Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4 bg-accent-foreground text-accent">
            Resource Ecosystem
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 text-balance">A Growing Ecosystem</h1>
          <p className="text-xl mb-8 text-accent-foreground/90 max-w-3xl mx-auto text-pretty">
            Library of AI-powered tools, guides, templates, and startup frameworks for every stage of your journey
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="text-lg px-8 py-3 bg-accent-foreground text-accent hover:bg-accent-foreground/90"
          >
            Explore the Hub <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>
      {/* Main Content */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="tools">AI-Powered Tools</TabsTrigger>
              <TabsTrigger value="resources">Resources & Templates</TabsTrigger>
              <TabsTrigger value="blog">Blog</TabsTrigger>
              <TabsTrigger value="community">Community</TabsTrigger>
            </TabsList>

            {/* AI-Powered Tools Tab */}
            <TabsContent value="tools" className="mt-8">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <Brain className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Business Model Generator</CardTitle>
                    <CardDescription>AI-powered canvas creation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Generate comprehensive business model canvases with AI assistance
                    </p>
                    <Button className="w-full">Launch Tool</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <TrendingUp className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Market Analysis AI</CardTitle>
                    <CardDescription>Intelligent market research</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Get AI-powered insights on market size, competition, and opportunities
                    </p>
                    <Button className="w-full">Launch Tool</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <DollarSign className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Financial Projector</CardTitle>
                    <CardDescription>Smart financial modeling</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Create detailed financial projections with AI-powered assumptions
                    </p>
                    <Button className="w-full">Launch Tool</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Users className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Customer Persona Builder</CardTitle>
                    <CardDescription>AI customer insights</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Build detailed customer personas using AI analysis and market data
                    </p>
                    <Button className="w-full">Launch Tool</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <FileText className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Pitch Deck Creator</CardTitle>
                    <CardDescription>AI-assisted presentations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Generate compelling pitch decks with AI-powered content suggestions
                    </p>
                    <Button className="w-full">Launch Tool</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <UserPlus className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Hiring Assistant</CardTitle>
                    <CardDescription>Smart recruitment tools</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      AI-powered job descriptions, interview questions, and candidate screening
                    </p>
                    <Button className="w-full">Launch Tool</Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Resources & Templates Tab */}
            <TabsContent value="resources" className="mt-8">
              <div className="space-y-12">
                {/* Startup Frameworks */}
                <div>
                  <h3 className="text-2xl font-bold font-sans mb-6 flex items-center gap-3">
                    <FileText className="h-6 w-6 text-primary" />
                    Startup Frameworks
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Lean Startup Canvas</CardTitle>
                        <CardDescription>A Strategic Template for Building Your Business Model</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Includes: Problem, Customer Segments, Unique Value Proposition, Solution, Key Metrics,
                          Channels, Cost Structure, Revenue Streams
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            PDF Version
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Fillable Form
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>MVP Planning Template</CardTitle>
                        <CardDescription>Define, Prioritize, and Build Your Minimum Viable Product</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Includes: Problem Statement, Target Users, Core Features vs. Nice-to-Haves, MVP Hypotheses,
                          Success Metrics, 30-60-90 Day Roadmap
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Template
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Customer Development Guide</CardTitle>
                        <CardDescription>Validate Your Startup Idea the Right Way</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Includes: Top 5 Customer Problems, Hypotheses & Experiments, Customer Persona Template,
                          Customer Journey Map
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Guide
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Business Model Canvas</CardTitle>
                        <CardDescription>
                          Map Out How Your Business Creates, Delivers, and Captures Value
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Includes: Key Partners, Key Activities, Key Resources, Value Propositions, Customer
                          Relationships, Channels, Customer Segments, Cost Structure, Revenue Streams
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Canvas
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Growth Playbooks */}
                <div>
                  <h3 className="text-2xl font-bold font-sans mb-6 flex items-center gap-3">
                    <TrendingUp className="h-6 w-6 text-primary" />
                    Growth Playbooks
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Scaling Operations Manual</CardTitle>
                        <CardDescription>Turn Startup Hustle into Scalable Systems</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Process Documentation Template, Hiring Priority Matrix, Tech Stack Checklist, Scaling Metrics
                          Dashboard, 6-Month Scaling Roadmap
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Manual
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Growth Hacking Toolkit</CardTitle>
                        <CardDescription>Scrappy, Creative Tactics to Accelerate Growth</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Growth Experiment Tracker, Viral Loop Design Template, A/B Testing Log, 90-Day Growth Calendar
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Toolkit
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Product-Market Fit Guide</CardTitle>
                        <CardDescription>Find Out If You've Built Something People Truly Want</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Customer Feedback Tracker, PMF Survey Template, Cohort Retention Data, 30-Day PMF Roadmap
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Guide
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Funding Resources */}
                <div>
                  <h3 className="text-2xl font-bold font-sans mb-6 flex items-center gap-3">
                    <DollarSign className="h-6 w-6 text-primary" />
                    Funding Resources
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Financial Model Template</CardTitle>
                        <CardDescription>Project Your Startup's Revenue, Costs, and Growth</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Revenue Projections, Cost Structure, Cash Flow Forecast, Break-Even Analysis, KPI Dashboard
                          (Burn Rate, Runway, CAC, LTV)
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Template
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Investor Pitch Template</CardTitle>
                        <CardDescription>Craft a Winning Pitch Deck for Investors</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          12-slide template: Problem, Solution, Market, Product, Business Model, Traction, Competition,
                          Team, Financials, Ask
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Template
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Due Diligence Checklist</CardTitle>
                        <CardDescription>Prepare the Documents Investors Will Request</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Corporate Documents, Financials, Legal, Market Data, Product, Team documentation requirements
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Checklist
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Team Building */}
                <div>
                  <h3 className="text-2xl font-bold font-sans mb-6 flex items-center gap-3">
                    <Users className="h-6 w-6 text-primary" />
                    Team Building
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Remote Team Guide</CardTitle>
                        <CardDescription>Build and Manage High-Performing Distributed Teams</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Remote Communication Charter, Meeting Agenda Template, Weekly Check-In Tracker, best practices
                          for remote collaboration
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Guide
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Hiring Playbook</CardTitle>
                        <CardDescription>Recruit, Interview, and Onboard A-Players</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Job Description Template, Interview Scorecard, Onboarding Checklist, structured hiring
                          framework
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Playbook
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Culture Building Kit</CardTitle>
                        <CardDescription>Shape and Scale Your Company Culture</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground mb-4">
                          Core Values Worksheet, Team Rituals Planner, Recognition & Feedback Log, culture scaling
                          strategies
                        </p>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Download Kit
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Blog Tab */}
            <TabsContent value="blog" className="mt-8">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit mb-2">
                      Growth Hacks
                    </Badge>
                    <CardTitle>10 AI-Powered Growth Strategies That Actually Work</CardTitle>
                    <CardDescription>Published 2 days ago</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      Discover how successful startups are using AI to accelerate their growth and outpace competitors.
                    </p>
                    <Button variant="outline" size="sm">
                      Read More
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit mb-2">
                      Funding Tips
                    </Badge>
                    <CardTitle>The New Rules of Startup Fundraising in 2024</CardTitle>
                    <CardDescription>Published 1 week ago</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      What investors are looking for now and how to position your startup for funding success.
                    </p>
                    <Button variant="outline" size="sm">
                      Read More
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit mb-2">
                      Emerging Trends
                    </Badge>
                    <CardTitle>Why Every Startup Needs an AI Strategy</CardTitle>
                    <CardDescription>Published 2 weeks ago</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      How artificial intelligence is reshaping entrepreneurship and what it means for your business.
                    </p>
                    <Button variant="outline" size="sm">
                      Read More
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit mb-2">
                      Case Study
                    </Badge>
                    <CardTitle>From Idea to $10M ARR: A Founder's Journey</CardTitle>
                    <CardDescription>Published 3 weeks ago</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      An in-depth look at how one entrepreneur built a successful SaaS company using our frameworks.
                    </p>
                    <Button variant="outline" size="sm">
                      Read More
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit mb-2">
                      Product Updates
                    </Badge>
                    <CardTitle>Introducing Prospra 2.0: Smarter AI Mentoring</CardTitle>
                    <CardDescription>Published 1 month ago</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      New features and improvements that make our AI mentor even more powerful and personalized.
                    </p>
                    <Button variant="outline" size="sm">
                      Read More
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit mb-2">
                      Industry Insights
                    </Badge>
                    <CardTitle>The Future of Remote Work for Startups</CardTitle>
                    <CardDescription>Published 1 month ago</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      How distributed teams are becoming the new competitive advantage for growing companies.
                    </p>
                    <Button variant="outline" size="sm">
                      Read More
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Community Tab */}
            <TabsContent value="community" className="mt-8">
              <div className="space-y-8">
                <div className="text-center">
                  <h3 className="text-2xl font-bold font-sans mb-4">Join 10,000+ Entrepreneurs</h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    Connect, collaborate, and learn from fellow founders in our active community
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader>
                      <MessageSquare className="h-8 w-8 text-primary mb-2" />
                      <CardTitle>Active Discussions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="border-l-4 border-primary pl-4">
                          <h4 className="font-semibold">How to validate a B2B SaaS idea?</h4>
                          <p className="text-sm text-muted-foreground">23 replies • Started by @sarah_founder</p>
                        </div>
                        <div className="border-l-4 border-accent pl-4">
                          <h4 className="font-semibold">Best practices for remote team management</h4>
                          <p className="text-sm text-muted-foreground">18 replies • Started by @mike_ceo</p>
                        </div>
                        <div className="border-l-4 border-primary pl-4">
                          <h4 className="font-semibold">Fundraising in the current market</h4>
                          <p className="text-sm text-muted-foreground">31 replies • Started by @alex_startup</p>
                        </div>
                      </div>
                      <Button className="w-full mt-4">Join Discussion</Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <Calendar className="h-8 w-8 text-primary mb-2" />
                      <CardTitle>Upcoming Events</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary text-primary-foreground rounded p-2 text-center min-w-[60px]">
                            <div className="text-xs">DEC</div>
                            <div className="text-lg font-bold">15</div>
                          </div>
                          <div>
                            <h4 className="font-semibold">AI for Startups Masterclass</h4>
                            <p className="text-sm text-muted-foreground">2:00 PM EST • Online</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="bg-accent text-accent-foreground rounded p-2 text-center min-w-[60px]">
                            <div className="text-xs">DEC</div>
                            <div className="text-lg font-bold">22</div>
                          </div>
                          <div>
                            <h4 className="font-semibold">Founder Networking Happy Hour</h4>
                            <p className="text-sm text-muted-foreground">6:00 PM EST • San Francisco</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="bg-primary text-primary-foreground rounded p-2 text-center min-w-[60px]">
                            <div className="text-xs">JAN</div>
                            <div className="text-lg font-bold">05</div>
                          </div>
                          <div>
                            <h4 className="font-semibold">2024 Planning Workshop</h4>
                            <p className="text-sm text-muted-foreground">10:00 AM EST • Online</p>
                          </div>
                        </div>
                      </div>
                      <Button className="w-full mt-4">View All Events</Button>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <Star className="h-8 w-8 text-primary mb-2" />
                    <CardTitle>Featured Community Members</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-primary rounded-full mx-auto mb-3 flex items-center justify-center text-primary-foreground font-bold text-xl">
                          JD
                        </div>
                        <h4 className="font-semibold">Jessica Davis</h4>
                        <p className="text-sm text-muted-foreground">CEO, TechFlow</p>
                        <p className="text-xs text-muted-foreground mt-1">Raised $5M Series A</p>
                      </div>
                      <div className="text-center">
                        <div className="w-16 h-16 bg-accent rounded-full mx-auto mb-3 flex items-center justify-center text-accent-foreground font-bold text-xl">
                          MR
                        </div>
                        <h4 className="font-semibold">Marcus Rodriguez</h4>
                        <p className="text-sm text-muted-foreground">Founder, GrowthLab</p>
                        <p className="text-xs text-muted-foreground mt-1">Successful exit to Google</p>
                      </div>
                      <div className="text-center">
                        <div className="w-16 h-16 bg-primary rounded-full mx-auto mb-3 flex items-center justify-center text-primary-foreground font-bold text-xl">
                          SC
                        </div>
                        <h4 className="font-semibold">Sarah Chen</h4>
                        <p className="text-sm text-muted-foreground">Serial Entrepreneur</p>
                        <p className="text-xs text-muted-foreground mt-1">3 successful startups</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </main>
  )
}
