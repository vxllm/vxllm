---
Status: Draft
Version: 1.0
Last Updated: 2026-03-20
---

# Design Guidelines

This document establishes design principles and implementation guidelines for VxLLM's user interface and experience.

## Design Philosophy

VxLLM's design prioritizes:
1. **Clarity:** Clear information hierarchy, obvious user intent
2. **Efficiency:** Fast operations, minimal clicks, keyboard shortcuts
3. **Accessibility:** WCAG 2.1 AA compliance, keyboard navigation, screen reader support
4. **Responsiveness:** Works seamlessly on mobile, tablet, desktop
5. **Consistency:** Predictable patterns throughout the app
6. **Dark-first:** Respect user's system preference, excellent dark mode by default

## Tailwind CSS v4 Usage

### Configuration

VxLLM uses Tailwind v4 with native CSS variables for dynamic theming. Configuration file: `apps/web/tailwind.config.ts`

**Key Features:**
- CSS variables for all colors, sizes, spacing
- Dark mode support via `dark:` prefix
- Container queries for responsive component behavior
- Custom color palette (see Color Scheme section)

### Common Utilities

**Spacing:**
- Use predefined scale: `p-2`, `p-4`, `p-6`, `p-8` (not arbitrary values)
- Margin: `m-4`, `mx-auto`, `mb-6`
- Padding: `px-4`, `py-2`

**Typography:**
- Font sizes: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`
- Font weights: `font-normal`, `font-medium`, `font-semibold`, `font-bold`
- Line height: `leading-normal`, `leading-relaxed`, `leading-tight`

**Layout:**
- Flex: `flex`, `flex-col`, `items-center`, `justify-between`
- Grid: `grid`, `grid-cols-2`, `gap-4`
- Positioning: `absolute`, `relative`, `sticky`

**Responsive Prefixes:**
- Mobile-first: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`
- Example: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`

**Don't:**
- Avoid `!important` (refactor if needed)
- Avoid arbitrary values (`w-[123px]`) unless absolutely necessary; add to config instead
- Avoid magic numbers; use spacing scale

### Dark Mode

**Convention:** Use `dark:` prefix for dark mode overrides

```tsx
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
  Content
</div>
```

**Provider:** `next-themes` manages system preference and persists user choice

```tsx
import { ThemeProvider } from "next-themes"

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system">
      <YourApp />
    </ThemeProvider>
  )
}
```

**System Detection:** App respects `prefers-color-scheme` by default; user can override via settings

---

## shadcn/ui Component Conventions

### Copying Components

shadcn/ui follows a "copy-paste" model. Components are copied into `packages/ui/src/components`, not imported as a package.

**To add a new component:**
```bash
npx shadcn-ui@latest add button --yes
```

This copies the component code to `packages/ui/src/components/button.tsx`.

### Component Usage

All shadcn/ui components are re-exported from `packages/ui`:

```tsx
import { Button, Card, Dialog, Input } from "@vxllm/ui"
```

Do not import from `packages/ui/src/components/*` directly; use the barrel export.

### Customization

shadcn/ui components should be extended via composition, not direct modification:

```tsx
// ✅ Good: Composition
export function PrimaryButton(props) {
  return <Button variant="default" size="lg" {...props} />
}

// ❌ Bad: Modifying component file
// (Edit button.tsx directly)
```

### Common Components

**Button:**
- `variant="default"` (filled, primary action)
- `variant="outline"` (secondary, lower priority)
- `variant="ghost"` (minimal, often in headers)
- `variant="destructive"` (delete, dangerous actions)
- `size="sm"` | `size="default"` | `size="lg"`

**Card:**
- Container for grouped content
- Use `<Card><CardContent>` for headers, footers
- Padding: `p-6` (24px)
- Rounded corners: `rounded-lg`

**Dialog:**
- Modal overlays for forms, confirmations
- Controlled: `<Dialog open={isOpen} onOpenChange={setIsOpen}>`
- Accessibility: Respects `aria-labelledby`, focus trapping, escape key

**Input/Textarea:**
- Use with `<Label>` for accessibility
- Placeholder text: `placeholder="Enter text..."`
- Size: `h-10` (40px, standard height)

**Select:**
- Dropdown for finite options
- Better than text input when choices are predefined

**Tabs:**
- Group related content without page navigation
- Use `value` prop to track active tab

**Alert:**
- `variant="default"` (info)
- `variant="destructive"` (error)
- For success/warning, use Toast instead

**Toast:**
- Temporary notifications (appear for 3s, auto-dismiss)
- Non-blocking (user can continue working)
- Use for confirmations, errors that don't need immediate action

---

## Responsive Design Approach

### Mobile-First Strategy

Design and code mobile layout first, then enhance for larger screens:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 1 column on mobile, 2 on tablet, 3 on desktop */}
</div>
```

### Breakpoints

Standard Tailwind breakpoints (used throughout):
- `sm` (640px) → Tablets in portrait
- `md` (768px) → Tablets in landscape
- `lg` (1024px) → Desktops
- `xl` (1280px) → Large screens
- `2xl` (1536px) → Ultra-wide monitors

### Common Patterns

**Sidebar + Content Layout:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
  <aside className="md:block hidden">Sidebar</aside>
  <main>Content</main>
</div>
```

