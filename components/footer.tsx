import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Mail, Twitter, Linkedin, Youtube } from "lucide-react"

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t">
      {/* 🌈 Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#4f7ca7] via-[#d27a2c] to-[#1a2942] bg-[length:400%_400%] animate-gradient-flow opacity-70"></div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold font-sans !text-[#1a2942]">Entrepreneuria</span>
            </Link>
            <p className="text-sm leading-relaxed opacity-90 !text-[#1a2942]">
              Empowering entrepreneurs everywhere with cutting-edge AI tools, mentorship, and resources for building
              successful businesses.
            </p>
            <div className="flex space-x-4">
              {[Twitter, Linkedin, Youtube, Mail].map((Icon, i) => (
                <Button key={i} variant="ghost" size="icon" asChild className="hover:bg-white/10">
                  <Link href="#" aria-label={Icon.name}>
                    <Icon className="h-4 w-4 !text-white hover:!text-white transition-colors" />
                  </Link>
                </Button>
              ))}
            </div>
          </div>

          {/* Products */}
          <div className="space-y-4">
            <h3 className="font-semibold !text-[#1a2942]">Products</h3>
            <div className="space-y-2">
              {[
                { name: "Prospra - AI Mentor", href: "/prospra" },
                { name: "Synceri - AI Admin", href: "/synceri" },
                { name: "Entrepreneuria Hub", href: "/hub" },
                { name: "Pricing", href: "/pricing" },
              ].map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block text-sm opacity-90 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="font-semibold !text-[#1a2942]">Resources</h3>
            <div className="space-y-2">
              {["Startup Frameworks", "Growth Playbooks", "Funding Resources", "Team Building", "Community"].map(
                (item) => (
                  <Link
                    key={item}
                    href="/hub"
                    className="block text-sm opacity-90 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors"
                  >
                    {item}
                  </Link>
                )
              )}
            </div>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h3 className="font-semibold !text-[#1a2942]">Stay Updated</h3>
            <p className="text-sm opacity-90 !text-[#1a2942]">
              Get the latest entrepreneurial insights and product updates delivered to your inbox.
            </p>
            <div className="space-y-2">
              <Input
                placeholder="Enter your email"
                type="email"
                className="bg-white/70 border-[#1a2942]/30 !text-[#1a2942] placeholder:!text-[#1a2942]/60"
              />
              <Button className="w-full bg-[#1a2942] hover:bg-[#4f7ca7] !text-white" size="sm">
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        <Separator className="my-8 bg-[#1a2942]/30" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
            <p className="text-sm opacity-80 !text-[#1a2942]">© 2025 Entrepreneuria. All rights reserved.</p>
            <div className="flex space-x-4">
              <Link href="/privacy" className="text-sm opacity-80 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm opacity-80 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors">
                Terms of Service
              </Link>
              <Link href="/contact" className="text-sm opacity-80 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors">
                Support
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/about" className="text-sm opacity-80 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors">
              About Us
            </Link>
            <Link href="/contact" className="text-sm opacity-80 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}