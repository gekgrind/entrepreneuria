import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Mail, Twitter, Linkedin, Youtube } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-muted/50 border-t">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold font-sans text-primary">Entrepreneuria</span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Empowering entrepreneurs everywhere with cutting-edge AI tools, mentorship, and resources for building
              successful businesses.
            </p>
            <div className="flex space-x-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="#" aria-label="Twitter">
                  <Twitter className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link href="#" aria-label="LinkedIn">
                  <Linkedin className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link href="#" aria-label="YouTube">
                  <Youtube className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link href="#" aria-label="Email">
                  <Mail className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Products */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Products</h3>
            <div className="space-y-2">
              <Link
                href="/prospra"
                className="block text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Prospra - AI Mentor
              </Link>
              <Link
                href="/synceri"
                className="block text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Synceri - AI Admin
              </Link>
              <Link href="/hub" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                Entrepreneuria Hub
              </Link>
              <Link
                href="/pricing"
                className="block text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Pricing
              </Link>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Resources</h3>
            <div className="space-y-2">
              <Link
                href="/resources"
                className="block text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Startup Frameworks
              </Link>
              <Link
                href="/resources"
                className="block text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Growth Playbooks
              </Link>
              <Link
                href="/resources"
                className="block text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Funding Resources
              </Link>
              <Link
                href="/resources"
                className="block text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Team Building
              </Link>
              <Link href="/hub" className="block text-sm text-muted-foreground hover:text-primary transition-colors">
                Community
              </Link>
            </div>
          </div>

          {/* Newsletter */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Stay Updated</h3>
            <p className="text-sm text-muted-foreground">
              Get the latest entrepreneurial insights and product updates delivered to your inbox.
            </p>
            <div className="space-y-2">
              <Input placeholder="Enter your email" type="email" />
              <Button className="w-full" size="sm">
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
            <p className="text-sm text-muted-foreground">© 2024 Entrepreneuria. All rights reserved.</p>
            <div className="flex space-x-4">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Terms of Service
              </Link>
              <Link href="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Support
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              About Us
            </Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
