import TripszApp from "../components/TripszApp";
import { SITE_URL } from "../lib/siteUrl";
import { LANDING_FAQS } from "../lib/landingFaqs";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#org`, name: "tripsz", url: SITE_URL, logo: `${SITE_URL}/icon.png` },
    { "@type": "WebSite", "@id": `${SITE_URL}/#site`, url: SITE_URL, name: "tripsz", inLanguage: "pt-BR", publisher: { "@id": `${SITE_URL}/#org` } },
    {
      "@type": "FAQPage",
      mainEntity: LANDING_FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TripszApp />
    </>
  );
}
