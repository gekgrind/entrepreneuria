# Design System Inspired by Entrepreneuria

## 1. Visual Theme & Atmosphere

The Entrepreneuria design system embodies a **futuristic, tech-forward aesthetic** with a deeply immersive digital atmosphere. Built around a dark, space-like environment that evokes innovation and precision, this system combines rich midnight blues with electrifying cyan accents, creating a high-contrast interface that feels both premium and cutting-edge. The visual language emphasizes clarity, sophistication, and forward momentum—perfect for a platform designed to empower founders. Grid overlays, glowing elements, and strategic use of luminous cyan create a sense of dynamic energy and technological prowess. The design prioritizes readability against the deep navy backdrop while maintaining visual drama through accent colors and subtle shadow effects that suggest depth and dimension.

**Key Characteristics:**
- **Dark-first color palette** with deep navy backgrounds (`#1A2942`, `#04222B`)
- **Electrifying cyan accents** (`#00D4FF`) that demand attention and guide user focus
- **High contrast** between dark surfaces and bright interactive elements
- **Glowing effects** with cyan-tinted shadows suggesting energy and motion
- **Premium typography** using Playfair Display for headings and DM Sans for body
- **Minimal borders** with subtle glows and inset highlights rather than heavy outlines
- **Tech-inspired aesthetic** with precision, geometry, and forward-facing visual language
- **Spacious layouts** with generous padding and breathing room

## 2. Color Palette & Roles

### Primary
- **Primary Brand Blue** (`#1A2942`): Core background color; dominant surface across interface. Used extensively as page background, primary container color, and structural foundation.
- **Deep Navy** (`#04222B`): Deeper alternative for nested containers, sections with visual hierarchy emphasis, and darker interactive surfaces.
- **Ultra-Deep Navy** (`#081527`): Darkest foundational color for footer regions, overlay backgrounds, and depth accents.

### Accent Colors
- **Electric Cyan** (`#00D4FF`): Primary call-to-action accent; glowing effects, interactive highlights, and attention-drawing elements. Creates luminous glow in shadows.
- **Burnt Orange** (`#D27A2C`): Secondary accent for secondary CTAs; "Join the waitlist" button primary fill color. Warm contrast to cool palette.
- **Steel Blue** (`#4F7CA7`): Tertiary accent for muted interactive states, secondary navigation highlights, and supporting visual elements.
- **Slate Blue** (`#41567A`): Neutral-toned accent for subtle highlights, hover states on secondary elements, and boundary definition.

### Interactive
- **Cyan Glow** (`#00D4FF`): All primary interactive states (links, primary buttons on hover); creates glowing shadow effects.
- **Burnt Orange Fill** (`#D27A2C`): Primary CTA button background (e.g., "Join the waitlist", "Sign up").
- **Subtle Gray** (`#6E747C`): Disabled states, muted text on secondary elements, and low-emphasis interactive regions.

### Neutral Scale
- **Pure White** (`#FFFFFF`): Primary text color, icon color, highest contrast text on dark backgrounds. Used for 290+ instances across interface.
- **Off-White** (`#FAFAFA`): Subtle neutral surface for minimal contrast situations; premium text or hover state backgrounds.
- **Very Light Cyan** (`#F0FDFD`): Ultra-subtle background tint for sections requiring minimal visual separation.
- **Light Blue Tint** (`#F7FBFF`): Faint background for specialty sections or card hover states.
- **Light Slate** (`#F0F6FE`): Input field backgrounds, form element surfaces with minimal opacity.

### Surface & Borders
- **Translucent White Borders** (opacity `15%` on `#FFFFFF`): Subtle card and input borders maintaining visual separation without heaviness.
- **Translucent White (Very Light)** (opacity `3%` to `10%` on `#FFFFFF`): Card backgrounds, overlay surfaces; creates layering without obscuring content.
- **Translucent White (Medium)** (opacity `32%` on `#00D4FF` inset): Premium card inset glow; cyan inner glow for elevated containers.

### Semantic / Status
- **Error Red** (`#E40014`): Primary error/danger state indicator.
- **Alert Red** (`#FB2C36`): Alternative error state; notifications and validation failures.

