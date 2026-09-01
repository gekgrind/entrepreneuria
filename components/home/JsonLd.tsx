import { getFlagship } from "@/lib/ecosystem/products";

const BASE = "https://entrepreneuria.io";

/**
 * Homepage structured data. Organization + WebSite establish the entity;
 * SoftwareApplication marks up the flagship. Product names/descriptions
 * come from the registry so markup can never drift from the site copy.
 */
export function JsonLd() {
  const flagship = getFlagship();

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Entrepreneuria",
    url: BASE,
    logo: `${BASE}/logos/entrepreneuria-logo.png`,
    description:
      "An ecosystem of AI-powered mentorship, strategy, and tools for people building a business of their own.",
    sameAs: [
      "https://pinterest.com/entrepreneuriaio",
      "https://x.com/entrepreneuriaio",
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Entrepreneuria",
    url: BASE,
  };

  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: flagship.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: flagship.tagline,
    url: `${BASE}${flagship.link.href}`,
    brand: { "@type": "Organization", name: "Entrepreneuria", url: BASE },
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "USD",
      description: "Free tier at launch",
    },
  };

  return (
    <>
      {[organization, website, software].map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
    </>
  );
}
