# Vellum — A Portable Design Language

> **Vellum** is the Covenant aesthetic, extracted from a single product and turned into a
> transferable system. It is a *calm, premium, editorial, trust-first* look: monochrome UI,
> an editorial serif paired with a clean sans, photography (not colour) for warmth, black as
> the only action colour, and motion that is slow and alive.
>
> Point this file at **any** website — a SaaS dashboard, a marketing page, a docs site, a
> store, a blog — or use it to build one from scratch. The output should feel like it was
> set by a typographer who hates clutter, not assembled from a component kit.
>
> This is the single source of truth. If something here conflicts with a habit, a template
> default, or "what most sites do" — Vellum wins.

---

## 0. How to use this file (read first)

You are (or are driving) an agent/designer applying Vellum to a target. **Before touching a
single line of code, you must run the Intake in §1 and ask the user the Mode Question.**
Everything downstream depends on the answer.

The flow is always:

```
INTAKE  →  MODE QUESTION  →  AUDIT  →  TOKENS  →  TYPE  →  COMPONENTS  →  MOTION  →  QA
```

Never skip Intake. Never apply styling before you have decided the Mode. Never invent a
coloured brand accent (see §3, the one unbreakable rule).

---

## 1. Intake — what to ask before you start

Run this as a short conversation, one cluster at a time. Default sensibly when the user
says "you decide", but **always** ask the Mode Question explicitly — it changes everything.

### 1.1 The Mode Question (ask this first, every time)

> **"Do you want me to *recreate the structure* of this site in the Vellum system, or *keep
> your existing structure* and apply Vellum styling on top of the whole frontend?"**

Offer the two modes plainly:

- **Mode A — Restyle in place (non-destructive).** Keep every page, route, section, and
  DOM structure exactly as it is. Vellum changes only the *skin*: colours, type, spacing,
  radius, motion, component treatment. Lowest risk. Nothing moves; it just gets quiet and
  premium. *Choose this for: live sites, large apps, anything you can't afford to break,
  or when the information architecture is already good.*

- **Mode B — Restructure with Vellum (editorial rebuild).** Re-lay-out the page(s) around
  Vellum's canonical section rhythm (§8): full-bleed hero → quiet pillars → scroll-pinned
  explainer → single clear offer → marquee proof → founder/voice → final CTA → footer.
  Content is preserved and re-homed into these patterns; the *arrangement* changes.
  *Choose this for: greenfield builds, tired marketing pages, or "make it feel like
  Covenant", where the current layout is the problem.*

A **hybrid** is allowed and common: Mode B for the marketing/landing surface, Mode A for
the app/dashboard/checkout behind the login. If the user is unsure, **recommend Mode A
first** (ship the skin, prove the value, restructure later) and say so.

**If they choose Mode A, ask the depth follow-ups** (these don't apply to Mode B, which
always adopts Vellum fully):

> **"Should I also adopt Vellum's *colour scheme* and *fonts*, or keep your existing ones?"**

Offer each independently — the user can mix:

- **Colour:** *Adopt Vellum* (warm paper + ink + photography-as-colour; strip existing
  accents — the full effect) **·** *Keep existing palette* (apply only Vellum's structure,
  spacing, radius, button shape, and motion; leave your current colours intact — a lighter,
  safer reskin). If they keep their palette, still **nudge** them off pure `#000`/cold greys
  toward warm equivalents and off any decorative gradients, but don't override their hues.
- **Fonts:** *Adopt the serif + sans pair* (the editorial voice — recommended; it's most of
  the effect) **·** *Keep current fonts* (apply only the serif/sans *role split* — headings
  vs. body — to whatever typefaces you already load) **·** *Serif only on headings* (adopt
  Vellum's serif for display, keep your existing sans for body — a common, high-impact middle
  ground).

Record each choice. If the user keeps their own colours **and** fonts, Mode A reduces to
"structure, shape, spacing, buttons, and motion only" — that's a valid, deliberately light
application; note it so QA (§13) doesn't flag the retained palette/type as a violation.

Record the decision at the top of your work log. Every later instruction in this file is
annotated **[A]**, **[B]**, or **[A+B]** so you know whether it applies.