## 3. Typography Rules

### Font Family
**Primary Display Font:** Playfair Display (serif) — elegant, high-impact headings and brand-forward display text. Fallback stack: `Playfair Display, Georgia, serif`

**Secondary Body Font:** DM Sans (sans-serif) — clean, modern body copy, UI labels, and interactive text. Fallback stack: `DM Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

**Monospace Font:** DM Mono (monospace) — form labels, technical text, and code-like content. Fallback stack: `DM Mono, "Courier New", monospace`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display (H1) | Playfair Display | 72px | 500 | 75.6px | Normal | Hero headlines; maximum impact at page entry. |
| Large Heading (H2) | Playfair Display | 70.4px | 500 | 74.624px | Normal | Section headers; prominent page divisions. |
| Section Heading (H3) | Playfair Display | 24px | 500 | 32px | Normal | Medium-priority headings; card titles. |
| Emphasis Span | Playfair Display | 20px | 600 | 20px | Normal | Highlighted text; brand-emphasized phrases. |
| Body Text | DM Sans | 20px | 400 | 36px | Normal | Primary content paragraphs; generous line height for readability. |
| Navigation Link | DM Sans | 16px | 400 | 24px | Normal | Primary navigation menu items; high accessibility. |
| Button Label | DM Sans | 14px | 500 | 20px | Normal | Interactive element text; compact, clear call-to-action. |
| Input Text | DM Sans | 15px | 400 | 22.5px | Normal | Form field input text; slightly tighter than body. |
| Form Label | DM Mono | 16px | 400 | 24px | Normal | Form labels and descriptive text above inputs. |
| Caption | DM Sans | 12px | 400 | 18px | Normal | Fine print, metadata, timestamps (inferred). |
| Code / Inline | DM Mono | 13px | 400 | 19.5px | Normal | Inline code blocks, technical snippets (inferred). |

### Principles
- **Serif for authority:** Playfair Display conveys premium, founder-focused positioning in headings.
- **Sans-serif for clarity:** DM Sans ensures modern legibility in body and UI elements.
- **High contrast text:** All text rendered as pure white (`#FFFFFF`) on dark backgrounds for maximum accessibility.
- **Generous line heights:** 1.8x multiplier on body text (36px line height on 20px size) ensures visual breathing room.
- **Weight discipline:** Only two weights in use (400 for regular, 500–600 for emphasis) creates visual hierarchy without fragmentation.
- **Monospace for precision:** DM Mono reserved for form labels and code-like content, signaling technical or structured information.

## 4. Component Stylings

### Buttons

#### Primary Button (e.g., "Join the waitlist")
- **Background:** `#D27A2C` (Burnt Orange)
- **Text Color:** `#FFFFFF` (Pure White)
- **Padding:** `8px 16px`
- **Font Size:** `14px`
- **Font Weight:** `500`
- **Font Family:** DM Sans
- **Line Height:** `20px`
- **Border Radius:** `3355px` (fully rounded pill)
- **Border:** `0px solid transparent`
- **Height:** `56px`
- **Width:** Auto (fits content)
- **Hover State:** Opacity `0.9`; subtle shadow `rgba(0, 212, 255, 0.2) 0px 0px 12px`
- **Active State:** Opacity `0.8`
- **Disabled State:** Opacity `0.5`; cursor `not-allowed`

#### Secondary Button (Navigation/Text Link Buttons)
- **Background:** `rgba(255, 255, 255, 0)` (transparent)
- **Text Color:** `#FFFFFF` (Pure White)
- **Padding:** `8px 16px`
- **Font Size:** `14px`
- **Font Weight:** `500`
- **Font Family:** DM Sans
- **Line Height:** `20px`
- **Border Radius:** `3355px` (fully rounded pill)
- **Border:** `0px solid transparent`
- **Height:** `56px`
- **Width:** Auto
- **Hover State:** Background `rgba(255, 255, 255, 0.1)`; text color `#00D4FF`
- **Active State:** Background `rgba(0, 212, 255, 0.15)`
- **Disabled State:** Text color `#6E747C`; cursor `not-allowed`

