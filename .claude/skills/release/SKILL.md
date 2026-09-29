---
name: release
description: Prepare a release of HoverTranslate — version, changelog, checks, live YouTube markup, store archives, and what the user uploads where. Uploads nothing itself.
argument-hint: <version>
disable-model-invocation: true
---

Prepare release $0. Talk to the user in Russian. Nothing is uploaded or published: the user does that. Stop at the first failing step and report it.

## 1. May it go out

- Read «Сейчас» in `work/backlog.md`: a release condition (a waiting window, a store still reviewing the previous version) that is not met — stop and say what is missing. A new upload replaces the one waiting in a store's review queue.
- Tasks in `review` in `work/backlog.md` are not committed yet: list them and ask whether the release waits for them.
- `git status --short`: uncommitted changes are the user's; list them.

## 2. Version and changelog

- The number follows `CLAUDE.md` → «Releasing», judged by the `CHANGELOG.md` section: only **Fixed** → patch; **Added** or a change the viewer notices → minor; something the viewer loses → major. If $0 does not match, say so before changing anything.
- `npm run version:set -- $0`, then the release date in the `CHANGELOG.md` heading (`## [$0] - YYYY-MM-DD`). Read the section as a viewer would: every entry says what changed for them.

## 3. Checks

```bash
npm run verify
npm run setup:chrome && npm run build && npm run test:e2e
```

## 4. YouTube's markup has not changed (~2 min, live YouTube)

```bash
node e2e/youtube-dom/capture.js
git diff --stat e2e/youtube-dom/captured
```

In the diff look at classes, nesting, `position`, `z-index`, `pointer-events` and what lies over the captions (`onTopOfCaption`); caption texts and small size shifts do not matter. If something the extension depends on changed, the fixtures in `e2e/fixtures/` follow it and `test:e2e` runs again — that is a task of its own before the release, not a quick fix here. If nothing relevant changed, say so: The user discards the new capture himself (`git checkout -- e2e/youtube-dom/captured`; agents may not) or commits it with the release.

## 5. Old browsers

If a package that ships in the bundle or `build.target` changed since the last release (`git diff <last tag>..HEAD -- package.json '*/package.json' '*/vite*.config.ts'`; the tags are `v1.1.9`-style, `git tag --sort=-v:refname | head -1`), run the build in Chromium 102 and Firefox 115 by the recipe in `CLAUDE.md` → «Dependencies», in `work/runs/release/`, and delete the folder after.

## 6. Archives

```bash
npm run release
```

List every archive in `releases/$0/` (`unzip -l`):
- the store packages hold only `manifest.json`, `_locales/`, `assets/icons/`, `extension/dist/`, `popup/dist/` (`scripts/archive.js`), and each `manifest.json` is its browser's (`manifest.firefox.json` in the `.xpi`), with version $0;
- the source archive has no `work/`, `.claude/`, `CLAUDE.md`, `.env`, `node_modules`, `dist`, `releases/`.

## 7. For the user

In Russian:

1. **Manual check** in a browser with the store-installed extension, after updating to the new package: one video with manual captions and one with auto-generated ones — hover, a Shift phrase, a click, «Translation saved», the dictionary in the popup. It is the only check of an update over a real store install.
2. **What goes where:** Chrome Web Store — `releases/$0/<chrome zip>`; Edge Add-ons — the Edge zip; AMO — the `.xpi` plus the source archive. If the listing changed: `npm run update:amo` (the user runs it — agents may not).
3. **A commit message** for the version and the changelog date, in the style of `git log` (English, imperative).
4. After the stores publish it: the dates go into «Сейчас» in `work/backlog.md`.

## 8. Clean up

When the user confirms the release is committed: the files of the tasks that went into it are deleted from `work/tasks/`, their lines from `work/backlog.md`; a decision worth keeping goes into `work/decisions.md`.
