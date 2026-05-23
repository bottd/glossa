import { z } from 'zod';
import { consola as logger } from 'consola';

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: { definition: string; example?: string }[];
}

const DictionaryApiResponseSchema = z.array(
  z.object({
    meanings: z
      .array(
        z.object({
          partOfSpeech: z.string().optional(),
          definitions: z
            .array(
              z.object({
                definition: z.string().optional(),
                example: z.string().optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
  }),
);

const API = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const MAX_DEFS_PER_MEANING = 3;

export async function getDictionary(term: string): Promise<DictionaryMeaning[] | null> {
  try {
    const res = await fetch(`${API}/${encodeURIComponent(term)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`dictionary API ${res.status}`);

    const parsed = DictionaryApiResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      logger.warn(`Unexpected dictionary API shape for "${term}":`, parsed.error);
      return null;
    }
    return parseMeanings(parsed.data);
  } catch (error) {
    logger.warn(`Dictionary lookup failed for "${term}":`, error);
    return null;
  }
}

function parseMeanings(data: z.infer<typeof DictionaryApiResponseSchema>): DictionaryMeaning[] {
  return data
    .flatMap((entry) => entry.meanings ?? [])
    .map((meaning) => ({
      partOfSpeech: meaning.partOfSpeech ?? 'other',
      definitions: (meaning.definitions ?? [])
        .filter((d): d is { definition: string; example?: string } => Boolean(d.definition))
        .slice(0, MAX_DEFS_PER_MEANING)
        .map((d) => ({ definition: d.definition, example: d.example })),
    }))
    .filter((meaning) => meaning.definitions.length > 0);
}
