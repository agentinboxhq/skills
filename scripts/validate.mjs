#!/usr/bin/env node
/**
 * Checks this repository the way an installer and a reviewer would: every skill against the Agent Skills
 * spec (https://agentskills.io/specification) and this repo's own rules, the plugin manifests against each
 * other, the plugin's MCP server against the address the skills give, and the README, skills.sh.json and
 * evals against the skills that exist.
 *
 * Usage: node scripts/validate.mjs [repo-root]
 * Needs only Node.js 20 or later, no packages.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The frontmatter fields the spec allows. claude.ai uploads accept exactly these too. */
const SPEC_FIELDS = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
const REQUIRED_FIELDS = ['name', 'description', 'license'];

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Every skill here is named after the product, so installs next to other vendors' skills don't collide. */
const NAME_PREFIX = 'agentinbox';
/** Claude rejects these in a skill name. */
const RESERVED_WORDS = ['anthropic', 'claude'];
const MAX_NAME_LENGTH = 64;
const MIN_DESCRIPTION_LENGTH = 40;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_COMPATIBILITY_LENGTH = 500;

/** The spec's ceiling for SKILL.md; past it, move detail into references/. */
const MAX_SKILL_LINES = 500;
/** The spec recommends under 5,000 tokens for the body. Four characters per token is a rough measure. */
const MAX_BODY_TOKENS = 5000;
const CHARS_PER_TOKEN = 4;
/** A reference file longer than this starts with a table of contents, so a partial read still shows its scope. */
const CONTENTS_AFTER_LINES = 100;
/** Each skill gets at least three eval cases. */
const MIN_EVAL_CASES = 3;

const AGENT_PLUGINS_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const AGENT_PLUGINS_MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';
const AGENT_PLUGINS_FIELDS = new Set([
  '$schema',
  'name',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'extensions',
]);

/**
 * What Anthropic's plugin directory takes as the listing icon (`icon` in .claude-plugin/plugin.json): a square
 * PNG of 512 to 2048 px, under 2 MB. It keeps the icon from the first submission, so a wrong one sticks.
 */
const MIN_ICON_SIZE = 512;
const MAX_ICON_SIZE = 2048;
const MAX_ICON_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Characters that YAML reads as syntax when a plain value starts with them. */
const YAML_INDICATORS = '-?:,[]{}#&*!|>\'"%@`';

/**
 * Words the product doesn't use (the "Say this" table in the Agent Inbox docs), and commands that no longer
 * exist. Checked in everything under skills/.
 */
