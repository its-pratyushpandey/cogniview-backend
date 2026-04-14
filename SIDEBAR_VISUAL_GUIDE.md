# 🎨 Sidebar Visual Guide

## Desktop View (Expanded - 280px)

```
┌──────────────────────────────────────────────────────┐
│  ✨ Features                              ⟨           │ ← Header (Purple Gradient)
├──────────────────────────────────────────────────────┤
│                                                      │
│  🏠 Dashboard                              ⌄         │ ← Category Header
│    🏠  Home                                          │
│        Overview & Dashboard                          │
│                                                      │
│    📈  Progress Tracker                              │
│        Track your learning journey                   │
│                                                      │
│  🎤 AI Interview Tools                     ⌄         │
│    🎤  AI Interview                         🔥       │ ← Hot Feature Badge
│        Voice-based mock interviews                   │
│                                                      │
│    💡  AI Viva                             NEW       │ ← New Feature Badge
│        Adaptive questioning system                   │
│                                                      │
│    📊  Answer Scoring                      NEW       │
│        Get detailed quality analysis                 │
│                                                      │
│    📄  Resume Prep                         🔥       │
│        Resume-based interview prep                   │
│                                                      │
│  📚 Learning & Practice                    ⌄         │
│    🎓  AI Tutor                            NEW       │
│        Your personalized learning assistant          │
│                                                      │
│    🧠  Smart Revision                      🔥       │
│        AI-powered study materials                    │
│                                                      │
│    🎯  Mistake Memory                      🔥       │
│        Learn from your mistakes                      │
│                                                      │
│    🤖  Engineering Chat                    NEW       │
│        CS topics expert assistant                    │
│                                                      │
│  🏆 Assessment & Testing                   ⌄         │
│    ✅  MCQ Practice                        NEW       │
│        Multiple choice questions                     │
│                                                      │
│    🧮  Aptitude Trainer                    NEW       │
│        Reasoning & aptitude tests                    │
│                                                      │
│  🏢 Career Preparation                     ⌄         │
│    🏢  Company Mode                        NEW       │
│        Target specific companies                     │
│                                                      │
├──────────────────────────────────────────────────────┤
│  ⚡ Pro Tip                                          │ ← Footer (Yellow Gradient)
│     Use keyboard shortcuts for faster navigation     │
└──────────────────────────────────────────────────────┘
```

## Desktop View (Collapsed - 80px)

```
┌────────┐
│ ✨  ⟨  │ ← Header
├────────┤
│        │
│  🏠    │ ← Shows tooltip on hover: "Dashboard"
│        │
│  📈    │
│        │
│  🎤    │
│        │
│  💡    │
│        │
│  📊    │
│        │
│  📄    │
│        │
│  📚    │
│        │
│  🎓    │
│        │
│  🧠    │
│        │
│  🎯    │
│        │
│  🤖    │
│        │
│  🏆    │
│        │
│  ✅    │
│        │
│  🧮    │
│        │
│  🏢    │
│        │
│  🏢    │
│        │
└────────┘
```

## Mobile View (Slide-in from Left)

```
┌─────────────────────────────────────┐
│  ✨ All Features              ✕     │ ← Header with Close
├─────────────────────────────────────┤
│                                     │
│  [Same content as Desktop Expanded] │
│                                     │
│  Full scrollable list of all        │
│  features and categories            │
│                                     │
└─────────────────────────────────────┘

  [●]  ← Floating toggle button (bottom-left)
```

## Color Coding

### Active Item (Current Page)
```
┌─────────────────────────────────────┐
│  ▌ 🎤  AI Interview            🔥   │ ← Blue gradient background
│  ▌     Voice-based mock interviews  │   White text
└─────────────────────────────────────┘
    ↑
    Active indicator bar
```

### Hover State
```
┌─────────────────────────────────────┐
│    🎓  AI Tutor               NEW   │ ← Light blue background
│        Personalized assistant       │   Slides right 4px
└─────────────────────────────────────┘
```

