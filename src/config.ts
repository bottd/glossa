import 'dotenv/config';
import { join } from 'node:path';

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('Missing required environment variable: DISCORD_TOKEN');
const clientId = process.env.CLIENT_ID;
if (!clientId) throw new Error('Missing required environment variable: CLIENT_ID');
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicApiKey) throw new Error('Missing required environment variable: ANTHROPIC_API_KEY');

const dataDir = process.env.DATA_DIR || join(process.cwd(), 'data');

export const config = {
  token,
  clientId,
  anthropicApiKey,
  /** Optional. When set, commands deploy to this guild only (instant updates). */
  guildId: process.env.GUILD_ID || undefined,
  /** Where the SQLite database lives. */
  dbPath: process.env.DB_PATH || join(dataDir, 'glossa.db'),
} as const;
