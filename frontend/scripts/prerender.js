/* Build-time prerender: after `craco build`, generate a static index.html per
 * public route with route-specific <title>, meta, canonical, OG/Twitter, a
 * BreadcrumbList JSON-LD, and route-specific crawlable content inside #root.
 *
 * No headless browser needed - we string-transform the already-built index.html
 * (which already has the correct hashed <script> tags), so each route both:
 *   - serves rich, route-specific HTML to search + AI/agent crawlers (no JS), and
 *   - still boots the SPA for real users (React replaces #root on mount).
 *
 * nginx `try_files $uri $uri/ /index.html` serves build/<route>/index.html for
 * "/route" automatically; unknown routes fall back to the home index.html.
 */
const fs = require("fs");
const path = require("path");

const BUILD = path.join(__dirname, "..", "build");
const SITE = "https://24hourclipping.com";
const BRAND = " | 24 Hour Clipping";
const MAIN_STYLE =
  "max-width:760px;margin:0 auto;padding:64px 24px;color:#e4e4e7;" +
  "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;";

const H1 = "font-size:32px;line-height:1.15;color:#fff;margin:0 0 16px;";
const H2 = "font-size:20px;color:#fff;margin:32px 0 10px;";
const P = "font-size:17px;color:#a1a1aa;margin:0 0 20px;";
const LINK = "color:#CCFF00;font-weight:700;";

const nav =
  `<p style="margin:24px 0 0;">` +
  `<a href="/marketplace" style="${LINK}">Live jobs</a> &nbsp;·&nbsp; ` +
  `<a href="/clippers" style="${LINK}">Clippers</a> &nbsp;·&nbsp; ` +
  `<a href="/docs" style="${LINK}">How it works</a> &nbsp;·&nbsp; ` +
  `<a href="/register" style="${LINK}">Get started</a></p>`;

const ROUTES = [
  {
    path: "/marketplace",
    crumb: "Live jobs",
    title: "Live clipping jobs",
    description:
      "Browse open short-form video clipping jobs from creators and place your bid. Vetted clippers deliver finished clips for TikTok, Reels and Shorts within 24 hours on 24 Hour Clipping.",
    body:
      `<h1 style="${H1}">Live clipping jobs</h1>` +
      `<p style="${P}">Browse open clipping jobs posted by creators on 24 Hour Clipping and bid to win the work. Each brief lists the footage, the budget, the desired output and the deadline. Vetted clippers compete in real time and deliver a finished, ready-to-post short-form clip within 24 hours.</p>` +
      `<h2 style="${H2}">How bidding works</h2>` +
      `<p style="${P}">Clippers place a bid with a price, an estimated turnaround and a short pitch. The creator picks by rating, speed and fit. When the job is funded the 24-hour clock starts, backed by a money-back deadline bond.</p>` +
      nav,
  },
  {
    path: "/clippers",
    crumb: "Clippers",
    title: "Clipper directory",
    description:
      "Browse vetted, rated short-form video clippers on 24 Hour Clipping. Every clipper is manually vetted - hire by rating, on-time percentage and specialty.",
    body:
      `<h1 style="${H1}">Clipper directory</h1>` +
      `<p style="${P}">Every clipper on 24 Hour Clipping is manually vetted. Browse the roster and hire by rating, on-time percentage and specialty - from stream highlights and podcast clips to product and founder content.</p>` +
      `<h2 style="${H2}">Why vetted clippers</h2>` +
      `<p style="${P}">Clippers stake a real-money deadline bond behind every job, so their on-time track record is the score that matters. Miss the 24-hour deadline and the creator gets a full refund plus the bond.</p>` +
      nav,
  },
  {
    path: "/docs",
    crumb: "How it works",
    title: "How it works",
    description:
      "How 24 Hour Clipping works: post footage, get live bids from vetted clippers, and receive a finished short-form clip within 24 hours backed by a deadline bond. Deadlines, bonds and payments explained.",
    body:
      `<h1 style="${H1}">How 24 Hour Clipping works</h1>` +
      `<p style="${P}">24 Hour Clipping connects creators with vetted short-form clippers who deliver finished clips within 24 hours, or your money back.</p>` +
      `<h2 style="${H2}">The steps</h2>` +
      `<ol style="color:#a1a1aa;padding-left:20px;margin:0 0 20px;font-size:17px;">` +
      `<li>Post your footage and set a budget - upload a file or paste a link.</li>` +
      `<li>Vetted clippers bid live with price, turnaround and a pitch.</li>` +
      `<li>Fund the job to start the 24-hour clock. The clipper stakes a deadline bond.</li>` +
      `<li>Review the delivered clip and approve to release payment.</li></ol>` +
      `<h2 style="${H2}">Deadlines, bonds and payments</h2>` +
      `<p style="${P}">If a clipper misses the 24-hour deadline you get a full refund plus their bond. Posting and bidding are free; a single 8% success fee applies only when you approve the finished clip.</p>` +
      nav,
  },
  {
    path: "/register",
    crumb: "Sign up",
    title: "Sign up",
    description:
      "Create your free 24 Hour Clipping account as a creator or a clipper. Post footage and get short-form clips in 24 hours, or earn by clipping for creators.",
    body:
      `<h1 style="${H1}">Create your account</h1>` +
      `<p style="${P}">Join 24 Hour Clipping as a creator to get short-form clips made in 24 hours, or as a clipper to earn by editing for creators. One account does both. Free to join.</p>` +
      nav,
  },
  {
    path: "/login",
    crumb: "Log in",
    title: "Log in",
    description: "Log in to your 24 Hour Clipping account.",
    body:
      `<h1 style="${H1}">Log in</h1>` +
      `<p style="${P}">Log in to 24 Hour Clipping to post jobs, review bids and manage your clips.</p>` +
      nav,
  },
];

