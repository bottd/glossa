import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../config';
import { consola as logger } from 'consola';

const ResponseSchema = z.object({
  words: z.array(z.string()),
});

// Cheap/fast model for this high-frequency lookup. Note: Haiku does not support
// the `effort` parameter (it 400s), so we don't set output_config.effort below.
const MODEL = 'claude-haiku-4-5';
const MAX_WORDS = 8;

const SYSTEM = `You are a reverse dictionary for a community lexicon Discord bot. The user describes a meaning, concept, or feeling; you return the word(s) or established phrase(s) that name it.

Return only real, lexicalized terms — things a reader could look up:
- single words, including rare, archaic, dialectal, slang, loanword, and technical terms;
- multi-word entries ONLY when the phrase is itself the established name for the concept: idioms, set phrases, proverbs, compounds, and named phenomena (e.g. "schadenfreude", "petrichor", "saudade", "the Streisand effect").

Do NOT invent terms or paraphrase the meaning. If an entry reads like a definition or a freeform description rather than a term someone could find in a dictionary or reference work, leave it out. Self-test each candidate: would it plausibly appear as a headword in a dictionary or a named entry in a reference? If not, omit it.

Order by how precisely each term matches the described meaning. Prefer precision over quantity: return only genuinely fitting terms, up to ${MAX_WORDS}. If nothing words fit, return an empty list instead of forcing a loose or invented match.

Return just the terms themselves — no definitions, no commentary.`;

// JSON Schema sent to the API for structured output; mirrors ResponseSchema above.
const SCHEMA = {
  type: 'object',
  properties: {
    words: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['words'],
  additionalProperties: false,
} as const;

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export async function findWordsForMeaning(query: string): Promise<string[] | null> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: {
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [{ role: 'user', content: query.trim() }],
    });

    const block = response.content.find((b) => b.type === 'text');
    if (block?.type !== 'text') return [];

    const parsed = ResponseSchema.safeParse(JSON.parse(block.text));
    if (!parsed.success) {
      logger.warn(`Claude returned an unexpected shape for "${query.trim()}":`, parsed.error);
      return [];
    }
    return parsed.data.words.slice(0, MAX_WORDS);
  } catch (error) {
    logger.warn(`Claude reverse-dictionary lookup failed for "${query.trim()}":`, error);
    return null;
  }
}
