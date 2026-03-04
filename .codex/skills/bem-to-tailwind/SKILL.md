---
name: bem-to-tailwind
description: Convert BEM CSS to Tailwind utility classes in Vue files. Use when user asks to convert BEM to Tailwind, migrate CSS to Tailwind, replace BEM classes with Tailwind, or refactor Vue component styles to use Tailwind.
---

# BEM to Tailwind Converter

## When to Use

- User asks to convert BEM CSS to Tailwind in a Vue file
- User asks to migrate a component's CSS to Tailwind
- User asks to replace BEM classes with Tailwind utilities
- User asks to refactor Vue component styles to Tailwind
- User specifies a Vue file for Tailwind conversion

## Prerequisites

- The target Vue file must be specified by the user
- The project should already have Tailwind CSS configured

## Instructions

### 1. Read the Target Vue File

Read the entire Vue file specified by the user to understand:
- The `<template>` section with BEM class references
- The `<style>` section containing the BEM CSS rules

### 2. Extract and Analyze BEM Classes

Identify all BEM classes in the `<style>` block. BEM follows the pattern:
- **Block**: `.block-name` (standalone component)
- **Element**: `.block-name__element` (part of a block)
- **Modifier**: `.block-name--modifier` or `.block-name__element--modifier`

For each BEM class, list:
1. The class name
2. All CSS properties and values it contains
3. Any media queries or pseudo-selectors (`:hover`, `:focus`, etc.)

### 3. Convert CSS Properties to Tailwind Classes

For each CSS property, find the equivalent Tailwind utility class.

**IMPORTANT**: Do NOT guess or hardcode Tailwind class names. When unsure about any conversion, search the Tailwind documentation:

```
Search: "tailwind css [property-name]" 
Example: "tailwind css justify-content"
Example: "tailwind css box-shadow"
Example: "tailwind css line-height"
```

Use https://tailwindcss.com/docs as the authoritative reference.

#### Common Conversion Categories

**Spacing (margin, padding)**
- Look up: https://tailwindcss.com/docs/padding
- Look up: https://tailwindcss.com/docs/margin
- Pattern: `p-{size}`, `m-{size}`, `px-{size}`, `py-{size}`, etc.

**Sizing (width, height)**
- Look up: https://tailwindcss.com/docs/width
- Look up: https://tailwindcss.com/docs/height
- Pattern: `w-{size}`, `h-{size}`, `min-w-{size}`, `max-h-{size}`, etc.

**Flexbox**
- Look up: https://tailwindcss.com/docs/flex
- Look up: https://tailwindcss.com/docs/justify-content
- Look up: https://tailwindcss.com/docs/align-items
- Pattern: `flex`, `flex-row`, `justify-center`, `items-center`, etc.

**Grid**
- Look up: https://tailwindcss.com/docs/grid-template-columns
- Pattern: `grid`, `grid-cols-{n}`, `gap-{size}`, etc.

**Typography**
- Look up: https://tailwindcss.com/docs/font-size
- Look up: https://tailwindcss.com/docs/font-weight
- Look up: https://tailwindcss.com/docs/text-color
- Pattern: `text-{size}`, `font-{weight}`, `text-{color}`, etc.

**Colors**
- Look up: https://tailwindcss.com/docs/customizing-colors
- Look up: https://tailwindcss.com/docs/background-color
- Pattern: `bg-{color}`, `text-{color}`, `border-{color}`, etc.

**Borders**
- Look up: https://tailwindcss.com/docs/border-width
- Look up: https://tailwindcss.com/docs/border-radius
- Pattern: `border`, `border-{size}`, `rounded-{size}`, etc.

**Effects**
- Look up: https://tailwindcss.com/docs/box-shadow
- Look up: https://tailwindcss.com/docs/opacity
- Pattern: `shadow-{size}`, `opacity-{value}`, etc.

**Transitions**
- Look up: https://tailwindcss.com/docs/transition-property
- Pattern: `transition`, `duration-{ms}`, `ease-{type}`, etc.

#### Handling Pseudo-classes and States

Convert CSS pseudo-classes to Tailwind state prefixes:
- `:hover` → `hover:`
- `:focus` → `focus:`
- `:active` → `active:`
- `:disabled` → `disabled:`
- `:first-child` → `first:`
- `:last-child` → `last:`

Example: `.btn:hover { background: blue }` → `hover:bg-blue-500`

#### Handling Responsive Breakpoints

Convert media queries to Tailwind responsive prefixes:
- Default (mobile-first): no prefix
- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up
- `2xl:` - 1536px and up

Look up: https://tailwindcss.com/docs/responsive-design

### 4. Handle Custom/Non-Standard Values

If the CSS uses custom values that don't map to Tailwind's default scale:

**Option A: Use Arbitrary Values**
Tailwind supports arbitrary values in square brackets:
- `w-[137px]` for `width: 137px`
- `bg-[#1a1a1a]` for custom hex colors
- `text-[13px]` for custom font sizes
- `p-[7px]` for custom padding

