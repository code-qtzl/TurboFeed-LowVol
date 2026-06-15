## Contributing to TurboFeed-LowVol

First off, thank you for considering contributing! Any contributions you make are **greatly appreciated**.

## How to Contribute

1. **Report Bugs:** Use the GitHub Issues tab to report any bugs. Please include steps to reproduce the error.

2. **Feature Requests:** Open an issue to discuss new ideas before diving into the code.

3. **Pull Requests (Required Flow):**
    - Open your PR **to `main`**.
    - CI is enforced on PRs to `main` and on pushes to `main`.
    - Branch naming and PR title checks are enforced by [`.github/workflows/ci.yml`](https://github.com/code-qtzl/TurboFeed-LowVol/blob/main/.github/workflows/ci.yml).

## Branch Naming Convention (Required)

Your branch name must start with one of these prefixes:

- `feat/`
- `fix/`
- `chore/`
- `hotfix/`

Examples:

- `feat/new-campaign-wizard`
- `fix/review-dashboard-null-state`
- `chore/update-eslint-config`

If your branch does not match one of these prefixes, CI will fail.

## Commit Prefixes (Required)

Use Conventional Commit style prefixes in commit messages:

- `feat:`
- `fix:`
- `chore:`
- `docs:`
- `refactor:`
- `test:`
- `build:`
- `ci:`
- `perf:`

Examples:

- `feat: add campaign preview controls`
- `fix: handle empty assets in upload step`
- `chore: update lint script`

## PR Title Naming Convention (Required)

PR titles must follow Conventional Commits format and are validated by CI.

Use:

- `<type>: <short description>`

Examples:

- `feat: add review dashboard export option`
- `fix: prevent crash when campaign name is missing`

## Suggested PR Creation Steps

```bash
# Clone
git clone https://github.com/code-qtzl/TurboFeed-LowVol.git
cd TurboFeed-LowVol

# Sync main
git checkout main
git pull origin main

# Create a compliant branch
git checkout -b feat/amazing-new-feature

# Commit using a required prefix
git add .
git commit -m "feat: add some amazing feature"

# Push and open PR to main
git push origin feat/amazing-new-feature
```

Before requesting review:

- Add or update tests when behavior changes.
- Keep control flow and style consistent with the existing codebase.
- Make sure your PR title and branch name follow the conventions above.