### 1.2 Brand & content inputs (gather, then default)

| Ask | Why it matters | Sensible default if "you decide" |
| --- | --- | --- |
| **Brand name / wordmark** | Drives the lowercase serif wordmark | The repo/site name, lowercased |
| **Do you have real photography?** | Vellum gets its colour from photos | If none: use a warm, candid, documentary stock set; never illustration or 3D blobs |
| **Serif preference?** | The voice of the brand (§4) | Source Serif 4 (free, editorial, warm) |
| **Sans preference?** | Body/UI voice (§4) | Source Sans 3 (its natural pair) |
| **Hard accent colour required?** (e.g. regulated logo) | Vellum is monochrome | Refuse a *UI* accent; allow the logo to keep its colour, nothing else |
| **Tone of voice** | Copy rewrite in Mode B | Plain, warm, expert; short sentences |
| **Dark mode needed?** | Token strategy | Provide it (§3.4) but default surface is warm cream, *not* dark |
| **Tech stack** | How tokens are delivered | Detect it; Tailwind preferred, CSS variables always |
| **Density tolerance** | Dashboards need tighter rhythm than landings | Marketing = generous (§5); app = "compact Vellum" (§5.4) |

### 1.3 Output a one-paragraph plan before coding

Echo back: the Mode, the font pair, whether photography exists, the stack, and the list of
files/sections you will touch. Get a nod. *Then* build.

---

## 2. The audit (do this before you change anything) — [A+B]

You cannot apply restraint to a page you haven't read. Inventory the target first:

1. **Surfaces** — list every page/route and classify each: *marketing*, *app/dashboard*,
   *form/flow*, *content/blog*, *legal/footer-ish*.
2. **Type** — what fonts are loaded? Is there any heading/body distinction? Note every
   place size/weight is used so you can collapse them onto the scale in §4.
3. **Colour** — extract the current palette. Every saturated accent, gradient, and coloured
   button is a candidate for **deletion** (replaced by ink, contrast, or a photo).
4. **Components** — catalogue buttons, cards, nav, modals. Map each to a Vellum pattern (§7).
5. **Motion** — note anything that loops, autoplays, or bounces. It must gain a hover-pause
   and a `prefers-reduced-motion` off-switch, or be cut.
6. **Risk** — flag anything load-bearing (auth, checkout, data tables) so Mode A stays
   non-destructive there.

Deliver the audit as a short table: *element → current → Vellum treatment → risk*. This is
your worklist.

---

## 3. Colour — monochrome UI, photography as colour

The whole interface is **warm off-white, warm near-black ink, and white.** Colour enters
through full-bleed human photography and, sparingly, a few muted pastel cards. That's it.

### 3.1 The one unbreakable rule

> **No coloured brand accent. Ever.** No blue, no gold, no purple "primary". If a design
> seems to need an accent, the answer is one of three things: **contrast** (a black pill),
> **scale** (a bigger serif), or a **photograph**. A regulated logo may keep its own colour;
> the *UI* may not borrow it.

If you only remember one thing from Vellum, remember this. Most "off-brand Vellum" failures
are someone sneaking an accent colour back in.

### 3.2 Tokens (portable — ship as CSS variables, map into Tailwind)

These are intentionally **generic** (no product-specific names). Warm, never cold; the ink
is a warm near-black, **not** `#000`.

