param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$migrationRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $migrationRoot '..\..'))
$target = [System.IO.Path]::GetFullPath($OutputDirectory)
$separator = [System.IO.Path]::DirectorySeparatorChar

if ($target.Equals($repositoryRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $target.StartsWith($repositoryRoot + $separator, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Choose an encrypted backup directory outside the Git repository.'
}
foreach ($name in @('PGHOST', 'PGDATABASE', 'PGUSER')) {
  if (-not [Environment]::GetEnvironmentVariable($name)) {
    throw "Missing source PostgreSQL connection setting: $name"
  }
}
if ($env:PGHOST -notmatch '(^|\.)[^.]*supabase\.(co|com)$') {
  throw 'Source PGHOST must be a Supabase host. Refusing to export from another database.'
}
if ($env:PGSSLMODE -ne 'require') { throw 'Set PGSSLMODE=require for the source connection.' }
foreach ($executable in @('pg_dump', 'psql')) {
  if (-not (Get-Command $executable -ErrorAction SilentlyContinue)) {
    throw "$executable is required. Install PostgreSQL client tools first."
  }
}
if (Test-Path -LiteralPath $target) {
  if ((Get-ChildItem -LiteralPath $target -Force | Measure-Object).Count -ne 0) {
    throw 'The backup directory must be empty. No existing backup is overwritten.'
  }
} else {
  New-Item -ItemType Directory -Path $target | Out-Null
}

$tables = @(
  'profiles', 'events', 'contents', 'event_applications',
  'article_entitlements', 'article_media',
  'kaihipay_sync_events', 'kaihipay_invitation_jobs'
)
$fingerprints = Join-Path $migrationRoot 'source_fingerprints.sql'
$before = Join-Path $target 'source-fingerprints-before.csv'
$after = Join-Path $target 'source-fingerprints-after.csv'

& psql -X --set=ON_ERROR_STOP=1 --quiet --tuples-only --csv `
  "--file=$fingerprints" "--output=$before"
if ($LASTEXITCODE -ne 0) { throw 'Source fingerprint query failed.' }

foreach ($table in $tables) {
  $file = Join-Path $target ($table + '.sql')
  & pg_dump --data-only --column-inserts --no-owner --no-privileges `
    "--table=public.$table" "--file=$file"
  if ($LASTEXITCODE -ne 0) { throw "Export failed for $table. Keep the partial backup for review." }
}

$identities = Join-Path $target 'auth-identity-manifest.csv'
& psql -X --set=ON_ERROR_STOP=1 --quiet --tuples-only --csv `
  --command='select id,email,email_confirmed_at from auth.users order by id' `
  "--output=$identities"
if ($LASTEXITCODE -ne 0) { throw 'Auth identity manifest export failed. Password hashes are never exported.' }

& psql -X --set=ON_ERROR_STOP=1 --quiet --tuples-only --csv `
  "--file=$fingerprints" "--output=$after"
if ($LASTEXITCODE -ne 0) { throw 'Second source fingerprint query failed.' }
if ((Get-Content -LiteralPath $before -Raw) -ne (Get-Content -LiteralPath $after -Raw)) {
  throw 'Source rows changed during export. Do not import this backup; retry in a paused-write window.'
}

Write-Output 'Eight legacy tables and an identity-only manifest were exported.'
Write-Output 'Keep this directory private and encrypted. Do not commit or share the files.'
