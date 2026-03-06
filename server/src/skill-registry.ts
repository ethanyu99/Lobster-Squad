import type { SkillDefinition } from '../../shared/types';

/**
 * Curated skills registry — real OpenClaw community skills sourced from
 * the openclaw/skills GitHub repo and ClawHub. Each SKILL.md is the
 * authentic content used by the OpenClaw agent runtime.
 */
export const SKILL_REGISTRY: SkillDefinition[] = [
  // ─── Developer Skills ─────────────────────────────
  {
    id: 'github',
    name: 'github',
    description: 'Interact with GitHub using the gh CLI for issues, PRs, CI runs, and advanced queries',
    author: 'steipete',
    category: 'coding',
    tags: ['github', 'gh', 'pr', 'issues', 'ci'],
    skillMd: `---
name: github
description: "Interact with GitHub using the \`gh\` CLI. Use \`gh issue\`, \`gh pr\`, \`gh run\`, and \`gh api\` for issues, PRs, CI runs, and advanced queries."
---

# GitHub Skill

Use the \`gh\` CLI to interact with GitHub. Always specify \`--repo owner/repo\` when not in a git directory, or use URLs directly.

## Pull Requests

Check CI status on a PR:
\`\`\`bash
gh pr checks 55 --repo owner/repo
\`\`\`

List recent workflow runs:
\`\`\`bash
gh run list --repo owner/repo --limit 10
\`\`\`

View a run and see which steps failed:
\`\`\`bash
gh run view <run-id> --repo owner/repo
\`\`\`

View logs for failed steps only:
\`\`\`bash
gh run view <run-id> --repo owner/repo --log-failed
\`\`\`

## API for Advanced Queries

The \`gh api\` command is useful for accessing data not available through other subcommands.

Get PR with specific fields:
\`\`\`bash
gh api repos/owner/repo/pulls/55 --jq '.title, .state, .user.login'
\`\`\`

## JSON Output

Most commands support \`--json\` for structured output. You can use \`--jq\` to filter:

\`\`\`bash
gh issue list --repo owner/repo --json number,title --jq '.[] | "\\(.number): \\(.title)"'
\`\`\`
`,
    metadata: {
      homepage: 'https://cli.github.com',
      emoji: '🐙',
    },
  },
  {
    id: 'github-pr',
    name: 'github-pr',
    description: 'Fetch, preview, merge, and test GitHub PRs locally before merging',
    author: 'dbhurley',
    category: 'coding',
    tags: ['github', 'pr', 'merge', 'test', 'review'],
    skillMd: `---
name: github-pr
description: Fetch, preview, merge, and test GitHub PRs locally. Great for trying upstream PRs before they're merged.
homepage: https://cli.github.com
metadata: {"clawdbot":{"emoji":"🔀","requires":{"bins":["gh","git"]}}}
---

# GitHub PR Tool

Fetch and merge GitHub pull requests into your local branch. Perfect for:
- Trying upstream PRs before they're merged
- Incorporating features from open PRs into your fork
- Testing PR compatibility locally

## Prerequisites

- \`gh\` CLI authenticated (\`gh auth login\`)
- Git repository with remotes configured

## Commands

### Preview a PR
\`\`\`bash
github-pr preview <owner/repo> <pr-number>
\`\`\`
Shows PR title, author, status, files changed, CI status, and recent comments.

### Fetch PR branch locally
\`\`\`bash
github-pr fetch <owner/repo> <pr-number> [--branch <name>]
\`\`\`
Fetches the PR head into a local branch (default: \`pr/<number>\`).

### Merge PR into current branch
\`\`\`bash
github-pr merge <owner/repo> <pr-number> [--no-install]
\`\`\`
Fetches and merges the PR. Optionally runs install after merge.

### Full test cycle
\`\`\`bash
github-pr test <owner/repo> <pr-number>
\`\`\`
Fetches, merges, installs dependencies, and runs build + tests.

## Notes

- PRs are fetched from the \`upstream\` remote by default
- Use \`--remote <name>\` to specify a different remote
- Merge conflicts must be resolved manually
- The \`test\` command auto-detects package manager (npm/pnpm/yarn/bun)
`,
    metadata: {
      homepage: 'https://cli.github.com',
      emoji: '🔀',
      requires: { bins: ['gh', 'git'] },
    },
  },
  {
    id: 'summarize',
    name: 'summarize',
    description: 'Summarize URLs or files with the summarize CLI (web, PDFs, images, audio, YouTube)',
    author: 'steipete',
    category: 'productivity',
    tags: ['summarize', 'pdf', 'youtube', 'web', 'tldr'],
    skillMd: `---
name: summarize
description: Summarize URLs or files with the summarize CLI (web, PDFs, images, audio, YouTube).
homepage: https://summarize.sh
metadata: {"clawdbot":{"emoji":"🧾","requires":{"bins":["summarize"]},"install":[{"id":"brew","kind":"brew","formula":"steipete/tap/summarize","bins":["summarize"],"label":"Install summarize (brew)"}]}}
---

# Summarize

Fast CLI to summarize URLs, local files, and YouTube links.

## Quick start

\`\`\`bash
summarize "https://example.com" --model google/gemini-3-flash-preview
summarize "/path/to/file.pdf" --model google/gemini-3-flash-preview
summarize "https://youtu.be/dQw4w9WgXcQ" --youtube auto
\`\`\`

## Model + keys

Set the API key for your chosen provider:
- OpenAI: \`OPENAI_API_KEY\`
- Anthropic: \`ANTHROPIC_API_KEY\`
- xAI: \`XAI_API_KEY\`
- Google: \`GEMINI_API_KEY\`

Default model is \`google/gemini-3-flash-preview\` if none is set.

## Useful flags

- \`--length short|medium|long|xl|xxl\`
- \`--max-output-tokens <n>\`
- \`--extract-only\` (URLs only)
- \`--json\` (machine readable)
- \`--firecrawl auto|off|always\` (fallback extraction)
- \`--youtube auto\` (Apify fallback if \`APIFY_API_TOKEN\` set)

## Config

Optional config file: \`~/.summarize/config.json\`

\`\`\`json
{ "model": "openai/gpt-5.2" }
\`\`\`

Optional services:
- \`FIRECRAWL_API_KEY\` for blocked sites
- \`APIFY_API_TOKEN\` for YouTube fallback
`,
    metadata: {
      homepage: 'https://summarize.sh',
      emoji: '🧾',
      requires: { bins: ['summarize'] },
    },
  },
  {
    id: 'gemini',
    name: 'gemini',
    description: 'Gemini CLI for one-shot Q&A, summaries, and generation',
    author: 'steipete',
    category: 'coding',
    tags: ['gemini', 'google', 'ai', 'llm', 'generation'],
    skillMd: `---
name: gemini
description: Gemini CLI for one-shot Q&A, summaries, and generation.
homepage: https://ai.google.dev/
metadata: {"clawdbot":{"emoji":"♊️","requires":{"bins":["gemini"]},"install":[{"id":"brew","kind":"brew","formula":"gemini-cli","bins":["gemini"],"label":"Install Gemini CLI (brew)"}]}}
---

# Gemini CLI

Use Gemini in one-shot mode with a positional prompt (avoid interactive mode).

Quick start
- \`gemini "Answer this question..."\`
- \`gemini --model <name> "Prompt..."\`
- \`gemini --output-format json "Return JSON"\`

Extensions
- List: \`gemini --list-extensions\`
- Manage: \`gemini extensions <command>\`

Notes
- If auth is required, run \`gemini\` once interactively and follow the login flow.
- Avoid \`--yolo\` for safety.
`,
    metadata: {
      homepage: 'https://ai.google.dev/',
      emoji: '♊️',
      requires: { bins: ['gemini'] },
    },
  },

  // ─── Productivity Skills ──────────────────────────
  {
    id: 'memory-feedback',
    name: 'memory-feedback',
    description: 'Self-improving agent memory: logs episodes, detects patterns, proposes skill improvements as PRs',
    author: 'steipete',
    category: 'productivity',
    tags: ['memory', 'learning', 'self-improvement', 'feedback', 'patterns'],
    skillMd: `---
name: memory-feedback
description: "Learning loop for agent skills: log episodes, detect patterns, propose improvements. Use when debugging repeated failures, reviewing skill effectiveness, or building self-improving agent workflows."
metadata: {"clawdbot":{"emoji":"🧠","requires":{"bins":["jq","curl"]}}}
---

# Memory Feedback Loop

A learning system that helps the agent improve over time by logging what works and what doesn't.

## How It Works

1. **Log episodes** — after each skill use, record success/failure with context
2. **Detect patterns** — when enough data accumulates, identify recurring issues
3. **Propose fixes** — generate concrete skill improvements (optionally as PRs)

## Episode Logging

\`\`\`bash
# Log a successful episode
echo '{"skill":"github","outcome":"success","context":"merged PR #42","ts":"'$(date -u +%FT%TZ)'"}' >> ~/.openclaw/memory/episodes.jsonl

# Log a failure
echo '{"skill":"summarize","outcome":"failure","error":"timeout on large PDF","ts":"'$(date -u +%FT%TZ)'"}' >> ~/.openclaw/memory/episodes.jsonl
\`\`\`

## Pattern Detection

\`\`\`bash
# Count failures by skill
cat ~/.openclaw/memory/episodes.jsonl | jq -r 'select(.outcome=="failure") | .skill' | sort | uniq -c | sort -rn
\`\`\`

## Propose Improvements

When a pattern is detected with sufficient confidence (3+ similar failures):
1. Analyze the failure context
2. Draft a concrete fix to the skill's SKILL.md
3. Optionally create a PR via \`gh\` CLI for human review

## Notes

- Core memory logging works without GitHub integration
- Only pattern-detected improvements (not single failures) trigger proposals
- Human-in-the-loop: proposals require review before applying
`,
    metadata: {
      emoji: '🧠',
      requires: { bins: ['jq', 'curl'] },
    },
  },
  {
    id: 'skill-writer',
    name: 'skill-writer',
    description: 'Write high-quality SKILL.md files for ClawHub. Use when creating skills, structuring content, or writing frontmatter',
    author: 'gitgoodordietrying',
    category: 'productivity',
    tags: ['skill', 'writing', 'clawhub', 'documentation', 'publishing'],
    skillMd: `---
name: skill-writer
description: Write high-quality agent skills (SKILL.md files) for ClawHub. Use when creating a new skill from scratch, structuring skill content, writing effective frontmatter and descriptions, choosing section patterns, or following best practices for agent-consumable technical documentation.
metadata: {"clawdbot":{"emoji":"✍️","requires":{"anyBins":["npx"]},"os":["linux","darwin","win32"]}}
---

# Skill Writer

Write well-structured, effective SKILL.md files for the ClawHub registry. Covers the skill format specification, frontmatter schema, content patterns, example quality, and common anti-patterns.

## When to Use

- Creating a new skill from scratch
- Structuring technical content as an agent skill
- Writing frontmatter that the registry indexes correctly
- Choosing section organization for different skill types
- Reviewing your own skill before publishing

## The SKILL.md Format

A skill is a single Markdown file with YAML frontmatter. The agent loads it on demand and follows its instructions.

## Frontmatter Schema

### \`name\` (required)
Lowercase, hyphenated slug: \`csv-pipeline\`, \`git-workflows\`

### \`description\` (required)
Pattern: \`[What it does]. Use when [trigger 1], [trigger 2], [trigger 3].\`

### \`metadata\` (required)
JSON object with \`clawdbot\` schema: emoji, requires.anyBins, os

## Content Structure

1. **When to Use** — 4-8 bullet points of concrete scenarios
2. **Main Content** — organized by task, not by concept
3. **Code Blocks** — every section needs at least one runnable example
4. **Tips** — 5-10 standalone, non-obvious insights

## Size Guidelines

| Metric | Target | Too Short | Too Long |
|--------|--------|-----------|----------|
| Lines  | 300-550 | < 150    | > 700    |
| Sections | 5-10 | < 3      | > 15     |
| Code blocks | 15-40 | < 8  | > 60     |

## Tips

- The \`description\` field is your skill's search ranking — spend more time on it than any single content section
- Lead with the most common use case
- Every code example should be copy-pasteable
- Write for the agent, not the human — use unambiguous instructions
- Test by asking an agent to use the skill on a real task
`,
    metadata: {
      emoji: '✍️',
      requires: { bins: ['npx'] },
    },
  },
  {
    id: 'ontology',
    name: 'ontology',
    description: 'Typed knowledge graph for structured agent memory and composable skills. Use for entity CRUD, linking, and cross-skill state sharing',
    author: 'oswalpalash',
    category: 'data',
    tags: ['knowledge-graph', 'memory', 'entities', 'relations', 'structured-data'],
    skillMd: `---
name: ontology
description: "Typed knowledge graph for structured agent memory and composable skills. Use when creating/querying entities (Person, Project, Task, Event, Document), linking related objects, enforcing constraints, planning multi-step actions as graph transformations, or when skills need to share state."
---

# Ontology

A typed vocabulary + constraint system for representing knowledge as a verifiable graph.

## When to Use

- "Remember that..." — store structured facts
- "What do I know about X?" — query the knowledge graph
- "Link X to Y" — create relationships between entities
- "Show dependencies" — traverse graph relations
- Entity CRUD operations
- Cross-skill data access and state sharing

## Storage

Default location: \`memory/ontology/graph.jsonl\` (append-only JSONL format)

## Entity Types

Person, Organization, Project, Task, Goal, Event, Location, Document, Message, Note, Account, Device, Credential, Action, Policy

## Operations

\`\`\`bash
# Create an entity
echo '{"op":"create","type":"Project","id":"proj-1","props":{"name":"OpenClaw Manager","status":"active"}}' >> memory/ontology/graph.jsonl

# Link entities
echo '{"op":"link","from":"person-1","to":"proj-1","rel":"owns"}' >> memory/ontology/graph.jsonl

# Query (use jq)
cat memory/ontology/graph.jsonl | jq 'select(.type=="Project")'
\`\`\`

## Tips

- Use append-only JSONL for safe concurrent writes
- Validate entity types against the schema before creating
- Prefer explicit relation types over free-text links
`,
    metadata: {
      emoji: '🔗',
    },
  },

  // ─── DevOps Skills ────────────────────────────────
  {
    id: 'peekaboo',
    name: 'peekaboo',
    description: 'Capture and automate macOS UI with the Peekaboo CLI — screenshots, element targeting, input control',
    author: 'steipete',
    category: 'browser',
    tags: ['macos', 'ui-automation', 'screenshot', 'testing', 'accessibility'],
    skillMd: `---
name: peekaboo
description: Capture and automate macOS UI with the Peekaboo CLI.
homepage: https://peekaboo.boo
metadata: {"clawdbot":{"emoji":"👀","os":["darwin"],"requires":{"bins":["peekaboo"]},"install":[{"id":"brew","kind":"brew","formula":"steipete/tap/peekaboo","bins":["peekaboo"],"label":"Install Peekaboo (brew)"}]}}
---

# Peekaboo

Full macOS UI automation CLI: capture/inspect screens, target UI elements, drive input, and manage apps/windows/menus.

## Quickstart
\`\`\`bash
peekaboo permissions
peekaboo list apps --json
peekaboo see --annotate --path /tmp/peekaboo-see.png
peekaboo click --on B1
peekaboo type "Hello" --return
\`\`\`

## Core Commands
- \`image\`: capture screenshots (screen/window/menu bar)
- \`see\`: annotated UI maps with snapshot IDs
- \`list\`: apps, windows, screens, menubar, permissions
- \`capture\`: live capture or video ingest

## Interaction
- \`click\`: target by ID/query/coords with smart waits
- \`type\`: text + control keys (\`--clear\`, delays)
- \`hotkey\`: modifier combos like \`cmd,shift,t\`
- \`drag\`: drag & drop across elements/coords
- \`scroll\`: directional scrolling (targeted + smooth)

## See -> Click -> Type (most reliable flow)
\`\`\`bash
peekaboo see --app Safari --annotate --path /tmp/see.png
peekaboo click --on B3 --app Safari
peekaboo type "user@example.com" --app Safari
peekaboo press tab --count 1 --app Safari
peekaboo type "password" --app Safari --return
\`\`\`

## Notes
- Requires Screen Recording + Accessibility permissions
- Use \`peekaboo see --annotate\` to identify targets before clicking
- Prefer element IDs over raw coordinates for resilience
`,
    metadata: {
      homepage: 'https://peekaboo.boo',
      emoji: '👀',
      requires: { bins: ['peekaboo'] },
    },
  },
  {
    id: 'pr-reviewer',
    name: 'pr-reviewer',
    description: 'Automated PR code review with diff analysis, security checks, lint integration, and severity verdicts',
    author: 'briancolinger',
    category: 'coding',
    tags: ['code-review', 'pr', 'security', 'lint', 'quality'],
    skillMd: `---
name: pr-reviewer
description: "Automated code review for GitHub PRs with diff analysis, security scanning, and lint integration. Use when reviewing pull requests, checking for security issues, or generating review reports."
metadata: {"clawdbot":{"emoji":"🔍","requires":{"bins":["gh","git"]}}}
---

# PR Reviewer

Automated code review for GitHub pull requests with structured analysis.

## What It Checks

1. **Security** — hardcoded credentials, AWS keys, SQL injection, XSS
2. **Error Handling** — missing catch blocks, unvalidated input, silent failures
3. **Style** — naming conventions, unused imports, dead code
4. **Test Coverage** — new code paths without corresponding tests
5. **Performance** — N+1 queries, unnecessary re-renders, memory leaks

## Usage

\`\`\`bash
# Review a specific PR
gh pr diff 42 --repo owner/repo | pr-reviewer analyze

# Review with lint integration
pr-reviewer review --repo owner/repo --pr 42 --lint
\`\`\`

## Output Format

Reports are generated as markdown with severity verdicts:
- **🔴 Security** — must fix before merge
- **🟡 Attention** — should address, not blocking
- **🟢 Minor** — style/preference, optional
- **✅ Good** — no issues found

## Tracking

Reviewed PRs are tracked by HEAD SHA to avoid redundant re-reviews.

## Supported Languages

Go, Python, JavaScript, TypeScript

## Tips

- Run on every PR to catch issues early
- Combine with CI for automated review comments
- Focus on security findings first — they're the highest impact
`,
    metadata: {
      emoji: '🔍',
      requires: { bins: ['gh', 'git'] },
    },
  },

  // ─── Search & Data Skills ─────────────────────────
  {
    id: 'skill-search-optimizer',
    name: 'skill-search-optimizer',
    description: 'Optimize skills for ClawHub discoverability. Improve descriptions, frontmatter, and semantic search ranking',
    author: 'gitgoodordietrying',
    category: 'productivity',
    tags: ['clawhub', 'seo', 'search', 'optimization', 'publishing'],
    skillMd: `---
name: skill-search-optimizer
description: "Optimize OpenClaw skills for ClawHub discoverability. Use when improving skill descriptions, writing better frontmatter, or understanding how semantic search ranking works on ClawHub."
metadata: {"clawdbot":{"emoji":"🔎","os":["linux","darwin","win32"]}}
---

# Skill Search Optimizer

ClawHub uses vector-based semantic search via OpenAI embeddings, not keyword matching. The \`description\` field is the primary indexed content.

## Description Formula

\`\`\`
[What it does]. Use when [trigger 1], [trigger 2], [trigger 3]. Also covers [related topic].
\`\`\`

## Good vs Bad Descriptions

\`\`\`yaml
# GOOD: Specific triggers and scope
description: "Schedule and manage recurring tasks with cron and systemd timers. Use when setting up cron jobs, writing systemd timer units, or automating periodic scripts."

# BAD: Vague, no triggers
description: "A skill about task scheduling."
\`\`\`

## Key Rules

- Start with what the skill does (action verb)
- Include 3-5 "Use when" trigger phrases
- Mention specific tools, commands, or technologies
- Keep under 200 characters for search result display
- Don't start with "This skill..." or "A skill for..."

## Tips

- The description field is the single most important field for discoverability
- Think about what users would search for, not what the skill contains
- Test by searching for your skill on ClawHub after publishing
`,
    metadata: {
      emoji: '🔎',
    },
  },

  // ─── Communication & Integration ──────────────────
  {
    id: 'cognitive-memory',
    name: 'cognitive-memory',
    description: 'FSRS-6 spaced repetition memory — scientifically optimized fact retention and learning across sessions',
    author: 'community',
    category: 'productivity',
    tags: ['memory', 'spaced-repetition', 'learning', 'fsrs', 'retention'],
    skillMd: `---
name: cognitive-memory
description: "FSRS-6 spaced repetition for agent memory. Use when memorizing facts, reinforcing important information, managing stale context, or building long-term knowledge retention across sessions."
metadata: {"clawdbot":{"emoji":"🧠"}}
---

# Cognitive Memory (FSRS-6)

Replaces flat memory with scientifically validated spaced repetition. Important facts get reinforced at optimal intervals; stale information fades gracefully.

## How It Works

- **Learning mode** — explicitly memorize vocabulary, API endpoints, names, etc.
- **Reinforcement** — important facts reviewed at increasing intervals (1d → 3d → 7d → 21d)
- **Graceful decay** — old, unreferenced information fades without cluttering active memory

## Usage

\`\`\`bash
# Store a fact for spaced repetition
cognitive-memory add "Client budget is $50,000" --importance high

# Review due facts
cognitive-memory review

# Query retained knowledge
cognitive-memory search "client budget"

# Check retention stats
cognitive-memory stats
\`\`\`

## Integration

The skill hooks into OpenClaw's memory system:
1. New facts are scored and scheduled for review
2. Review prompts appear at calculated intervals
3. Successful recall extends the interval; failure shortens it

## Tips

- High-importance facts get more aggressive review schedules
- The system is most effective after 1-2 weeks of use
- Works best for factual knowledge (names, numbers, preferences)
- Built on the open-source FSRS algorithm (Free Spaced Repetition Scheduler v6)
`,
    metadata: {
      emoji: '🧠',
    },
  },
  {
    id: 'prompt-optimizer',
    name: 'prompt-optimizer',
    description: 'Auto-optimize prompts with 58 proven techniques — chain-of-thought, few-shot, structured output, and more',
    author: 'community',
    category: 'coding',
    tags: ['prompt', 'optimization', 'chain-of-thought', 'few-shot', 'quality'],
    skillMd: `---
name: prompt-optimizer
description: "Automatically optimize prompts before they reach the model. Use when improving response quality, reducing retries, lowering API costs, or applying structured prompting techniques."
metadata: {"clawdbot":{"emoji":"⚡"}}
---

# Prompt Optimizer

Bundles 58 proven prompting techniques and automatically rewrites casual instructions into optimized prompts before they hit the model API.

## Techniques Included

- **Chain-of-thought** — step-by-step reasoning
- **Few-shot examples** — provide input/output pairs
- **Role assignment** — set expert persona
- **Structured output** — enforce JSON/XML/table formats
- **Self-consistency** — multiple reasoning paths
- **Tree-of-thought** — branching exploration
- **Reflection** — self-critique and refinement

## Usage

The optimizer runs transparently:
1. Intercepts the user's casual instruction
2. Selects appropriate techniques based on task type
3. Rewrites into an optimized prompt
4. Sends to the model

## When It Helps Most

- Cheaper models (Gemini Flash, Claude Haiku) where prompt quality has disproportionate impact
- Complex reasoning tasks
- Tasks requiring structured output
- Reducing "hallucination" in factual queries

## Tips

- The optimizer adds ~100-200 tokens overhead per prompt
- Disable for simple, direct queries where optimization adds latency without benefit
- Most effective for multi-step or analytical tasks
- Pairs well with cognitive-memory for context-enriched prompts
`,
    metadata: {
      emoji: '⚡',
    },
  },
];

export function getSkillRegistry(): SkillDefinition[] {
  return SKILL_REGISTRY;
}

export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILL_REGISTRY.find(s => s.id === id);
}

export function getSkillsByCategory(category: string): SkillDefinition[] {
  return SKILL_REGISTRY.filter(s => s.category === category);
}

export function searchSkills(query: string): SkillDefinition[] {
  const q = query.toLowerCase();
  return SKILL_REGISTRY.filter(s =>
    s.name.toLowerCase().includes(q)
    || s.description.toLowerCase().includes(q)
    || s.tags.some(t => t.toLowerCase().includes(q))
  );
}
