import {
  getFlagship,
  getProduct,
  PRODUCT_STATUS_LABELS,
} from "@/lib/ecosystem/products";
import { getPrimaryCta } from "@/lib/launch";
import { ProductShot } from "@/components/home/ProductShot";
import { Kicker, PrimaryCtaLink } from "./shared";

/**
 * SCENE 4 — "The Proof"
 * Wonder becomes trust: real software, shown large. Prospra leads;
 * Architecta and the Command Center support as ecosystem evidence.
 * Products without production screenshots (Directorium, Channelwright)
 * deliberately get NO frame here — mark + role + status only, per the
 * no-fake-UI rule. Slots activate via the registry when assets exist.
 */
export function SceneProof() {
  const prospra = getFlagship();
  const architecta = getProduct("architecta");
  const cta = getPrimaryCta();

  return (
    <section
      aria-labelledby="proof-heading"
      className="relative px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <div data-ignite className="max-w-2xl">
          <Kicker>The flagship</Kicker>
          <h2
            id="proof-heading"
            className="type-display-md"
          >
            Meet {prospra.name}. The mentor in your corner.
          </h2>
          <p className="type-lede mt-6 text-white/70">
            Bring a real decision — pricing your first offer, planning a
            launch week, deciding what to do next — and work it through with
            a mentor that knows your business and answers at 2 a.m.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-white/80">
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-intelligence" />
              Works your actual business, not generic advice
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-intelligence" />
              Remembers your context across sessions
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-intelligence" />
              Built by a founder who needed it first
            </li>
          </ul>
          <div className="mt-10">
            <PrimaryCtaLink label={cta.label} href={cta.href} />
          </div>
        </div>

        {/* hero artifact — real Prospra UI, tilting into focus on scroll */}
        {prospra.screenshot ? (
          <div className="mt-16">
            <ProductShot
              src={prospra.screenshot.src}
              alt={prospra.screenshot.alt}
              width={1600}
              height={1050}
              caption={`${prospra.name} — the founder dashboard, ${PRODUCT_STATUS_LABELS[prospra.status].toLowerCase()}`}
              glow="intelligence"
              shot="hero"
            />
          </div>
        ) : null}

        {/* supporting evidence: Architecta + Command Center */}
        <div className="mt-12 grid gap-10 md:grid-cols-2">
          {architecta.screenshot ? (
            <ProductShot
              src={architecta.screenshot.src}
              alt={architecta.screenshot.alt}
              width={1200}
              height={788}
              caption={`${architecta.name} — ${architecta.role.toLowerCase()}, ${PRODUCT_STATUS_LABELS[architecta.status].toLowerCase()}`}
              glow="none"
              shot="support"
            />
          ) : null}
          <ProductShot
            src="/marketing/screenshots/generated/command-center-1200.webp"
            alt="Entrepreneuria Command Center: the Founder Operating Suite showing Prospra, Architecta, and Directorium with a business health score."
            width={1200}
            height={788}
            caption="Command Center — one login. Every light."
            glow="none"
            shot="support"
          />
        </div>
      </div>
    </section>
  );
}