```css
:root {
  /* Ink — warm near-black. Text, headings, dark sections, the black pill. */
  --ink:          #1A1816;   /* primary ink (NOT pure black) */
  --ink-mid:      #2B2826;   /* hover/pressed state of the ink */
  --ink-soft:     #48433F;   /* rare low-emphasis warm fill */
  --muted:        #6A7282;   /* secondary text when warm grey is wanted */

  /* Surfaces — the canvas is warm off-white, not white. */
  --paper:        #F9F8F6;   /* page background — the default canvas */
  --paper-raised: #F0EDE9;   /* subtle raised / striped surfaces on paper */
  --paper-deep:   #ECE9E3;   /* footer / deepest warm surface */
  --white:        #FFFFFF;   /* genuine white sections, for rhythm */

  /* Pastels — muted card backgrounds ONLY (testimonials, soft tiles). Cycle in order.
     Never saturated, never used as UI accents or buttons. */
  --pastel-1:     #DDE4D8;   /* sage  */
  --pastel-2:     #EFE7DA;   /* tan   */
  --pastel-3:     #D8E3EC;   /* blue  */
  --pastel-4:     #E7E4DD;   /* stone */
  --pastel-5:     #EEE1DC;   /* rose  */

  /* Shape & rhythm */
  --radius-card:  24px;      /* cards, panels, tiles, image frames */
  --radius-pill:  9999px;    /* buttons, chips, avatars */
}
```

Tailwind mapping (any version; rename freely, keep the roles):

```ts
// tailwind.config.ts → theme.extend
colors: {
  ink:    { DEFAULT: '#1A1816', mid: '#2B2826', soft: '#48433F' },
  paper:  { DEFAULT: '#F9F8F6', raised: '#F0EDE9', deep: '#ECE9E3' },
  muted:  '#6A7282',
  pastel: { 1:'#DDE4D8', 2:'#EFE7DA', 3:'#D8E3EC', 4:'#E7E4DD', 5:'#EEE1DC' },
},
borderRadius: { card: '24px' },
```

### 3.3 Rules

- The page is **paper** (warm off-white). Sections alternate **paper ↔ white ↔ full-bleed
  photo** to create rhythm. The **footer** is the one persistently deeper-warm surface
  (`--paper-deep`).
- Headings & primary copy → `--ink`. Body & secondary copy → a warm grey (`text-gray-500`
  or `--muted`). Never cold `#666` on cold white.
- Pastels appear **only** as muted card fills and cycle in order. They are never text,
  never buttons, never borders.
- **No gradients as decoration.** The only gradient allowed is a *dark legibility scrim*
  over photography (§9).

### 3.4 Dark mode (optional, provide if asked)

Invert the temperature, keep it warm. `--paper` → `#171513` ink-dark; text → `#F4F1EC`;
the black pill becomes a **paper-white pill with ink text**. Pastels stay muted but drop ~8%
lightness. Photography still carries the colour. Never ship a cold, blue-black dark mode.

---

## 4. Typography — the editorial serif + clean sans is the brand

The contrast between a serif headline and a sans body **is** the identity. Get this right and
the page already feels like Vellum before you've styled anything else.

- **Display / headings → serif.** Default `Source Serif 4` (swap for any warm editorial
  serif: Spectral, Newsreader, Lora, Fraunces at low optical contrast). Weight **500–600**,
  tight leading. Every `h1`–`h6` is serif **by default** — set it globally, don't opt in
  per heading. The serif also carries: hero headline, section titles, the price, every
  question in a flow, every pull-quote, every testimonial.
- **Body / UI → sans.** Default `Source Sans 3` (swap for Inter, IBM Plex Sans, Public
  Sans). Paragraphs, labels, nav links, button text, captions, footnotes.
- **Base size 15px.** The scale runs roughly:

  | Role | Size |
  | --- | --- |
  | Hero headline | `text-5xl → text-7xl` serif |
  | Section heading | `text-4xl → text-5xl` serif |
  | Question / lead copy | `text-[20px] → text-[22px]` serif |
  | Body | `text-[15px] → text-[17px]` sans |
  | Muted detail / caption | `text-[13px] → text-[14px]` sans |

> **The serif rule:** if it's a **headline, a question, a quote, or a price** → serif.
> Everything else → sans. When in doubt, ask "is this the *voice* or the *interface*?"
> Voice is serif; interface is sans.

Load fonts via the framework's font pipeline (e.g. `next/font`), expose as CSS variables,
ship a system fallback stack so first paint isn't naked.

---

## 5. Layout, spacing & shape

- **Container** — a single centred max width (`max-w-7xl`) with responsive horizontal
  padding. The wordmark, nav, and hero headline **share the same left edge** — alignment is
  a feature, not an accident.
