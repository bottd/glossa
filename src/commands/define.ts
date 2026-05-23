import type { Subcommand } from './index';
import { store } from '../store/index';
import { getDictionary } from '../services/dictionary';
import { buildLookupCard } from '../lib/lookupCard';
import { normalizeTerm } from '../lib/term';

export const defineSub = {
  name: 'def',

  build: (sub) =>
    sub
      .setDescription('Look up a term: dictionary, community notes, references.')
      .addStringOption((opt) =>
        opt
          .setName('term')
          .setDescription('The term to look up')
          .setRequired(true)
          .setAutocomplete(true),
      ),

  async execute(interaction) {
    const input = interaction.options.getString('term', true);
    const term = normalizeTerm(input);

    await interaction.deferReply();

    const [notes, references, images, dictionary] = await Promise.all([
      store.getCommunityNotes(term),
      store.getReferencesByTag(term),
      store.getImagesForTerm(term),
      getDictionary(term),
    ]);

    const display = notes[0]?.display ?? input.trim();
    const embeds = buildLookupCard({ display, dictionary, notes, references, images });
    await interaction.editReply({ embeds });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const matches = await store.searchTerms(focused);
    await interaction.respond(matches.slice(0, 25).map((term) => ({ name: term, value: term })));
  },
} satisfies Subcommand;
