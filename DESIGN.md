---
name: MetalDaze Launcher
description: Console-style (XMB) Minecraft launcher for MetalDaze Estudio's modpacks
colors:
  reactor-teal: "#2dd4bf"
  ion-violet: "#7c5cff"
  bg: "#0a0a0a"
  surface: "#121418"
  surface-2: "#1a1d23"
  border: "#262a31"
  border-lit: "#383d46"
  text: "#f0f0f0"
  text-muted: "#8f98a0"
  text-dim: "#5c6270"
  status-green: "#4caf7d"
  status-red: "#e05a5a"
  status-blue: "#5b9bd5"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(1.3rem, 3vw, 3.4rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.1em"
  body:
    fontFamily: "Barlow, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 300
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  xxl: "2.5rem"
components:
  button-primary:
    backgroundColor: "linear-gradient(135deg, {colors.reactor-teal}, {colors.ion-violet})"
    textColor: "{colors.bg}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "1rem 3.75rem"
  button-primary-hover:
    backgroundColor: "linear-gradient(135deg, {colors.reactor-teal}, {colors.ion-violet})"
    textColor: "{colors.bg}"
  button-secondary:
    backgroundColor: "rgba(255,255,255,0.05)"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.9rem 1.1rem"
  chip:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.3rem 0.75rem"
  instance-tile:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.md}"
    size: "76px"
  nav-item-active:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.text}"
    typography: "{typography.label}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "1.25rem 1.5rem"
  account-chip:
    backgroundColor: "rgba(255,255,255,0.04)"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0.3rem 0.9rem 0.3rem 0.3rem"
---

# Design System: MetalDaze Launcher

## Overview

**Creative North Star: "The Command Deck"**

MetalDaze Launcher reads like the command deck of a game console, not a settings app with a launch button bolted on. The whole system is near-black and quiet at rest — surfaces, borders, and text sit in tight steps of dark gray so nothing competes for attention — until the one thing that matters lights up: the reactor-teal-to-ion-violet gradient marks the primary action or the thing currently selected, and nothing else. This is a redesign that replaced a prior sidebar-and-list layout (Selvania/Steam-library-style) with a horizontal, always-visible instance rail inspired directly by PS3's XMB menu and modern launchers like Deepslate and Twooverse: pick your modpack from a row of tiles, see it take over the whole screen as a hero background, and hit play.

Precision matters more than decoration here. Every interactive surface is flat by default; the gradient and its glow exist only as a *response* — hover, active selection, the primary action — never as ambient texture. The launcher's job is to get a player from "I opened this" to "I'm playing the right modpack" in as few visual decisions as possible, and the command-deck framing supports that: one accent, one clear focal point, everything else recedes.

**Key Characteristics:**
- Near-black, flat-by-default dark surfaces (light theme mirrors the same structure, inverted)
- A single two-stop gradient accent (teal → violet), reserved for primary actions and active/selected state
- Barlow Condensed for all display/label text (often uppercase, wide letter-spacing); Barlow for body copy
- A horizontal, XMB-style instance rail is the system's signature interaction, not a generic list or grid
- Full-bleed panels are pinned to the real viewport (`position: fixed`), never left to resolve through ambiguous percentage-height ancestors

## Colors

Almost entirely neutral dark grays, with exactly one two-stop gradient accent that is deliberately rare.

