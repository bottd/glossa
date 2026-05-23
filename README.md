# Glossa

A community lexicon bot for Discord. Glossa is part dictionary, part shared
knowledge graph: look up a word and you'll see **the standard dictionary
definition next to your server's own**, plus any messages saved against it.

Built with [discord.js](https://discord.js.org) v14 + TypeScript, backed by
SQLite (`better-sqlite3`).

## What it does

- **`/glossa def <term>`** — a card combining:
  - 📖 **Dictionary** — the standard definition (via [dictionaryapi.dev](https://dictionaryapi.dev))
  - 💬 **Notes** — community notes your members have added
  - 🔖 **References** — messages saved under this term, linking back to the originals
  - any images filed against the term
  - Autocompletes against known terms.
- **`/glossa find <query>`** — a **Claude-powered reverse dictionary**. Describe a meaning, concept, or feeling and get the word(s) that fit. Look any up with `/glossa def`.
- **`/glossa ref <term>`** — list the messages saved under a term. Autocompletes against known terms.
- **`/glossa help`** — an in-Discord overview, replied to you privately.
- **DM the bot** `term :: note` to add a community note.
- **Reply to a message and @-mention the bot** with a term (e.g. `@Glossa <term>`) to file that message as a reference. The whole phrase after the mention is one term.

References store a **link to the original message**, not a copy of its text; the bot renders a jump link, attributed to the author. Image attachments are recorded by their **Discord attachment URL** (not re-hosted) and shown in the lookup card.

> **Known compromise:** Discord's attachment URLs are signed and expire (~24h), so saved images stop rendering after a while. Accepted for now; re-hosting locally to make them durable was intentionally dropped in favour of a simpler implementation.

## Stack

- **discord.js v14** — slash commands with subcommands, autocomplete, message events
- **@anthropic-ai/sdk** — Claude (Haiku) powering `/glossa find`, the reverse dictionary (`ANTHROPIC_API_KEY` required at startup)
- **better-sqlite3** — local persistent storage (`data/glossa.db`)
- **TypeScript** (ESM, strict, `bundler` module resolution — extensionless imports)
- **tsx** — runs the TypeScript directly (dev, deploy, and production `start`); no build step
- **Nix flake + direnv** — reproducible toolchain (Node 22, pnpm, treefmt)
- **pnpm** — package manager
- **treefmt + Prettier + ESLint** — formatting and linting

## Project layout

```
src/
  index.ts              # bootstrap: client, intents, event wiring, shutdown
  config.ts             # env config
  deploy-commands.ts    # registers /glossa with Discord
  logger.ts
  commands/             # /glossa + subcommands (def, find, ref, help); Command/Subcommand types
  events/               # ready, interactionCreate (router), messageCreate (DM add + reply-mention refs); Event type
  services/             # dictionary API, Claude reverse-dictionary search
  store/                # SqliteStore + its data-shape types
  lib/                  # term normalization, the /glossa def lookup card, shared COLOR
data/                   # SQLite db (gitignored)
```

## Setup

The repo ships a Nix flake + direnv for a reproducible toolchain. With
[direnv](https://direnv.net) installed, `direnv allow` drops you into a shell
with Node, pnpm, and treefmt; otherwise run `nix develop` manually. (No Nix?
Any Node 18+ with pnpm works too.)

1. Create an application at the
   [Discord Developer Portal](https://discord.com/developers/applications), add a **Bot**, and copy its token.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `CLIENT_ID`, and
   optionally `GUILD_ID` (a server ID for instant command updates in dev).
4. Invite the bot with the `bot` and `applications.commands` scopes (OAuth2 > URL Generator).
5. Register commands, then run:
   ```bash
   pnpm deploy
   pnpm dev
   ```

> **Intents:** Glossa requests `Guilds`, `GuildMessages`, and `DirectMessages` —
> **no privileged intents**. Discord delivers message content in DMs and for
> messages that **@mention the bot**, so DM-based adding and the reply-and-mention
> reference flow both work without the privileged MessageContent intent.

## Scripts

| Script        | Description                                   |
| ------------- | --------------------------------------------- |
| `pnpm dev`    | Run in watch mode with tsx                    |
| `pnpm start`  | Run the bot with tsx                          |
| `pnpm deploy` | Register slash commands with Discord          |
| `pnpm check`  | Type-check without emitting                   |
| `pnpm lint`   | Lint with ESLint (autofixes)                  |
| `pnpm format` | Format the tree with treefmt (Prettier + nix) |

## Roadmap ideas

- Clickable suggestions in `/glossa find` (button-row that runs `/glossa def` on tap)
- Upvoting community notes
- Editing or removing your own definitions and references
