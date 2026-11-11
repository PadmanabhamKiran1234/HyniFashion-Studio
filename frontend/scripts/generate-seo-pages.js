import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(frontendDirectory, "dist");
const siteUrl = (process.env.VITE_SITE_URL || "https://www.hynifashionstudio.com").replace(/\/+$/, "");
const parsedSiteUrl = new URL(siteUrl);

if (!["http:", "https:"].includes(parsedSiteUrl.protocol) || parsedSiteUrl.pathname !== "/" || parsedSiteUrl.search || parsedSiteUrl.hash) {
  throw new Error("VITE_SITE_URL must be an HTTP(S) origin without a path, query, or hash.");
}

const pages = [
  {
    path: "/",
    title: "Hyni Fashion Studio | Boutique Indian Wear & Ethnic Fashion",
    description: "Shop thoughtfully curated Indian wear, kurtis, sarees and occasion styles at Hyni Fashion Studio in Visakhapatnam.",
  },
  {
    path: "/shop",
    title: "Shop Indian Wear & Boutique Fashion | Hyni Fashion Studio",
    description: "Explore the Hyni Fashion Studio collection of thoughtfully selected Indian wear, everyday styles and occasion outfits.",
  },
  {
    path: "/hot-sales",
    title: "Hot Sales & Fashion Offers | Hyni Fashion Studio",
    description: "Discover current offers on boutique Indian wear and favourite Hyni Fashion Studio styles.",
  },
  {
    path: "/new-arrivals",
    title: "New Arrivals | Hyni Fashion Studio",
    description: "Explore the latest arrivals in Indian wear and boutique fashion at Hyni Fashion Studio.",
  },
  {
    path: "/about",
    title: "Our Story | Hyni Fashion Studio",
    description: "Get to know Hyni Fashion Studio and our thoughtfully curated boutique fashion in Visakhapatnam.",
  },
  {
    path: "/contact",
    title: "Contact & Visit Our Vizag Boutique | Hyni Fashion Studio",
    description: "Contact Hyni Fashion Studio or visit our boutique in Asilmetta, Visakhapatnam, Andhra Pradesh.",
  },
  ...[
    ["kurtis", "Kurtis"],
    ["sarees", "Sarees"],
    ["dresses", "Dresses"],
    ["ethnic-wear", "Ethnic Wear"],
    ["tops", "Tops"],
    ["dupattas", "Dupattas"],
  ].map(([slug, name]) => ({
    path: `/category/${slug}`,
    title: `${name} | Shop Indian Wear | Hyni Fashion Studio`,
    description: `Explore ${name.toLowerCase()} and thoughtfully curated Indian wear at Hyni Fashion Studio.`,
  })),
];

const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

function setMeta(html, attribute, key, content) {
  const keyPattern = new RegExp(`\\b${attribute}\\s*=\\s*["']${key}["']`, "i");
  let found = false;
  const updated = html.replace(/<meta\b[^>]*>/gi, (tag) => {
    if (!keyPattern.test(tag)) return tag;
    found = true;
    return `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
  });
  if (found) return updated;
  return updated.replace("</head>", `    <meta ${attribute}="${key}" content="${escapeHtml(content)}" />\n  </head>`);
}

function renderPage(template, page) {
  const canonicalUrl = `${siteUrl}${page.path}`;
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
  html = setMeta(html, "name", "description", page.description);
  html = setMeta(html, "name", "robots", "index, follow");
  html = setMeta(html, "property", "og:type", "website");
  html = setMeta(html, "property", "og:site_name", "Hyni Fashion Studio");
  html = setMeta(html, "property", "og:title", page.title);
  html = setMeta(html, "property", "og:description", page.description);
  html = setMeta(html, "property", "og:url", canonicalUrl);
  html = setMeta(html, "property", "og:image", `${siteUrl}/images/hyni-logo.png`);
  html = setMeta(html, "name", "twitter:card", "summary_large_image");
  html = setMeta(html, "name", "twitter:title", page.title);
  html = setMeta(html, "name", "twitter:description", page.description);
  html = setMeta(html, "name", "twitter:image", `${siteUrl}/images/hyni-logo.png`);
  const canonicalTag = `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`;
  if (/<link\b[^>]*\brel=["']canonical["'][^>]*>/i.test(html)) {
    html = html.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i, canonicalTag);
  } else {
    html = html.replace("</head>", `    ${canonicalTag}\n  </head>`);
  }
  return html;
}

const template = await readFile(path.join(outputDirectory, "index.html"), "utf8");
for (const page of pages) {
  const html = renderPage(template, page);
  if (page.path === "/") {
    await writeFile(path.join(outputDirectory, "index.html"), html);
    continue;
  }
  const routeDirectory = path.join(outputDirectory, page.path.slice(1));
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(path.join(routeDirectory, "index.html"), html);
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map((page) => `  <url><loc>${escapeHtml(`${siteUrl}${page.path}`)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
await writeFile(path.join(outputDirectory, "sitemap.xml"), sitemap);

const robotsPath = path.join(outputDirectory, "robots.txt");
const robots = await readFile(robotsPath, "utf8");
const sitemapDirective = `Sitemap: ${siteUrl}/sitemap.xml`;
const updatedRobots = /^Sitemap:.*$/im.test(robots)
  ? robots.replace(/^Sitemap:.*$/im, sitemapDirective)
  : `${robots.trimEnd()}\n\n${sitemapDirective}\n`;
await writeFile(robotsPath, updatedRobots);

console.log(`Generated SEO pages and sitemap for ${siteUrl}`);
