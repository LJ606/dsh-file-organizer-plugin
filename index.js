// dsh-file-organizer-plugin — DeepSeek Harness (Cordis) tool plugin.
// Official shape: export `name`, `inject`, `apply(ctx)`; register tools
// with `ctx.tools.register(defineTool({...}))`.
// https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/tool
// Pure logic lives in ./src/core.js. This file only wires it up.
// SAFETY: none of these tools moves, renames, or deletes anything.
// plan_organize returns a dry-run plan only.
import { defineTool } from '@deepseek-ai/dsh-tools'
import { scanFolder, findDuplicates, planOrganize } from './src/core.js'

export const name = 'file-organizer-plugin'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'scan_folder',
    description: 'Scan a local folder (max depth 2, max 500 files, hidden files and symlinks skipped) and return counts by file type and size, total bytes, and the 5 largest files. Read-only.',
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute path of the folder to scan' },
      maxDepth: { type: 'number', description: 'How deep to recurse, default 2' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      return scanFolder(args)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'find_duplicates',
    description: 'Find duplicate files in a folder by size then SHA-256 hash (files over 50 MB are grouped by size and name only). Returns duplicate groups and reclaimable bytes. Read-only.',
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute path of the folder to check' },
      maxDepth: { type: 'number', description: 'How deep to recurse, default 2' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      return findDuplicates(args)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'plan_organize',
    description: 'Propose a dry-run organise plan for a folder: group by file type (default) or by modified month. Returns planned moves only — it never moves, renames, or deletes any file.',
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute path of the folder to organise' },
      strategy: { type: 'string', description: 'by-type (default) or by-date' },
      maxDepth: { type: 'number', description: 'How deep to scan, default 1' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      return planOrganize(args)
    },
  }))

  console.log('[file-organizer-plugin] plugin loaded! tools: scan_folder, find_duplicates, plan_organize')
}
