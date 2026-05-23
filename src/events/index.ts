import type { ClientEvents } from 'discord.js';
import { ready } from './ready';
import { interactionCreate } from './interactionCreate';
import { messageCreate } from './messageCreate';

/** A gateway event handler; `execute` is typed by the discord.js event name. */
export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(...args: ClientEvents[K]): Promise<void> | void;
}

/** Register event handlers here. New handlers `satisfies Event<typeof Events.X>`. */
export const events: Event[] = [ready, interactionCreate, messageCreate];
