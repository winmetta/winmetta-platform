---
name: add-dhamma-post
description: 'Add or edit a Dhamma post in winmetta-platform: one markdown file with Burmese, English and Simplified Chinese sections, tags from the tag registry, then validation. Use when asked to add, publish, write up, translate or fix a Dhamma post, teaching, Pāḷi term explanation or similar short post for the Dhamma Posts pages, or to add or edit a post tag, even if the user only pastes the text.'
---

# Add or edit a Dhamma post

The rules for posts are in `AGENTS.md` §7 ("Dhamma Posts — adding or editing a post"): file name, format, frontmatter, tags, search and checks. Read that section first; this skill is the workflow around it and the mistakes to avoid, not a second copy of the rules.

## Content comes from the teachers

- **Keep the teacher's wording.** Fix only formatting (headings, lists, emphasis, spacing). Don't summarize, reorder, "improve" or add explanations. If something reads like an error, ask rather than change it.
- **Missing languages:** all three sections (`my`, `en`, `zh-Hans`) are required. If the user gives only some, draft the others as close, literal translations, and tell the user exactly which sections are your drafts so a reader of that language checks them before it's published. Don't mark drafts inside the file; it is published as written.
- **Names and terms:** correct Pāḷi diacritics (Pāḷi, Abhidhamma, kusala) and titles (Sayadaw, Ven., U), and keep Pāḷi terms the teacher wrote in brackets or bold.
- **Burmese must be Unicode.** If pasted text looks like Zawgyi (the validator says so), ask for a Unicode copy instead of converting it by hand.
- **Chinese must be Simplified.** When the validator lists Traditional characters, convert those, and tell the user a Chinese reader should check the wording.

## Add a post

1. **Get the text and the English title.** If there's no English title, propose one and confirm it: it becomes the permanent URL.
2. **Start the file** from the repo root (it uses today's local date):

   ```bash
   npm run posts:new -- "English title"
   ```

3. **Fill each section** under its `<!-- lang: … -->` marker: exactly one `# Title`, then the body with `##`/`###` sub-headings only.
4. **Tags:** read `apps/web/src/content/post-tags.json` and reuse existing tags, listed in frontmatter by their English names. Add a new tag only when no existing one fits: append an entry with a slug made once from the English name and names in all three languages, before using it. Suggest new tags to the user rather than adding many.
5. **Check and format** from the repo root (formatting from `apps/web` skips the root ignore rules):

   ```bash
   npm run format
   npm run posts:validate -- apps/web/src/content/posts/<file>.md
   ```

   Fix every error and rerun. `npm run build` fails on the same rules, so a passing validation is required, not optional.

6. **Look at it** when you can: `npm run dev`, then `/en/dhamma-posts/<file-name-without-.md>/` with `?lang=my,en,zh` to see all three sections. Stop the server with `npm run dev:stop` when done.
7. **Report** the file, its URL, the tags (marking any new ones) and which sections are your drafts. Commit only when asked, with a Conventional Commits message such as `feat(posts): add "Meaning of Vidhi and Anuvāda"`.

## Edit a post

- **Never rename or delete a published post file**, even if its title changes: the file name is its URL and shared links would break.
- Keep `created`; set `updated` to today. The pre-commit hook rejects a changed post whose `updated` didn't change.
- **Tags:** tag names may be edited in `post-tags.json`; a slug never changes once a post has used it (the hook and CI reject it).
- If the post is named in a golden search query in `apps/web/src/lib/posts/search.test.ts`, run `npm test` too. If a query legitimately no longer fits, point it at another post that does; never loosen the assertion.
- Then run the same format and validate steps as above.
