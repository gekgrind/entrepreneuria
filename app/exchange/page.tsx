"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Vault, Bot, ArrowRight, Shield, Zap, Users } from "lucide-react"
import Link from "next/link"

export default function ExchangePage() {
  return (
    <main className="relative z-10 pt-24 pb-24">
      {/* Hero Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-6xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4 bg-white/20 text-white backdrop-blur-sm">
            Entrepreneuria Exchange
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold font-sans mb-6 text-white text-balance">
            Your Digital Business Hub
          </h1>
          <p className="text-xl mb-8 text-white/90 max-w-3xl mx-auto text-pretty">
            Secure your digital assets and leverage AI agents to accelerate your entrepreneurial journey
          </p>
        </div>
      </section>

      {/* Main Products Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Digital Vault Card */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <Vault className="h-12 w-12 text-white mb-4" />
                <CardTitle className="text-3xl text-white">Digital Vault</CardTitle>
                <CardDescription className="text-white/80 text-lg">
                  Secure storage for all your business assets
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-white/90">
                  Store, organize, and protect your business documents, contracts, intellectual property, and digital
                  assets in one secure location.
                </p>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-white mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-white">Bank-Level Security</h4>
                      <p className="text-sm text-white/80">End-to-end encryption for all your files</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-white mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-white">Smart Organization</h4>
                      <p className="text-sm text-white/80">AI-powered categorization and search</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-white mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-white">Team Collaboration</h4>
                      <p className="text-sm text-white/80">Secure sharing with granular permissions</p>
                    </div>
                  </div>
                </div>

                <Button asChild size="lg" className="w-full bg-white text-[#d27a2c] hover:bg-white/90">
                  <Link href="/exchange/digital-vault">
                    Explore Digital Vault <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Agentverse Card */}
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardHeader>
                <Bot className="h-12 w-12 text-white mb-4" />
                <CardTitle className="text-3xl text-white">Agentverse</CardTitle>
                <CardDescription className="text-white/80 text-lg">AI agents working for your business</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-white/90">
                  Deploy specialized AI agents to automate tasks, analyze data, and accelerate your business operations
                  24/7.
                </p>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Bot className="h-5 w-5 text-white mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-white">Specialized Agents</h4>
                      <p className="text-sm text-white/80">Marketing, sales, finance, and operations agents</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-white mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-white">24/7 Automation</h4>
                      <p className="text-sm text-white/80">Agents work around the clock for you</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-white mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-white">Custom Training</h4>
                      <p className="text-sm text-white/80">Train agents on your business data</p>
                    </div>
                  </div>
                </div>

                <Button asChild size="lg" className="w-full bg-white text-[#d27a2c] hover:bg-white/90">
                  <Link href="/exchange/agentverse">
                    Explore Agentverse <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/5">
        <div className="max-w-4xl mx-auto">
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl text-white mb-4">Seamless Integration</CardTitle>
              <CardDescription className="text-white/80 text-lg">
                Digital Vault and Agentverse work together to supercharge your business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Vault className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="font-semibold text-white mb-2">Store Assets</h4>
                  <p className="text-sm text-white/80">Securely store all your business data</p>
                </div>
                <div>
                  <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <ArrowRight className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="font-semibold text-white mb-2">Connect Agents</h4>
                  <p className="text-sm text-white/80">Give agents access to your data</p>
                </div>
                <div>
                  <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="font-semibold text-white mb-2">Automate & Scale</h4>
                  <p className="text-sm text-white/80">Let AI handle the heavy lifting</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 backdrop-blur-sm bg-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold font-sans mb-6 text-white">Ready to Transform Your Business?</h2>
          <p className="text-xl mb-8 text-white/90">
            Join thousands of entrepreneurs using Entrepreneuria Exchange to secure and scale their ventures
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-white text-[#d27a2c] hover:bg-white/90">
              <Link href="/pricing">Get Started Today</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 bg-transparent"
            >
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
