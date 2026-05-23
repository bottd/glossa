import type { Subcommand } from './index';
import type { Reference } from '../store/sqliteStore';
import { store } from '../store/index';
import { normalizeTerm, truncate } from '../lib/term';
import { formatReferenceLine } from '../lib/reference';

const MAX_REFERENCES = 12;
const MESSAGE_MAX = 2000;

/**
 * `/glossa ref <term>` — list the messages saved as references under a term.
 * Adding a reference happens by replying to a message and @-mentioning the bot
 * (see `events/messageCreate.ts`); this is the read side of the same data.
 */
export const refSub = {
  name: 'ref',

  build: (sub) =>
    sub
      .setDescription('Show the messages saved as references under a term.')
      .addStringOption((opt) =>
        opt
          .setName('term')
          .setDescription('The term to show references for')
          .setRequired(true)
          .setAutocomplete(true),
      ),

  async execute(interaction) {
    const input = interaction.options.getString('term', true);
    const term = normalizeTerm(input);

    await interaction.deferReply();

    const references = await store.getReferencesByTag(term);
    await interaction.editReply(renderRefs(input.trim(), references));
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const matches = await store.searchTerms(focused);
    await interaction.respond(matches.slice(0, 25).map((term) => ({ name: term, value: term })));
  },
} satisfies Subcommand;

/** Render the references list as a plain message: header + bullet list + truncation note. */
function renderRefs(display: string, references: Reference[]): string {
  const header = `## 🔖 References · ${display}`;

  if (!references.length) {
    return `${header}\nNothing saved yet. Reply to a message and @-mention me with a term to file one.`;
  }

  const shown = references.slice(0, MAX_REFERENCES);
  const lines = shown.map(formatReferenceLine).join('\n');
  const extra =
    references.length > MAX_REFERENCES ? `\n…and ${references.length - MAX_REFERENCES} more.` : '';

  // 2000 chars per message; leave room for header + suffix.
  const room = MESSAGE_MAX - header.length - extra.length - 2;
  return `${header}\n${truncate(lines, room)}${extra}`;
}