const DENYLIST = [
  ['the removed `skill install` command', /\bskill install\b/],
  ['the old CLI name `human`', /\bnpx human\b|`human (?:setup|login|connect|inbox|contact|channel|ask|approve|choose)\b/],
  ['"thread": say "conversation"', /\bthreads?\b/i],
  ['"subscriber" or "recipient": say "contact"', /\b(?:subscribers?|recipients?)\b/i],
  ['"pairing code": say "one-time code"', /\bpairing codes?\b/i],
];

export function validate(root) {
  const errors = [];
  const warnings = [];
  const error = (file, message) => errors.push(`${relative(root, file) || '.'}: ${message}`);
  const warn = (file, message) => warnings.push(`${relative(root, file) || '.'}: ${message}`);

  const skills = checkSkills(root, error, warn);
  const plugin = checkManifests(root, error);
  checkMcpServers(root, skills, error);
  checkSkillLicenses(root, skills, plugin, error);
  checkReadme(root, skills, error);
  checkSkillsSh(root, skills, error);
  checkEvals(root, skills, error);

  return { skills: skills.map((skill) => skill.name), errors, warnings };
}

function checkSkills(root, error, warn) {
  const skillsDir = join(root, 'skills');
  if (!isDirectory(skillsDir)) {
    error(skillsDir, 'missing: skills live in skills/<name>/SKILL.md');

    return [];
  }

  const skills = [];
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      error(join(skillsDir, entry.name), 'only skill folders belong in skills/');
      continue;
    }

    const dir = join(skillsDir, entry.name);
    const skillFile = join(dir, 'SKILL.md');
    if (!existsSync(skillFile)) {
      error(dir, 'has no SKILL.md');
      continue;
    }

    const skill = checkSkill(dir, skillFile, error, warn);
    if (skill) {
      skills.push(skill);
    }
  }

  if (skills.length === 0) {
    error(skillsDir, 'has no skills');
  }

  const names = new Set(skills.map((skill) => skill.name));
  for (const skill of skills) {
    checkSkillMentions(skill, names, error);
  }

  return skills;
}

function checkSkill(dir, skillFile, error, warn) {
  const text = readFileSync(skillFile, 'utf8');
  if (text.includes('\r\n')) {
    error(skillFile, 'uses Windows line endings; save it with LF');
  }

  const frontmatter = readFrontmatter(text);
  if (!frontmatter) {
    error(skillFile, 'must start with YAML frontmatter between --- lines');

    return null;
  }

  for (const problem of frontmatter.problems) {
    error(skillFile, problem);
  }

  const { fields } = frontmatter;
  for (const key of fields.keys()) {
    if (!SPEC_FIELDS.has(key)) {
      error(skillFile, `frontmatter field "${key}" isn't in the Agent Skills spec (allowed: ${[...SPEC_FIELDS].join(', ')})`);
    }
  }
  for (const key of REQUIRED_FIELDS) {
    if (!fields.has(key)) {
      error(skillFile, `frontmatter needs "${key}"`);
    }
  }
  for (const [key, value] of fields) {
    const problem = key === 'metadata' ? null : plainScalarProblem(value);
    if (problem) {
      error(skillFile, `frontmatter "${key}" ${problem}`);
    }
  }

  const folder = dir.split(sep).at(-1);
  const name = fields.get('name') ?? '';
  checkName(skillFile, name, folder, error);
  checkDescription(skillFile, fields.get('description') ?? '', error);

  const compatibility = fields.get('compatibility');
  if (compatibility !== undefined && compatibility.length > MAX_COMPATIBILITY_LENGTH) {
    error(skillFile, `compatibility is ${compatibility.length} characters; the spec allows ${MAX_COMPATIBILITY_LENGTH}`);
  }

  const lines = text.split('\n').length;
  if (lines > MAX_SKILL_LINES) {
    error(skillFile, `is ${lines} lines; keep SKILL.md under ${MAX_SKILL_LINES} and move detail into references/`);
  }
  const tokens = Math.round(frontmatter.body.length / CHARS_PER_TOKEN);
  if (tokens > MAX_BODY_TOKENS) {
    warn(skillFile, `body is about ${tokens} tokens; the spec recommends under ${MAX_BODY_TOKENS}`);
  }

  const files = listFiles(dir);
  for (const file of files.filter((path) => path.endsWith('.md'))) {
    checkMarkdown(dir, file, error);
  }
  for (const file of files) {
    if (file === skillFile) {
      continue;
    }

    const path = relative(dir, file).split(sep).join('/');
    if (!frontmatter.body.includes(path)) {
      error(file, `isn't mentioned in SKILL.md, so agents won't know when to read it`);
    }
  }

  return { name: name || folder, dir, fields, files };
}

function checkName(file, name, folder, error) {
  if (!name) {
    return;
  }

  if (name.length > MAX_NAME_LENGTH) {
    error(file, `name is ${name.length} characters; the spec allows ${MAX_NAME_LENGTH}`);
  }
  if (!NAME_PATTERN.test(name)) {
    error(file, `name "${name}" may only use lowercase letters, digits and single hyphens`);
  }
  if (name !== folder) {
    error(file, `name "${name}" must match its folder "${folder}"`);
  }
  if (name !== NAME_PREFIX && !name.startsWith(`${NAME_PREFIX}-`)) {
    error(file, `name "${name}" should start with "${NAME_PREFIX}"`);
  }
  for (const word of RESERVED_WORDS) {
    if (name.includes(word)) {
      error(file, `name "${name}" contains the reserved word "${word}"`);
    }
  }
}

function checkDescription(file, description, error) {
  if (!description) {
    return;
  }

  if (description.length < MIN_DESCRIPTION_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
    error(
      file,
      `description is ${description.length} characters; keep it between ${MIN_DESCRIPTION_LENGTH} and ${MAX_DESCRIPTION_LENGTH}`
    );
  }
  if (/<[A-Za-z][^>]*>/.test(description)) {
    error(file, 'description must not contain XML tags');
  }
  if (/^(?:I|I'm|You|You're|We)\b/.test(description)) {
    error(file, 'description is loaded into the system prompt: write it in the third person ("Reaches…", not "I can…")');
  }
  if (!/\bUse (?:when|to|for)\b/.test(description)) {
    error(file, 'description should say when to use the skill ("Use when…")');
  }
}

