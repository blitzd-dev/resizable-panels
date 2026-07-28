# Releasing (maintainers)

Publishes use [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC from GitHub Actions). No long-lived `NPM_TOKEN` is required.

## Trusted publisher (one-time)

On npmjs.com → **@blitzd/resizable-panels** → **Settings** → **Trusted
publishing** → **GitHub Actions**:

| Field | Value |
| --- | --- |
| Organization or user | `blitzd-dev` |
| Repository | `resizable-panels` |
| Workflow filename | `publish.yml` |
| Environment | _(leave empty)_ |
| Allowed actions | `npm publish` |

Filename only — not `.github/workflows/publish.yml`. Values are
case-sensitive.

Optional harden after it works: package **Settings → Publishing access** →
require 2FA and disallow tokens.

## Each release

1. `verify:release` is green on `main`.
2. Version in `packages/resizable-panels/package.json` matches the tag.
3. Changelog entry exists for that version.
4. Docs / homepage URLs resolve.

```sh
git tag v0.1.0
git push origin v0.1.0
```

Watch the **Publish** workflow. Provenance is generated automatically.
