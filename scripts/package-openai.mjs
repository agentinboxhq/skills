#!/usr/bin/env node
/**
 * Builds the ZIP for OpenAI's plugin directory (ChatGPT and Codex): the Agent Plugins layout, with plugin.json,
 * mcp.json, the skills, the files plugin.json names, and the license at the root of the archive. The repository's
 * plugin.json has no "version", so installs from GitHub update on every commit; the directory wants an explicit
 * one, so this writes it into the packaged copy only. It then opens the archive again and checks what's inside.
 *
 * Usage: node scripts/package-openai.mjs <version> [out-dir]
 * Writes <out-dir>/agentinbox-<version>.zip (out-dir defaults to dist/). Needs `zip` and `unzip` on PATH.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './validate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
/** What the directory installs. Everything else here (evals, CI, other clients' manifests) stays out. */
const INCLUDE = ['plugin.json', 'mcp.json', 'LICENSE', 'README.md', 'skills', 'assets'];
/** Without these the directory holds the submission, so a package missing any is a draft. */
const SUBMISSION_FIELDS = [
  ['interface', 'supportURL'],
  ['interface', 'privacyPolicyURL'],
  ['interface', 'termsOfServiceURL'],
  ['review', 'demo_recording_url'],
];
/** Things that must never ship: keys and tokens, and the fields the directory rejects in a package. */
const SECRETS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /"(?:clientSecret|client_secret|test_credentials|reviewer_instructions)"\s*:/,
  /\[ADD URL\]/,
];

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function fail(message) {
  console.log(`error: ${message}`);
  process.exit(1);
}

const [version, outArg] = process.argv.slice(2);
if (!version || !SEMVER.test(version)) {
  fail('give the version to package, such as 0.1.0');
}

const { errors } = validate(ROOT);
if (errors.length > 0) {
  fail(`node scripts/validate.mjs reports ${errors.length} error(s); fix those first`);
}

const plugin = JSON.parse(readFileSync(join(ROOT, 'plugin.json'), 'utf8'));
const { name, ...rest } = plugin;
const packaged = { $schema: plugin.$schema, name, version, ...rest };

const stage = mkdtempSync(join(tmpdir(), 'agentinbox-package-'));
const check = mkdtempSync(join(tmpdir(), 'agentinbox-unzip-'));
try {
  for (const entry of INCLUDE) {
    cpSync(join(ROOT, entry), join(stage, entry), {
      recursive: true,
      filter: (path) => !/(?:^|[/\\])\.[^/\\]+$/.test(relative(ROOT, path)),
    });
  }
  writeFileSync(join(stage, 'plugin.json'), `${JSON.stringify(packaged, null, 2)}\n`);

  const outDir = resolve(outArg ?? join(ROOT, 'dist'));
  mkdirSync(outDir, { recursive: true });
  const zipFile = join(outDir, `${name}-${version}.zip`);
  rmSync(zipFile, { force: true });
  execFileSync('zip', ['-X', '-r', '-q', zipFile, '.'], { cwd: stage });

  // Check the archive itself, not the folder it was made from.
  execFileSync('unzip', ['-q', zipFile, '-d', check]);
  const problems = [];
  const files = listFiles(check).map((path) => relative(check, path));
  const roots = files.filter((path) => path.endsWith('plugin.json'));
  if (roots.length !== 1 || roots[0] !== 'plugin.json') {
    problems.push(`the archive must have one plugin.json, at its root; it has ${roots.join(', ') || 'none'}`);
  }
  for (const file of files) {
    if (/(?:^|\/)\./.test(file)) {
      problems.push(`${file} is a hidden file`);
    }
    const text = readFileSync(join(check, file), 'latin1');
    for (const pattern of SECRETS) {
      if (pattern.test(text)) {
        problems.push(`${file} matches ${pattern}, which must not ship`);
      }
    }
  }
  const unpacked = JSON.parse(readFileSync(join(check, 'plugin.json'), 'utf8'));
  const openai = unpacked.extensions?.['com.openai'] ?? {};
  const listing = openai.interface ?? {};
  for (const path of [listing.composerIcon, listing.logo, listing.logoDark, openai.onboardingSkill].filter(Boolean)) {
    if (!existsSync(join(check, path))) {
      problems.push(`plugin.json names ${path}, which isn't in the archive`);
    }
  }
  JSON.parse(readFileSync(join(check, 'mcp.json'), 'utf8'));
  for (const problem of problems) {
    console.log(`error: ${problem}`);
  }
  if (problems.length > 0) {
    rmSync(zipFile, { force: true });
    process.exit(1);
  }

  const sha256 = createHash('sha256').update(readFileSync(zipFile)).digest('hex');
  writeFileSync(`${zipFile}.sha256`, `${sha256}  ${name}-${version}.zip\n`);
  const missing = SUBMISSION_FIELDS.filter(([section, key]) => !openai[section]?.[key]).map(([s, k]) => `${s}.${k}`);
  console.log(`${files.length} files, ${statSync(zipFile).size} bytes, sha256 ${sha256}`);
  console.log(missing.length > 0 ? `DRAFT, missing ${missing.join(', ')}: ${zipFile}` : `ok: ${zipFile}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
  rmSync(check, { recursive: true, force: true });
}
