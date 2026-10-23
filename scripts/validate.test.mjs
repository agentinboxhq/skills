import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validate } from './validate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const copies = [];

/** A copy of this repository to break on purpose. */
function copyRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'agentinbox-skills-'));
  copies.push(dir);
  cpSync(ROOT, dir, {
    recursive: true,
    filter: (path) => !/[/\\](?:\.git|node_modules|results)$/.test(path),
  });

  return dir;
}

function edit(dir, file, change) {
  const path = join(dir, file);
  writeFileSync(path, change(readFileSync(path, 'utf8')));
}

function errorsOf(dir) {
  return validate(dir).errors.join('\n');
}

afterEach(() => {
  for (const dir of copies.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('validate', () => {
  it('passes this repository', () => {
    const { errors, skills } = validate(ROOT);

    assert.deepEqual(errors, []);
    assert.deepEqual(skills.sort(), ['agentinbox', 'agentinbox-cli', 'agentinbox-mcp']);
  });

  it('rejects a frontmatter field the spec does not have', () => {
    const dir = copyRepo();
    edit(dir, 'skills/agentinbox/SKILL.md', (text) => text.replace('license: MIT', 'license: MIT\ntriggers: inbox'));

    assert.match(errorsOf(dir), /frontmatter field "triggers" isn't in the Agent Skills spec/);
  });

  it('rejects a name that does not match its folder', () => {
    const dir = copyRepo();
    edit(dir, 'skills/agentinbox-mcp/SKILL.md', (text) => text.replace('name: agentinbox-mcp', 'name: agentinbox-connect'));

    assert.match(errorsOf(dir), /name "agentinbox-connect" must match its folder "agentinbox-mcp"/);
  });

  it('rejects a description that YAML would read as a new key', () => {
    const dir = copyRepo();
    edit(dir, 'skills/agentinbox-cli/SKILL.md', (text) =>
      text.replace('description: Sets up', 'description: The CLI: sets up')
    );

    assert.match(errorsOf(dir), /frontmatter "description" contains ": "/);
  });

  it('rejects a description that does not say when to use the skill', () => {
    const dir = copyRepo();
    edit(dir, 'skills/agentinbox-mcp/SKILL.md', (text) =>
      text.replace(/^description: .*$/m, 'description: Connects an AI app to the hosted Agent Inbox MCP server and troubleshoots it.')
    );

    assert.match(errorsOf(dir), /description should say when to use the skill/);
  });

  it('rejects a broken link and a link that leaves the skill folder', () => {
    const dir = copyRepo();
    appendFileSync(join(dir, 'skills/agentinbox/SKILL.md'), '\nSee [errors](references/errors.md) and [the CLI](../agentinbox-cli/SKILL.md).\n');

    const errors = errorsOf(dir);
    assert.match(errors, /link "references\/errors.md" points at a file that doesn't exist/);
    assert.match(errors, /link "..\/agentinbox-cli\/SKILL.md" leaves the skill folder/);
  });

  it('rejects a file that SKILL.md never mentions', () => {
    const dir = copyRepo();
    writeFileSync(join(dir, 'skills/agentinbox/references/unused.md'), '# Unused\n');

    assert.match(errorsOf(dir), /references\/unused.md: isn't mentioned in SKILL.md/);
  });

  it('rejects a SKILL.md over 500 lines', () => {
    const dir = copyRepo();
    appendFileSync(join(dir, 'skills/agentinbox-mcp/SKILL.md'), 'More.\n'.repeat(500));

    assert.match(errorsOf(dir), /lines; keep SKILL.md under 500/);
  });

  it('rejects words the product does not use and removed commands', () => {
    const dir = copyRepo();
    appendFileSync(join(dir, 'skills/agentinbox/SKILL.md'), '\nReply in the thread, or run `npx @agentinbox/cli skill install`.\n');

    const errors = errorsOf(dir);
    assert.match(errors, /"thread": say "conversation"/);
    assert.match(errors, /the removed `skill install` command/);
  });

  it('rejects a mention of a skill that does not exist', () => {
    const dir = copyRepo();
    appendFileSync(join(dir, 'skills/agentinbox/SKILL.md'), '\nThe agentinbox-api skill covers the REST API.\n');

    assert.match(errorsOf(dir), /mentions "agentinbox-api", which isn't a skill/);
  });

  it('rejects manifests that disagree', () => {
    const dir = copyRepo();
    // The marketplace has the plugin's name too, so rename only the plugin's entry.
    edit(dir, '.claude-plugin/marketplace.json', (text) => {
      const marketplace = JSON.parse(text);
      marketplace.plugins[0].name = 'inbox';

      return JSON.stringify(marketplace);
    });
    edit(dir, 'plugin.json', (text) => text.replace('"license": "MIT"', '"license": "Apache-2.0"'));

    const errors = errorsOf(dir);
    assert.match(errors, /entry "inbox" must have the plugin's name "agentinbox"/);
    assert.match(errors, /"license" differs from plugin.json/);
  });

  it('rejects a plugin icon the directory would not take', () => {
    const dir = copyRepo();
    const icon = readFileSync(join(dir, 'assets/icon.png'));
    // A 1024x512 PNG: only the size in its IHDR chunk changes.
    icon.writeUInt32BE(512, 20);
    writeFileSync(join(dir, 'assets/icon.png'), icon);

    assert.match(errorsOf(dir), /assets\/icon.png: is 1024x512 px; the directory takes a square of 512 to 2048 px/);

    edit(dir, '.claude-plugin/plugin.json', (text) => text.replace('./assets/icon.png', './assets/logo.png'));
    assert.match(errorsOf(dir), /"icon" points at .\/assets\/logo.png, which isn't a file in this repository/);
  });

  it('rejects an MCP server at an address the skills do not give', () => {
    const dir = copyRepo();
    edit(dir, '.mcp.json', (text) => text.replace('https://mcp.agentinbox.md', 'https://mcp.agentinbox.md/mcp'));

    assert.match(errorsOf(dir), /"inbox" points at https:\/\/mcp.agentinbox.md\/mcp, which no SKILL.md gives/);
  });

  it('rejects a README, skills.sh.json or evals that miss a skill', () => {
    const dir = copyRepo();
    edit(dir, 'README.md', (text) => text.replace(/^\| `agentinbox-mcp` \|.*\n/m, ''));
    edit(dir, 'skills.sh.json', (text) => text.replace(/,\s*"agentinbox-mcp"/, ''));
    rmSync(join(dir, 'evals/agentinbox-mcp'), { recursive: true });

    const errors = errorsOf(dir);
    assert.match(errors, /the skills table is missing "agentinbox-mcp"/);
    assert.match(errors, /"agentinbox-mcp" is in 0 groups/);
    assert.match(errors, /has 0 eval cases; write at least 3 for "agentinbox-mcp"/);
  });
});