- **Section rhythm** — generous vertical padding (`py-20 lg:py-28`). White space is the
  primary design element; when unsure, add more.
- **Radius** — `--radius-card` (24px) for cards, panels, tiles, image frames;
  `--radius-pill` for buttons, chips, avatars. Two radii, no others.
- **Alternating backgrounds** — `paper → white → photo → paper …` down the page. Never two
  identical adjacent section backgrounds.
- **Full-bleed sections** break out of the container edge-to-edge (hero, scroll-pinned
  explainer, final CTA). Text over them sits over a dark scrim (§9).

### 5.4 Compact Vellum (for apps & dashboards) — [A]

When restyling a dense product surface, keep the *language* but tighten the *rhythm*:
section padding drops to `py-8 → py-12`, the type scale shifts down one step, cards keep the
24px radius but gain tighter internal padding. **Restraint, warmth, the serif/sans split,
and the no-accent rule still hold.** A Vellum dashboard is calm and warm — it does not become
a rainbow of status colours. Use ink + weight + one muted pastel for state, not saturated
semantic colours. (If true semantic colour is unavoidable — e.g. a destructive action —
desaturate it heavily and use it as text/icon, never as a fill.)

---

## 6. Buttons — black is the action colour

- **Primary** — a **solid black (ink) pill**, white text, `--radius-pill`, a subtle press
  scale (`active:scale-[0.98]`). This is *the* call to action. Hover → `--ink-mid`.
- **On photography** — a **white pill with ink text**, same shape, for contrast over imagery.
- **Tertiary** — a plain text link with a chevron ("See how it works"). Inherits white over
  photos, ink on light surfaces. No outline buttons, no ghost-button zoo.

```css
/* globals.css — the canonical pair */
.btn-primary {
  background: var(--ink); color: #fff;
  border-radius: var(--radius-pill);
  padding: 0.75rem 1.5rem; font-weight: 600;
  transition: transform .15s ease, background .2s ease;
}
.btn-primary:hover  { background: var(--ink-mid); }
.btn-primary:active { transform: scale(.98); }

.btn-on-photo { background: #fff; color: var(--ink); /* same shape */ }
```

One primary style, one on-photo style, one text style. That's the entire button system.

---

## 7. Components & patterns (abstracted from Covenant)

Each pattern below is described generically so it maps onto *any* site's equivalent section.
In **Mode A** you reskin the existing component to match; in **Mode B** you build the section
as described.

### Navbar
Transparent with a **white** wordmark + links while over the hero; on scroll it collapses
into a **floating white pill** with ink text and a single black primary pill. Wordmark is the
lowercase serif brand name. — *Mode A: just restyle the existing nav's two states.*

### Hero
Full-bleed photograph, dark left/bottom scrim, **white serif headline** + subcopy positioned
**lower-left**, aligned to the container's left edge. Optional small trust pill and a
scroll cue. — *No photography? Use a near-full-bleed warm-paper hero with an oversized serif
headline and one black pill; never a coloured gradient hero.*

### Pillars / value props
Centred serif heading + **plain text columns** (title + short description). **No cards, no
icons, no borders** — pure typography. This is the most-violated pattern; resist the urge to
box it.

### Scroll-pinned explainer ("How it works")
A tall section whose inner `sticky top-0 h-screen` panel holds a fixed full-bleed image while
the **active step advances with scroll progress**. A vertical, clickable step list sits to
the side. — *Mode A on an app: a simpler stepped/anchored section is an acceptable downgrade;
keep the pinned image if the perf budget allows.*

### The offer / pricing
Centred eyebrow + a **large serif price/headline**, then a **full-width striped feature list**
(`<dl>` rows, alternating subtle stripe). One clear offer beats three tiers. No photo here —
let the type carry it.

### Testimonials / proof
A continuous, **slow marquee** of uniform fixed-size cards in muted pastels (cycle
`--pastel-1…5`), with one **black stat card** for rhythm. **Pauses on hover**, halts under
`prefers-reduced-motion`.

### Founder / voice + secondary list
Two columns on paper: a large serif **pull-quote** (avatar + name) on the left; a divided-row
list (title · detail · description) on the right.

