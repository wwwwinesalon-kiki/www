param(
  [Parameter(Mandatory = $true)]
  [string]$InputDirectory,
  [Parameter(Mandatory = $true)]
  [string]$ExpectedTargetHost
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $InputDirectory).Path
$migrationRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
foreach ($name in @('PGHOST', 'PGDATABASE', 'PGUSER')) {
  if (-not [Environment]::GetEnvironmentVariable($name)) {
    throw "Missing TARGET PostgreSQL connection setting: $name"
  }
}
if ($env:PGHOST -notlike '*.neon.tech' -or
    -not $env:PGHOST.Equals($ExpectedTargetHost, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Target PGHOST must be the exact confirmed Neon host. Refusing to import.'
}
if ($env:PGSSLMODE -ne 'require') { throw 'Set PGSSLMODE=require for the target connection.' }
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  throw 'psql is required. Install PostgreSQL client tools first.'
}
$tables = @(
  'profiles', 'events', 'contents', 'event_applications',
  'article_entitlements', 'article_media',
  'kaihipay_sync_events', 'kaihipay_invitation_jobs'
)
$baselineFile = Join-Path $source 'source-fingerprints-before.csv'
foreach ($file in @($baselineFile, (Join-Path $source 'auth-identity-manifest.csv'))) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing required export: $file" }
}
foreach ($table in $tables) {
  if (-not (Test-Path -LiteralPath (Join-Path $source ($table + '.sql')) -PathType Leaf)) {
    throw "Missing table export: $table"
  }
}
$baseline = @(Import-Csv -LiteralPath $baselineFile -Header @('table_name','row_count','fingerprint'))
if ($baseline.Count -ne 8) { throw 'Expected exactly eight source fingerprints.' }
foreach ($row in $baseline) {
  if ($tables -cnotcontains $row.table_name -or
      $row.row_count -cnotmatch '^[0-9]+$' -or
      $row.fingerprint -cnotmatch '^[0-9a-f]{32}$') {
    throw 'Invalid source fingerprint file. Stop and inspect the backup.'
  }
}
if ((@($baseline.table_name | Sort-Object -Unique)).Count -ne 8) {
  throw 'Duplicate source fingerprint table names.'
}

& psql -X --set=ON_ERROR_STOP=1 "--file=$(Join-Path $migrationRoot '0001_www_schema.sql')"
if ($LASTEXITCODE -ne 0) { throw 'Fresh Neon schema creation failed. Do not use this database for cutover.' }

$psqlArguments = @('-X', '--set=ON_ERROR_STOP=1', '--single-transaction')
foreach ($table in $tables) {
  $psqlArguments += "--file=$(Join-Path $source ($table + '.sql'))"
}
& psql @psqlArguments
if ($LASTEXITCODE -ne 0) { throw 'Legacy data import failed and was rolled back. The Neon schema remains inactive.' }

$rows = @($baseline | ForEach-Object {
  "('$($_.table_name)',$($_.row_count),'$($_.fingerprint)')"
}) -join ','
$insert = "insert into public.www_migration_baseline(table_name,expected_rows,expected_fingerprint) values $rows"
& psql -X --set=ON_ERROR_STOP=1 "--command=$insert"
if ($LASTEXITCODE -ne 0) { throw 'Source fingerprint baseline could not be recorded.' }

$targetFingerprintFile = Join-Path $source 'target-fingerprints-after-import.csv'
& psql -X --set=ON_ERROR_STOP=1 --quiet --tuples-only --csv `
  --command='select * from public.www_migration_fingerprints()' `
  "--output=$targetFingerprintFile"
if ($LASTEXITCODE -ne 0) { throw 'Target fingerprint query failed.' }
$targetBaseline = @(Import-Csv -LiteralPath $targetFingerprintFile -Header @('table_name','row_count','fingerprint'))
foreach ($row in $baseline) {
  $match = @($targetBaseline | Where-Object { $_.table_name -ceq $row.table_name })
  if ($match.Count -ne 1 -or $match[0].row_count -ne $row.row_count -or
      $match[0].fingerprint -ne $row.fingerprint) {
    throw "Imported data differs from source: $($row.table_name). Activation is blocked."
  }
}
Write-Output 'Eight legacy tables match their source row counts and fingerprints.'
Write-Output 'Authentication remains unbound and private media remains unverified.'
Write-Output 'Do not run 0002_activate.sql until all private objects pass SHA-256 comparison.'