#### Ghost Button / Icon Button (e.g., Dropdown toggles)
- **Background:** `rgba(255, 255, 255, 0.1)`
- **Text Color:** `#FFFFFF`
- **Padding:** `0px` (for icon buttons)
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Font Family:** DM Sans
- **Line Height:** `24px`
- **Border Radius:** `12px`
- **Border:** `1px solid rgba(79, 124, 167, 0.2)` (Steel Blue, translucent)
- **Height:** `44px`
- **Width:** `44px`
- **Hover State:** Background `rgba(255, 255, 255, 0.15)`; border color `rgba(0, 212, 255, 0.3)`
- **Active State:** Background `rgba(0, 212, 255, 0.2)`
- **Box Shadow:** None (transparent design)

#### Tertiary Button / "Sign up" (Cyan)
- **Background:** `#00D4FF` (Electric Cyan)
- **Text Color:** `#1A2942` (Primary Brand Blue)
- **Padding:** `8px 16px`
- **Font Size:** `14px`
- **Font Weight:** `500`
- **Font Family:** DM Sans
- **Line Height:** `20px`
- **Border Radius:** `3355px`
- **Border:** `0px solid transparent`
- **Height:** `56px`
- **Width:** Auto
- **Hover State:** Background `#00B8D4` (darker cyan); box-shadow `rgba(0, 212, 255, 0.4) 0px 0px 16px`
- **Active State:** Background `#0096B8`
- **Disabled State:** Opacity `0.5`

### Cards & Containers

#### Premium Card (with inset glow)
- **Background:** `rgba(255, 255, 255, 0.03)` (translucent white, 3% opacity)
- **Border:** `1px solid rgba(255, 255, 255, 0.1)`
- **Border Radius:** `16px`
- **Padding:** `32px`
- **Width:** `566px` (or responsive `100%`)
- **Min Height:** `210px`
- **Box Shadow:** `rgba(0, 212, 255, 0.32) 0px 0px 0px 1px inset, rgba(255, 229, 33, 0.1) 0px 1px 0px 0px inset`
- **Text Color:** `#FFFFFF`
- **Font Family:** DM Sans
- **Font Size:** `16px`
- **Line Height:** `24px`
- **Hover State:** Box shadow enhanced to `rgba(0, 212, 255, 0.5) 0px 0px 0px 1px inset`; background opacity increases to `0.05`

#### Minimal Card (transparent with border only)
- **Background:** `rgba(0, 0, 0, 0)` (fully transparent)
- **Border:** `0px solid transparent`
- **Border Radius:** `16px`
- **Padding:** `0px`
- **Width:** `566px` or responsive
- **Height:** `210px`
- **Box Shadow:** None
- **Text Color:** `#FFFFFF`
- **Use Case:** Hero sections, content containers without heavy visual weight

#### Floating Container (with glow shadow)
- **Background:** `rgba(255, 255, 255, 0.03)`
- **Border:** `0px solid transparent`
- **Border Radius:** `16px`
- **Padding:** `32px 32px`
- **Box Shadow:** `rgba(0, 212, 255, 0.65) 0px 0px 10px 0px` (medium glow)
- **On Hover:** Glow enhances to `rgba(0, 212, 255, 0.8) 0px 0px 8px 0px`
- **Use Case:** Highlighted features, call-out sections, featured content blocks

### Inputs & Forms

#### Text Input (Primary)
- **Background:** `rgba(255, 255, 255, 0.06)` (very light translucent)
- **Border:** `1px solid rgba(255, 255, 255, 0.15)`
- **Border Radius:** `3355px` (fully rounded pill)
- **Padding:** `0px 20px` (horizontal only)
- **Height:** `52px`
- **Width:** `388px` or responsive
- **Font Family:** DM Sans
- **Font Size:** `15px`
- **Font Weight:** `400`
- **Line Height:** `22.5px`
- **Text Color:** `#FFFFFF`
- **Placeholder Color:** `rgba(255, 255, 255, 0.4)`
- **Focus State:** Border color `#00D4FF`; box-shadow `rgba(0, 212, 255, 0.3) 0px 0px 0px 3px`; background opacity increases to `0.1`
- **Error State:** Border color `#E40014`; box-shadow `rgba(228, 0, 20, 0.3) 0px 0px 0px 3px`
- **Disabled State:** Background opacity `0.03`; border color `rgba(255, 255, 255, 0.08)`; cursor `not-allowed`