### Primary
- **Reactor Teal** (#2dd4bf): The cooler stop of the brand gradient. Rarely used alone; mostly seen blended into Ion Violet across gradient fills (primary buttons, active toggles, progress bars) and as the glow color at low opacity around instance-rail hover states.
- **Ion Violet** (#7c5cff): The warmer stop of the brand gradient, and the dominant note in the active-instance glow ring (`rgba(124,92,255,0.35)`), active nav underline, and focus rings on inputs.

### Neutral
- **Bg** (#0a0a0a): The base canvas for every window — home hero, login backdrop, settings panel.
- **Surface** (#121418): Cards, panels, and floating elements sitting one step above the base (settings cards, news blocks, the login card).
- **Surface-2** (#1a1d23): A second, slightly lighter step for elements nested inside a surface (instance tiles, input fields' focus backdrop, the login logo mark).
- **Border** (#262a31) / **Border-lit** (#383d46): Two-step border system — `border` for resting dividers and card edges, `border-lit` for hover/focus states before the accent takes over.
- **Text** (#f0f0f0) / **Text-Muted** (#8f98a0) / **Text-Dim** (#5c6270): Three-step text hierarchy — primary copy, secondary labels (nav items, tags), and the quietest tier (timestamps, hints, dev badge).

### Status
- **Status Green** (#4caf7d): Online/available state (server status dot).
- **Status Red** (#e05a5a): No-instance / blocked play state.
- **Status Blue** (#5b9bd5): Update-available play state.

### Named Rules
**The Rare Accent Rule.** The teal→violet gradient appears on at most one or two elements per screen — the primary action and the thing currently selected. It is never used as a background wash, a decorative border, or repeated across multiple simultaneous elements. Its rarity is what makes it read as "the one thing to notice."

**The Light Theme Is Structural, Not Improvised Rule.** The light theme (`.light` on `<body>`) mirrors every dark-theme token 1:1 (bg/surface/surface-2/border/border-lit/text/text-muted/text-dim) with lightness inverted; the accent gradient and status colors stay identical in both themes. Never hand-tune a light-theme color independent of this mapping.

## Typography

**Display/Label Font:** Barlow Condensed (weights 400/600/700/900), with `sans-serif` fallback.
**Body Font:** Barlow (weights 300/400/500), with `sans-serif` fallback.

**Character:** Barlow Condensed carries almost the entire interface — titles, nav, buttons, tags, section headers — nearly always at wide positive letter-spacing (0.05–0.3em) and often uppercase; it reads assertive and console-like even at small sizes. Barlow (uncondensed) is reserved for anything meant to be read at length: news body copy, setting descriptions, form input text.

### Hierarchy
- **Display** (900, `clamp(1.3rem, 3vw, 3.4rem)`, line-height 1): The selected instance's name on the home hero. The single largest text in the app; appears nowhere else at this size.
- **Title** (700, 1–1.4rem): Panel/section titles — login "MetalDaze", settings "titre-tab" headers, about-card title.
- **Label** (600, 0.7–0.95rem, letter-spacing 0.08–0.15em, frequently uppercase): Nav items, tags/chips, buttons, form labels, tab names — the workhorse style for anything interactive or structural.
- **Body** (300–400, 0.8–0.9rem, line-height 1.6): News content, setting descriptions, help text. Never condensed, never uppercase.

### Named Rules
**The Condensed-for-Structure Rule.** If text labels an interactive element, a section, or a piece of chrome, it's Barlow Condensed. If it's prose meant to be read, it's Barlow. The two fonts are never swapped for decorative reasons.

## Layout

The shell is a frameless Electron window with custom-drawn minimize/maximize/close controls (top-right, `.other .frame`) that must always render above app content — the home top nav reserves right-side padding and the frame's z-index sits above the nav specifically so app UI can never cover the native window controls again.

Home replaced its original left sidebar with a full-width top nav (64px, `position: fixed`) — brand mark, nav links (Inicio/Noticias/Ajustes), account chip on the right — and the entire nav is itself an app-drag-region (with interactive children carved out as no-drag) so the window stays movable without a separate hit-tested drag strip. Below the nav, the hero area (instance rail, selected-instance info, play bar) is pinned edge-to-edge with `position: fixed; top: 64px; left/right: 0; bottom: 0`, not a percentage-height flow child — that distinction matters (see Named Rule below).

Settings uses a fixed-width (210px) left nav rail of stacked tab buttons over a single scrollable content pane per tab (`id` button ↔ `id-tab` content pane pairing), content capped at 700px max-width. Login is a single centered floating card (380px) over a full-bleed dark backdrop. Spacing throughout is rem-based and loosely stepped at 0.5 / 0.75 / 1 / 1.5 / 2 / 2.5rem rather than a strict numeric scale.

### Named Rules
**The Viewport-Pinned Rule.** Any panel meant to fill the remaining window height below a fixed header must be pinned directly to the viewport (`position: fixed` with explicit `top/left/right/bottom`), never given `height: calc(100% - Npx)` inside a normal-flow ancestor chain. Percentage heights silently break when any ancestor in that chain doesn't have an explicit, non-auto height — the home hero was cut off at the bottom window edge from exactly this mistake.

**The Overflow-Needs-Room Rule.** Any element that lifts, scales, or glows on hover/active state must have its scrollable/clipped container padded generously on every side that transform can reach. The instance rail's active tile (lift + scale + glow ring) was visibly clipped at the top and left edge until the rail got explicit padding to match.

## Elevation & Depth

Flat by default, glow as the only depth signal — this system does not use classic drop-shadow elevation layering. Static surfaces (cards, panels, tiles at rest) are distinguished purely by background-lightness step and a 1px border, with no shadow. Depth only appears as a *soft colored glow* (`box-shadow` using the accent or a status color at low opacity) and only in response to state: the active instance tile, a focused input, the primary button, and the login/about logo marks. A handful of static drop-shadows exist purely for physical lift under floating chrome (the login card, the splash frame) — dark, neutral, and unrelated to the accent glow system.

### Shadow Vocabulary
- **Accent glow** (`0 0 0 3px rgba(124,92,255,0.35), 0 8px 22px rgba(0,0,0,0.45)`): Active instance tile, focused inputs, primary buttons — the system's only "this is alive" signal.
- **Neutral lift** (`0 32px 80px rgba(0,0,0,0.7)`): Physical elevation for floating chrome (login card, splash frame) — always neutral black, never tinted.

### Named Rules
**The Glow-Not-Shadow Rule.** Depth communicates state (selected, focused, primary), not hierarchy. If an element needs to look "raised" at rest with no state to justify it, that's a sign it shouldn't be raised at all — use a lighter surface step instead.

## Shapes

A tight three-step radius scale (6 / 10 / 16px) plus a pill (999px) for anything chip-shaped. Small interactive chrome (nav items, small buttons, form inputs) uses 6px; cards, panels, and instance tiles use 10px; large floating containers (login card, about-card) use up to 14–16px. Anything meant to read as a tag, status, or badge (hero tags, account role, playtime chip, theme/close-behavior buttons) is a full pill. Borders are always 1px and always one of the two border tokens — never a heavier weight, never a color outside the border/border-lit/accent set.

## Components

### Buttons
- **Shape:** 6–10px radius depending on size (`{rounded.sm}`–`{rounded.md}`).
- **Primary** (`button-primary`): Filled with the full teal→violet gradient, dark (`{colors.bg}`) text for contrast, no border. Used for exactly one action per screen: play, save, login submit.
- **Hover/Focus:** `filter: brightness(1.08)` plus a small upward translate — never a color swap, since the gradient itself is the identity.
- **Secondary/Ghost** (`button-secondary`): Translucent white-alpha background (`rgba(255,255,255,0.05)`), 1px border token, muted text; border shifts to `border-lit` or the accent on hover.

### Chips
- **Style** (`chip`): Translucent surface pill, 1px border, Label typography, muted text at rest.
- **State:** An active/selected chip (theme choice, close-behavior choice, active account) switches to the accent gradient fill with dark text — same treatment as `button-primary`, reinforcing that gradient = "this is the active/primary one."

### Cards / Containers
- **Corner Style:** 10px (`{rounded.md}`).
- **Background:** `{colors.surface}` on `{colors.bg}`.
- **Shadow Strategy:** None at rest (see Elevation & Depth) — separation comes from the surface/bg contrast and a 1px border.
- **Internal Padding:** 1.25rem 1.5rem typical (settings cards, news blocks).

### Inputs / Fields
- **Style:** `{colors.bg}` fill, 1px border token, 8px radius, Barlow body text.
- **Focus:** Border shifts to the accent (`ion-violet`) plus a soft accent-glow ring (`0 0 0 3px rgba(124,92,255,0.35)`) — never a plain color-only focus state.

### Navigation
- **Top nav (home):** Fixed 64px bar, nav items in Label typography, active item gets a subtle background wash plus a 2px accent underline (`box-shadow: inset 0 -2px 0 0 {colors.ion-violet}`). The bar itself is a drag region; interactive children opt out individually.
- **Settings side-rail:** Stacked full-width tab buttons; active tab gets a background wash and a left-edge accent bar (`inset 3px 0 0 0 {colors.ion-violet}`) instead of a full fill, keeping the rail itself flat.

### Instance Rail (signature component)
The system's defining custom component, replacing what used to be a modal list popup. A horizontal, always-visible, generously-padded row of square tiles (76–132px depending on window width, `{rounded.md}`), each showing the instance's own dedicated `icon` image cropped to a square (or a two-letter initial fallback on solid `{colors.surface-2}` when no icon URL exists), with a small truncated label underneath. The active tile grows to 1.18× its real width/height (not `transform: scale`, which would visually overlap the label below it — see The Layout-Property-Animation Exception rule) and gains the accent glow ring; because the row uses `align-items: flex-start`, the taller active tile grows downward from a shared top edge, matching neighboring tiles. Others lift slightly on hover only. Clicking a tile is the entire interaction model for switching modpacks — there is no separate "selector button" anymore.

### Named Rules
**The Icon-Is-Not-The-Background Rule.** An instance's `icon` (small, square, used for the rail tile) and its `background` (large, scene-setting, used for the full hero backdrop) are two independent fields with two independent purposes. Never fall back to `background` for the tile when `icon` is missing — a wide atmospheric photo crushed into a 76px square reads as noise, not a logo. Missing icon falls back to two-letter initials instead.

## Do's and Don'ts

### Do:
- **Do** keep the accent gradient to one or two elements per screen (The Rare Accent Rule).
- **Do** pin any full-height panel to the real viewport with `position: fixed` rather than a percentage-height chain (The Viewport-Pinned Rule).
- **Do** pad any container that clips overflow generously enough for its children's hover/active transforms and glows (The Overflow-Needs-Room Rule).
- **Do** keep the Luuxis/Selvania Launcher credit visible in About/README/license — a durable brand commitment, never cosmetic.
- **Do** keep instance-tile art (`icon`) and hero background art (`background`) as separate fields, falling back to initials rather than crossing them (The Icon-Is-Not-The-Background Rule).
- **Do** animate `transform`/`opacity`/color properties for hover and state changes, not `width`/`height`/`padding`/`margin` (layout thrash) — the one exception is the instance tile's active-size change, which needs a real box-size change so the flex layout reserves space correctly instead of overlapping the label below it; there, only `transform`/`border-color`/`box-shadow` animate and the size change itself snaps instantly.

### Don't:
- **Don't** cover the native window frame controls (minimize/maximize/close) with new full-width fixed chrome — always check z-index and reserve the top-right ~110px.
- **Don't** reintroduce a modal/popup for instance switching — the always-visible rail is the committed interaction model.
- **Don't** use literal photographic or meme placeholder imagery for brand assets (icon, backgrounds) — until real MetalDaze Estudio art lands, placeholders stay abstract gradient-based art in the same accent family.
- **Don't** give a static, non-interactive surface a shadow to fake hierarchy — use a lighter surface step instead (The Glow-Not-Shadow Rule).
