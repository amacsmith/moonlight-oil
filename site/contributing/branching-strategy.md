# Branching Strategy

Moonlight Oil uses a simple **trunk-based** branching model.

## Branches

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Stable, release-ready code | Yes |
| `feature/*` | New features or enhancements | No |
| `fix/*` | Bug fixes | No |
| `docs/*` | Documentation changes | No |

## Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/my-change
   ```

2. **Make your changes** and commit with clear messages.

3. **Push and open a PR** against `main`:
   ```bash
   git push -u origin feature/my-change
   ```

4. **CI runs automatically** — the installer compiles on Windows and the FlowState image builds on Ubuntu.

5. **Review and merge** — squash-merge is preferred to keep `main` linear.

## Branch Protection Rules (Recommended)

For the `main` branch, enable:

- **Require pull request reviews** (at least 1 approval)
- **Require status checks to pass** before merging:
  - `installer` (Windows build)
  - `flowstate-image` (Docker build)
  - `tests` (validation suite)
- **Require branches to be up to date** before merging
- **Do not allow force pushes**
- **Do not allow deletions**

These can be configured in **Settings > Branches > Branch protection rules** on GitHub.

## Releases

Releases follow [semantic versioning](https://semver.org/):

- Tag `main` with `v1.0.0`, `v1.1.0`, etc.
- The CI workflow automatically attaches `MoonlightOilSetup.exe` to the release.

```bash
git tag v1.0.0
git push origin v1.0.0
```