**Stacked on Mobile, Side-by-side on Desktop:**
```tsx
<div className="flex flex-col md:flex-row gap-6">
  <section className="flex-1">Left</section>
  <section className="flex-1">Right</section>
</div>
```

**Responsive Grid:**
```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
  {items.map(item => <Card key={item.id}>{item}</Card>)}
</div>
```

---

## Tauri-Specific UI Considerations

### Feature Detection

Check if running in Tauri webview to enable native features:

```tsx
import { __TAURI_IPC__ } from "@tauri-apps/api/core"

export function useIsTauri() {
  return typeof __TAURI_IPC__ !== "undefined"
}

export function FilePickerButton() {
  const isTauri = useIsTauri()

  if (!isTauri) return null // Hide on web

  return (
    <Button onClick={async () => {
      const { invoke } = await import("@tauri-apps/api/core")
      const file = await invoke("pick_file")
      // Handle file
    }}>
      Pick File
    </Button>
  )
}
```

### Window Management

In Tauri, you can:
- Minimize/maximize window
- Show/hide window
- Control tray behavior

```tsx
import { appWindow } from "@tauri-apps/api/window"

export function WindowControls() {
  return (
    <>
      <Button onClick={() => appWindow.minimize()}>Minimize</Button>
      <Button onClick={() => appWindow.maximize()}>Maximize</Button>
      <Button onClick={() => appWindow.close()}>Close</Button>
    </>
  )
}
```

### Conditional Features

Use feature flags for Tauri-only UI:

```tsx
const TAURI_ONLY_FEATURES = {
  fileAccess: typeof __TAURI_IPC__ !== "undefined",
  nativeMenu: typeof __TAURI_IPC__ !== "undefined",
  trayIntegration: typeof __TAURI_IPC__ !== "undefined",
}
```

### Performance

- Tauri has no browser DevTools overhead; app is faster than web version
- Avoid large DOM (10,000+ elements) even if Tauri is faster
- Use virtualization for long lists (chat history, model list)

---

## Accessibility Basics

VxLLM aims for WCAG 2.1 AA compliance. Minimum baseline:

### Keyboard Navigation

- **Tab order:** Logical (left-to-right, top-to-bottom)
- **Focus visible:** Blue outline on focused element (default shadcn/ui)
- **Escape key:** Close dialogs, dropdowns, menus
- **Enter key:** Activate buttons, submit forms
- **Arrow keys:** Navigate lists, tabs, dropdowns

**Implementation:**
```tsx
<button onKeyDown={(e) => {
  if (e.key === "Escape") closeDialog()
}}>
  Button text
</button>
```

### Screen Readers

- Use semantic HTML: `<button>`, `<label>`, `<nav>`, not `<div>` everywhere
- Add `aria-label` for icon-only buttons:
  ```tsx
  <Button aria-label="Delete conversation" variant="ghost" size="icon">
    <Trash2 className="w-4 h-4" />
  </Button>
  ```
- Link form inputs to labels:
  ```tsx
  <label htmlFor="model-select">Model</label>
  <select id="model-select">...</select>
  ```

### Color Contrast

- Text: 4.5:1 contrast ratio (normal text), 3:1 (large text)
- Default shadcn/ui colors meet this; don't override without testing

