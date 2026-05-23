import { REST, Routes } from 'discord.js';
import { config } from './config';
import { consola as logger } from 'consola';
import { glossa } from './commands/index';

/**
 * Registers the /glossa slash command with Discord. Run with `pnpm run deploy`.
 *
 * If GUILD_ID is set, commands register to that guild and update instantly
 * (best for development). Otherwise they register globally, which can take up
 * to an hour to propagate.
 */
const body = [glossa.data.toJSON()];
const rest = new REST().setToken(config.token);

try {
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
    logger.info(`Registered /glossa to guild ${config.guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body });
    logger.info('Registered /glossa globally.');
  }
} catch (error) {
  logger.error('Failed to register commands:', error);
  process.exit(1);
}