### Final CTA
Full-bleed human photograph, dark scrim, white serif "Ready to get started?" + a white pill.

### Footer
The deepest warm surface (`--paper-deep`). Lowercase serif wordmark + a one-line disclaimer
on the left; tidy link columns on the right; a quiet legal/copyright bottom row.

### Conversational form (for any multi-step flow / questionnaire / onboarding)
Turn the form into a **chat**, not a grid of fields:
- Minimal header: a segmented progress bar, centred wordmark, a restart icon.
- An assistant avatar appears **only on the active question**; answered turns collapse into
  quiet greyed history.
- Assistant messages **stream in character-by-character** with a blinking caret; the answer
  control (white tiles / Continue / input) appears only once the text finishes.
- The user's answer renders as a **right-aligned pill**; the view auto-scrolls to the newest
  turn. — *This single pattern makes any boring form feel like Vellum. Use it for checkout
  steps, surveys, settings wizards.*

### Cookie / system notice
A dismissible **dark bar** pinned to the bottom, rendered only after mount (no hydration
flash), dismissal remembered in `localStorage`.

---

## 8. Canonical section rhythm (Mode B blueprint) — [B]

When restructuring, re-home the site's content into this order. Not every site needs every
section — drop, don't pad — but keep the *sequence* and the *background alternation*:

```
1. Navbar            (transparent → floating pill)
2. Hero              (full-bleed photo, lower-left serif)         [photo]
3. Pillars           (plain-text value columns)                  [paper]
4. Scroll explainer  (pinned image, scroll-driven steps)         [photo]
5. The offer         (serif price + striped feature list)        [white]
6. Proof             (slow pastel marquee + one black stat)       [paper]
7. Founder / voice    (serif pull-quote + divided list)           [paper/white]
8. Final CTA         (full-bleed photo, white pill)              [photo]
9. Footer            (deep-warm, serif wordmark, link columns)   [paper-deep]
```

Map the user's content onto this skeleton during Intake; show them the mapping before you
build. Anything that doesn't fit (a data table, a feature grid) gets the **compact Vellum**
treatment (§5.4) rather than a coloured component.

---

## 9. Motion

| Pattern | Where | Feel |
| --- | --- | --- |
| **Streaming text** | Conversational flows | Live, human, conversational |
| **Scroll-pin + step** | The explainer | Immersive, deliberate; user controls pace |
| **Slow marquee** | Proof / testimonials | Ambient drift; pauses on hover |
| **Hover lift** | Tiles & cards | `-translate-y` + soft shadow; small, quick |
| **Reveal / slide** | Section entrances | `slide-up` / fade; 200–500ms, ease-out |

All motion is **smooth and unhurried**. Nothing bounces, nothing is fast, nothing is loud.
**Every loop/autoplay must pause on hover and disable under `prefers-reduced-motion`** — no
exceptions. Reduced motion is a correctness requirement, not a nicety.

---

## 10. Imagery

- Warm, candid, **human**, documentary photography — real people and real context, never
  posed stock, never illustration, 3D blobs, or gradient meshes.
- Photos run **full-bleed** in the hero, the explainer, and the final CTA.
- Over any photo, apply a **dark gradient scrim**, heavier on the side the text sits, so
  white serif text stays legible. This is the *only* sanctioned gradient.
- Use licensed photography before production; placeholders are fine while building but flag
  them.
- **No photography available?** Lean harder on typography and white space: oversized serif
  on warm paper, generous margins, one black pill. A type-only Vellum page is still Vellum.
  A page that fakes warmth with a coloured gradient is not.

---

## 11. Voice & tone

Plain, warm, and expert. **Short sentences.** Reassuring, never salesy or jargon-heavy.
Explain *why* something matters, not just what it is. In flows: conversational,
one-question-at-a-time. In Mode B you may lightly rewrite copy to this register; in Mode A
leave copy alone unless asked. Headlines and questions are serif and earn their size by
saying something real — never lorem, never "Empower your synergy."

---

## 12. Application playbook (step-by-step for the agent)

1. **Intake** (§1) — gather inputs, ask the **Mode Question**, echo a one-paragraph plan,
   get a nod.