**Test Tool:** [WebAIM Color Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Focus Management

- Keep focus visible at all times
- Don't hide focus outlines (remove `outline: none`)
- Move focus to newly opened dialogs, modals

```tsx
import { useEffect, useRef } from "react"

export function Modal({ isOpen }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) closeRef.current?.focus()
  }, [isOpen])

  return (
    <Dialog open={isOpen}>
      <Button ref={closeRef} onClick={close}>Close</Button>
    </Dialog>
  )
}
```

---

## Color Scheme

### Primary Palette

Based on Tailwind defaults, customized for VxLLM branding:

**Light Mode (Default):**
- Primary: `slate-900` (text) / `slate-50` (background)
- Accent: `blue-600` (interactive elements)
- Success: `green-600` (positive feedback)
- Warning: `amber-600` (caution)
- Danger: `red-600` (destructive, errors)

**Dark Mode:**
- Primary: `slate-50` (text) / `slate-950` (background)
- Accent: `blue-500` (interactive, lighter for dark BG)
- Success: `green-500`
- Warning: `amber-500`
- Danger: `red-500`

### Implementation

Define in `tailwind.config.ts`:
```ts
theme: {
  colors: {
    primary: "hsl(var(--primary))",
    accent: "hsl(var(--accent))",
    success: "hsl(var(--success))",
    warning: "hsl(var(--warning))",
    danger: "hsl(var(--danger))",
  },
},
```

Use in components:
```tsx
<Button className="bg-accent hover:bg-accent/90">
  Send
</Button>
```

### Status Colors

- **Info:** `blue` (informational messages)
- **Success:** `green` (positive outcome, completion)
- **Warning:** `amber` (cautionary, needs attention)
- **Error:** `red` (problems, failures)

---

## Typography

### Font Stack

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

Tailwind includes this as `font-sans` (default).

### Type Scale

```
text-xs    → 12px (captions, small labels)
text-sm    → 14px (secondary text, form labels)
text-base  → 16px (body text)
text-lg    → 18px (large body, section intro)
text-xl    → 20px (medium heading)
text-2xl   → 24px (section heading)
text-3xl   → 30px (page heading)
text-4xl   → 36px (hero title)
```

### Font Weights

- `font-normal` (400) → Body text
- `font-medium` (500) → Form labels, button text
- `font-semibold` (600) → Section headings
- `font-bold` (700) → Page titles

### Line Height

- `leading-tight` (1.25) → Headings
- `leading-normal` (1.5) → Body text
- `leading-relaxed` (1.625) → Long-form content

### Example Usage

```tsx
<h1 className="text-4xl font-bold leading-tight">Page Title</h1>
<h2 className="text-2xl font-semibold leading-tight">Section</h2>
<p className="text-base leading-normal text-slate-600 dark:text-slate-300">
  Body text...
</p>
<label className="text-sm font-medium">Label</label>
```

---

## Spacing Scale

VxLLM uses Tailwind's default spacing scale (multiples of 4px):

```
p-0, p-1 (4px), p-2 (8px), p-3 (12px), p-4 (16px), p-6 (24px), p-8 (32px), p-12 (48px)
```

### Card Padding

- Outer padding: `p-6` (24px all sides)
- Inner sections: `gap-4` (16px between)

### Margin/Spacing

- Between sections: `my-8` or `mb-8`
- Between list items: `gap-2` or `gap-3`
- Between form fields: `space-y-4`

### Grid Gaps

- Default: `gap-4` (16px)
- Tight: `gap-2` (8px)
- Loose: `gap-6` (24px)

---

## Component Layout Patterns

### Card Group

```tsx
<div className="space-y-4">
  <Card>
    <CardHeader>
      <CardTitle>Title</CardTitle>
    </CardHeader>
    <CardContent>Content</CardContent>
  </Card>
</div>
```

### Form Layout

```tsx
<form className="space-y-6">
  <div className="space-y-2">
    <Label htmlFor="input">Label</Label>
    <Input id="input" />
  </div>
  <Button type="submit">Submit</Button>
</form>
```

### List with Actions

```tsx
<div className="space-y-2">
  {items.map(item => (
    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
      <span>{item.name}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost">Edit</Button>
        <Button size="sm" variant="ghost">Delete</Button>
      </div>
    </div>
  ))}
</div>
```

### Modal Dialog

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-slate-600">Are you sure?</p>
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Animation & Transitions

### Tailwind Transitions

Use `transition` utility for smooth property changes:

```tsx
<Button className="transition-colors hover:bg-slate-100">
  Hover Button
</Button>
```

### Duration

- `duration-75` (75ms) → Quick feedback
- `duration-150` (150ms) → Standard transitions
- `duration-300` (300ms) → Longer animations
- `duration-500` (500ms) → Dramatic entrance

### Easing

- `ease-in` → Accelerating
- `ease-out` → Decelerating (preferred for UI)
- `ease-in-out` → Both
- `ease-linear` → Constant speed

### Example

```tsx
<div className="transition-all duration-300 ease-out hover:shadow-lg">
  Smooth card lift on hover
</div>
```

### CSS Animations

For more complex animations, use `@keyframes` in CSS:

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-out;
}
```

---

## Interaction Patterns

### Loading States

Show visual feedback during async operations:

```tsx
<Button disabled={isLoading} className="gap-2">
  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
  {isLoading ? "Loading..." : "Send"}
