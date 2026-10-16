import { SITE_URL } from "../lib/siteUrl";
import { allStadiums } from "../lib/stadiumPages";

export const revalidate = 3600;

export default async function sitemap() {
  const now = new Date();
  const stadiums = await allStadiums().catch(() => []);
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/estadios`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    ...stadiums.map((s) => ({ url: `${SITE_URL}/estadios/${s.slug}`, lastModified: now, changeFrequency: "daily", priority: 0.6 })),
    { url: `${SITE_URL}/termos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacidade`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
