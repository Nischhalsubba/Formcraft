# Formcraft Repository Instructions

## Product intent

Formcraft is an original portfolio dashboard and design-development workspace. It must not resemble an off-the-shelf admin template after implementation.

## Current phase

Build and validate the public-facing interface as an original static prototype before integrating it into CodeIgniter.

## Conventions

- Use semantic HTML and accessible labels.
- Use CSS custom properties for design tokens.
- Keep JavaScript progressively enhanced and dependency-free unless a dependency is justified.
- Do not invent portfolio metrics, outcomes, testimonials, or client claims.
- Use placeholders clearly marked as placeholders.
- Preserve third-party license and attribution files when licensed code is introduced.
- Never commit `.env`, credentials, API tokens, private client files, or confidential project assets.

## Verification

Before merging:

1. Test keyboard navigation.
2. Test at 360px, 768px, 1024px, and 1440px widths.
3. Verify light and dark themes.
4. Confirm all links have valid targets or are visibly marked as planned.
5. Check browser console for errors.
6. Confirm content claims are accurate.

## Do not

- Do not copy Greeva branding, layouts, demo content, or visual styling into the public experience.
- Do not expose wildcard routes when CodeIgniter is introduced.
- Do not publish purchased template assets unless the license permits repository distribution.
- Do not merge unfinished placeholder metrics as factual content.
