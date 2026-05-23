import { Events, type Message } from 'discord.js';
import type { Event } from './index';
import { store } from '../store/index';
import { normalizeTerm, parseTag } from '../lib/term';
import { saveMessageAsReference } from '../lib/reference';
import { consola as logger } from 'consola';

const SEPARATOR = '::';
const DM_USAGE = `DM me \`term ${SEPARATOR} note\` to add a community note.`;
const MENTION_USAGE =
  'Reply to a message and @-mention me with a term to file it as a reference. ' +
  'Like **@Glossa <term>**. Browse later with `/glossa ref <term>`.';

/**
 * Two text entry points:
 *  - DM `term :: note` to add a community note (DMs deliver content without
 *    the privileged MessageContent intent).
 *  - In a server, reply to a message and @mention the bot with a word/tags to
 *    file that message as a reference. Discord delivers content for messages
 *    that mention the bot, so this also needs no privileged intent — only the
 *    (non-privileged) GuildMessages intent to receive the events.
 */
export const messageCreate = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    if (message.partial) {
      try {
        await message.fetch();
      } catch {
        return;
      }
    }

    if (message.guild) {
      await handleMentionReference(message);
    } else {
      await handleDmCommunityNote(message);
    }
  },
} satisfies Event<typeof Events.MessageCreate>;

/** Server: reply + @mention the bot with tags → save the replied message as a reference. */
async function handleMentionReference(message: Message): Promise<void> {
  const me = message.client.user;
  // Require an explicitly typed @mention of the bot. `ignoreRepliedUser` is
  // essential: a reply auto-pings the replied author, so without it a plain
  // reply to one of the bot's own messages would falsely count as a mention.
  if (
    !me ||
    !message.mentions.has(me, {
      ignoreEveryone: true,
      ignoreRoles: true,
      ignoreRepliedUser: true,
    })
  ) {
    return;
  }

  // The only supported mention action is replying-to-save. A bare mention is
  // most likely casual chatter, so stay silent rather than spam a usage notice.
  if (!message.reference?.messageId) return;

  const tag = parseTag(stripMention(message.content ?? '', me.id));
  if (!tag) {
    await safeReply(message, MENTION_USAGE);
    return;
  }

  const target = await message.fetchReference().catch(() => null);
  if (!target) {
    await safeReply(message, 'Couldn’t grab the message you replied to.');
    return;
  }

  try {
    const { imageCount } = await saveMessageAsReference({
      message: target,
      tags: [tag],
      addedBy: message.author.id,
    });

    const imageNote = imageCount ? ` (+${imageCount} image${imageCount > 1 ? 's' : ''})` : '';
    await safeReply(
      message,
      `🔖 Saved under \`${tag.display}\`${imageNote}. Browse with \`/glossa ref ${tag.display}\`.`,
    );
  } catch (error) {
    logger.error('Failed to save reference:', error);
    await safeReply(message, '⚠️ Couldn’t save that reference. Try again?');
  }
}

/** Reply without letting a failed reply (missing perms, deleted message) throw. */
async function safeReply(message: Message, content: string): Promise<void> {
  try {
    await message.reply(content);
  } catch (error) {
    logger.warn('Failed to reply to a message:', error);
  }
}

/** Remove the bot's own mention token(s) from the message content. */
function stripMention(content: string, botId: string): string {
  return content.replace(new RegExp(`<@!?${botId}>`, 'g'), ' ').trim();
}

/** DM: `term :: note` adds a community note. */
async function handleDmCommunityNote(message: Message): Promise<void> {
  const text = message.content?.trim() ?? '';
  const sepIndex = text.indexOf(SEPARATOR);
  if (sepIndex === -1) {
    await safeReply(message, DM_USAGE);
    return;
  }

  const rawTerm = text.slice(0, sepIndex).trim();
  const note = text.slice(sepIndex + SEPARATOR.length).trim();
  if (!rawTerm || !note) {
    await safeReply(message, DM_USAGE);
    return;
  }

  const term = normalizeTerm(rawTerm);
  await store.addCommunityNote({
    term,
    display: rawTerm,
    body: note,
    authorId: message.author.id,
    authorTag: message.author.username,
  });

  const images = message.attachments.filter((a) => a.contentType?.startsWith('image/'));
  await Promise.all(
    images.map((a) =>
      store.addImage({
        term,
        referenceId: null,
        url: a.url,
        addedBy: message.author.id,
      }),
    ),
  );
  const imageCount = images.size;

  const imageNote = imageCount ? ` (+${imageCount} image${imageCount > 1 ? 's' : ''})` : '';
  await safeReply(
    message,
    `✅ Added **${rawTerm}**${imageNote}. Look it up with \`/glossa def ${term}\`.`,
  );
}