/**
 * The skill names a skill's text mentions, such as "the agentinbox-cli skill", must exist. The CLI's package
 * (`@agentinbox/cli`) and the site (`agentinbox.md`) aren't mentions.
 */
function checkSkillMentions(skill, names, error) {
  const mention = new RegExp(`(?<![\\w/.@-])${NAME_PREFIX}(?:-[a-z0-9]+)*\\b(?!\\.md)`, 'g');
  for (const file of skill.files.filter((path) => path.endsWith('.md'))) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(mention)) {
      if (!names.has(match[0])) {
        error(file, `mentions "${match[0]}", which isn't a skill in skills/`);
      }
    }
  }
}

function checkMarkdown(dir, file, error) {
  const text = readFileSync(file, 'utf8');
  const isSkillFile = file === join(dir, 'SKILL.md');

  for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) {
      continue;
    }

    if (target.includes('\\')) {
      error(file, `link "${target}" uses backslashes; use forward slashes`);
      continue;
    }

    const path = resolve(dirname(file), target.split('#')[0]);
    if (!path.startsWith(dir + sep)) {
      error(file, `link "${target}" leaves the skill folder; installers copy only the folder`);
    } else if (!existsSync(path)) {
      error(file, `link "${target}" points at a file that doesn't exist`);
    } else if (!isSkillFile && path.endsWith('.md') && path !== join(dir, 'SKILL.md')) {
      error(file, `link "${target}" chains to another reference; link every reference from SKILL.md, one level deep`);
    }
  }

  for (const [label, pattern] of DENYLIST) {
    const match = pattern.exec(text);
    if (match) {
      error(file, `line ${lineOf(text, match.index)}: ${label} ("${match[0]}")`);
    }
  }

  if (!isSkillFile && text.split('\n').length > CONTENTS_AFTER_LINES && !/^## Contents$/m.test(text)) {
    error(file, `is over ${CONTENTS_AFTER_LINES} lines; start it with a "## Contents" list`);
  }
}

function checkManifests(root, error) {
  const portableFile = join(root, 'plugin.json');
  const claudeFile = join(root, '.claude-plugin', 'plugin.json');
  const marketplaceFile = join(root, '.claude-plugin', 'marketplace.json');
  const portable = readJson(portableFile, error);
  const claude = readJson(claudeFile, error);
  const marketplace = readJson(marketplaceFile, error);

  if (portable) {
    if (portable.$schema !== AGENT_PLUGINS_SCHEMA) {
      error(portableFile, `$schema must be ${AGENT_PLUGINS_SCHEMA}`);
    }
    for (const key of Object.keys(portable)) {
      if (!AGENT_PLUGINS_FIELDS.has(key)) {
        error(portableFile, `"${key}" isn't an Agent Plugins 1.0 field; client-specific data goes under "extensions"`);
      }
    }
    if (typeof portable.name !== 'string' || !NAME_PATTERN.test(portable.name) || portable.name.length > MAX_NAME_LENGTH) {
      error(portableFile, 'name must be 1-64 lowercase letters, digits and single hyphens');
    }
  }

  if (portable && claude) {
    for (const key of ['name', 'description', 'homepage', 'repository', 'license']) {
      if (portable[key] !== claude[key]) {
        error(claudeFile, `"${key}" differs from plugin.json; keep the two manifests the same`);
      }
    }
  }

  if (claude) {
    checkIcon(root, claudeFile, claude.icon, error);
  }

  if (marketplace) {
    if (!marketplace.name || !marketplace.owner?.name || !Array.isArray(marketplace.plugins)) {
      error(marketplaceFile, 'needs "name", "owner.name" and a "plugins" list');
    } else {
      const entry = marketplace.plugins.find((plugin) => plugin.source === './');
      if (!entry) {
        error(marketplaceFile, 'needs a plugin entry whose source is "./", this repository');
      } else if (claude && entry.name !== claude.name) {
        error(marketplaceFile, `entry "${entry.name}" must have the plugin's name "${claude.name}"`);
      } else if (claude && entry.description !== claude.description) {
        error(marketplaceFile, `entry "${entry.name}" must have the plugin's description`);
      }
    }
  }

  return claude ?? portable;
}

