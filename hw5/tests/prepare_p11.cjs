/* Copy only git-eligible HW5 files into the verified existing submission checkout.
 * No deletion, no HW4 edits, no secrets printed. */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const assert = require('node:assert/strict')
const source = path.resolve(__dirname, '..')
const checkout = path.resolve(process.argv[2] || '')
const target = path.join(checkout, 'hw5')
const git = (...args) => execFileSync('git', args, { cwd: checkout, encoding: 'utf8' }).trim()
assert.equal(git('remote', 'get-url', 'origin'), 'https://github.com/sssfyzy/MGT409.git')
assert.equal(fs.existsSync(path.join(checkout, 'hw4')), true)
assert.equal(git('diff', '--name-only', '--', 'hw4'), '')
assert.equal(git('diff', '--cached', '--name-only', '--', 'hw4'), '')
const sourceGitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: source, encoding: 'utf8' }).trim()
const prefix = path.relative(sourceGitRoot, source).replaceAll('\\', '/')
const names = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z', '--', prefix], { cwd: sourceGitRoot, encoding: 'utf8' }).split('\0').filter(Boolean).map(n => n.slice(prefix.length + 1))
assert.ok(names.length > 20)
assert.deepEqual(names.filter(n => n.startsWith('data/')).sort(), ['data/campus_customs.db', 'data/campus_customs_new.db'])
const required = ['AI_prompts.md', 'requirements.txt', '.env.example', '.gitignore', '.mcp.json', 'README.md', 'mcp_server/server.py', 'mcp_server/README.md', 'frontend/package-lock.json', 'backend/main.py', 'backend/models.py', 'output/harness.md', 'output/mcp_smoke.json', 'output/desk_tickets.html', 'output/design.md', 'output/resolved_tickets.json', 'output/resolved_board.html', 'output/audit_trail.json', 'output/github_url.txt']
for (const role of ['boss', 'inventory', 'accounting', 'facilities', 'customer_service']) required.push(`backend/prompts/${role}.md`)
for (const name of required) assert.ok(names.includes(name), `Missing required file: ${name}`)
const secretValues = ['PORTKEY_API_KEY', 'PORTKEY_VIRTUAL_KEY', 'CAMPUS_OPERATOR_KEY', 'CAMPUS_APPROVAL_SECRET'].map(k => process.env[k]).filter(v => v && v.length >= 12)
for (const envFile of [path.join(source, '.env'), path.join(source, '../.env')]) {
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?(?:PORTKEY_API_KEY|PORTKEY_VIRTUAL_KEY|CAMPUS_OPERATOR_KEY|OPENAI_API_KEY)\s*=\s*(.+?)\s*$/)
      if (match) { const value = match[1].replace(/^['"]|['"]$/g, ''); if (value.length >= 12) secretValues.push(value) }
    }
  }
}
const operatorFile = path.join(source, 'data/operator_access.json')
if (fs.existsSync(operatorFile)) secretValues.push(JSON.parse(fs.readFileSync(operatorFile, 'utf8')).access_key)
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
for (const name of names) {
  assert.equal(/(^|\/)(?:\.env|operator_access\.json|node_modules|\.venv|debug\.log|p8_fixture_meta\.json)(\/|$)/.test(name), false, `Excluded file selected: ${name}`)
  const bytes = fs.readFileSync(path.join(source, name))
  for (const secret of secretValues) assert.equal(bytes.includes(Buffer.from(secret)), false, `Private credential detected in ${name}; value withheld`)
  if (!name.endsWith('.db') && !name.endsWith('.png')) {
    assert.equal(/\bsk-(?:proj-)?[A-Za-z0-9_-]{25,}\b/.test(bytes.toString('utf8')), false, `Potential API credential in ${name}; value withheld`)
  }
  const destination = path.resolve(target, name)
  assert.ok(destination.startsWith(target + path.sep), 'Destination must remain within hw5')
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(path.join(source, name), destination)
  assert.equal(hash(destination), hash(path.join(source, name)))
}
const evidence = { recorded_at_utc: new Date().toISOString(), remote: git('remote', 'get-url', 'origin'), source_file_count: names.length, required_files_present: true, data_files: names.filter(n => n.startsWith('data/')), secret_scan: 'Passed: selected files scanned against actual local/environment credential values without printing them; OpenAI-key format check passed', hw4_tree_before: git('rev-parse', 'HEAD:hw4'), files: names.sort(), original_database_sha256: hash(path.join(target, 'data/campus_customs.db')), working_database_sha256: hash(path.join(target, 'data/campus_customs_new.db')) }
const evidenceText = JSON.stringify(evidence, null, 2)
fs.writeFileSync(path.join(source, 'output/p11_manifest.json'), evidenceText)
fs.writeFileSync(path.join(target, 'output/p11_manifest.json'), evidenceText)
console.log(JSON.stringify({ copied: names.length, data_files: evidence.data_files, secret_scan: 'passed', remote: evidence.remote, hw4_tree: evidence.hw4_tree_before }))
