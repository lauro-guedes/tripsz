import { SITE_URL } from "../lib/siteUrl";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/conta/", "/roteiro/", "/jogos/", "/convite/", "/redefinir-senha"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
