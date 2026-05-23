import {
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type SlashCommandOptionsOnlyBuilder,
  type SlashCommandSubcommandBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import { defineSub } from './define';
import { findSub } from './find';
import { refSub } from './ref';
import { helpSub } from './help';

/** A slash command: its definition, handler, and optional autocomplete. */
export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void> | void;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void> | void;
}

/**
 * A subcommand of a parent slash command (e.g. `/glossa def`). `build` adds
 * this subcommand's description and options to the builder the parent supplies
 * (already named); `execute`/`autocomplete` handle it once dispatched by name.
 */
export interface Subcommand {
  name: string;
  build(sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void> | void;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void> | void;
}

/**
 * Everything the bot does lives under `/glossa` as a subcommand. To add one:
 * create a file in this folder that exports a `Subcommand`, then add it to the
 * array below.
 */
const subcommands: Subcommand[] = [defineSub, findSub, refSub, helpSub];
const byName = new Map(subcommands.map((sub) => [sub.name, sub]));

const data = new SlashCommandBuilder()
  .setName('glossa')
  .setDescription(
    'Community lexicon: look up words, add definitions, and learn how your server talks.',
  );
for (const sub of subcommands) {
  data.addSubcommand((b) => sub.build(b.setName(sub.name)));
}

/** The single top-level `/glossa` command; dispatches to the matching subcommand. */
export const glossa = {
  data,

  async execute(interaction) {
    const sub = byName.get(interaction.options.getSubcommand());
    if (!sub) return;
    await sub.execute(interaction);
  },

  async autocomplete(interaction) {
    const sub = byName.get(interaction.options.getSubcommand());
    await sub?.autocomplete?.(interaction);
  },
} satisfies Command;