</Button>
```

### Empty States

When no data is available, show helpful empty state:

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
  <h3 className="text-lg font-semibold">No conversations yet</h3>
  <p className="text-sm text-slate-600">Start a new chat to begin.</p>
  <Button className="mt-4" onClick={startNewChat}>New Chat</Button>
</div>
```

### Error States

Display errors prominently but not alarmingly:

```tsx
{error && (
  <Alert variant="destructive">
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
)}
```

### Confirmation Dialogs

For destructive actions, require confirmation:

```tsx
const [confirmDelete, setConfirmDelete] = React.useState(false)

return (
  <>
    <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
      Delete
    </Button>
    <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <DialogContent>
        <DialogTitle>Delete Conversation?</DialogTitle>
        <DialogDescription>This cannot be undone.</DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
)
```

---

## Performance Considerations

### Virtualization

For long lists (100+ items), use virtualization to avoid rendering all items:

```tsx
import { FixedSizeList } from "react-window"

export function LongList({ items }) {
  return (
    <FixedSizeList height={600} itemCount={items.length} itemSize={50}>
      {({ index, style }) => (
        <div style={style}>{items[index].name}</div>
      )}
    </FixedSizeList>
  )
}
```

### Lazy Images

Use native `loading="lazy"` for images outside viewport:

```tsx
<img src={url} alt="Description" loading="lazy" />
```

### Code Splitting

TanStack Router auto-splits by route. Additional bundles via dynamic import:

```tsx
const HeavyComponent = lazy(() => import("./HeavyComponent"))
```

---

## Accessibility Checklist

Before shipping UI components:

- [ ] All interactive elements are keyboard accessible (Tab, Enter, Escape)
- [ ] Focus outline is visible and clear
- [ ] Form inputs have associated `<label>` elements
- [ ] Icon-only buttons have `aria-label`
- [ ] Color is not the only way to distinguish information
- [ ] Text contrast ratio is 4.5:1 (normal text) or 3:1 (large text)
- [ ] Modal dialogs trap focus and restore focus on close
- [ ] No automatic audio/video plays
- [ ] Links are semantically `<a>` tags, buttons are `<button>`
- [ ] Heading hierarchy is correct (h1 → h2 → h3, no skips)
- [ ] Images have descriptive `alt` text
- [ ] Screen reader can perceive all content

---

## Design Review Checklist

When reviewing new UI work:

1. **Consistency:** Follows existing patterns? Uses design system components?
2. **Accessibility:** Passes WCAG 2.1 AA? Keyboard navigable?
3. **Responsive:** Works on mobile (375px), tablet (768px), desktop (1024px+)?
4. **Dark Mode:** Looks good in both light and dark? Sufficient contrast?
5. **Performance:** No unnecessary re-renders? Lists virtualized?
6. **Loading States:** Shows feedback during async operations?
7. **Error Handling:** Graceful error states? Helpful messages?
8. **Empty States:** User understands when no data is available?

---

## Design System Future

As VxLLM grows, consider:
- Figma design kit for designers + developers
- Component documentation (Storybook)
- Design tokens (CSS variables for all values)
- Accessibility testing automation
- Color palette expansion for data viz

For now, this document and the codebase itself are the source of truth.
