# Contributing

Thanks for helping with `@blitzd/resizable-panels`.

## Setup

Requires [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

- Library: `packages/resizable-panels`
- Docs / demo site: `apps/demo`

## Before you open a PR

```sh
bun run lint
bun run typecheck
bun run test
```

For behavior that needs a browser (resize, collapse, persistence, a11y), also run:

```sh
bun --filter '@blitzd/resizable-panels' test:e2e:react19
```

CI runs `bun run verify:release` (build, typecheck, docs checks, unit tests,
package smoke, React 18 + 19 e2e).

## Scope

- Prefer small, focused PRs.
- Match existing patterns in `packages/resizable-panels/src` — headless API,
  no new runtime dependencies without discussion.
- Add or extend unit/e2e coverage when you change layout, collapse, or
  persistence behavior.
- Docs live as TSX under `apps/demo/src/pages/docs/`; update them when you
  change public API or recommended patterns.

## Issues

- Use a bug or feature issue template when possible.
- Include a minimal reproduction for bugs (CodeSandbox / StackBlitz / repo link).
- Search existing issues before filing a duplicate.

## Conduct

By participating, you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).