2. **Audit** (§2) — inventory surfaces, type, colour, components, motion, risk → worklist.
3. **Tokens** (§3) — install CSS variables + Tailwind mapping. Delete existing accent
   colours and decorative gradients. This step alone transforms the feel.
4. **Type** (§4) — load the serif/sans pair, set `h1–h6` to serif globally, collapse the old
   size soup onto the scale.
5. **Shape & rhythm** (§5) — apply the two radii, the container, alternating backgrounds,
   generous (or compact) padding.
6. **Buttons** (§6) — replace every button variant with the one black pill (+ on-photo +
   text link). Delete the rest.
7. **Components** (§7) — Mode A: reskin in place. Mode B: rebuild into the §8 rhythm.
8. **Motion** (§9) — slow everything down; add hover-pause + reduced-motion to every loop.
9. **Imagery** (§10) — full-bleed photos + scrims, or type-only fallback.
10. **QA** — run the checklist (§13). Diff against the audit. Confirm nothing load-bearing
    broke (especially Mode A).

Work surface-by-surface, ship incrementally, keep each step reviewable.

---

## 13. QA checklist (acceptance criteria)

Ship only when **all** of these are true:

- [ ] **No coloured UI accent** anywhere — actions are black pills; emphasis is contrast,
      scale, or photo. (The single most important check.)
- [ ] Ink is warm near-black (`#1A1816`-ish), **never** `#000`. Neutrals are warm, never cold.
- [ ] Every heading, question, quote, and price is **serif**; everything else is **sans**.
- [ ] The page background is warm **paper**, and section backgrounds **alternate** (no two
      identical adjacent).
- [ ] Exactly **two radii** in use (24px cards, full pills).
- [ ] **One** primary button style (+ on-photo + text link). No outline/ghost zoo.
- [ ] Decorative gradients are gone; the only gradient is a photo scrim.
- [ ] Every loop/autoplay **pauses on hover** and **respects `prefers-reduced-motion`**.
- [ ] Photography is warm/human/documentary, or the page is honestly type-only — never faked
      with colour.
- [ ] Generous white space; the page reads like print, not a dashboard.
- [ ] **Mode A:** no route, DOM contract, or load-bearing flow (auth/checkout/data) broke.
- [ ] **Mode B:** content was preserved and re-homed; nothing was lost, only rearranged.

---

## 14. Quick do / don't

**Do**
- Lead with a serif headline and a lot of space.
- Use black pills for actions and photography for warmth.
- Keep history/secondary content quiet; emphasise the one active thing.
- Alternate paper → white → photo for rhythm.
- Ask the Mode Question before you touch anything.

**Don't**
- Introduce a coloured brand accent (no blue/gold/purple). *This is the cardinal sin.*
- Box everything in cards, icons, and borders — especially the pillars.
- Use pure black `#000` or cold grey; keep ink and neutrals warm.
- Animate fast, bounce, or loop without a hover-pause and reduced-motion fallback.
- Fake warmth with a gradient when you have no photo — go type-only instead.
- Restructure a live app in Mode A, or restyle-only when the user asked for Mode B.

---

## 15. Failure modes (how Vellum goes wrong)

- **"It looks like every other SaaS site."** → An accent colour crept back in, or buttons
  gained outlines/colours. Return to monochrome + black pill.
- **"It feels cold / clinical."** → Pure black, cold greys, or pure-white background. Warm
  every neutral; switch the canvas to paper.
- **"It's busy."** → Cards and icons everywhere, especially on the pillars. Strip to
  plain-text typography and white space.
- **"It feels cheap."** → Sans headlines, or a system-default serif at the wrong weight.
  Restore the editorial serif at 500–600 and let it be big.
- **"The motion is annoying."** → Something loops fast or without a pause. Slow it, pause on
  hover, honour reduced motion.
- **"You broke the app."** → Restructured in Mode A. Mode A is skin-only; never move the DOM.

---

*Vellum is restraint with a warm heart. When a decision is unclear, choose the quieter
option, make the type do the talking, and let a photograph carry the colour.*
