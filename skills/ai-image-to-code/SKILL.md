---
name: ai-image-to-code
description: >
  Use when (1) user provides a UI screenshot or image and asks to convert it into HTML, CSS, or component code. 
  (2) user says "turn this into code", "rebuild this UI", "code this design", or "generate HTML from screenshot". 
  (3) user pastes an image and says "write the React component for this". 
license: MIT
metadata:
  version: "1.0.1"
  category: design
  author: wangjipeng
  sources:
    - https://github.com/MiniMax-AI/skills
---

# AI Image to Code

Use when (1) user provides a UI screenshot or image and asks to convert it into HTML, CSS, or component code. (2) user says "turn this into code", "rebuild this UI", "code this design", or "generate HTML from screenshot". (3) user pastes an image and says "write the React component for this".

## Core Position

This skill solves the specific problem of: *a visual UI mockup needs to become actual runnable frontend code — not just a description, but a working implementation.*

This skill IS NOT:
- An image generation tool — it converts existing images to code, not creates images
- A design tool — it interprets and codes a design, not create the design
- A backend integration tool — it outputs HTML/CSS/JS, not server code

This skill IS activated ONLY when: image (screenshot/mockup) + code generation intent are both present.

## Modes

### `/ai-image-to-code`

**Default mode.** Converts a UI image into a complete HTML/CSS implementation.

When to use: User provides a screenshot and wants a working HTML page that resembles it.

### `/ai-image-to-code/react`

Outputs a React functional component using Tailwind CSS.

When to use: User explicitly asks for React or a component, not a plain HTML page.

### `/ai-image-to-code/describe`

Provides a detailed text description of the layout without writing code.

When to use: User only wants to understand the layout before committing to code generation.

## Execution Steps

### Step 1 — Analyze the Image

1. Receive image (pasted, file attachment, or URL)
2. Use vision model to inspect the image and extract:
   - Layout structure (header, sidebar, main content, footer)
   - Color palette (primary, secondary, background, text, accent)
   - Typography (headings, body, labels — size and weight hierarchy)
   - Spacing system (padding, margins, gaps)
   - Component types (buttons, inputs, cards, lists, navigation)
   - Visual hierarchy (what stands out, what recedes)
3. If the image is complex (>10 distinct UI sections), focus on the main content area

### Step 2 — Plan the Code Structure

| Image Content | Recommended Output |
|---|---|
| Landing page | Single HTML with embedded CSS |
| Dashboard | HTML + CSS grid layout |
| Mobile app screen | Mobile-first responsive HTML |
| Form / login page | Semantic HTML form with proper inputs |
| Card / list UI | Component-based HTML with classes |
| Chart / data visualization | SVG or canvas-based rendering |

### Step 3 — Generate Code

**HTML/CSS output** (default):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UI</title>
  <style>
    /* Extracted colors, typography, spacing from image */
  </style>
</head>
<body>
  <!-- Structure matching the image layout -->
</body>
</html>
```

**React + Tailwind** (react mode):
```jsx
export function UICard() {
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm">
      {/* Component matching image */}
    </div>
  );
}
```

### Step 4 — Validate

- Key layout sections (header, main, sidebar) are present
- Colors are within ±10% of the original image (subjective match)
- No invented content — placeholder text is generic ("Card title", not specific brand names)
- HTML is valid (proper tag nesting, no unclosed tags)

## Mandatory Rules

### Do not

- Do not invent brand names, specific product names, or proprietary text not visible in the image
- Do not claim the output is pixel-perfect — it is an interpretation
- Do not generate backend code, JavaScript logic, or API calls
- Do not reproduce copyrighted UI elements (logos, icons) — use generic equivalents

### Do

- Use placeholder text that fits the context (e.g., "Search..." for a search bar)
- Preserve the visual hierarchy (primary > secondary > tertiary)
- Use realistic placeholder data for images (e.g., via placeholder.com or picsum)
- State explicitly: "This is an approximation; fine-tune colors and spacing as needed"

## Quality Bar

**A good output:**
- All major layout regions are present and positioned correctly
- Color palette is recognizably derived from the image
- Typography hierarchy matches (heading size > body size)
- Code is valid, runnable HTML/CSS without external dependencies beyond a CDN

**A bad output:**
- Layout is scrambled or missing major sections
- Output includes broken or unclosed HTML tags
- Fabricated text content not appropriate to the UI context
- Output requires non-free dependencies or local asset files

## Good vs. Bad Examples

| Scenario | Bad Output | Good Output |
|---|---|---|
| E-commerce product card | Generic lorem ipsum text | "Price: $49.99 — Add to Cart" contextually appropriate |
| Dark mode UI | Ignores dark theme | Uses dark background, light text, correct contrast |
| Mobile screenshot | Desktop-only output | `max-width: 375px` container, mobile-first |
| Complex dashboard | One undifferentiated div | Grid layout with sidebar, header, main panels |

## References

- `references/` — Color extraction heuristics, layout structure patterns, Tailwind class mapping guide