/** The plugin's `icon` is a PNG in this repository that the directory accepts. */
function checkIcon(root, claudeFile, icon, error) {
  if (typeof icon !== 'string' || !icon.startsWith('./')) {
    error(claudeFile, '"icon" must be the path of the listing icon, such as "./assets/icon.png"');

    return;
  }

  const file = resolve(root, icon);
  if (relative(root, file).startsWith('..') || !existsSync(file)) {
    error(claudeFile, `"icon" points at ${icon}, which isn't a file in this repository`);

    return;
  }

  const png = readFileSync(file);
  if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    error(file, 'must be a PNG');

    return;
  }

  // The first chunk, IHDR, holds the width and height.
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== height || width < MIN_ICON_SIZE || width > MAX_ICON_SIZE) {
    error(file, `is ${width}x${height} px; the directory takes a square of ${MIN_ICON_SIZE} to ${MAX_ICON_SIZE} px`);
  }
  if (png.length >= MAX_ICON_BYTES) {
    error(file, 'must be under 2 MB');
  }
}

/**
 * The MCP server the plugin adds is the hosted one, at the address the skills give. Claude Code reads it from
 * .mcp.json, and Agent Plugins clients from mcp.json, which calls the transport `streamable-http`. Both files
 * list the same servers.
 */
function checkMcpServers(root, skills, error) {
  const skillText = skills.map((skill) => readFileSync(join(skill.dir, 'SKILL.md'), 'utf8')).join('\n');
  const claudeFile = join(root, '.mcp.json');
  const portableFile = join(root, 'mcp.json');
  const claude = readJson(claudeFile, error);
  const portable = readJson(portableFile, error);

  if (portable) {
    if (portable.$schema !== AGENT_PLUGINS_MCP_SCHEMA) {
      error(portableFile, `$schema must be ${AGENT_PLUGINS_MCP_SCHEMA}`);
    }
    for (const key of Object.keys(portable)) {
      if (key !== '$schema' && key !== 'mcpServers') {
        error(portableFile, `"${key}" isn't an Agent Plugins mcp.json field`);
      }
    }
  }

  const claudeServers = claude && checkServers(claudeFile, claude, 'http', skillText, error);
  const portableServers = portable && checkServers(portableFile, portable, 'streamable-http', skillText, error);
  if (claudeServers && portableServers && claudeServers !== portableServers) {
    error(portableFile, 'must list the same servers, at the same addresses, as .mcp.json');
  }
}

/** Each server must be a remote one of `type`, at an address the skills give. Returns them as "name url" lines. */
function checkServers(file, config, type, skillText, error) {
  const servers = Object.entries(config.mcpServers ?? {});
  if (servers.length === 0) {
    error(file, 'needs "mcpServers" with the hosted MCP server');
  }
  for (const [name, server] of servers) {
    if (server.type !== type || typeof server.url !== 'string') {
      error(file, `"${name}" must be a remote server: { "type": "${type}", "url": "…" }`);
    } else if (!skillText.includes(server.url)) {
      error(file, `"${name}" points at ${server.url}, which no SKILL.md gives as the server's address`);
    }
  }

  return servers
    .map(([name, server]) => `${name} ${server.url}`)
    .sort()
    .join('\n');
}

function checkSkillLicenses(root, skills, plugin, error) {
  if (!existsSync(join(root, 'LICENSE'))) {
    error(join(root, 'LICENSE'), 'missing');
  }

  for (const skill of skills) {
    const license = skill.fields.get('license');
    if (plugin && license && license !== plugin.license) {
      error(join(skill.dir, 'SKILL.md'), `license "${license}" differs from the plugin's "${plugin.license}"`);
    }
  }
}

