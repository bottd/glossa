import { EmbedBuilder } from 'discord.js';
import type { Definition, ImageRef, Reference } from '../store/sqliteStore';
import type { DictionaryMeaning } from '../services/dictionary';
import { truncate } from './term';
import { formatReferenceLine } from './reference';
import { COLOR } from './colors';

const FIELD_MAX = 1024;
const EMBED_MAX = 6000; // Discord's total cap across title + all field text.
const MAX_REFERENCES = 8;
const MAX_IMAGES = 4;

/**
 * Build the `/glossa def` lookup card: a main embed with dictionary / community /
 * references / related fields, plus image-only sidecar embeds for extras.
 */
export function buildLookupCard({
  display,
  dictionary,
  definitions,
  references,
  images,
}: {
  display: string;
  dictionary: DictionaryMeaning[] | null;
  definitions: Definition[];
  references: Reference[];
  images: ImageRef[];
}): EmbedBuilder[] {
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(truncate(display, 256));

  const hasContent = dictionary?.length || definitions.length || references.length || images.length;

  // Add a field, capping its value at the per-field limit and at whatever room
  // is left in the embed's total budget (title + all field text). Once the
  // budget runs out, later fields are dropped rather than risking a 400.
  let budget = EMBED_MAX - display.length;
  const addField = (name: string, value: string): void => {
    const room = Math.min(FIELD_MAX, budget - name.length);
    if (room <= 0) return;
    const capped = truncate(value, room);
    embed.addFields({ name, value: capped });
    budget -= name.length + capped.length;
  };

  if (dictionary?.length) addField('📖 Dictionary', formatDictionary(dictionary));
  if (definitions.length) addField('💬 Notes', formatDefinitions(definitions));
  if (references.length) addField('🔖 References', formatReferences(references));

  if (!hasContent) {
    embed.setDescription(
      `Nothing for **${display}** yet. DM me \`term :: note\` to add one, or reply to a message and @-mention me with a term to file it.`,
    );
  }

  // Images are referenced by their Discord CDN URL (not re-hosted). The first
  // rides on the main embed; extras become image-only embeds, which Discord
  // stacks below it.
  const shown = images.slice(0, MAX_IMAGES);
  if (shown.length) embed.setImage(shown[0].url);

  return [
    embed,
    ...shown.slice(1).map((img) => new EmbedBuilder().setColor(COLOR).setImage(img.url)),
  ];
}

function formatDictionary(meanings: DictionaryMeaning[]): string {
  return meanings
    .map((m) => {
      const defs = m.definitions
        .map((d, i) => `${i + 1}. ${d.definition}${d.example ? `\n   *“${d.example}”*` : ''}`)
        .join('\n');
      return `__${m.partOfSpeech}__\n${defs}`;
    })
    .join('\n\n');
}

function formatDefinitions(definitions: Definition[]): string {
  return definitions.map((d, i) => `**${i + 1}.** ${d.definition}\n— ${d.authorTag}`).join('\n\n');
}

function formatReferences(references: Reference[]): string {
  return references.slice(0, MAX_REFERENCES).map(formatReferenceLine).join('\n');
}
