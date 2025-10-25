"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Zap, Calendar, Mail, Bell, Briefcase, CheckCircle } from "lucide-react"

export default function SynceriPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-4 bg-accent-foreground text-accent">
                AI-Powered Life Admin
              </Badge>
              <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 text-balance">Your AI Life Admin</h1>
              <p className="text-xl mb-8 text-accent-foreground/90 text-pretty">
                Synceri automates your personal and business tasks so you can focus on growth, creativity, and freedom
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  variant="secondary"
                  className="text-lg px-8 py-3 bg-accent-foreground text-accent hover:bg-accent-foreground/90"
                >
                  Get Synceri Working for You <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-3 bg-transparent border-accent-foreground text-accent-foreground hover:bg-accent-foreground hover:text-accent"
                >
                  See It in Action
                </Button>
              </div>
            </div>
            <div className="bg-card rounded-lg p-6 text-card-foreground">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Zap className="h-6 w-6 text-accent" />
                  <span className="font-semibold">Synceri Dashboard</span>
                </div>
                <div className="space-y-3">
                  <div className="bg-muted p-3 rounded-lg flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-accent" />
                    <span className="text-sm">Scheduled 3 meetings for next week</span>
                  </div>
                  <div className="bg-muted p-3 rounded-lg flex items-center gap-3">
                    <Mail className="h-4 w-4 text-accent" />
                    <span className="text-sm">Responded to 12 emails automatically</span>
                  </div>
                  <div className="bg-muted p-3 rounded-lg flex items-center gap-3">
                    <Bell className="h-4 w-4 text-accent" />
                    <span className="text-sm">Prioritized 8 tasks for today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold font-sans mb-4">Automate Everything, Focus on What Matters</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Let AI handle the routine so you can concentrate on building your empire
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card>
              <CardHeader>
                <Calendar className="h-8 w-8 text-accent mb-2" />
                <CardTitle className="text-xl">AI Scheduling</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Intelligent calendar management that finds optimal meeting times and handles scheduling conflicts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Mail className="h-8 w-8 text-accent mb-2" />
                <CardTitle className="text-xl">Email Automation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Smart email responses, follow-ups, and inbox organization based on your communication style
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Bell className="h-8 w-8 text-accent mb-2" />
                <CardTitle className="text-xl">Smart Reminders</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  AI-powered task prioritization and intelligent reminders that adapt to your workflow
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Briefcase className="h-8 w-8 text-accent mb-2" />
                <CardTitle className="text-xl">Business Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Seamlessly manage both personal and business tasks in one unified, intelligent system
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold font-sans mb-6">Reclaim Your Time, Amplify Your Impact</h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-accent mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Save 15+ Hours Per Week</h3>
                    <p className="text-muted-foreground">
                      Automate routine tasks and administrative work that drain your energy and creativity
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-accent mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Reduce Stress & Mental Load</h3>
                    <p className="text-muted-foreground">
                      Never forget important tasks or miss deadlines with intelligent prioritization and reminders
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-accent mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Boost Productivity by 300%</h3>
                    <p className="text-muted-foreground">
                      Focus on high-value activities while AI handles the operational details seamlessly
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <CheckCircle className="h-6 w-6 text-accent mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Perfect Work-Life Balance</h3>
                    <p className="text-muted-foreground">
                      Maintain boundaries and ensure personal time while staying on top of business priorities
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-background p-8 rounded-lg">
              <h3 className="text-2xl font-bold mb-6 text-center">Time Savings Impact</h3>
              <div className="grid grid-cols-2 gap-6 text-center">
                <div>
                  <div className="text-3xl font-bold text-accent mb-2">15hrs</div>
                  <div className="text-sm text-muted-foreground">Saved Per Week</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-accent mb-2">300%</div>
                  <div className="text-sm text-muted-foreground">Productivity Boost</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-accent mb-2">90%</div>
                  <div className="text-sm text-muted-foreground">Stress Reduction</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-accent mb-2">24/7</div>
                  <div className="text-sm text-muted-foreground">Always Working</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold font-sans mb-4">How Synceri Works</h2>
            <p className="text-xl text-muted-foreground">Simple setup, powerful automation, immediate results</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold">1</span>
                </div>
                <CardTitle className="text-xl">Connect Your Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Link your calendar, email, task management apps, and business tools in minutes
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold">2</span>
                </div>
                <CardTitle className="text-xl">AI Learns Your Style</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Synceri observes your preferences and patterns to provide personalized automation
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold">3</span>
                </div>
                <CardTitle className="text-xl">Enjoy Your Freedom</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Focus on what you love while Synceri handles the rest automatically and intelligently
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold font-sans mb-12">Trusted by Busy Entrepreneurs</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">
                  "Synceri gave me back 20 hours a week. I can finally focus on strategy instead of admin work."
                </p>
                <div className="font-semibold">Sarah Chen</div>
                <div className="text-sm text-muted-foreground">CEO, TechStart Inc.</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">
                  "The email automation alone is worth the price. My inbox is finally under control."
                </p>
                <div className="font-semibold">Marcus Rodriguez</div>
                <div className="text-sm text-muted-foreground">Founder, GrowthLab</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-4">
                  "I never miss important tasks anymore. Synceri keeps me organized and productive."
                </p>
                <div className="font-semibold">Emily Watson</div>
                <div className="text-sm text-muted-foreground">Serial Entrepreneur</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold font-sans mb-6">Ready to Get Your Life Back?</h2>
          <p className="text-xl mb-8 text-accent-foreground/90 max-w-2xl mx-auto">
            Join thousands of entrepreneurs who have already automated their way to freedom
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-3 bg-accent-foreground text-accent hover:bg-accent-foreground/90"
            >
              Get Synceri Working for You <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-3 bg-transparent border-accent-foreground text-accent-foreground hover:bg-accent-foreground hover:text-accent"
            >
              Start Free Trial
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
