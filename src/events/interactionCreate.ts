import { Events, MessageFlags, type Interaction } from 'discord.js';
import type { Event } from './index';
import { consola as logger } from 'consola';
import { glossa } from '../commands/index';

export const interactionCreate = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        await glossa.execute(interaction);
      } else if (interaction.isAutocomplete()) {
        await glossa.autocomplete?.(interaction);
      }
    } catch (error) {
      logger.error('Interaction handler failed:', error);
      await replyWithError(interaction);
    }
  },
} satisfies Event<typeof Events.InteractionCreate>;

async function replyWithError(interaction: Interaction): Promise<void> {
  if (!interaction.isRepliable()) return;
  const content = 'Something broke handling that. Try again?';
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch {
    // The interaction may have already expired; nothing more we can do.
  }
}
