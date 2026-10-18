$ErrorActionPreference = 'Stop'

$featureBranch = git branch --show-current
if ($LASTEXITCODE -ne 0) { throw 'Unable to read the current Git branch.' }
if ($featureBranch -eq 'main' -or [string]::IsNullOrWhiteSpace($featureBranch)) {
  throw 'Run this command from a completed feature branch, not main.'
}

$changes = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'Unable to read Git status.' }
if ($changes.Count -gt 0) {
  throw 'The feature worktree has uncommitted changes. Commit the intended changes, then run this command again.'
}

npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed. Fix the reported issues before merging.' }
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed. Fix the reported issues before merging.' }

git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'Could not fetch origin. Check network/authentication and retry.' }
git switch main
if ($LASTEXITCODE -ne 0) { throw 'Could not switch to main. Resolve the current Git state manually.' }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Could not fast-forward main. Resolve local/remote divergence before merging.' }
git merge --no-ff $featureBranch -m "Merge $featureBranch"
if ($LASTEXITCODE -ne 0) {
  throw "Merge failed. Resolve conflicts on '$featureBranch', commit the resolution, then retry. No force-push was attempted."
}
git push origin main
if ($LASTEXITCODE -ne 0) {
  throw 'Push failed. The merge remains in local main; inspect Git status and follow repository branch protection if enabled.'
}

Write-Host "Merged and pushed $featureBranch to origin/main. The feature branch is retained."