import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Mail, Pinterest, LinkedIn, Instagram } from "lucide-react"


export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t">
      <div className="absolute inset-0 bg-gradient-to-br from-[#4f7ca7] via-[#d27a2c] to-[#1a2942] bg-[length:400%_400%] animate-gradient-flow opacity-70"></div>


      <div className="relative max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-bold font-sans !text-[#1a2942]">
                Entrepreneuria
              </span>
            </Link>


            <p className="text-sm leading-relaxed opacity-90 !text-[#1a2942]">
              Practical founder tools available now. AI-powered business apps coming soon.
            </p>


            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" size="icon" asChild className="hover:bg-white/10">
                <a
                  href="https://instagram.com/entrepreneuriaio"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4 !text-white hover:!text-white transition-colors" />
                </a>
              </Button>


              <Button variant="ghost" size="icon" asChild className="hover:bg-white/10">
                <a
                  href="https://pinterest.com/entrepreneuriaio"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Pinterest"
                >
                  <PinIcon className="h-4 w-4 !text-white hover:!text-white transition-colors" />
                </a>
              </Button>


              <Button variant="ghost" size="icon" asChild className="hover:bg-white/10">
                <a
                  href="https://x.com/entrepreneuriaio"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="X"
                >
                  <Twitter className="h-4 w-4 !text-white hover:!text-white transition-colors" />
                </a>
              </Button>


              <Button variant="ghost" size="icon" asChild className="hover:bg-white/10">
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-4 w-4 !text-white hover:!text-white transition-colors" />
                </a>
              </Button>


              <Button variant="ghost" size="icon" asChild className="hover:bg-white/10">
                <a
                  href="mailto:misti@entrepreneuria.io"
                  aria-label="Email"
                >
                  <Mail className="h-4 w-4 !text-white hover:!text-white transition-colors" />
                </a>
              </Button>
            </div>
          </div>


          {/* Explore */}
          <div className="space-y-4">
            <h3 className="font-semibold !text-[#1a2942]">Explore</h3>
            <div className="space-y-2">
              {[
                { name: "Home", href: "/" },
                { name: "Resources & Templates", href: "/launch-pad/resources" },
                { name: "Founder Tools on Etsy", href: "https://entrepreneuriatools.etsy.com", external: true },
                { name: "Join the Waitlist", href: "/contact" },
                { name: "Pricing", href: "/pricing" },
              ].map((item) =>
                item.external ? (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm opacity-90 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors"
                  >
                    {item.name}
                  </a>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="block text-sm opacity-90 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors"
                  >
                    {item.name}
                  </Link>
                )
              )}
            </div>
          </div>


          {/* Apps & Tools */}
          <div className="space-y-4">
            <h3 className="font-semibold !text-[#1a2942]">Apps & Tools</h3>
            <div className="space-y-2">
              {[
                { name: "Prospra • Coming Soon", href: "/prospra" },
                { name: "Architecta • Coming Soon", href: "/architecta" },
                { name: "Synceri • Coming Soon", href: "/synceri" },
                { name: "Resources Library", href: "/launch-pad/resources" },
                { name: "Contact", href: "/contact" },
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


          {/* Waitlist CTA */}
          <div className="space-y-4">
            <h3 className="font-semibold !text-[#1a2942]">Stay Updated</h3>
            <p className="text-sm opacity-90 !text-[#1a2942]">
              Get launch updates, new founder tools, and early access news for upcoming AI apps.
            </p>


            <Button className="w-full bg-[#1a2942] hover:bg-[#4f7ca7] !text-white" size="sm" asChild>
              <Link href="/contact">
                Join the Waitlist
              </Link>
            </Button>


            <Button
              className="w-full bg-white/70 hover:bg-white/90 !text-[#1a2942] border border-[#1a2942]/20"
              size="sm"
              asChild
            >
              <a
                href="https://entrepreneuriatools.etsy.com"
                target="_blank"
                rel="noreferrer"
              >
                Shop on Etsy
              </a>
            </Button>
          </div>
        </div>


        <Separator className="my-8 bg-[#1a2942]/30" />


        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
            <p className="text-sm opacity-80 !text-[#1a2942]">
              © 2026 Entrepreneuria. All rights reserved.
            </p>


            <div className="flex space-x-4">
              <Link
                href="/privacy"
                className="text-sm opacity-80 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm opacity-80 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/contact"
                className="text-sm opacity-80 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors"
              >
                Support
              </Link>
            </div>
          </div>


          <div className="flex items-center space-x-4">
            <Link
              href="/about"
              className="text-sm opacity-80 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="text-sm opacity-80 !text-[#1a2942] hover:!text-[#4f7ca7] transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
