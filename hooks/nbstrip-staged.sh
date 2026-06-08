#!/usr/bin/env bash
# Strip outputs from staged .ipynb files only
set -euo pipefail

# Get list of staged ipynb files
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.ipynb$' || true)
if [ -z "$STAGED" ]; then
  exit 0
fi

# Ensure nbstripout is available
command -v nbstripout >/dev/null 2>&1 || {
  echo "nbstripout not found in PATH; install it or activate your venv." >&2
  exit 0
}

for file in $STAGED; do
  # Only proceed if file exists in working tree
  if [ -f "$file" ]; then
    # nbstripout works in-place; create a temporary copy, strip, and update index
    tmp_file_name="tmp_nbstrip_$(basename "$file")"
    cp -- "$file" "$tmp_file_name"
    nbstripout "$tmp_file_name"
    # replace working file and update index with stripped version
    mv -- "$tmp_file_name" "$file"
    git add -- "$file"
  fi
done

exit 0
