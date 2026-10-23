#!/usr/bin/env node
/**
 * Installs the plugin from this repository into an empty Codex home, as `codex plugin marketplace add` and
 * `codex plugin add` would from GitHub, and checks what Codex made of it: each MCP server in mcp.json at its
 * address, and each skill in skills/. Codex has no command that validates a plugin, so this is that check.
 * It runs Codex with a throwaway HOME and CODEX_HOME, so it never reads or changes your own Codex setup,
 * never signs in, and makes no model calls.
 *
 * Usage: node scripts/check-codex-plugin.mjs [repo-root]
 * Runs `codex` from PATH, or the command in CODEX_CLI, such as "npx --yes @openai/codex@0.160.0".
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
const [command, ...commandArgs] = (process.env.CODEX_CLI ?? 'codex').split(' ').filter(Boolean);
const home = mkdtempSync(join(tmpdir(), 'agentinbox-codex-'));
const env = { ...process.env, HOME: home, CODEX_HOME: join(home, '.codex') };
mkdirSync(env.CODEX_HOME);

/** Codex's output. Its stderr only matters when a command fails, so it's shown then. */
function codex(...args) {
  try {
    return execFileSync(command, [...commandArgs, ...args], {
      cwd: home,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw new Error(`codex ${args.join(' ')} failed:\n${err.stderr || err.message}`);
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(join(root, file), 'utf8'));
}

const problems = [];
try {
  const { name: plugin } = readJson('plugin.json');
  const { marketplaceName } = JSON.parse(codex('plugin', 'marketplace', 'add', root, '--json'));
  codex('plugin', 'add', `${plugin}@${marketplaceName}`, '--json');

  const servers = JSON.parse(codex('mcp', 'list', '--json'));
  for (const [name, { url }] of Object.entries(readJson('mcp.json').mcpServers)) {
    const server = servers.find((candidate) => candidate.name === name);
    if (!server) {
      problems.push(`Codex has no MCP server "${name}" after installing the plugin`);
    } else if (server.transport?.url !== url) {
      problems.push(`Codex has the MCP server "${name}" at ${server.transport?.url}, not ${url}`);
    }
  }

  // The skills list Codex puts in front of the model, rendered without calling one.
  const prompt = codex('debug', 'prompt-input');
  for (const skill of readdirSync(join(root, 'skills'))) {
    if (!prompt.includes(`${plugin}:${skill}:`)) {
      problems.push(`Codex doesn't list the skill ${plugin}:${skill}`);
    }
  }

  if (problems.length === 0) {
    console.log(`ok: Codex installs ${plugin}@${marketplaceName} with its MCP servers and skills`);
  }
} catch (err) {
  problems.push(err.message);
} finally {
  rmSync(home, { recursive: true, force: true });
}

for (const problem of problems) {
  console.log(`error: ${problem}`);
}
process.exit(problems.length > 0 ? 1 : 0);
