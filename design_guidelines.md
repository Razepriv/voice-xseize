# Design Guidelines: AI Voice Agent Platform

## Design Approach
**Strict Minimal Black & White Theme** - Pure monochrome aesthetic with absolutely NO colors except black, white, and grayscale. Typography and white space create all hierarchy. No decorative elements.

## Color System

### Light Mode (Default)
- Background: `#FFFFFF` (pure white)
- Secondary Background: `#FAFAFA` (#F9F9F9 very light gray)
- Primary Actions: `#000000` (pure black buttons with white text)
- Secondary Actions: White buttons with `1px solid #000000` border
- Text Primary: `#000000` (pure black)
- Text Secondary: `#666666` (medium gray)
- Text Muted: `#999999` (light gray)
- Borders: `#E5E5E5` (very light gray)
- Dividers: `#F0F0F0`
- Cards: White with `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`
- Success: `#000000` (black - no color)
- Warning: `#666666` (gray - no color)
- Error: `#000000` (black - no color)
- Info: `#333333` (dark gray - no color)

### Dark Mode
- Background: `#000000` (true black for OLED)
- Secondary Background: `#0A0A0A` (very dark gray)
- Primary Actions: `#FFFFFF` (white buttons with black text)
- Secondary Actions: Black buttons with `1px solid #FFFFFF` border
- Text Primary: `#FFFFFF` (pure white)
- Text Secondary: `#A0A0A0` (medium gray)
- Text Muted: `#666666` (dark gray)
- Borders: `#1A1A1A` (very dark gray)
- Dividers: `#0F0F0F`
- Cards: `#0A0A0A` with subtle border
- Success: `#FFFFFF` (white - no color)
- Warning: `#A0A0A0` (gray - no color)
- Error: `#FFFFFF` (white - no color)
- Info: `#CCCCCC` (light gray - no color)

## Typography
- **Font Family**: Inter (system-ui fallback)
- **Headings**: Bold weights
  - H1: 40px (desktop), 28px (mobile) - `font-bold tracking-tight`
  - H2: 32px (desktop), 24px (mobile) - `font-semibold tracking-tight`
  - H3: 24px (desktop), 20px (mobile) - `font-semibold`
  - H4: 20px (desktop), 18px (mobile) - `font-medium`
- **Body**: Regular 16px (desktop), 14px (mobile)
- **Small**: 14px (desktop), 12px (mobile)
- **Line Height**: 1.5 for body, 1.2 for headings
- **Letter Spacing**: -0.011em for tighter minimal aesthetic

## Layout System

### Spacing Scale (Tailwind units)
Use consistent spacing: `4, 8, 12, 16, 20, 24, 32, 48, 64` (p-1, p-2, p-3, p-4, p-5, p-6, p-8, p-12, p-16)

### Responsive Breakpoints
- Mobile: 320px-767px (single column, bottom navigation, full-width cards)
- Tablet: 768px-1023px (2-column grids, collapsible sidebar)
- Desktop: 1024px+ (3-5 column grids, fixed sidebar 260px width)

### Sidebar
- Desktop: 260px fixed width (320px for AI Voice Agent platform)
- Mobile: Full overlay or bottom sheet
- Collapsible to icon-only mode

## Navigation Architecture

### AI Voice Agent Platform Structure
1. **AI VOICE SYSTEM** - Dashboard, Calls, AI Agents, Call History
2. **CRM & LEAD MANAGEMENT** - Leads, Pipelines, Contacts
3. **BUSINESS MANAGEMENT** - Knowledge Base, Analytics, Billing

### Mobile (320px-767px)
- Collapsible sidebar overlay
- Touch targets: minimum 48px height/width
- Bottom actions for primary CTAs

### Desktop (1024px+)
- Fixed sidebar (260px width)
- Sections with uppercase labels
- Icons + text labels
- Subtle badges for counts/status

## Component Library

### Buttons
- **Primary**: Black bg (light mode), white bg (dark mode), medium padding, rounded-md
- **Secondary**: Outlined with 1px border, same padding, rounded-md
- **Ghost**: No background, hover elevate effect
- **Touch Targets**: 48px mobile, 36px desktop minimum
- **States**: Subtle elevation on hover, no color changes

### Cards
- White (light) or `#0A0A0A` (dark) background
- Subtle shadow: `0 1px 3px rgba(0,0,0,0.08)` in light mode
- 12px border-radius (rounded-md)
- 24px padding (desktop), 16px (mobile)
- Hover: Subtle transform translateY(-2px)

### Badges
- Pure grayscale backgrounds
- Small text (12px-14px)
- Rounded corners
- Used for status indicators, counts

### Data Tables
- **Mobile**: Card view with key info
- **Tablet**: Condensed table
- **Desktop**: Full table with sorting, filtering
- Alternating row backgrounds for readability
- Pure black/white/gray styling

### Forms
- Clear labels above inputs
- Border focus states (no color outlines)
- Validation messages in black/white
- Auto-save capabilities

### Progress Bars
- Grayscale fills only
- No colored indicators
- Percentage or fraction labels

## Key Visual Principles

1. **NO COLOR** - Absolutely no colors except black, white, and grayscale
2. **Typography creates hierarchy** - Font size, weight, and spacing differentiate elements
3. **White space is primary design element** - Generous padding and margins
4. **Subtle shadows define depth** - Not colors
5. **Icons are minimal line-art style** - Lucide React outline icons
6. **Interaction feedback through opacity/scale** - Not color changes
7. **Data visualization in grayscale/patterns** - Charts use black/white/gray gradients

## Interactions & States

### Hover States
- Subtle elevation (opacity overlays)
- No background color changes
- Transform: translateY(-2px) for cards
- Opacity changes for text/icons

### Active/Focus States
- 2px outline in black (light mode) or white (dark mode)
- No colored focus rings
- Subtle elevation changes

### Loading States
- Skeleton screens in grayscale
- Pulse animations
- Spinner in black/white

## Performance & Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation throughout
- Screen reader labels (ARIA)
- Focus indicators: 2px outline
- Minimum contrast ratio: 4.5:1
- Virtual scrolling for large lists
- Code splitting per route

## Theme Toggle

- Sun/moon icon in header
- Smooth transition (150ms)
- Persists to localStorage
- System preference detection

This strict minimal black/white design prioritizes clarity and restraint. Every element uses only monochrome colors, creating a premium, focused experience through typography, spacing, and subtle interactions.
