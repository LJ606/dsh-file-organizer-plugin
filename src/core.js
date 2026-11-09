// Pure logic for dsh-file-organizer-plugin.
// No network, no API key, no model call. All three tools read the local
// filesystem only, and plan_organize NEVER moves or deletes a file —
// it returns a dry-run plan for the user to approve first.
// Safety rules baked in:
//  - path must exist and be a directory; symlinks are not followed
//  - hidden files/dirs (starting with .) are skipped
//  - max 500 files scanned per call, files over 50 MB are hashed by size+name only
import { createHash } from 'node:crypto'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const MAX_FILES = 500
const MAX_HASH_BYTES = 50 * 1024 * 1024

const TYPE_MAP = {
  Images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'],
  Documents: ['.pdf', '.doc', '.docx', '.txt', '.md', '.ppt', '.pptx', '.xls', '.xlsx'],
  Audio: ['.mp3', '.wav', '.flac', '.m4a'],
  Video: ['.mp4', '.mov', '.mkv', '.avi'],
  Archives: ['.zip', '.tar', '.gz', '.7z'],
}

export function classify(ext) {
  const lower = ext.toLowerCase()
  for (const [group, exts] of Object.entries(TYPE_MAP)) {
    if (exts.includes(lower)) return group
  }
  return 'Other'
}

export function sizeBucket(bytes) {
  if (bytes < 100 * 1024) return '<100KB'
  if (bytes < 1024 * 1024) return '100KB-1MB'
  if (bytes < 10 * 1024 * 1024) return '1-10MB'
  return '>10MB'
}

export async function listFiles(dir, maxDepth = 2) {
  const root = path.resolve(dir)
  const rootStat = await stat(root)
  if (!rootStat.isDirectory()) throw new Error(`not a directory: ${dir}`)
  const out = []
  async function walk(current, depth) {
    if (out.length >= MAX_FILES) return
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = path.join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (depth < maxDepth) await walk(full, depth + 1)
      } else if (entry.isFile()) {
        const s = await stat(full)
        out.push({
          path: full,
          name: entry.name,
          ext: path.extname(entry.name),
          size: s.size,
          mtime: s.mtime.toISOString(),
        })
        if (out.length >= MAX_FILES) return
      }
    }
  }
  await walk(root, 0)
  return { root, files: out, truncated: out.length >= MAX_FILES }
}

export async function scanFolder({ path: dir, maxDepth = 2 }) {
  const { root, files, truncated } = await listFiles(dir, maxDepth)
  const byType = {}
  const bySize = {}
  let totalBytes = 0
  for (const f of files) {
    const group = classify(f.ext)
    byType[group] = (byType[group] || 0) + 1
    const bucket = sizeBucket(f.size)
    bySize[bucket] = (bySize[bucket] || 0) + 1
    totalBytes += f.size
  }
  const largest = [...files].sort((a, b) => b.size - a.size).slice(0, 5)
  return {
    root,
    totalFiles: files.length,
    totalBytes,
    truncated,
    byType,
    bySize,
    largest: largest.map((f) => ({ name: f.name, size: f.size })),
    note: truncated ? `Only first ${MAX_FILES} files scanned.` : 'Full scan.',
  }
}

export function hashFileSync() {
  // Placeholder kept for API symmetry; hashing is done async in findDuplicates.
  return null
}

export async function findDuplicates({ path: dir, maxDepth = 2 }) {
  const { root, files } = await listFiles(dir, maxDepth)
  // Group by size first (cheap), then hash only same-size groups under the limit.
  const bySize = new Map()
  for (const f of files) {
    if (!bySize.has(f.size)) bySize.set(f.size, [])
    bySize.get(f.size).push(f)
  }
  const groups = []
  const { readFile } = await import('node:fs/promises')
  for (const [size, candidates] of bySize) {
    if (candidates.length < 2) continue
    const byHash = new Map()
    for (const f of candidates) {
      let hash
      if (size > MAX_HASH_BYTES) {
        hash = `size-only:${size}:${f.name}`
      } else {
        const buf = await readFile(f.path)
        hash = createHash('sha256').update(buf).digest('hex')
      }
      if (!byHash.has(hash)) byHash.set(hash, [])
      byHash.get(hash).push(f)
    }
    for (const [hash, dupes] of byHash) {
      if (dupes.length < 2) continue
      groups.push({
        hash: hash.slice(0, 12),
        size,
        count: dupes.length,
        files: dupes.map((d) => d.path),
        reclaimableBytes: size * (dupes.length - 1),
      })
    }
  }
  return {
    root,
    totalFiles: files.length,
    duplicateGroups: groups.length,
    totalReclaimableBytes: groups.reduce((a, g) => a + g.reclaimableBytes, 0),
    groups,
  }
}

export async function planOrganize({ path: dir, strategy = 'by-type', maxDepth = 1 }) {
  const { root, files } = await listFiles(dir, maxDepth)
  const moves = []
  for (const f of files) {
    let targetDir
    if (strategy === 'by-date') {
      const d = new Date(f.mtime)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      targetDir = path.join(root, ym)
    } else {
      // default: by-type
      targetDir = path.join(root, classify(f.ext))
    }
    if (path.dirname(f.path) === targetDir) continue
    moves.push({
      from: f.path,
      to: path.join(targetDir, f.name),
      reason: strategy === 'by-date' ? `modified ${f.mtime.slice(0, 10)}` : `${classify(f.ext)} / ${f.ext || 'no-ext'}`,
    })
  }
  return {
    root,
    strategy,
    totalFiles: files.length,
    plannedMoves: moves.length,
    alreadyOrganized: files.length - moves.length,
    moves: moves.slice(0, 50),
    truncatedMoves: moves.length > 50,
    dryRun: true,
    warning: 'DRY RUN ONLY — no files were moved. Review the plan, then move files yourself or approve a separate apply step.',
  }
}
