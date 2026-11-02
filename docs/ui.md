# UI rules

LEBLOND is used one-handed on a phone, often with chalky fingers. Sizes come from
one scale so pages cannot drift apart. The values live in `app/globals.css`
(`@theme`) and in the primitives under `components/ui`.

## Scale

| Thing | Rule |
|---|---|
| Typeface | Inter, self-hosted by `next/font` at build time. No request reaches Google at runtime. |
| Page title | `text-2xl font-black tracking-tight md:text-3xl`. The live session and Patrick headers stay compact. |
| Section title | `text-lg`, bold. |
| Body and meta text | `text-sm` and `text-xs`. No arbitrary sizes such as `text-[11px]`, except inside SVG charts. |
| Weights | `font-bold` and `font-black`; the theme maps `extrabold` to 700 and `black` to 800. |
| Corners | `rounded-xl` for controls and inner tiles, `rounded-2xl` for cards, `rounded-full` for buttons and chips. |
| Touch targets | At least 44 px (`min-h-11`), 48 px for main actions (`min-h-12`). |

## Components

- **Buttons:** use `Button`, `LinkButton` or `buttonClass(variant, size)`. Do not write `bg-accent` buttons by hand.
- **Form fields:** use `Input`, `Select` and `Textarea`, or `fieldClass` for a field inside a `<label>`. Field text stays at 16 px, because iPhones zoom the page on anything smaller.
- **Dropdowns:** the arrow and the padding that keeps long labels clear of it are set globally on `select`.
- **Stacked actions:** wrap them in `.leblond-actions`, which gives equal widths on a phone and a row from 640 px up.

## Overflow

A `grid` with no base column rule sizes its column to the widest child, so one
long `truncate` title can stretch the whole page. Always give the base column:
`grid grid-cols-1 sm:grid-cols-2`.

Measure overflow with `document.documentElement.clientWidth`, never
`window.innerWidth`. A phone zooms out to fit a page that is too wide, which
hides the overflow from `innerWidth`. Journey E in `tests/e2e/journeys.spec.ts`
checks the main pages at 360 px, 390 px and desktop width.
