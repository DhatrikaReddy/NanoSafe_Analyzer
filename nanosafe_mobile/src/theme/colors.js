// ============================================================
// NanoSafe Analyzer — Mobile Color Theme
// Exact match to web app dark mode CSS variables (style.css)
//
// Web var                  → Mobile key
// --ns-primary             → primary        #14b8a6
// --ns-primary-hover       → primaryDark    #2dd4bf
// --ns-primary-glow        → primaryGlow    rgba(20,184,166,0.2)
// --ns-primary-light       → primaryLight   rgba(20,184,166,0.12)
// --ns-accent              → accent         #38bdf8
// --ns-accent-light        → accentLight    rgba(56,189,248,0.12)
// --ns-bg-main             → background     #090d16
// --ns-bg-sidebar          → sidebar        #0f172a
// --ns-bg-card             → card           #131d31
// --ns-bg-card-hover       → cardHover      #18243c
// --ns-bg-input            → inputBg        #1e293b
// --ns-bg-hover            → hover          #1e293b
// --ns-text-main           → text           #f8fafc
// --ns-text-muted          → textSecondary  #94a3b8
// --ns-text-sub            → textMuted      #64748b
// --ns-border-main         → border         #1e293b
// --ns-border-input        → borderInput    #334155
// --ns-border-subtle       → borderSubtle   rgba(255,255,255,0.08)
// --ns-safe-bg             → safeBg         rgba(5,150,105,0.15)
// --ns-safe-text           → safe           #34d399
// --ns-safe-border         → safeBorder     rgba(52,211,153,0.3)
// --ns-mod-bg              → moderateBg     rgba(217,119,6,0.15)
// --ns-mod-text            → moderate       #fbbf24
// --ns-mod-border          → moderateBorder rgba(251,191,36,0.3)
// --ns-toxic-bg            → dangerBg       rgba(220,38,38,0.15)
// --ns-toxic-text          → danger         #f87171
// --ns-toxic-border        → dangerBorder   rgba(248,113,113,0.3)
// ============================================================

export const colors = {
  // ── Brand / Primary (teal) ──────────────────────────────
  primary:       '#14b8a6',                    // --ns-primary
  primaryDark:   '#2dd4bf',                    // --ns-primary-hover
  primaryGlow:   'rgba(20, 184, 166, 0.2)',    // --ns-primary-glow
  primaryLight:  'rgba(20, 184, 166, 0.12)',   // --ns-primary-light

  // ── Accent (sky blue) ────────────────────────────────────
  accent:        '#38bdf8',                    // --ns-accent
  accentLight:   'rgba(56, 189, 248, 0.12)',   // --ns-accent-light

  // ── Backgrounds ──────────────────────────────────────────
  background:    '#090d16',                    // --ns-bg-main      (darkest page bg)
  sidebar:       '#0f172a',                    // --ns-bg-sidebar
  card:          '#131d31',                    // --ns-bg-card
  cardHover:     '#18243c',                    // --ns-bg-card-hover
  inputBg:       '#1e293b',                    // --ns-bg-input
  hover:         '#1e293b',                    // --ns-bg-hover

  // ── Text ─────────────────────────────────────────────────
  text:          '#f8fafc',                    // --ns-text-main
  textSecondary: '#94a3b8',                    // --ns-text-muted
  textMuted:     '#64748b',                    // --ns-text-sub

  // ── Borders ──────────────────────────────────────────────
  border:        '#1e293b',                    // --ns-border-main
  borderInput:   '#334155',                    // --ns-border-input
  borderFocus:   '#14b8a6',                    // matches primary for focus rings
  borderSubtle:  'rgba(255, 255, 255, 0.08)', // --ns-border-subtle

  // ── Status: Safe / Non-toxic ─────────────────────────────
  safe:          '#34d399',                    // --ns-safe-text
  safeBg:        'rgba(5, 150, 105, 0.15)',    // --ns-safe-bg
  safeBorder:    'rgba(52, 211, 153, 0.3)',    // --ns-safe-border

  // ── Status: Moderate toxicity ────────────────────────────
  moderate:      '#fbbf24',                    // --ns-mod-text
  moderateBg:    'rgba(217, 119, 6, 0.15)',    // --ns-mod-bg
  moderateBorder:'rgba(251, 191, 36, 0.3)',    // --ns-mod-border

  // ── Status: Dangerous / High toxicity ────────────────────
  danger:        '#f87171',                    // --ns-toxic-text
  dangerBg:      'rgba(220, 38, 38, 0.15)',    // --ns-toxic-bg
  dangerBorder:  'rgba(248, 113, 113, 0.3)',   // --ns-toxic-border

  // ── Info / Neutral ────────────────────────────────────────
  info:          '#38bdf8',                    // same as accent (sky blue)
  infoBg:        'rgba(56, 189, 248, 0.12)',   // same as accentLight

  // ── Legacy aliases (backward-compat for existing screens) ─
  // primaryLight was rgba but screens use it as icon/text color → solid teal
  primaryLight:  '#2dd4bf',    // solid teal — use as icon/text color
  // textMain alias for colors.text
  textMain:      '#f8fafc',
  // surface alias for card
  surface:       '#131d31',
  // subtle alias for borderSubtle
  subtle:        'rgba(255, 255, 255, 0.08)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius = {
  sm: 8,    // --ns-radius-sm  8px
  md: 12,   // --ns-radius-md  12px
  lg: 18,   // --ns-radius-lg  18px
  full: 9999,
};
