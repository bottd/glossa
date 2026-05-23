import type { Message } from 'discord.js';
import type { Reference, TagRef } from '../store/sqliteStore';
import { store } from '../store/index';

export interface SaveReferenceInput {
  message: Message;
  tags: TagRef[];
  addedBy: string;
}

/**
 * File a Discord message as a reference under one or more tags. We store a
 * pointer (jump link + author), not the text. Image attachments are recorded
 * once against the reference; `getImagesForTerm` surfaces them under any of
 * its tags via the bookmark_tags join.
 */
export async function saveMessageAsReference(
  input: SaveReferenceInput,
): Promise<{ imageCount: number }> {
  const { message, tags, addedBy } = input;

  const reference = await store.addReference({
    messageLink: message.url,
    sourceAuthorTag: message.author.username,
    addedBy,
    tags,
  });

  const images = message.attachments.filter((a) => a.contentType?.startsWith('image/'));
  await Promise.all(
    images.map((a) =>
      store.addImage({ term: null, referenceId: reference.id, url: a.url, addedBy }),
    ),
  );

  return { imageCount: images.size };
}

/** Render a saved reference as a single bullet line: a jump link, attributed. */
export function formatReferenceLine(reference: Reference): string {
  const who = reference.sourceAuthorTag;
  const label = who ? `message from ${who}` : 'saved message';
  return reference.messageLink ? `• [${label}](${reference.messageLink})` : `• ${label}`;
}