#### Checkbox / Secondary Input
- **Background:** `rgba(255, 255, 255, 0.08)`
- **Border:** `1px solid rgba(255, 255, 255, 0.2)`
- **Border Radius:** `0px` (square or minimal rounding per HTML standard)
- **Padding:** `0px`
- **Height:** Auto
- **Width:** Auto
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Font Family:** DM Sans
- **Line Height:** `24px`
- **Text Color:** `#FFFFFF`
- **Checked State:** Background `#00D4FF`; border color `#00D4FF`
- **Focus State:** Box-shadow `rgba(0, 212, 255, 0.3) 0px 0px 0px 2px`

#### Form Label
- **Font Family:** DM Mono
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Line Height:** `24px`
- **Text Color:** `#FFFFFF`
- **Margin Bottom:** `8px`
- **Letter Spacing:** `0.02em`

### Navigation

#### Horizontal Menu (Header Navigation)
- **Background:** `rgba(0, 0, 0, 0)` (transparent)
- **Border:** `0px solid transparent`
- **Height:** `56px`
- **Padding:** `0px` (spacing managed by flex gap)
- **Font Family:** DM Sans
- **Font Size:** `16px`
- **Font Weight:** `400`
- **Line Height:** `24px`
- **Text Color:** `#FFFFFF`
- **Menu Item Hover:** Text color transitions to `#00D4FF`; subtle underline appears as `rgba(0, 212, 255, 0.3) 0px 2px 0px 0px`
- **Active Menu Item:** Text color `#00D4FF`; persistent underline `2px solid #00D4FF`
- **Dropdown Toggle Icon:** 
  - Normal: `#FFFFFF`
  - Hover: `#00D4FF`
  - Open: `#00D4FF` with `rotate(180deg)` transform

#### Mobile Navigation (Hamburger Menu)
- **Background:** `#1A2942`
- **Border:** `0px`
- **Trigger Button:** `44px × 44px`; background `rgba(255, 255, 255, 0.08)`; border-radius `12px`
- **Menu Overlay:** Full-screen; background `rgba(4, 34, 43, 0.98)` (deep navy with opacity)
- **Menu Items:** Same styling as horizontal menu; stacked vertically with `16px` gap
- **Close Button:** Same as trigger button; positioned top-right

## 5. Layout Principles

### Spacing System

**Base Unit:** `8px`

**Scale Multipliers:**
- `8px` (1x) — Micro gaps between closely-related elements
- `12px` (1.5x) — Small gaps between form elements
- `16px` (2x) — Standard padding inside components; spacing between icon and text
- `20px` (2.5x) — Component gaps; medium spacing
- `24px` (3x) — Section padding; medium card padding
- `32px` (4x) — Large component padding; card content padding
- `36px` (4.5x) — Extra-large padding for premium sections
- `40px` (5x) — Major section spacing
- `48px` (6x) — Large section dividers
- `56px` (7x) — Extra-large section gaps; hero to content transition
- `64px` (8x) — Maximum section margin; page-level vertical rhythm

**Usage Contexts:**
- **`8px`–`12px`:** Gap between icon + label; form field spacing
- **`16px`:** Default padding on buttons; input horizontal padding; nested component padding
- **`24px`–`32px`:** Card internal padding; section padding
- **`40px`–`56px`:** Vertical separation between major content blocks
- **`64px`:** Full page section margins; hero to features transition

### Grid & Container

**Max Width:** `1280px` (standard desktop container max-width; responsive down to `100%` on tablet/mobile)

**Container Structure:**
- Full-width dark background (`#1A2942`)
- Inner max-width container centered with `0 auto` margins
- Horizontal padding: `40px` on desktop; `24px` on tablet; `16px` on mobile

