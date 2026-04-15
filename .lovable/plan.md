

# Show Only First and Second Fold

Keep all code intact but hide sections 3+ from view.

## Changes

**File: `src/pages/Landing.tsx`**

Wrap the Features section (line ~534), Social proof section (line ~611), CTA section (line ~689), and Footer section in a single `<div className="hidden">` wrapper so they remain in code but are not rendered visually.

Specifically, add `<div className="hidden">` before the Features `<section>` (around line 533) and close `</div>` after the last section before the closing `</div>` of the page (before the dev tools panel and final closing tags).

This is a single-line addition at two points — no content is deleted or restructured.

