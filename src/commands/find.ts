import type { Subcommand } from './index';
import { findWordsForMeaning } from '../services/llmSearch';
import { truncate } from '../lib/term';

/**
 * `/glossa find <query>` — describe a meaning and get the words that capture it.
 * A Claude-powered conceptual reverse dictionary. The query can be a full phrase.
 */
export const findSub = {
  name: 'find',

  build: (sub) =>
    sub
      .setDescription('Describe a meaning and find the word(s) for it.')
      .addStringOption((opt) =>
        opt
          .setName('query')
          .setDescription("The meaning, concept, or feeling you're trying to name")
          .setRequired(true),
      ),

  async execute(interaction) {
    const query = interaction.options.getString('query', true).trim();

    await interaction.deferReply();

    // Null (lookup failed) and an empty list (no word fits) are both "no word
    // found" as far as the user is concerned — same message for both.
    const words = await findWordsForMeaning(query);
    if (!words?.length) {
      await interaction.editReply('🔮 Scrying the LLM Orb has failed. Try again in a moment.');
      return;
    }

    await interaction.editReply(renderFind(query, words));
  },
} satisfies Subcommand;

/** Render the find result as a plain message: header + dot-joined word list + subtext footer. */
function renderFind(query: string, words: string[]): string {
  const header = `🔎 **${query}**`;
  const footer = '-# Look any up with `/glossa def`';
  // 2000 chars per message; leave room for header + footer + the two newlines.
  const room = 2000 - header.length - footer.length - 4;
  const list = truncate(words.map((w) => `\`${w}\``).join(' · '), room);
  return `${header}\n${list}\n${footer}`;
}
