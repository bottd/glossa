import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config';
import { consola as logger } from 'consola';
import { store } from './store/index';
import { events } from './events/index';

const client = new Client({
  // Guilds: slash commands. DirectMessages: DM-add. GuildMessages: reply-mention saves.
  // No MessageContent intent — Discord delivers content for DMs and bot mentions.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  // Partials let us receive events for uncached DM channels/messages.
  partials: [Partials.Channel, Partials.Message],
});

for (const event of events) {
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection:', reason));

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down.`);
  await client.destroy();
  store.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

client.login(config.token);
