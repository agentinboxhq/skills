import assert from 'node:assert/strict';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
    appendFileSync(
      join(dir, 'skills/agentinbox/SKILL.md'),
      '\nReply in the thread, or run `npx @agentinbox/cli skill install`.\nThen `npx @agentinbox/cli inbox list`.\n'
    );

    const errors = errorsOf(dir);
    assert.match(errors, /"thread": say "conversation"/);
    assert.match(errors, /the removed `skill install` command/);
    assert.match(errors, /the removed `inbox` group: `inbox send` is `send` now \("@agentinbox\/cli inbox list"\)/);
  });

  it('rejects a mention of a skill that does not exist', () => {
    const dir = copyRepo();
    appendFileSync(join(dir, 'skills/agentinbox/SKILL.md'), '\nThe agentinbox-api skill covers the REST API.\n');

    assert.match(errorsOf(dir), /mentions "agentinbox-api", which isn't a skill/);
  });

  it('takes the background service of listen for what it is, not a skill', () => {
    const dir = copyRepo();
    appendFileSync(
      join(dir, 'skills/agentinbox-cli/SKILL.md'),
      '\nmacOS lists it as `agentinbox-listen`, and Linux runs `agentinbox-listen.service`.\n'
    );

    assert.doesNotMatch(errorsOf(dir), /mentions "agentinbox-listen"/);
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

  it('rejects a Cursor manifest outside the Cursor schema or out of step with the other manifests', () => {
    const dir = copyRepo();
    edit(dir, '.cursor-plugin/plugin.json', (text) => {
      const manifest = JSON.parse(text);
      manifest.privacyPolicyUrl = 'https://www.agentinbox.md/privacy';
      manifest.author.url = 'https://www.agentinbox.md';
      manifest.description = 'Ask a person.';
      manifest.logo = './assets/logo.png';
      // Without its placement, Grok Bot never offers to sign in.
      delete manifest.mcpServers.inbox.placement;
      manifest.mcpServers.mail = { type: 'http', url: 'https://mail.example.com/mcp' };

      return JSON.stringify(manifest);
    });

    const errors = errorsOf(dir);
    assert.match(errors, /"privacyPolicyUrl" isn't a field in Cursor's plugin schema/);
    assert.match(errors, /"author.url" isn't allowed/);
    assert.match(errors, /"description" differs from .claude-plugin\/plugin.json/);
    assert.match(errors, /"logo" must be the plugin's icon, .\/assets\/icon.png/);
    assert.match(
      errors,
      /"mcpServers.inbox" must be \{ "type": "http", "url": "https:\/\/mcp.agentinbox.md", "placement": "server" \}/
    );
    assert.match(errors, /"mcpServers.mail" isn't a server in .mcp.json/);
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

  it('rejects an mcp.json that does not match .mcp.json', () => {
    const dir = copyRepo();
    edit(dir, 'mcp.json', (text) => text.replace('"inbox"', '"agentinbox"').replace('"streamable-http"', '"http"'));

    const errors = errorsOf(dir);
    assert.match(errors, /"agentinbox" must be a remote server: \{ "type": "streamable-http"/);
    assert.match(errors, /must list the same servers, at the same addresses, as .mcp.json/);
  });

  it('rejects an mcp.json server with a field Codex drops it for', () => {
    const dir = copyRepo();
    edit(dir, 'mcp.json', (text) => {
      const config = JSON.parse(text);
      config.mcpServers.inbox.extensions = { 'com.openai': { auth: { type: 'oauth' } } };

      return JSON.stringify(config);
    });

    assert.match(errorsOf(dir), /"inbox" has "extensions"; Codex drops a server with more than type, url and headers/);
  });

  it('rejects a Codex listing that disagrees with the plugin or that Codex would cut short', () => {
    const dir = copyRepo();
    edit(dir, 'plugin.json', (text) => {
      const plugin = JSON.parse(text);
      const listing = plugin.extensions['com.openai'].interface;
      listing.displayName = 'Inbox';
      listing.websiteURL = 'https://agentinbox.md';
      listing.websiteUrl = 'https://www.agentinbox.md';
      listing.defaultPrompt.push('Summarize what my contacts asked for this week.');

      return JSON.stringify(plugin);
    });

    const errors = errorsOf(dir);
    assert.match(errors, /Codex interface "displayName" differs from .claude-plugin\/plugin.json/);
    assert.match(errors, /Codex interface "websiteURL" differs from the plugin's "homepage"/);
    assert.match(errors, /Codex interface "websiteUrl" isn't a field Codex reads/);
    assert.match(errors, /"defaultPrompt" has 4 prompts; Codex shows only the first 3/);
  });

  it('rejects a Codex listing that names files that are not there', () => {
    const dir = copyRepo();
    edit(dir, 'plugin.json', (text) => {
      const plugin = JSON.parse(text);
      const codex = plugin.extensions['com.openai'];
      codex.interface.logo = './assets/codex-logo.png';
      codex.onboardingSkill = './skills/agentinbox-setup/SKILL.md';
      codex.skills = './skills/';

      return JSON.stringify(plugin);
    });

    const errors = errorsOf(dir);
    assert.match(errors, /Codex interface "logo" points at .\/assets\/codex-logo.png, which isn't a file in this repository/);
    assert.match(errors, /onboardingSkill is .\/skills\/agentinbox-setup\/SKILL.md; it must be the SKILL.md of a skill in skills\//);
    assert.match(errors, /extensions\["com.openai"\] has "skills"/);
  });

  it('rejects a Codex marketplace that would give the plugin another id or hide it', () => {
    const dir = copyRepo();
    edit(dir, '.agents/plugins/marketplace.json', (text) => {
      const marketplace = JSON.parse(text);
      marketplace.name = 'agent-inbox';
      marketplace.plugins[0].category = 'Developer Tools';
      marketplace.plugins[0].policy.installation = 'NOT_AVAILABLE';

      return JSON.stringify(marketplace);
    });

    const errors = errorsOf(dir);
    assert.match(errors, /"name" must be "agentinbox", as in .claude-plugin\/marketplace.json/);
    assert.match(errors, /has category "Developer Tools" but the Codex interface has "Productivity"/);
    assert.match(errors, /"policy.installation" must be AVAILABLE or INSTALLED_BY_DEFAULT/);
  });

  it('rejects a Codex manifest that Codex would ignore', () => {
    const dir = copyRepo();
    mkdirSync(join(dir, '.codex-plugin'));
    writeFileSync(join(dir, '.codex-plugin/plugin.json'), '{ "name": "agentinbox" }\n');

    assert.match(errorsOf(dir), /\.codex-plugin\/plugin.json: Codex ignores it while plugin.json has extensions\["com.openai"\]/);
  });

  it('rejects an eval mock for a server or a tool the plugin does not have', () => {
    const dir = copyRepo();
    writeFileSync(join(dir, 'evals/mocks/inbox/inbox_archive.md'), 'Archived.\n');
    mkdirSync(join(dir, 'evals/agentinbox/tell-me-when-done/mocks/agentinbox'), { recursive: true });
    writeFileSync(join(dir, 'evals/agentinbox/tell-me-when-done/mocks/agentinbox/inbox_send.md'), 'Delivered.\n');

    const errors = errorsOf(dir);
    assert.match(errors, /inbox_archive.md: answers "inbox_archive", which isn't a tool in evals\/mocks\/inbox\/_tools.json/);
    assert.match(errors, /mocks\/agentinbox: stands in for "agentinbox", which isn't a server in .mcp.json/);
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