**Column Strategy:**
- **Desktop:** 12-column grid (or flexible flex layout)
- **Tablet (768px–1024px):** 8-column grid; consolidate multi-column layouts
- **Mobile (<768px):** Single-column (100% width); stack all elements vertically

**Section Patterns:**
- **Hero Section:** Full-width, max-height `600px`–`700px`; centered content
- **Feature Grid:** 2–3 columns on desktop (566px cards); 1 column on mobile
- **Navigation Header:** Full-width fixed or sticky; `56px` height minimum
- **Content Sections:** Centered max-width container; top/bottom margin `64px`

### Whitespace Philosophy

The design prioritizes **generous breathing room** and **negative space** to convey premium quality and reduce cognitive load. Every component is surrounded by intentional whitespace to create visual hierarchy and focus.

- **Vertical rhythm:** Sections separated by `48px`–`64px` gaps
- **Horizontal margins:** Components maintain `20px`–`40px` from container edges
- **Internal padding:** All interactive elements have minimum `8px` padding to prevent visual crowding
- **Empty space as design:** The dark background is used strategically as a design element—not all space must be filled
- **Breathing headroom:** Headings have `20px`–`32px` margin below; body text has `16px`–`24px` spacing

### Border Radius Scale

| Value | Component Context | Use Case |
|-------|------------------|----------|
| `0px` | Form labels, dividers | Strict geometry; technical sections |
| `12px` | Secondary buttons, icon buttons, small cards | Subtle softness for compact elements |
| `16px` | Cards, containers, featured sections | Primary component radius; balanced softness |
| `3355px` (fully rounded) | Primary buttons, input fields, pill-shaped CTA buttons | Maximum softness; friendly, welcoming call-to-actions |

**Philosophy:** Radius increases with component prominence. Minimal radius (`0px`–`12px`) for utilitarian elements; maximum radius (`3355px`) for hero CTAs and primary inputs, signaling user action.

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| **Base (No Shadow)** | `box-shadow: none` | Default cards, backgrounds, structural containers without emphasis |
| **Small (Sm)** | `box-shadow: rgba(0, 212, 255, 0.32) 0px 0px 0px 1px inset, rgba(255, 229, 33, 0.1) 0px 1px 0px 0px inset` | Premium inset card glow; subtle layered appearance; container distinction |
| **Medium (Md)** | `box-shadow: rgba(0, 212, 255, 0.65) 0px 0px 10px 0px` | Floating containers; featured sections; elevated interactive elements |
| **Large (Lg)** | `box-shadow: rgba(0, 212, 255, 0.7) 0px 0px 10px 0px` | High-emphasis overlays; modal backgrounds; important notifications |
| **Extra Large (Xl)** | `box-shadow: rgba(0, 212, 255, 0.8) 0px 0px 8px 0px` | Maximum focus; hero elements; primary CTA highlights on hover |

**Shadow Philosophy:**

The system uses **cyan-tinted glows** rather than traditional neutral shadows. This approach:
- Creates a cohesive, branded visual language aligned with the electric cyan accent
- Produces a **futuristic, tech-forward aesthetic** suggesting energy and innovation
- Increases **visual accessibility** by creating sharp depth distinction on dark backgrounds
- Avoids flat appearance while maintaining modern minimalism

**Implementation notes:**
- Shadows are always **inset** (for cards) or **external glow** (for floating elements)
- No traditional drop-shadows with opacity variations; instead, pure cyan luminosity
- Hover states trigger shadow **intensity increase** (0.32 → 0.5 opacity) not size change
- Shadow blur radius is consistent at `8px`–`10px` for visual cohesion

## 7. Do's and Don'ts

### Do
- **Use cyan (`#00D4FF`) sparingly but strategically** for primary interactive elements and CTAs; it's the most attention-grabbing accent.
- **Maintain high contrast** between text and background; pure white text on dark navy backgrounds ensures legibility.
- **Leverage the spacing system** to create hierarchy; don't reduce standard gaps below `16px` for readability.
- **Apply inset glow shadows** to premium cards and containers to create layered depth without visual chaos.
- **Use Playfair Display** for all heading elements; it reinforces brand authority and premium positioning.
- **Keep button padding consistent** at `8px 16px` minimum; this ensures touch-friendly affordance.
- **Embrace the dark background** as a design feature, not a limitation; generous whitespace against navy is premium, not empty.
- **Use fully rounded pill buttons** (`border-radius: 3355px`) for primary CTAs; they signal friendliness and action.
- **Stack forms vertically** with `16px`–`20px` gap between fields; horizontal stacking is acceptable only on desktop with sufficient width.
- **Respect focus states** on all interactive elements; minimum `2px` blue glow for keyboard accessibility.

