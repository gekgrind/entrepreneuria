# Archived routes

Next.js App Router treats a folder whose name starts with `_` as a **private
folder**: it and everything beneath it are opted out of routing. Nothing in
here is served, linked, or listed in the sitemap — but every page, component
import, and line of copy is preserved exactly as it shipped.

These destinations were removed from the *public* experience, not from the
product. They are expected to return.

| Archived path                        | Original public route         | Concept                        |
| ------------------------------------ | ----------------------------- | ------------------------------ |
| `_archive/launch-pad/page.tsx`        | `/launch-pad`                 | The Launch Pad (directory hub) |
| `_archive/launch-pad/blog/**`         | `/launch-pad/blog[/post]`      | The Knowledge Blueprint        |
| `_archive/launch-pad/community/**`    | `/launch-pad/community`       | The Founder's Table            |
| `_archive/exchange/**`                | `/exchange[/digital-vault\|/agentverse]` | The Exchange        |

Inbound traffic to the old URLs is handled by temporary (307) redirects in
`next.config.mjs` — deliberately *not* permanent, so browsers and crawlers do
not cache a move that we intend to undo.

## Restoring one

1. `git mv app/_archive/<folder> app/<folder>` (drop the `launch-pad/` segment
   if the concept should live at the top level, as `/tools` and `/library` now
   do).
2. Delete the matching entry from the `redirects()` block in `next.config.mjs`.
3. Re-point the internal links inside the restored files — they still reference
   the pre-cleanup routes (`/launch-pad/tools`, `/launch-pad/resources`), which
   are now `/tools` and `/library`.
4. Add the route back to `app/sitemap.ts` and to the navigation source lists:
   `RESOURCE_LINKS` in `components/Header.tsx`, `RESOURCES` in
   `components/footer.tsx`, and `RESOURCE_LAYER` in `lib/ecosystem/products.ts`
   if it belongs in the homepage journey.