### Badge Colors
- 🔥 Hot: Appears without background
- NEW: 
  - Blue (#3b82f6) - Interview Tools
  - Purple (#8b5cf6) - Learning
  - Green (#10b981) - Assessment
  - Orange (#f97316) - Career

## Animations

### Opening Sidebar (Mobile)
```
[Hidden] → [Slide from left] → [Visible]
  0ms        250ms              300ms
  
Backdrop: fade in (200ms)
```

### Expanding Category
```
[Collapsed] → [Height grows] → [Expanded]
   0ms          300ms            done
   
Items: Stagger fade-in (50ms delay each)
```

### Active Indicator
```
Item A: ▌ Active
        ↓
Item B: ▌ Active  (Smooth spring animation)
```

## Responsive Breakpoints

| Screen Size | Behavior |
|-------------|----------|
| ≥1024px (Desktop) | Fixed sidebar, collapsible |
| 768-1023px (Tablet) | Mobile sidebar |
| <768px (Mobile) | Mobile sidebar, compact toggle |

## Layout Integration

```
┌─────────────────────────────────────────────────────┐
│                    HEADER (80px)                    │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ SIDEBAR  │         MAIN CONTENT                     │
│ (280px)  │         (Adjusted margin)                │
│          │                                          │
│  Fixed   │         Scrollable                       │
│          │                                          │
├──────────┴──────────────────────────────────────────┤
│                                                     │
└─────────────────────────────────────────────────────┘
                                    [Quick Access FAB]
                                          ↑
                                    (bottom-right)

[Sidebar Toggle]
      ↑
(bottom-left, mobile only)
```

## Interaction Flows

### Desktop: Collapse Sidebar
```
1. User clicks collapse toggle (⟨)
2. Sidebar width: 280px → 80px (300ms)
3. Text content fades out
4. Icons remain centered
5. Tooltips enabled on hover
```

### Mobile: Open Sidebar
```
1. User taps floating button (bottom-left)
2. Backdrop fades in (200ms)
3. Sidebar slides in from left (300ms)
4. Categories appear with stagger
```

### Navigation
```
1. User clicks "AI Tutor"
2. Active indicator slides to new position (spring)
3. Route changes (/tutor)
4. Mobile sidebar closes (if mobile)
5. Page content loads
```

## Z-Index Layers

```
Layer 6 (50): Mobile sidebar panel
Layer 5 (45): Mobile sidebar overlay
Layer 4 (40): Desktop sidebar
Layer 3 (30): Header
Layer 2 (20): Main content
Layer 1 (10): Background
```

## Accessibility Features

- ✅ Keyboard navigation (Tab/Shift+Tab)
- ✅ Focus indicators (2px outline)
- ✅ ARIA labels on buttons
- ✅ Screen reader announcements
- ✅ Semantic HTML (nav, aside, button)
- ✅ Color contrast (WCAG AA compliant)

## Performance Metrics

- Initial render: <100ms
- Expand/collapse: 300ms smooth
- Category toggle: 300ms smooth
- Mobile slide-in: 300ms smooth
- Re-render on navigation: <50ms

---

## Quick Reference

### Key Classes
- `.sidebar-desktop` - Main desktop container
- `.sidebar-mobile` - Mobile slide-in
- `.sidebar-item` - Feature links
- `.sidebar-item.active` - Active route
- `.sidebar-category` - Category sections

### Key States
- `isCollapsed` - Desktop sidebar state
- `isMobileOpen` - Mobile sidebar visibility
- `expandedCategories` - Category expansion

### Color Variables
```css
--primary-500: #3b82f6 (Blue)
--purple-500: #8b5cf6 (Purple)
--success-500: #10b981 (Green)
--orange-500: #f97316 (Orange)
```

---

*This visual guide provides a comprehensive overview of the sidebar's appearance, behavior, and integration within the Cogniview application.*