### Don't
- **Don't use multiple accent colors** in a single interface section; cyan and burnt orange should not appear together in the same component hierarchy.
- **Don't reduce padding below `8px`** inside components; this creates visual crowding and reduces readability.
- **Don't override the dark background** with light alternative colors except for specific error/alert states.
- **Don't use sans-serif fonts** for major headings; Playfair Display is mandatory for h1, h2, and h3 tags.
- **Don't create shadows using neutral colors** (black, gray); all depth must derive from cyan tints.
- **Don't stretch button text** beyond two lines; if text exceeds one line, reduce font size or increase button width.
- **Don't use opacity below `0.06`** for background colors; text will become illegible against the dark background.
- **Don't apply hover effects** that change element size significantly (avoid scale > 1.05); instead, modify color, opacity, or shadow.
- **Don't remove borders** from input fields; a minimum `1px solid rgba(255, 255, 255, 0.15)` border is required for definition.
- **Don't mix border-radius values** within the same component family; all buttons should use `3355px` or `12px`, not a mix.
- **Don't nest premium card shadows** with additional drop-shadows; limit to inset glow only per card.

## 8. Responsive Behavior

### Breakpoints

| Breakpoint Name | Width | Key Changes |
|-----------------|-------|------------|
| **Mobile** | `< 480px` | Single-column layout; `16px` horizontal padding; button height `48px`; font sizes reduce by 2px; full-width inputs |
| **Tablet Small** | `480px`–`768px` | Two-column grids; `24px` horizontal padding; navigation becomes hamburger menu; card width `100%` |
| **Tablet Large** | `768px`–`1024px` | Three-column grids; `32px` horizontal padding; horizontal navigation restored; max-width container `90%` |
| **Desktop** | `1024px`–`1280px` | Full 4-column grids; `40px` horizontal padding; max-width container `100%` with internal `1280px` limit; larger typography |
| **Large Desktop** | `> 1280px` | Same as desktop; no additional changes; container remains max `1280px` with centered margins |

### Touch Targets

**Minimum Interactive Element Size:** `44px × 44px` (mobile); `56px` (desktop buttons)

**Spacing Between Interactive Elements:** `12px` minimum gap to prevent accidental taps

**Button Sizing:**
- Desktop: `56px` height × variable width (text-based)
- Tablet: `48px` height × variable width
- Mobile: `48px` height × variable width (full-width recommended)

**Icon Button Size:** `44px × 44px` (consistent across all breakpoints)

**Touch-Friendly Padding:** All touch targets require minimum `8px` internal padding; comfortable tap zones are `44px` or larger

### Collapsing Strategy

**Header Navigation (Desktop → Tablet → Mobile):**
1. **Desktop (1024px+):** Horizontal menu; all items visible; dropdown menus expand on hover
2. **Tablet (768px–1024px):** Horizontal menu; condensed text; dropdowns trigger on tap
3. **Mobile (<768px):** Hamburger menu icon; full-screen overlay menu; vertical stack

**Content Grids (Desktop → Tablet → Mobile):**
1. **Desktop:** 3 cards per row (566px each with gaps)
2. **Tablet (768px–1024px):** 2 cards per row; responsive width
3. **Mobile (<768px):** 1 card per row; full width with `16px` margins

**Forms (Desktop → Mobile):**
1. **Desktop:** Side-by-side inputs (50% width each) if space permits
2. **Tablet:** Side-by-side inputs at smaller widths
3. **Mobile:** Full-width stacked inputs; single column only

