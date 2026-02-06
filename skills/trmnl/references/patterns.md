# TRMNL Design Patterns

Common patterns from official TRMNL examples. Use these as templates for building plugins.

## Table of Contents
- [Stats Dashboard](#stats-dashboard)
- [List View](#list-view)
- [Centered Rich Text](#centered-rich-text)
- [Big Numbers with Visual](#big-numbers-with-visual)
- [Visual Heatmap/Calendar](#visual-heatmapcalendar)
- [Todo List Columns](#todo-list-columns)
- [Lunar/Phase Display](#lunarphase-display)
- [Two-Column Custom Content](#two-column-custom-content)

---

## Stats Dashboard
*Source: Shopify, Stock Price examples*

Best for: Financial data, KPIs, metrics dashboards.

```html
<div class="layout layout--col gap--space-between">
  <div class="grid">
    <div class="col--span-3">
      <div class="grid grid--cols-1">
        <div class="item">
          <div class="meta"></div>
          <div class="content">
            <span class="value" data-fit-value="true">AAPL</span>
            <span class="label">Apple Inc.</span>
          </div>
        </div>
        <div class="item">
          <div class="meta"></div>
          <div class="content">
            <span class="value value--small value--tnums">+0.62%</span>
            <span class="label">Daily Change</span>
          </div>
        </div>
      </div>
    </div>
    <div class="item col--span-7">
      <div class="meta"></div>
      <div class="content">
        <span class="value value--xxlarge value--tnums" data-fit-value="true">$226.40</span>
      </div>
    </div>
  </div>
  <div class="divider"></div>
  <!-- Second row of stats (same structure) -->
</div>
<div class="title_bar">
  <img class="image" src="icon.svg">
  <span class="title">Stock Prices</span>
  <span class="instance">Portfolio</span>
</div>
```

**Key features:**
- 3:7 column split (sidebar + main value)
- Nested `grid--cols-1` for stacked items in sidebar
- `value--tnums` for all numbers
- `data-fit-value="true"` for large values
- `divider` between rows

---

## List View
*Source: Reddit, Todo examples*

Best for: News feeds, post lists, notifications.

```html
<div class="layout">
  <div class="columns">
    <div class="column" data-overflow="true" data-overflow-counter="true">
      <span class="label label--medium group-header">Section Header</span>
      <div class="item">
        <div class="meta">
          <span class="index">1</span>
        </div>
        <div class="content">
          <span class="title title--small">Item title here</span>
          <div class="flex gap--xsmall">
            <span class="label label--small label--underline">metadata</span>
            <span class="label label--small label--underline">more info</span>
          </div>
        </div>
      </div>
      <!-- More items -->
    </div>
  </div>
</div>
<div class="title_bar">
  <img class="image" src="icon.svg">
  <span class="title">Plugin Name</span>
  <span class="instance">Context</span>
</div>
```

**Key features:**
- `columns` + `column` for multi-column lists
- `data-overflow="true"` handles variable content length
- `data-overflow-counter="true"` shows "and X more"
- `group-header` for section titles
- `index` for numbered items
- `title--small` for compact titles
- `label--underline` for clickable-looking metadata

---

## Centered Rich Text
*Source: Wikipedia example*

Best for: Articles, quotes, single-focus content.

```html
<div class="layout">
  <div class="columns">
    <div class="column">
      <div class="richtext richtext--center gap--large">
        <span class="title" data-pixel-perfect="true">Article Title</span>
        <div class="content" data-content-limiter="true" data-pixel-perfect="true">
          <p>Article body text goes here. The content limiter will auto-adjust text size if it overflows.</p>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="title_bar">
  <img class="image" src="icon.svg">
  <span class="title">Wikipedia</span>
  <span class="instance">Random Article</span>
</div>
```

**Key features:**
- `richtext richtext--center` for centered text block
- `data-content-limiter="true"` auto-scales text to fit
- `data-pixel-perfect="true"` for crisp rendering
- `gap--large` between title and content

---

## Big Numbers with Visual
*Source: Days Left, GitHub examples*

Best for: Countdowns, progress trackers, analytics.

```html
<div class="layout layout--col gap--large">
  <div class="grid grid--cols-10">
    <div class="col col--span-1"></div>
    <div class="col col--span-4">
      <div class="item">
        <div class="meta"></div>
        <div class="content text--center">
          <span class="value value--xxxlarge" data-fit-value="true">247</span>
          <span class="label">Days Passed</span>
        </div>
      </div>
    </div>
    <div class="col col--span-4">
      <div class="item">
        <div class="meta"></div>
        <div class="content text--center">
          <span class="value value--xxxlarge" data-fit-value="true">118</span>
          <span class="label">Days Left</span>
        </div>
      </div>
    </div>
    <div class="col col--span-1"></div>
  </div>
  <div class="divider"></div>
  <div class="w--full">
    <!-- Visual element (chart, graph, heatmap) -->
  </div>
</div>
<div class="title_bar">
  <img class="image" src="icon.svg">
  <span class="title">Days Left</span>
  <span class="instance">2026</span>
</div>
```

**Key features:**
- `grid--cols-10` with empty span-1 columns for centering
- `value--xxxlarge` for hero numbers
- `text--center` for centered content
- `w--full` for full-width visual below
- `divider` separates stats from visual

---

## Visual Heatmap/Calendar
*Source: GitHub Commits example*

Best for: Activity graphs, calendars, contribution charts.

```html
<style>
#heatmap {
  width: 755px;
  height: 182px;
  overflow: hidden;
  column-count: auto;
  column-fill: auto;
  column-width: 14px;
  column-gap: 0px;
}
#heatmap .day {
  width: 11px;
  height: 23px;
  float: left;
  border-radius: 4px;
  margin: 0 0 3px 0;
  break-inside: avoid-column;
}
</style>
<div id="heatmap">
  <span class="day bg--gray-10"></span>
  <span class="day bg--gray-30"></span>
  <span class="day bg--gray-60"></span>
  <span class="day bg--black"></span>
  <!-- 365 day elements total -->
</div>
```

**Key features:**
- CSS multi-column layout for efficient grid
- `column-width: 14px` controls column sizing
- `break-inside: avoid-column` prevents cell splitting
- Dithered backgrounds: `bg--gray-10`, `bg--gray-30`, `bg--gray-60`, `bg--black`
- Small cells with `border-radius: 4px` for visual appeal

---

## Todo List Columns
*Source: Todo List example*

Best for: Kanban boards, status columns, categorized lists.

```html
<div class="layout">
  <div class="columns">
    <div class="column" data-overflow="true" data-overflow-counter="true">
      <span class="label label--medium group-header label--gray">Done</span>
      <div class="item">
        <div class="meta"><span class="index">1</span></div>
        <div class="content">
          <span class="title title--small label--gray">Completed task</span>
        </div>
      </div>
    </div>
    <div class="column" data-overflow="true" data-overflow-counter="true">
      <span class="label label--medium group-header">Doing</span>
      <div class="item">
        <div class="meta"><span class="index">1</span></div>
        <div class="content">
          <span class="title title--small">Active task</span>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="title_bar">
  <img class="image" src="icon.svg">
  <span class="title">Todo List</span>
  <span class="instance">Work Tasks</span>
</div>
```

**Key features:**
- `label--gray` for completed/inactive items
- Different styling for done vs active columns
- `data-overflow-counter` shows overflow count per column

---

## Lunar/Phase Display
*Source: Lunar Calendar example*

Best for: Status displays, phase indicators, icon-centric content.

```html
<div class="layout layout--col gap--space-between">
  <div class="grid">
    <div class="item col--span-4">
      <div class="meta"></div>
      <div class="content">
        <span class="value">Full Moon</span>
        <span class="label">Current Phase</span>
      </div>
    </div>
    <div class="item col--span-3">
      <span class="value value--xsmall">99.8%</span>
      <span class="label">Illumination</span>
    </div>
    <div class="item col--span-3">
      <span class="value value--xsmall">15.0</span>
      <span class="label">Lunar Age</span>
    </div>
  </div>
  <div class="divider"></div>
  <div class="grid grid--row grid--center">
    <img class="w--[90px] h--[90px]" src="moon-phase.svg">
  </div>
</div>
<div class="title_bar">
  <img class="image" src="icon.svg">
  <span class="title">Lunar Calendar</span>
  <span class="instance">Moon Phases</span>
</div>
```

**Key features:**
- 4:3:3 column split for varied importance
- `value--xsmall` for secondary metrics
- `w--[90px] h--[90px]` for fixed icon sizing
- `grid--center` for centered image

---

## Two-Column Custom Content
*Best for: Horoscopes, paired content, side-by-side comparisons*

```html
<div class="grid grid--cols-2 gap--xlarge" style="padding: 32px; height: 100%; font-family: Georgia, serif;">
  <div class="col layout layout--col layout--start gap--medium">
    <span style="font-size: 42px;">Heading</span>
    <span style="font-size: 24px;">Body text here. Keep it readable with appropriate font sizing based on content length.</span>
  </div>
  <div class="col layout layout--col layout--start gap--medium">
    <span style="font-size: 42px;">Heading</span>
    <span style="font-size: 24px;">Body text here. Content lengths may vary between columns.</span>
  </div>
</div>
<div class="title_bar">
  <img class="image" src="icon.svg">
  <span class="title">Plugin Name</span>
  <span class="instance">Context</span>
</div>
```

**Key features:**
- `layout--start` for top alignment (important when content varies)
- `gap--xlarge` between columns
- `gap--medium` within columns
- Georgia serif font for readability
- Content-aware font sizing (bigger for shorter text)