/** The README's table of skills lists exactly the skills that exist. */
function checkReadme(root, skills, error) {
  const file = join(root, 'README.md');
  if (!existsSync(file)) {
    error(file, 'missing');

    return;
  }

  const listed = new Set([...readFileSync(file, 'utf8').matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((match) => match[1]));
  for (const skill of skills) {
    if (!listed.has(skill.name)) {
      error(file, `the skills table is missing "${skill.name}"`);
    }
  }
  for (const name of listed) {
    if (!skills.some((skill) => skill.name === name)) {
      error(file, `the skills table lists "${name}", which isn't in skills/`);
    }
  }
}

/** skills.sh shows the skills in these groups: each skill in exactly one. */
function checkSkillsSh(root, skills, error) {
  const file = join(root, 'skills.sh.json');
  const config = readJson(file, error);
  if (!config) {
    return;
  }

  const grouped = (config.groupings ?? []).flatMap((group) => group.skills ?? []);
  for (const name of grouped) {
    if (!skills.some((skill) => skill.name === name)) {
      error(file, `groups "${name}", which isn't in skills/`);
    }
  }
  for (const skill of skills) {
    const count = grouped.filter((name) => name === skill.name).length;
    if (count !== 1) {
      error(file, `"${skill.name}" is in ${count} groups; put it in exactly one`);
    }
  }
}

/** evals/<skill>/<case>/ holds each case: a prompt.md and at least one grader. */
function checkEvals(root, skills, error) {
  const evalsDir = join(root, 'evals');
  for (const skill of skills) {
    const dir = join(evalsDir, skill.name);
    const cases = isDirectory(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => join(dir, entry.name))
      : [];

    if (cases.length < MIN_EVAL_CASES) {
      error(dir, `has ${cases.length} eval cases; write at least ${MIN_EVAL_CASES} for "${skill.name}"`);
    }
    for (const caseDir of cases) {
      if (!existsSync(join(caseDir, 'prompt.md'))) {
        error(caseDir, 'needs a prompt.md');
      }
      const graders = join(caseDir, 'graders');
      if (!isDirectory(graders) || !readdirSync(graders).some((name) => name.endsWith('.md'))) {
        error(caseDir, 'needs at least one grader in graders/');
      }
    }
  }
}

/**
 * Reads the frontmatter's `key: value` lines. The values here are single-line plain scalars, which is
 * what every client parses the same way; `metadata` may hold an indented map. The skills index on
 * agentinbox.md (`/.well-known/agent-skills/`) reads `description` the same way, without a YAML parser.
 */
function readFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) {
    return null;
  }

  const fields = new Map();
  const problems = [];
  let mapKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    if (/^\s/.test(line)) {
      if (mapKey !== 'metadata') {
        problems.push(`frontmatter line "${line.trim()}" is indented; only "metadata" holds a map`);
      }
      continue;
    }

    const field = /^([A-Za-z][\w-]*):(?: (.*))?$/.exec(line);
    if (!field) {
      problems.push(`frontmatter line "${line}" isn't "key: value"`);
      continue;
    }
    if (fields.has(field[1])) {
      problems.push(`frontmatter "${field[1]}" appears twice`);
    }

    fields.set(field[1], (field[2] ?? '').trim());
    mapKey = field[2] ? null : field[1];
  }

  return { fields, problems, body: text.slice(match[0].length) };
}

function plainScalarProblem(value) {
  if (value === '') {
    return 'is empty';
  }
  if (YAML_INDICATORS.includes(value[0])) {
    return `starts with "${value[0]}", which YAML reads as syntax`;
  }
  if (value.includes(': ')) {
    return 'contains ": ", which YAML reads as a new key; reword it';
  }
  if (value.includes(' #')) {
    return 'contains " #", which YAML reads as a comment; reword it';
  }
  if (value.endsWith(':')) {
    return 'ends with ":"';
  }

  return null;
}

function readJson(file, error) {
  if (!existsSync(file)) {
    error(file, 'missing');

    return null;
  }

  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    error(file, `isn't valid JSON (${err.message})`);

    return null;
  }
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function main() {
  const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
  const { skills, errors, warnings } = validate(root);

  for (const warning of warnings) {
    console.log(`warning: ${warning}`);
  }
  if (errors.length > 0) {
    for (const message of errors) {
      console.log(`error: ${message}`);
    }
    console.log(`\n${errors.length} error(s)`);
    process.exit(1);
  }

  console.log(`ok: ${skills.length} skills (${skills.join(', ')})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
