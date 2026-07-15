"""Server-rendered SEO/AEO blog for 24 Hour Clipping.

Posts live in Postgres and are rendered here as static, crawlable HTML at /blog
(no JavaScript needed - ideal for search + AI answer engines). A small set of
seed posts ship in-code; after that a daily scheduler auto-generates fresh,
keyword-targeted articles with OpenAI, seasoned with real platform stats.
"""
import html
import re
import random
import unicodedata
from datetime import datetime, timezone

SITE = "https://24hourclipping.com"
LIME = "#CCFF00"

# Rotating topic/keyword angles for the daily auto-generated posts.
TOPICS = [
    "How much it costs to hire a short-form video clipper in {year}",
    "Why demand for short-form clippers is exploding in {year}",
    "How streamers turn one VOD into a week of viral TikTok clips",
    "Podcast clips: turning one episode into 20 shorts that convert",
    "The creator economy's fastest-growing side hustle: clipping",
    "How fast should a short-form clip be delivered? The 24-hour benchmark",
    "TikTok vs Reels vs YouTube Shorts: where clips get the most reach in {year}",
    "What makes a scroll-stopping hook in the first 2 seconds",
    "How founders use short-form clips to grow without an agency",
    "Deadline bonds explained: how to guarantee on-time clip delivery",
    "Pricing your work as a freelance video clipper in {year}",
    "The economics of clipping: what creators pay and clippers earn",
    "Repurposing long-form content into short-form: a practical playbook",
    "Why on-time delivery beats low price when hiring a clipper",
]

CATEGORIES = ["Creator economy", "Clipping 101", "Pricing", "Trends", "How-to", "Demand"]


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9\s-]", "", text).strip().lower()
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:80].strip("-") or "post"


def sanitize_html(body: str) -> str:
    """Keep our own generated markup safe: drop scripts/styles/iframes and any
    inline event handlers. We author the source, so this is defense in depth."""
    body = re.sub(r"(?is)<(script|style|iframe)[^>]*>.*?</\1>", "", body or "")
    body = re.sub(r'(?i)\son\w+="[^"]*"', "", body)
    body = re.sub(r"(?i)\son\w+='[^']*'", "", body)
    body = re.sub(r"(?i)javascript:", "", body)
    return body.strip()


def read_minutes(body_html: str) -> int:
    words = len(re.sub(r"<[^>]+>", " ", body_html or "").split())
    return max(2, round(words / 200))


def _fmt_date(dt: datetime) -> str:
    if not dt:
        return ""
    return dt.strftime("%b %-d, %Y") if hasattr(dt, "strftime") else str(dt)


def _e(s: str) -> str:
    return html.escape(s or "", quote=True)


# ------------------------------- HTML shell -------------------------------
def _page(*, title: str, description: str, canonical: str, body: str,
          keywords: str = "", jsonld: str = "", og_type: str = "website") -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="theme-color" content="#0A0A0A"/>
