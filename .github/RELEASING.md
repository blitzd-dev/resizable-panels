# Releasing (maintainers)

## Prerequisites

1. `verify:release` is green on `main`.
2. Repo secret **`NPM_TOKEN`** is set (classic npm automation token with
   publish access to `@blitzd`).
3. Package homepage / docs URLs resolve publicly.

Add the token:

```sh
gh secret set NPM_TOKEN
# paste the token when prompted
```

## Publish

Tagging `v*` runs [`.github/workflows/publish.yml`](./workflows/publish.yml)
(build, provenance publish to npm).

```sh
# after bumping packages/resizable-panels/package.json version + changelog
git tag v0.1.0
git push origin v0.1.0
```

Confirm the GitHub Actions **Publish** run and the npm package page.
