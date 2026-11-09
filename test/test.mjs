// Mock test for dsh-file-organizer-plugin — no Harness, no API key.
// Uses only generic test files (photos, notes, slides, music) — nothing
// from any personal or work history. Run: node test/test.mjs
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { scanFolder, findDuplicates, planOrganize } from '../src/core.js'

// Build a neutral fixture folder.
const dir = await mkdtemp(path.join(tmpdir(), 'organizer-test-'))
await writeFile(path.join(dir, 'weekend-photo.jpg'), Buffer.alloc(1200, 1))
await writeFile(path.join(dir, 'todo.txt'), 'buy milk\ncall mum\n')
await writeFile(path.join(dir, 'slides.pptx'), Buffer.alloc(5000, 2))
await writeFile(path.join(dir, 'song.mp3'), Buffer.alloc(8000, 3))
// Duplicates: same content, different names.
await writeFile(path.join(dir, 'copy-a.txt'), 'same content here')
await writeFile(path.join(dir, 'copy-b.txt'), 'same content here')
await writeFile(path.join(dir, 'copy-c.txt'), 'same content here')
// Hidden file must be skipped.
await writeFile(path.join(dir, '.hidden.txt'), 'secret')
// Subfolder, one level deep.
await mkdir(path.join(dir, 'sub'))
await writeFile(path.join(dir, 'sub', 'nested-photo.png'), Buffer.alloc(900, 4))

// 1. scan_folder
const scan = await scanFolder({ path: dir, maxDepth: 2 })
assert.equal(scan.totalFiles, 8, `expected 8 visible files, got ${scan.totalFiles}`)
assert.equal(scan.byType.Images, 2)
assert.equal(scan.byType.Documents, 5)
assert.equal(scan.byType.Audio, 1)
assert.equal(scan.largest[0].name, 'song.mp3')
console.log('scan_folder OK:', JSON.stringify(scan, null, 2))

// 2. find_duplicates — one group of 3 identical .txt files.
const dupes = await findDuplicates({ path: dir, maxDepth: 2 })
assert.equal(dupes.duplicateGroups, 1)
assert.equal(dupes.groups[0].count, 3)
assert.equal(dupes.totalReclaimableBytes, 'same content here'.length * 2)
console.log('find_duplicates OK:', JSON.stringify(dupes, null, 2))

// 3. plan_organize — dry run only: files must still exist afterwards.
const plan = await planOrganize({ path: dir, strategy: 'by-type', maxDepth: 1 })
assert.equal(plan.dryRun, true)
assert.ok(plan.plannedMoves >= 6, `expected moves, got ${plan.plannedMoves}`)
assert.ok(plan.moves.every((m) => m.to.includes('/Images/') || m.to.includes('/Documents/') || m.to.includes('/Audio/')))
const stillThere = await import('node:fs/promises').then((fs) => fs.readdir(dir))
assert.ok(stillThere.includes('todo.txt'), 'plan must not move files')
console.log('plan_organize OK:', JSON.stringify(plan, null, 2))

// 4. Wiring check — index.js registers exactly the 3 tools.
const indexSrc = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
for (const tool of ['scan_folder', 'find_duplicates', 'plan_organize']) {
  assert.ok(indexSrc.includes(`name: '${tool}'`), `index.js missing ${tool}`)
}
assert.ok(indexSrc.includes("export const inject = ['tools']"))
assert.ok(indexSrc.includes('additionalProperties: true'), 'output schema must set additionalProperties explicitly')
assert.ok(!indexSrc.includes('rename') || indexSrc.includes('never moves'), 'plugin must not rename files')
console.log('wiring OK: index.js registers scan_folder, find_duplicates, plan_organize')

console.log('\nAll tests passed. Fixture dir (left for inspection):', dir)
