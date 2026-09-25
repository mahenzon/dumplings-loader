# Releasing

Two independent channels: the **demo site** (GitHub Pages, redeploys on every push to `master`)
and the **npm package** (published by the `Release` workflow when a `v*` tag is pushed).

## One-time setup

### GitHub repository

1. Create an empty repository `mahenzon/dumplings-loader` on GitHub (no README, no license, they
   are already here).
2. Push:

   ```bash
   git remote add origin git@github.com:mahenzon/dumplings-loader.git
   git push -u origin master
   ```

3. **Settings → Pages → Build and deployment → Source: GitHub Actions.** The first push already
   ran `Deploy demo to GitHub Pages`; if it ran before Pages was enabled, re-run it from the
   Actions tab. The demo then lives at <https://mahenzon.github.io/dumplings-loader/> and the
   README hero image starts resolving (it points at `raw.githubusercontent.com/.../master/docs/demo.webp`).

No token setup is needed for Pages or for GitHub releases: the workflows use the built-in
`GITHUB_TOKEN` with the permissions they declare.

### npm

1. Have an npm account with 2FA enabled and log in locally: `npm login`.
2. **First publish is manual** (trusted publishing can only be configured for a package that
   already exists on npm):

   ```bash
   npm run lint && npm run build
   npm publish --access public      # asks for the 2FA code
   ```

3. Then, on npmjs.com → package `dumplings-loader` → **Settings → Trusted Publisher → GitHub
   Actions**: owner `mahenzon`, repository `dumplings-loader`, workflow filename `release.yaml`,
   environment left empty. Save. From now on the workflow publishes without any secret and with
   provenance attestations.

   Alternative (if you prefer a token): create a _granular access token_ (Read and write, scoped
   to this package, "Bypass 2FA" enabled) and store it as the `NPM_TOKEN` repository secret
   (Settings → Secrets and variables → Actions). The workflow uses it when present. Tokens expire
   (90 days max), trusted publishing does not.

## Every release

1. Be on `master` with a clean tree and green CI.
2. Bump the version. This edits `package.json`, commits `x.y.z` and creates tag `vx.y.z`:

   ```bash
   npm version patch        # or minor / major / an explicit "1.2.0"
   ```

   Prerelease: `npm version prerelease --preid beta` → `1.2.0-beta.0`, published under the `next`
   dist-tag (`npm i dumplings-loader@next`) and marked as a pre-release on GitHub.

3. Push the commit and the tag:

   ```bash
   git push --follow-tags
   ```

4. Watch **Actions → Release**. It lints, builds, checks that the tag matches `package.json`,
   runs `npm publish --provenance`, and creates a GitHub release with generated notes. The same
   push also redeploys the demo site.
5. Verify:
   - <https://www.npmjs.com/package/dumplings-loader> shows the new version with a provenance badge.
   - `https://unpkg.com/dumplings-loader@x.y.z/` lists `dist/`.
   - The GitHub release page has the notes.

## Troubleshooting

- **"Tag must match package.json version" fails**: the tag was pushed without bumping. Delete it
  (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`), run `npm version`, push again.
- **`ENEEDAUTH` / 404 on publish**: no trusted publisher configured for this repo + workflow file
  and no `NPM_TOKEN` secret. Do the one-time npm setup above.
- **Provenance error**: provenance needs a public repository and a GitHub-hosted runner, both true
  here; if you ever make the repo private, drop `--provenance` from the workflow.
- **Re-running a failed release**: if `npm publish` did not happen, fix, delete the tag remotely
  and locally, re-run `npm version` with the same number (`npm version 1.2.0 --allow-same-version`
  if package.json is already bumped) and push. If it did publish, npm will reject the same version:
  bump to the next patch.
- **Pages shows an old demo**: the Pages workflow only runs on `master`; check that the release
  commit landed there and that Pages source is "GitHub Actions".