**Option B: Check for Closest Match**
Sometimes a close Tailwind default value is acceptable:
- `padding: 15px` might become `p-4` (16px) if exact match isn't critical

**Option C: Keep in Style Block**
For complex custom CSS that can't be converted, keep it in a minimal `<style>` block.

### 5. Handle Non-Convertible CSS

Some CSS cannot be easily converted to Tailwind utilities:
- Complex animations with `@keyframes`
- Custom CSS variables definitions
- Very specific selectors (`:nth-child(3n+2)`)
- Pseudo-elements (`::before`, `::after`) with complex content

For these cases:
1. Keep them in a `<style>` block
2. Consider using `@apply` to compose Tailwind classes
3. Or leave as scoped CSS with a simple class name

### 6. Update the Template

Replace BEM class names in the `<template>` with the Tailwind utility classes:

**Before:**
```vue
<div class="card">
  <h2 class="card__title">Title</h2>
  <p class="card__description card__description--muted">Text</p>
</div>
```

**After:**
```vue
<div class="rounded-lg shadow-md p-4 bg-white">
  <h2 class="text-xl font-bold mb-2">Title</h2>
  <p class="text-sm text-gray-500">Text</p>
</div>
```

### 7. Clean Up the Style Block

After conversion:
1. Remove converted BEM classes from `<style>`
2. If all CSS was converted, remove the entire `<style>` block
3. If some CSS remains, keep a minimal `<style scoped>` block

### 8. Verify the Conversion

After making changes:
1. Check that all template classes are valid Tailwind classes
2. Ensure no BEM class references remain in the template without corresponding styles
3. Look for any visual regressions (if possible)

## Conversion Checklist

For each BEM class, work through this checklist:

- [ ] Identify all CSS properties in the rule
- [ ] Convert layout properties (display, position, flex, grid)
- [ ] Convert spacing (margin, padding)
- [ ] Convert sizing (width, height, min/max)
- [ ] Convert typography (font-size, font-weight, line-height, color)
- [ ] Convert backgrounds (color, image, gradient)
- [ ] Convert borders (width, color, radius)
- [ ] Convert effects (shadow, opacity, transform)
- [ ] Convert transitions/animations (if simple)
- [ ] Handle hover/focus/active states
- [ ] Handle responsive breakpoints
- [ ] Update template with new classes
- [ ] Remove old BEM class from style block

## Example Conversion

### Input Vue File

```vue
<template>
  <div class="user-card">
    <img class="user-card__avatar" :src="avatar" />
    <div class="user-card__info">
      <h3 class="user-card__name">{{ name }}</h3>
      <p class="user-card__role user-card__role--admin">{{ role }}</p>
    </div>
  </div>
</template>

<style scoped>
.user-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.user-card__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  margin-right: 12px;
}

.user-card__info {
  display: flex;
  flex-direction: column;
}

.user-card__name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.user-card__role {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.user-card__role--admin {
  color: #3b82f6;
  font-weight: 500;
}
</style>
```

### Conversion Process

1. **Analyze `.user-card`**: flex, items-center, p-4, bg-white, rounded-lg, shadow
2. **Analyze `.user-card__avatar`**: w-12, h-12, rounded-full, mr-3
3. **Analyze `.user-card__info`**: flex, flex-col
4. **Analyze `.user-card__name`**: text-base, font-semibold, text-gray-900
5. **Analyze `.user-card__role`**: text-sm, text-gray-500
6. **Analyze `.user-card__role--admin`**: text-blue-500, font-medium

### Output Vue File

```vue
<template>
  <div class="flex items-center p-4 bg-white rounded-lg shadow">
    <img class="w-12 h-12 rounded-full mr-3" :src="avatar" />
    <div class="flex flex-col">
      <h3 class="text-base font-semibold text-gray-900">{{ name }}</h3>
      <p class="text-sm" :class="isAdmin ? 'text-blue-500 font-medium' : 'text-gray-500'">
        {{ role }}
      </p>
    </div>
  </div>
</template>
```

Note: The modifier class was converted to a dynamic class binding since it's conditional.

## Tips for Clean Conversions

1. **Group related utilities**: Keep layout classes together, then spacing, then visual styles
2. **Use semantic ordering**: Position → Display → Spacing → Sizing → Typography → Colors → Effects
3. **Leverage component extraction**: If Tailwind classes get too long, extract to a component
4. **Consider dark mode**: Add `dark:` variants if the project uses dark mode
5. **Preserve functionality**: Ensure dynamic classes (`:class`) work correctly with Tailwind

## When Conversion is Not Recommended

- Components with very few simple styles (conversion adds complexity)
- Heavy use of CSS custom properties for theming
- Complex animation sequences
- Styles that must be dynamically generated at runtime