**Typography Scale (Desktop → Mobile):**
- **Headings:** Reduce by `8px`–`12px` on tablet; reduce by `12px`–`16px` on mobile
- **Body:** Reduce from `20px` to `18px` on tablet; to `16px` on mobile
- **Navigation link:** Remain `16px` across all breakpoints for readability

**Hidden Elements:**
- Logo tagline hidden on mobile (<480px)
- Secondary navigation dropdowns collapse to icons on tablet
- "Log in" link hidden on mobile; accessible via hamburger menu

## 9. Agent Prompt Guide

### Quick Color Reference

- **Primary CTA Button:** Burnt Orange (`#D27A2C`)
- **Secondary CTA Button / Sign Up:** Electric Cyan (`#00D4FF`)
- **Primary Background:** Primary Brand Blue (`#1A2942`)
- **Deep Section Background:** Deep Navy (`#04222B`)
- **Heading Text:** Pure White (`#FFFFFF`)
- **Body Text:** Pure White (`#FFFFFF`)
- **Link Color:** Electric Cyan (`#00D4FF`)
- **Disabled State:** Subtle Gray (`#6E747C`)
- **Error State:** Error Red (`#E40014`)
- **Card Border:** Translucent White (`rgba(255, 255, 255, 0.1)`)
- **Card Background:** Translucent White (`rgba(255, 255, 255, 0.03)`)
- **Shadow / Glow:** Cyan (`rgba(0, 212, 255, 0.65)`)
- **Input Border:** Translucent White (`rgba(255, 255, 255, 0.15)`)
- **Input Background:** Translucent White (`rgba(255, 255, 255, 0.06)`)

### Iteration Guide

1. **Always render text as `#FFFFFF` (Pure White) on `#1A2942` or darker backgrounds.** This is the foundation contrast ratio; never deviate without explicit intent.

2. **Primary CTA buttons are always `#D27A2C` (Burnt Orange) with rounded pill shape (`border-radius: 3355px`).** Secondary CTAs and "Sign up" use `#00D4FF` (Electric Cyan).

3. **All card containers use transparent backgrounds (`rgba(255, 255, 255, 0.03)` minimum) with `1px solid rgba(255, 255, 255, 0.1)` border and inset cyan glow (`box-shadow: rgba(0, 212, 255, 0.32) 0px 0px 0px 1px inset`).**

4. **Typography hierarchy is Playfair Display for h1–h3; DM Sans for body, links, buttons; DM Mono for labels.** No font mixing within the same semantic role.

5. **Spacing follows the `8px` base scale:** Use multiples of 8 (`8px, 16px, 24px, 32px, 40px, 48px, 56px, 64px`) exclusively. No arbitrary values.

6. **All interactive elements include hover states:** Buttons change opacity or color; links transition to cyan; cards intensify their shadow glow.

7. **Focus states (keyboard navigation) require a cyan glow outline:** `box-shadow: rgba(0, 212, 255, 0.3) 0px 0px 0px 3px` minimum for all focusable elements.

8. **Form inputs always use `border-radius: 3355px` (pill shape) with `16px` horizontal padding, `52px` height, and `1px` white border at 15% opacity.**

9. **Depth is created exclusively via cyan-tinted shadows (glows), never neutral drop-shadows.** Inset glows for cards; external glows for floating containers.

10. **Navigation is always horizontal on desktop (1024px+) and collapses to hamburger menu on mobile (<768px).** Header height is `56px` minimum with `40px` padding.

11. **Max container width is `1280px` centered; horizontal padding is `40px` on desktop, `24px` on tablet, `16px` on mobile.**

12. **Error states use `#E40014` with cyan-based shadow replaced by red glow:** `rgba(228, 0, 20, 0.3) 0px 0px 0px 3px`.

13. **Disabled states reduce opacity to `0.5` and change text to `#6E747C`; they are not interactive and must have `cursor: not-allowed`.**

14. **Every breakpoint transition must be tested:** Mobile (<480px), Tablet Small (480px–768px), Tablet Large (768px–1024px), Desktop (1024px–1280px), Large Desktop (>1280px).

15. **Cards on desktop are `566px` wide (responsive to `100%` on mobile); feature grids are 3 columns on desktop, 2 on tablet, 1 on mobile.**