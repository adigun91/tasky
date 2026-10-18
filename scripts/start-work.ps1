param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Name
)

$ErrorActionPreference = 'Stop'

$currentBranch = git branch --show-current
if ($LASTEXITCODE -ne 0) { throw 'Unable to read the current Git branch.' }
if ($currentBranch -ne 'main') {
  throw "Start work from main; current branch is '$currentBranch'. Finish or switch back first."
}

$changes = @(git status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'Unable to read Git status.' }
if ($changes.Count -gt 0) {
  throw 'The worktree is not clean. Commit, stash, or otherwise resolve existing changes before starting a new branch.'
}

git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'Could not fetch origin. Check network/authentication and retry.' }
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw 'Could not fast-forward main. Resolve local/remote divergence before starting work.' }

$slug = $Name.ToLowerInvariant() -replace '[^a-z0-9]+', '-'
$slug = $slug.Trim('-')
if ([string]::IsNullOrWhiteSpace($slug)) { throw 'Use a name containing letters or numbers.' }

$branch = "feature/$slug-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
git switch -c $branch
if ($LASTEXITCODE -ne 0) { throw "Could not create branch '$branch'." }

Write-Host "Started $branch"