function metaReplace(html, attr, key, value) {
  const re = new RegExp(`<meta ${attr}="${key}" content="[^"]*"\\s*/>`);
  return html.replace(re, `<meta ${attr}="${key}" content="${value}"/>`);
}

function render(template, r) {
  const fullTitle = r.title + BRAND;
  const url = SITE + r.path;
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${fullTitle}</title>`);
  html = metaReplace(html, "name", "description", r.description);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${url}"/>`);
  html = metaReplace(html, "property", "og:title", fullTitle);
  html = metaReplace(html, "property", "og:description", r.description);
  html = metaReplace(html, "property", "og:url", url);
  html = metaReplace(html, "name", "twitter:title", fullTitle);
  html = metaReplace(html, "name", "twitter:description", r.description);
  html = html.replace(
    /<main id="seo-fallback"[\s\S]*?<\/main>/,
    `<main id="seo-fallback" style="${MAIN_STYLE}">${r.body}</main>`
  );
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: r.crumb, item: url },
    ],
  };
  html = html.replace(
    "</head>",
    `<script type="application/ld+json">${JSON.stringify(crumbs)}</script></head>`
  );
  return html;
}

function main() {
  const templatePath = path.join(BUILD, "index.html");
  if (!fs.existsSync(templatePath)) {
    console.error("prerender: build/index.html not found - run after `craco build`.");
    process.exit(1);
  }
  const template = fs.readFileSync(templatePath, "utf8");
  let ok = 0;
  for (const r of ROUTES) {
    const html = render(template, r);
    // sanity: the main block must have been replaced
    if (!html.includes(r.title + BRAND)) {
      console.warn(`prerender: title not injected for ${r.path} (check regexes)`);
    }
    const dir = path.join(BUILD, r.path.replace(/^\//, ""));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    ok++;
    console.log(`prerendered ${r.path} -> ${path.relative(BUILD, path.join(dir, "index.html"))}`);
  }
  console.log(`prerender: wrote ${ok} route(s).`);
}

main();
