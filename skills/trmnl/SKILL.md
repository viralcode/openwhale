---
name: trmnl
description: Generate content for TRMNL e-ink display devices using the TRMNL CSS framework. Use when the user wants to display information on their TRMNL device, send messages to an e-ink display, create dashboard content, show notifications, or update their terminal display. Supports rich layouts with the TRMNL framework (flexbox, grid, tables, progress bars, typography utilities) and sends content via webhook API.
---

# TRMNL Content Generator

Generate HTML content for TRMNL e-ink display devices.

## Quick Start Workflow

1. Check for `$TRMNL_WEBHOOK` environment variable
2. If missing, prompt user for webhook URL
3. **Ask user to verify TRMNL display markup is set to:** `<div>{{content}}</div>`
4. Confirm device type (default: TRMNL OG, 2-bit, 800x480)
5. Read relevant reference docs based on content needs
6. Generate HTML using TRMNL framework classes
7. Send via POST to webhook (use temp file method)
8. **Send minimal confirmation only** - Do NOT echo content back to chat

## Device & Setup

**Default target:** TRMNL OG (7.5" e-ink, 800x480px, 2-bit)

**Display markup required:**
```html
<div>{{content}}</div>
```

**Webhook:**
```bash
export TRMNL_WEBHOOK="https://trmnl.com/api/custom_plugins/{uuid}"
```

**Sending content (temp file method):**
```bash
cat > /tmp/trmnl.json << 'EOF'
{"merge_variables":{"content":"<div class=\"layout\">HTML</div>"}}
EOF
curl "$TRMNL_WEBHOOK" -H "Content-Type: application/json" -d @/tmp/trmnl.json -X POST
```

## Webhook Limits

| Tier | Payload Size | Rate Limit |
|------|--------------|------------|
| Free | **2 KB** (2,048 bytes) | 12 requests/hour |
| TRMNL+ | **5 KB** (5,120 bytes) | 30 requests/hour |

**Check payload size before sending:**
```bash
python3 scripts/check_payload.py /tmp/trmnl.json
```

**Tips to reduce payload size:**
- Minify HTML (remove unnecessary whitespace)
- Use framework classes instead of inline styles
- Use short class names the framework provides
- Remove comments from HTML
- Use `deep_merge` strategy for incremental updates

## Reference Documentation

Read these files as needed:

| File | When to Read |
|------|--------------|
| `references/patterns.md` | **Start here** - Common plugin patterns from official examples |
| `references/framework-overview.md` | Device specs, e-ink constraints, responsive prefixes |
| `references/css-utilities.md` | Colors, typography, sizing, spacing utilities |
| `references/layout-systems.md` | Flexbox, grid, overflow/clamp engines |
| `references/components.md` | Title bar, dividers, items, tables, charts |
| `references/webhook-api.md` | Payload format, rate limits, troubleshooting |
| `assets/anti-patterns.md` | Common mistakes to avoid |
| `assets/good-examples/` | HTML reference implementations |

**Scripts:**
| Script | Purpose |
|--------|---------|
| `scripts/check_payload.py` | Verify payload size before sending (run on /tmp/trmnl.json) |

## Standard Plugin Structure

**Every plugin follows this pattern:**

```html
<div class="layout layout--col gap--space-between">
  <!-- Content sections separated by dividers -->
</div>
<div class="title_bar">
  <img class="image" src="icon.svg">
  <span class="title">Plugin Name</span>
  <span class="instance">Context</span>
</div>
```

- `layout` + `layout--col` = vertical flex container
- `gap--space-between` = push sections to edges
- `title_bar` = always at bottom, outside layout
- `divider` = separate major sections
- **CRITICAL:** Only ONE `.layout` element per view (no nesting)

## Grid System (10-Column)

Column spans should sum to 10:

```html
<div class="grid">
  <div class="col--span-3">30%</div>
  <div class="col--span-7">70%</div>
</div>
```

Simple equal columns: `grid--cols-2`, `grid--cols-3`, etc.

## Item Component

Standard data display pattern:

```html
<div class="item">
  <div class="meta"><span class="index">1</span></div>
  <div class="content">
    <span class="value value--xlarge value--tnums">$159,022</span>
    <span class="label">Total Sales</span>
  </div>
</div>
```

## Value Typography

**Always use `value--tnums` for numbers.**

| Class | Usage |
|-------|-------|
| `value--xxxlarge` | Hero KPIs |
| `value--xxlarge` | Large prices |
| `value--xlarge` | Secondary metrics |
| `value--small` | Tertiary data |
| `value--tnums` | **Always for numbers** |

Auto-fit: `<span class="value" data-fit-value="true">...</span>`

## Columns (for Lists)

```html
<div class="columns">
  <div class="column" data-overflow="true" data-overflow-counter="true">
    <span class="label label--medium group-header">Section</span>
    <div class="item">...</div>
  </div>
</div>
```

## Grayscale Dithering

Use dithered classes, not inline gray colors:
- `bg--black`, `bg--gray-60`, `bg--gray-30`, `bg--gray-10`, `bg--white`
- `text--black`, `text--gray-50`

## Data Attributes

| Attribute | Purpose |
|-----------|---------|
| `data-fit-value="true"` | Auto-resize text to fit |
| `data-value-format="true"` | Auto-format numbers (locale-aware) |
| `data-clamp="N"` | Limit to N lines |
| `data-overflow="true"` | Enable overflow management |
| `data-overflow-counter="true"` | Show "and X more" |
| `data-overflow-max-cols="N"` | Max columns for overflow |
| `data-content-limiter="true"` | Auto-adjust text size |
| `data-pixel-perfect="true"` | Crisp text rendering |
| `data-table-limit="true"` | Table overflow with "and X more" |

## Label & Title Variants

```html
<span class="label label--small">Small</span>
<span class="label label--medium">Medium</span>
<span class="label label--underline">Underlined</span>
<span class="label label--gray">Muted/completed</span>
<span class="title title--small">Compact title</span>
```

## Gap Utilities

`gap--space-between` | `gap--xxlarge` | `gap--xlarge` | `gap--large` | `gap--medium` | `gap` | `gap--small` | `gap--xsmall` | `gap--none`

## Typography Guidelines

**Recommended:** Georgia serif font for e-ink readability.

**Content-aware sizing:**
- Short content = bigger fonts (24-28px body)
- Long content = smaller fonts (20px body)
- Headings: 36-48px

## User Experience

**Critical:** Do NOT echo content back to chat. Just confirm "Sent to TRMNL".

## Anti-Patterns

1. Tiny fonts for short content
2. Center-aligning columns with different lengths (use `layout--start`)
3. Spoiling content in chat confirmation
4. Missing `value--tnums` on numbers
5. Missing `title_bar`
6. Not using `data-fit-value` on primary metrics
7. Skipping `data-overflow` on variable lists
8. Using inline gray colors instead of `bg--gray-*`
9. Forgetting dividers between sections

## Best Practices

1. Verify `<div>{{content}}</div>` display markup
2. Use `layout` + `title_bar` structure
3. Always `value--tnums` for numbers
4. Use `data-fit-value` on primary metrics
5. Use `data-overflow` on variable lists
6. Use `item` component pattern
7. Use `divider` between sections
8. Use `bg--gray-*` dithered classes
9. Content-aware font sizing
10. Top-align columns (`layout--start`)
11. Temp file method for curl
12. Minimal confirmations

## Mashup Layouts (Multi-Plugin)

For dashboard views with multiple plugins:

| Layout | Description |
|--------|-------------|
| `mashup--1Lx1R` | 2 columns (50/50) |
| `mashup--1Tx1B` | 2 rows (50/50) |
| `mashup--2x2` | 4 quadrants |

See `references/layout-systems.md` for all 7 layouts.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Webhook fails | Verify URL, check rate limits (12/hour free) |
| Content missing | Check display markup is `<div>{{content}}</div>` |
| Payload too large | Run `scripts/check_payload.py`, keep under 2KB (free) or 5KB (TRMNL+) |
| Numbers misaligned | Add `value--tnums` |
| Text overflow | Use `data-clamp` or `data-overflow` |
| Columns misaligned | Use `layout--start` not `layout--center` |
| Multiple layouts error | Keep only ONE `.layout` element per view |
| Nested content fails | Use `.richtext` for nested/formatted content |
