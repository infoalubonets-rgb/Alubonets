---
name: Dignified Community
colors:
  surface: '#f9f9f7'
  surface-dim: '#dadad8'
  surface-bright: '#f9f9f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f2'
  surface-container: '#eeeeec'
  surface-container-high: '#e8e8e6'
  surface-container-highest: '#e2e3e1'
  on-surface: '#1a1c1b'
  on-surface-variant: '#434651'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f1ef'
  outline: '#747782'
  outline-variant: '#c4c6d2'
  surface-tint: '#3b5ca3'
  primary: '#001f50'
  on-primary: '#ffffff'
  primary-container: '#063378'
  on-primary-container: '#7f9ee9'
  inverse-primary: '#b0c6ff'
  secondary: '#974800'
  on-secondary: '#ffffff'
  secondary-container: '#fe8015'
  on-secondary-container: '#5f2b00'
  tertiary: '#162235'
  on-tertiary: '#ffffff'
  tertiary-container: '#2b374b'
  on-tertiary-container: '#94a0b8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001945'
  on-primary-fixed-variant: '#204489'
  secondary-fixed: '#ffdbc7'
  secondary-fixed-dim: '#ffb689'
  on-secondary-fixed: '#311300'
  on-secondary-fixed-variant: '#733500'
  tertiary-fixed: '#d7e3fd'
  tertiary-fixed-dim: '#bbc7e0'
  on-tertiary-fixed: '#101c2f'
  on-tertiary-fixed-variant: '#3b475c'
  background: '#f9f9f7'
  on-background: '#1a1c1b'
  surface-variant: '#e2e3e1'
typography:
  h1:
    fontFamily: Sora
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h1-mobile:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  h2:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  h2-mobile:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  h3:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
  container-max: 1200px
  gutter: 24px
---

## Brand & Style
The design system is built on the pillars of **Trust, Warmth, and Accountability**. It targets a multi-generational family and community collective, requiring a UI that feels established and secure rather than experimental.

The visual direction follows a **Modern-Professional** aesthetic with a strong emphasis on **Accessibility**. It avoids the coldness of traditional banking through the use of soft background tones and rounded geometry, while maintaining authority through a structured Navy foundation. The style prioritizes high-legibility and clear affordances to ensure users of all ages—especially elderly members—can navigate financial and community data with confidence.

## Colors
The palette is rooted in a deep **Navy (#063378)** to communicate stability and institutional strength. This is used for structural elements like headers and navigation to ground the user experience. 

**Orange (#F07602)** serves as the high-energy accent, reserved strictly for primary calls-to-action and critical highlights to ensure they remain distinct and accessible. The background uses a soft **Off-white (#F7F7F5)** to reduce screen glare and improve reading comfort for longer sessions, while cards and surfaces use pure **White (#FFFFFF)** to create a clear "layer" of focus for interactive content.

## Typography
The system employs a dual-font strategy. **Sora** provides a confident, geometric presence for headings, ensuring that page titles and section breaks are unmistakable. Its slightly wider character set aids in readability for users with declining vision.

**Inter** is used for all body text and data-heavy tables. It is a highly utilitarian typeface designed for legibility on digital screens. For this design system, we prioritize larger default font sizes (16px and 18px) to ensure accessibility. Line heights are intentionally generous (1.5x - 1.6x) to prevent "crowding" of text, which helps older users track lines across the screen.

## Layout & Spacing
The layout follows a strict **8px-based rhythm**. This ensures mathematical consistency across all margins and paddings. 

A **12-column fluid grid** is used for desktop (breakpoints: 1200px+), transitioning to a **4-column grid** for mobile (below 600px). On mobile, horizontal page margins should be a minimum of 16px to prevent content from touching the screen edges. To maintain the "dignified" feel, the system utilizes "Generous Whitespace"—specifically using the `xl` (40px) and `xxl` (64px) tokens between major page sections to give the content room to breathe and reduce cognitive load.

## Elevation & Depth
Depth is achieved through **Low-contrast outlines** and **Tonal layering** rather than heavy shadows. This creates a clean, "flat but tactile" look that feels more modern and less cluttered.

- **Level 0 (Background):** #F7F7F5. The base canvas.
- **Level 1 (Cards/Surfaces):** #FFFFFF with a 1px border of #DDE3EC. This is the primary container for information.
- **Level 2 (Hover/Active):** A very soft, diffused shadow (0px 4px 12px rgba(20, 32, 51, 0.05)) is used only when a card or button is interactive, providing subtle feedback to the user.

Avoid stacking multiple layers of cards. If a sub-container is needed, use a subtle grey fill (#F1F3F7) instead of a second border.

## Shapes
The shape language is "Rounded" but controlled. A **12px radius** for cards provides a soft, friendly appearance that feels approachable to families. Interactive elements like buttons and input fields use a slightly tighter **8px radius** to maintain a sense of precision and "clicability." Circular shapes are reserved exclusively for avatars or status indicators (e.g., notification dots).

## Components
### Navigation Bar
- **Style:** Sticky to the top with a pure white background and a subtle bottom border (#DDE3EC). 
- **Elements:** Logo on the far left. Navigation links in Navy (#063378) using `body-md` weight 500. 
- **CTA:** The "Login / Register" button must use the Orange (#F07602) background with White text to serve as the primary anchor.

### Buttons
- **Primary:** Orange background, white text, 8px radius. Minimum height of 48px to ensure large tap targets for mobile and elderly users.
- **Secondary:** Navy border (2px), Navy text, transparent background. 
- **Tertiary/Ghost:** Navy text, no border, used for less important actions like "Cancel."

### Cards
- **Structure:** White background, 12px radius, 1px border (#DDE3EC). 
- **Padding:** Always use `lg` (24px) padding for content within cards. 
- **Header:** Use a light grey bottom border to separate card titles from body content if the card contains complex data.

### Input Fields
- **Style:** 8px radius, 1px border (#DDE3EC).
- **Labels:** Always visible above the field (never use placeholder-only labels) to aid users with memory or cognitive constraints.
- **Focus State:** 2px solid Navy border with a soft blue outer glow.

### Lists & Tables
- **Lists:** Use `md` (16px) spacing between items. Every item should have a clear horizontal separator to help eyes track across the row.
- **Accountability Tables:** Use alternating row stripes (Zebra striping) in #F7F7F5 for financial data clarity.