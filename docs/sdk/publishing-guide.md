# Publishing Guide

How to publish new versions of the three OFFER-HUB npm packages.

## Current Status

All three packages are published at v1.0.0:

| Package | npm | Version |
|---|---|---|
| `@offerhub/sdk` | [npmjs.com/package/@offerhub/sdk](https://www.npmjs.com/package/@offerhub/sdk) | 1.0.0 |
| `@offerhub/cli` | [npmjs.com/package/@offerhub/cli](https://www.npmjs.com/package/@offerhub/cli) | 1.0.0 |
| `create-offer-hub-orchestrator` | [npmjs.com/package/create-offer-hub-orchestrator](https://www.npmjs.com/package/create-offer-hub-orchestrator) | 1.0.0 |

---

## When to publish a new version

Follow [semver](https://semver.org/):

| Change | Version bump | Example |
|---|---|---|
| Bug fix | `patch` | 1.0.0 → 1.0.1 |
| New feature, backward-compatible | `minor` | 1.0.0 → 1.1.0 |
| Breaking change | `major` | 1.0.0 → 2.0.0 |

---

## How to publish a new version

### 1. Authenticate

You need a Granular Access Token from [npmjs.com/settings/tokens](https://www.npmjs.com/settings/tokens) with:
- **Permissions:** Read and write
- **Bypass 2FA:** enabled
- **Packages:** All packages (or select `@offerhub`)

```bash
echo "//registry.npmjs.org/:_authToken=YOUR_TOKEN" >> ~/.npmrc
```

### 2. Bump version

Run from the package directory:

```bash
# Patch
cd packages/sdk && npm version patch

# Minor
cd packages/sdk && npm version minor

# Major
cd packages/sdk && npm version major
```

This updates `package.json` and creates a git tag automatically.

### 3. Build

From the repo root:

```bash
npm run build
```

### 4. Publish

```bash
# SDK
cd packages/sdk && npm publish --access public

# CLI
cd packages/cli && npm publish --access public

# Installer
cd packages/create-offerhub && npm publish
```

### 5. Push tags and update the GitHub Release

```bash
git push && git push --tags
```

Then update the GitHub Release — see [Updating the GitHub Release](#updating-the-github-release) below.

---

## Updating the GitHub Release

After publishing new package versions, update the release notes:

```bash
gh release edit v1.0.0 \
  --repo OFFER-HUB/OFFER-HUB \
  --notes "Updated release notes here"
```

Or to create a new release for the new version:

```bash
gh release create v1.1.0 \
  --repo OFFER-HUB/OFFER-HUB \
  --title "v1.1.0 — <short description>" \
  --notes "## Changes
- feat: ...
- fix: ..."
```

---

## Publishing to GitHub Packages (optional)

GitHub Packages is an alternative registry. Useful if you want packages available directly from the GitHub org without requiring an npmjs.com account.

### Setup

Add to each `package.json`:

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

### Authenticate

Create a GitHub token with `write:packages` scope:

```bash
echo "//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN" >> ~/.npmrc
echo "@offerhub:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

### Publish

```bash
cd packages/sdk && npm publish
cd packages/cli && npm publish
```

> **Note:** `create-offer-hub-orchestrator` has no scope, so it can only be published to npm, not GitHub Packages.

### Consumers installing from GitHub Packages

They need to add to their `.npmrc`:

```
@offerhub:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=THEIR_GITHUB_TOKEN
```

---

## Automated Publishing (CI/CD)

To automate publishing on every GitHub Release, create `.github/workflows/publish.yml`:

```yaml
name: Publish npm packages

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci

      - run: npm run build

      - name: Publish SDK
        run: npm publish --access public
        working-directory: packages/sdk
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Publish CLI
        run: npm publish --access public
        working-directory: packages/cli
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Publish Installer
        run: npm publish
        working-directory: packages/create-offerhub
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Add `NPM_TOKEN` as a repository secret in GitHub → Settings → Secrets.

---

## Troubleshooting

**`E403 — Two-factor authentication required`**
→ Your token does not have "Bypass 2FA" enabled. Regenerate it with that option checked.

**`E404 — Not found`**
→ The `@offerhub` org does not exist on npm, or you are not a member. Check [npmjs.com/org/offerhub](https://www.npmjs.com/org/offerhub).

**`Cannot publish over existing version`**
→ Bump the version with `npm version patch` before publishing.

**`ENOWORKSPACES — This command does not support workspaces`**
→ Run `npm publish` from inside the package directory, not from the repo root. Or write the token directly to `~/.npmrc` instead of using `npm set`.
