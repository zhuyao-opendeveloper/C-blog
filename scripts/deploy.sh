#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-gh-pages}"
MSG="${2:-chore: deploy C Blog}"

echo "📦 Publishing C Blog to branch '$BRANCH'..."

# Use a worktree to avoid switching main branch
TMP_DIR="$(mktemp -d)"
echo "=> Preparing temporary directory: $TMP_DIR"

git worktree add "$TMP_DIR" "$BRANCH" 2>/dev/null || {
  echo "=> Branch '$BRANCH' does not exist yet, initializing..."
  git worktree add -b "$BRANCH" "$TMP_DIR"
  pushd "$TMP_DIR" >/dev/null
  git rm -rf . >/dev/null 2>&1 || true
  popd >/dev/null
}

echo "=> Copying build artifacts..."
rsync -a --delete \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='node_modules' \
  --exclude='README.md' \
  --exclude='scripts' \
  ./ "$TMP_DIR/"

pushd "$TMP_DIR" >/dev/null
git add -A
if git diff --cached --quiet; then
  echo "=> Nothing to commit."
else
  git commit -m "$MSG"
  git push origin "$BRANCH"
  echo "=> Pushed to origin/$BRANCH ✨"
fi
popd >/dev/null

git worktree remove --force "$TMP_DIR"
rm -rf "$TMP_DIR"

echo "✅ Done. In your GitHub repo Settings → Pages, set Source to 'gh-pages' branch."
