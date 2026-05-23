import { MessageFlags } from 'discord.js';
import type { Subcommand } from './index';

/** Lists everything Glossa can do. Keep this in sync with the README's "What it does". */
export const helpSub = {
  name: 'help',

  build: (sub) => sub.setDescription('What Glossa can do and how to use it.'),

  async execute(interaction) {
    await interaction.reply({ content: HELP, flags: MessageFlags.Ephemeral });
  },
} satisfies Subcommand;

const HELP = [
  '## Glossa — your community lexicon',
  "Part dictionary, part shared knowledge graph. Look up a word and you'll see the standard definition next to your server's own notes, plus any messages saved against it.",
  '',
  '- **📖 `/glossa def <term>`** — A card with the **dictionary** and **community notes** side by side, plus any **references** and images filed against the term. Autocompletes against known terms.',
  '- **🔎 `/glossa find <query>`** — Know what you mean but not the word for it? Describe the idea and get the words that fit. Look any up with `/glossa def`.',
  '- **🔖 `/glossa ref <term>`** — Show every message saved under a term.',
  '- **🔖 Save a reference** — Reply to a message and @-mention me with a term (e.g. `@Glossa lore`) and that message gets filed under it.',
  '- **💬 Add a community note** — DM me `term :: note` to add one.',
].join('\n');
