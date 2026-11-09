// TypeScript source for dsh-file-organizer-plugin.
// Shipped entry point is index.js (plain JS, no build step — a git install
// never runs `build`, so the bundle must ship runnable JS).
// Keep in sync with index.js + src/core.js; `npm test` covers the shipped JS.
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { scanFolder, findDuplicates, planOrganize } from './core.js'

export const name = 'file-organizer-plugin'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'scan_folder',
    description: 'Scan a local folder and return counts by file type and size.',
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute path of the folder to scan' },
      maxDepth: { type: 'number', description: 'How deep to recurse, default 2' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      return scanFolder(args as { path: string; maxDepth?: number })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'find_duplicates',
    description: 'Find duplicate files by size then SHA-256 hash.',
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute path of the folder to check' },
      maxDepth: { type: 'number', description: 'How deep to recurse, default 2' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      return findDuplicates(args as { path: string; maxDepth?: number })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'plan_organize',
    description: 'Propose a dry-run organise plan. Never moves or deletes files.',
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
      return planOrganize(args as { path: string; strategy?: string; maxDepth?: number })
    },
  }))
}