<title>{_e(title)}</title>
<meta name="description" content="{_e(description)}"/>
{'<meta name="keywords" content="' + _e(keywords) + '"/>' if keywords else ''}
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"/>
<link rel="canonical" href="{_e(canonical)}"/>
<meta property="og:type" content="{og_type}"/>
<meta property="og:site_name" content="24 Hour Clipping"/>
<meta property="og:title" content="{_e(title)}"/>
<meta property="og:description" content="{_e(description)}"/>
<meta property="og:url" content="{_e(canonical)}"/>
<meta property="og:image" content="{SITE}/hero_streamer_a.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{_e(title)}"/>
<meta name="twitter:description" content="{_e(description)}"/>
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet"/>
{jsonld}
<style>
  :root{{--lime:{LIME};}}
  *{{box-sizing:border-box;}}
  body{{margin:0;background:#0A0A0A;color:#e4e4e7;font-family:'Manrope',-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased;}}
  a{{color:var(--lime);text-decoration:none;}}
  a:hover{{text-decoration:underline;}}
  .wrap{{max-width:760px;margin:0 auto;padding:0 24px;}}
  header.nav{{border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;background:rgba(10,10,10,.9);backdrop-filter:blur(10px);z-index:10;}}
  header.nav .wrap{{max-width:1100px;display:flex;align-items:center;justify-content:space-between;height:64px;}}
  .logo{{display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:-.5px;color:#fff;font-size:18px;}}
  .logo .dot{{width:30px;height:30px;border-radius:999px;background:var(--lime);color:#000;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;}}
  .navlinks a{{color:#a1a1aa;font-weight:600;font-size:14px;margin-left:20px;}}
  .navlinks a:hover{{color:#fff;text-decoration:none;}}
  h1{{font-size:38px;line-height:1.15;letter-spacing:-1px;color:#fff;margin:0 0 14px;}}
  h2{{font-size:24px;line-height:1.25;letter-spacing:-.4px;color:#fff;margin:36px 0 12px;}}
  h3{{font-size:19px;color:#fff;margin:28px 0 8px;}}
  p,li{{color:#c4c4cc;font-size:17px;}}
  blockquote{{border-left:3px solid var(--lime);margin:24px 0;padding:6px 0 6px 18px;color:#e4e4e7;font-style:italic;}}
  .eyebrow{{text-transform:uppercase;letter-spacing:2px;font-size:12px;font-weight:800;color:#71717a;}}
  .meta{{color:#71717a;font-size:14px;margin:0 0 28px;}}
  .chip{{display:inline-block;background:rgba(204,255,0,.1);color:var(--lime);border:1px solid rgba(204,255,0,.25);border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700;}}
  .card{{display:block;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:22px 24px;margin:16px 0;background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01));transition:border-color .2s;}}
  .card:hover{{border-color:rgba(204,255,0,.4);text-decoration:none;}}
  .card h2{{margin:8px 0 6px;font-size:22px;}}
  .card p{{margin:0;color:#a1a1aa;font-size:15px;}}
  .cta{{display:inline-block;background:var(--lime);color:#000;font-weight:800;border-radius:999px;padding:14px 30px;margin:8px 0;}}
  .cta:hover{{text-decoration:none;background:#b3e600;}}
  footer{{border-top:1px solid rgba(255,255,255,.08);margin-top:64px;padding:32px 0;color:#71717a;font-size:14px;}}
  footer a{{color:#a1a1aa;}}
  .content{{padding:48px 0 24px;}}
  hr{{border:none;border-top:1px solid rgba(255,255,255,.08);margin:40px 0;}}
</style>
</head>
<body>
<header class="nav"><div class="wrap">
  <a class="logo" href="/"><span class="dot">24</span><span>24HR<span style="color:var(--lime)">CLIPPING</span></span></a>
  <nav class="navlinks">
    <a href="/marketplace">Live jobs</a>
    <a href="/clippers">Clippers</a>
    <a href="/blog">Blog</a>
    <a href="/register">Get started</a>
  </nav>
</div></header>
{body}
<footer><div class="wrap">
  <p style="margin:0 0 8px;color:#fff;font-weight:700;">24 Hour Clipping</p>
  <p style="margin:0 0 12px;">Post footage, vetted clippers bid live, finished short-form clip back in 24 hours - or your money back.</p>
  <p style="margin:0;"><a href="/">Home</a> &nbsp;·&nbsp; <a href="/marketplace">Live jobs</a> &nbsp;·&nbsp; <a href="/clippers">Clippers</a> &nbsp;·&nbsp; <a href="/blog">Blog</a> &nbsp;·&nbsp; <a href="/docs">How it works</a></p>
</div></footer>
</body>
</html>"""


def render_index(posts) -> str:
    cards = ""
    for p in posts:
        cards += (
            f'<a class="card" href="/blog/{_e(p.slug)}">'
            f'<span class="chip">{_e(p.category)}</span>'
            f'<h2>{_e(p.title)}</h2>'
            f'<p>{_e(p.description)}</p>'
            f'<p style="margin-top:10px;color:#71717a;font-size:13px;">{_fmt_date(p.published_at)} · {p.read_minutes} min read</p>'
            f'</a>'
        )
    if not cards:
        cards = '<p style="color:#71717a;">First articles are publishing shortly. Check back soon.</p>'
    blog_ld = {
        "@context": "https://schema.org", "@type": "Blog",
        "@id": f"{SITE}/blog#blog", "name": "24 Hour Clipping Blog",
        "url": f"{SITE}/blog",
        "description": "Insights on short-form video clipping, the creator economy, pricing and demand.",
        "blogPost": [
            {"@type": "BlogPosting", "headline": p.title, "url": f"{SITE}/blog/{p.slug}",
             "datePublished": p.published_at.isoformat() if p.published_at else None}
            for p in posts[:20]
        ],
    }
    import json
    jsonld = f'<script type="application/ld+json">{json.dumps(blog_ld)}</script>'
    body = f"""
<div class="wrap content">
  <span class="eyebrow">The 24 Hour Clipping blog</span>
  <h1>Clipping, content &amp; the creator economy</h1>
  <p class="meta">Fresh, data-backed insights on short-form video, hiring clippers, pricing and demand - updated daily.</p>
  {cards}
  <hr/>
  <p><a class="cta" href="/register">Get clips made in 24 hours &rarr;</a></p>
</div>
"""
    return _page(
        title="Blog - Clipping, content & the creator economy | 24 Hour Clipping",
        description="Fresh, data-backed insights on short-form video clipping, the creator economy, pricing, demand, and how to grow with TikTok, Reels and YouTube Shorts. Updated daily.",
        canonical=f"{SITE}/blog",
        keywords="video clipping, short form content, creator economy, clipper pricing, content demand, TikTok, Reels, Shorts",
        body=body, jsonld=jsonld,
    )


def render_article(post, recent) -> str:
    import json
    article_ld = {
        "@context": "https://schema.org", "@type": "BlogPosting",
        "@id": f"{SITE}/blog/{post.slug}#article",
        "headline": post.title, "description": post.description,
        "url": f"{SITE}/blog/{post.slug}",
        "datePublished": post.published_at.isoformat() if post.published_at else None,
        "dateModified": post.published_at.isoformat() if post.published_at else None,
        "keywords": post.keywords,
        "articleSection": post.category,
        "inLanguage": "en",
        "author": {"@type": "Organization", "name": "24 Hour Clipping", "url": SITE},
        "publisher": {"@type": "Organization", "name": "24 Hour Clipping",
                      "logo": {"@type": "ImageObject", "url": f"{SITE}/favicon.svg"}},
        "mainEntityOfPage": {"@type": "WebPage", "@id": f"{SITE}/blog/{post.slug}"},
    }
    crumb_ld = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE}/blog"},
            {"@type": "ListItem", "position": 3, "name": post.title, "item": f"{SITE}/blog/{post.slug}"},
        ],
    }
    jsonld = (f'<script type="application/ld+json">{json.dumps(article_ld)}</script>'
              f'<script type="application/ld+json">{json.dumps(crumb_ld)}</script>')
    related = ""
    others = [r for r in recent if r.slug != post.slug][:3]
    if others:
        links = "".join(
            f'<a class="card" href="/blog/{_e(r.slug)}"><h2 style="font-size:18px;margin:0 0 4px;">{_e(r.title)}</h2>'
            f'<p>{_e(r.description)}</p></a>' for r in others)
        related = f'<hr/><h2>Keep reading</h2>{links}'
    body = f"""
<div class="wrap content">
  <p style="margin:0 0 16px;"><a href="/blog" style="color:#71717a;font-weight:700;font-size:13px;">&larr; All articles</a></p>
  <span class="chip">{_e(post.category)}</span>
  <h1>{_e(post.title)}</h1>
  <p class="meta">{_fmt_date(post.published_at)} · {post.read_minutes} min read</p>
  <article>{sanitize_html(post.body_html)}</article>
  <hr/>
  <p style="color:#fff;font-weight:700;font-size:19px;margin:0 0 4px;">Want clips like these, made for you?</p>
  <p style="margin:0 0 16px;">Post your footage and vetted clippers deliver a finished, ready-to-post clip within 24 hours - or your money back.</p>
  <p><a class="cta" href="/register">Get started free &rarr;</a></p>
  {related}
</div>
"""
    return _page(
        title=f"{post.title} | 24 Hour Clipping",
        description=post.description, canonical=f"{SITE}/blog/{post.slug}",
        keywords=post.keywords, body=body, jsonld=jsonld, og_type="article",
    )


def render_sitemap(posts) -> str:
    urls = [f"  <url><loc>{SITE}/blog</loc><changefreq>daily</changefreq><priority>0.7</priority></url>"]
    for p in posts:
        lm = p.published_at.date().isoformat() if p.published_at else ""
        urls.append(
            f"  <url><loc>{SITE}/blog/{p.slug}</loc>"
            f"<lastmod>{lm}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>")
    body = "\n".join(urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n'


# ----------------------------- OpenAI generation -----------------------------
def build_messages(topic: str, stats: dict) -> list:
    stat_lines = "\n".join(f"- {k}: {v}" for k, v in (stats or {}).items() if v is not None)
    system = (
        "You are a senior content writer for 24 Hour Clipping, a marketplace where creators "
        "post footage and vetted clippers deliver finished short-form clips (TikTok, Reels, "
        "YouTube Shorts) within 24 hours, backed by a money-back deadline bond. You write "
        "genuinely useful, specific, non-fluffy SEO articles for creators and clippers. "
        "Naturally mention 24 Hour Clipping where relevant, but lead with value."
    )
    user = f"""Write a blog article on this angle: "{topic}".

Use these real, current platform stats where they strengthen the piece (paraphrase naturally, don't dump a list):
{stat_lines or '- (no live stats available; write evergreen)'}

Requirements:
- 600-900 words, concrete and useful (real numbers, examples, steps).
- Target relevant SEO keywords about clipping, short-form video, the creator economy, pricing and demand.
- Include a compelling hook, 3-5 <h2> sections, and where useful <ul>/<li> lists.
- End with a short takeaway.
- Body must be clean HTML using only these tags: p, h2, h3, ul, ol, li, strong, em, blockquote. No <h1>, no images, no scripts, no inline styles.

Return ONLY minified JSON with keys:
{{"title": "compelling <=70 char title", "description": "meta description <=155 chars", "keywords": "5-8 comma-separated keywords", "category": "one of: {', '.join(CATEGORIES)}", "body_html": "the article HTML"}}"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def pick_topic(count: int, year: int) -> str:
    topic = TOPICS[count % len(TOPICS)] if count is not None else random.choice(TOPICS)
    return topic.format(year=year)


# ------------------------------- Seed content -------------------------------
def seed_posts():
    """A few solid launch articles so the blog is never empty. published_at is
    staggered by the caller."""
    return [
        {
            "slug": "how-much-does-it-cost-to-hire-a-clipper",
            "title": "How much does it cost to hire a short-form clipper?",
            "category": "Pricing",
            "description": "What creators actually pay to hire a video clipper for TikTok, Reels and Shorts in 2026 - and how to get the best value.",
            "keywords": "hire a clipper, clipper pricing, short form video cost, TikTok editor rate, video clipping price",
            "body_html": (
                "<p>If you make long-form content and want it turned into scroll-stopping short-form clips, the first question is simple: what does it cost to hire a clipper? The honest answer is that prices range widely - but there are clear bands, and knowing them helps you spend smart.</p>"
                "<h2>The typical price bands</h2>"
                "<p>For a single, polished vertical clip (15-60 seconds) with captions and clean pacing, most creators pay somewhere between <strong>$20 and $150</strong> per clip. Entry-level clippers building a portfolio sit at the low end; specialists who reliably produce viral-quality edits command more.</p>"
                "<ul><li><strong>$20-40:</strong> fast, clean cuts with captions - great for volume.</li><li><strong>$50-90:</strong> stronger hooks, sound design, and on-brand styling.</li><li><strong>$100-150+:</strong> premium editors, motion graphics, and a proven track record.</li></ul>"
                "<h2>Why the deadline matters more than the dollar</h2>"
                "<p>Short-form content is a speed game. A clip about a moment that happened yesterday outperforms the same clip two weeks later. That's why turnaround is part of the price: a clipper who delivers a finished cut in 24 hours is worth more than one who takes a week, even at the same rate.</p>"
                "<blockquote>The best value isn't the cheapest bid - it's the clipper who delivers on time, every time.</blockquote>"
                "<h2>How to get the most for your budget</h2>"
                "<p>Set a clear budget, share a reference clip you love, and let clippers compete. On 24 Hour Clipping, posting a job is free and vetted clippers bid in real time with their price and turnaround. You pick by rating and on-time percentage, and payment is only released when you approve the finished clip.</p>"
                "<h2>The takeaway</h2>"
                "<p>Budget $30-90 for most short-form clips, prioritize on-time delivery over the lowest bid, and use competitive bidding to find the right clipper fast. Speed plus reliability is what actually grows a channel.</p>"
            ),
        },
        {
            "slug": "why-demand-for-clippers-is-exploding",
            "title": "Why demand for short-form clippers is exploding",
            "category": "Demand",
            "description": "Short-form video is eating attention - and creators can't keep up alone. Here's why demand for skilled clippers is surging.",
            "keywords": "demand for clippers, short form video growth, creator economy jobs, video editing demand, clipping side hustle",
            "body_html": (
                "<p>Every major platform now pushes short-form video first. TikTok proved it, and Instagram Reels and YouTube Shorts followed. For creators, that means one thing: you need a steady stream of clips - far more than most people can edit themselves. The result is a fast-growing demand for skilled clippers.</p>"
                "<h2>The content treadmill is real</h2>"
                "<p>A single long-form asset - a stream, a podcast, a webinar - can yield ten or more short clips. Creators who post daily need that volume, but editing is the bottleneck. Outsourcing clips is no longer a luxury; it's how serious creators keep the algorithm fed.</p>"
                "<h2>Clipping is one of the creator economy's best side hustles</h2>"
                "<p>For editors, that demand is an opportunity. Clipping requires a sharp eye for hooks and pacing more than a Hollywood budget. Skilled clippers can build a reliable income working on their own schedule, and the best ones stay booked out.</p>"
                "<ul><li>Low startup cost - editing software and a good ear for moments.</li><li>Repeat clients - creators need clips every week.</li><li>Remote and flexible - work from anywhere, on your hours.</li></ul>"
                "<h2>Speed is the new differentiator</h2>"
                "<p>As supply grows, the clippers who win are the ones who deliver fast and on time. That's why marketplaces built around a 24-hour turnaround - with real accountability - are becoming the default way creators and clippers find each other.</p>"
                "<h2>The takeaway</h2>"
                "<p>Short-form isn't slowing down, and neither is the need for people who can cut it well and fast. Whether you're a creator drowning in footage or an editor looking for steady work, the clipping market is one of the clearest opportunities in content right now.</p>"
            ),
        },
        {
            "slug": "turn-one-vod-into-a-week-of-clips",
            "title": "Streamers: turn one VOD into a week of viral clips",
            "category": "How-to",
            "description": "A practical playbook for streamers to turn a single stream into a week of short-form clips for TikTok, Reels and Shorts.",
            "keywords": "stream highlights, VOD to clips, streamer content, Twitch clips, short form for streamers",
            "body_html": (
                "<p>You already did the hard part - you streamed for hours. Inside that VOD is a week's worth of short-form content, if you know how to mine it. Here's a repeatable playbook to turn one stream into a steady feed of clips.</p>"
                "<h2>1. Mark the moments while you stream</h2>"
                "<p>The fastest way to save editing time is to flag moments live - a clutch play, a funny reaction, a hot take. Even a rough timestamp turns hours of footage into a short shortlist a clipper can work from.</p>"
                "<h2>2. Aim for one strong hook per clip</h2>"
                "<p>Every clip should earn the first two seconds. Lead with the payoff or the tension, not the setup. A great clipper will restructure a moment so the hook lands instantly.</p>"
                "<h2>3. Batch, don't binge</h2>"
                "<p>Pull 5-10 moments from one VOD and schedule them across the week. Consistency beats a single viral spike, and it keeps you present on the algorithm every day.</p>"
                "<ul><li>Vertical, captioned, 15-45 seconds.</li><li>Native to each platform - TikTok, Reels, Shorts.</li><li>One clear idea per clip.</li></ul>"
                "<h2>4. Outsource the edit, keep the output</h2>"
                "<p>You don't need to sit in a timeline for hours. Hand your VOD and timestamps to a vetted clipper and get finished cuts back within 24 hours. That's the whole idea behind 24 Hour Clipping: you stream, they cut, your feed stays full.</p>"
                "<h2>The takeaway</h2>"
                "<p>One VOD is a content goldmine. Flag moments live, prioritize hooks, batch your posts, and let a clipper handle the edit so you can focus on creating.</p>"
            ),
        },
    ]
