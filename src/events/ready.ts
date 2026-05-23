import { Events } from 'discord.js';
import type { Event } from './index';
import { consola as logger } from 'consola';

export const ready = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`Logged in as ${client.user.tag} (serving ${client.guilds.cache.size} guild(s))`);
  },
} satisfies Event<typeof Events.ClientReady>;
