import { config } from '../config';
import { SqliteStore } from './sqliteStore';

/** The single store instance the app uses. */
export const store = new SqliteStore(config.dbPath);
