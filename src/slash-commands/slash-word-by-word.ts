import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { WSlashCommand } from '../types/w-slash-command';
import { Database } from '../types/generated/database.types';

export default function command(): WSlashCommand {
  return {
    name: 'word-by-word',
    description: 'Get a word by word breakdown for any verse(s)',
    options: [
      {
        name: 'verse',
        description: 'Verse #:# (or #:#-#)',
        required: true,
        type: ApplicationCommandOptionType.String,
        name_localizations: {
          tr: 'ayet',
        },
        description_localizations: {
          tr: 'Ayet numarasını girin',
        },
      },
    ],
    execute: async (interaction) => {
      const query = `${interaction.options.get('verse')?.value?.toString() || '1:1'}`;

      if (query.includes('-') || !query.includes(':')) {
        await interaction.reply({
          content: `\`Please request only one verse at a time.\``,
          flags: ['Ephemeral'],
        });
        return;
      }

      const request = await fetch(
        `https://api.wikisubmission.org/quran/word-by-word/${query}`,
      );

      const result: {
        results: Database['public']['Tables']['DataQuranWordByWord']['Row'][];
        error?: { name: string; description: string };
      } = await request.json();

      if (result && result.results && !result.error) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${query} – Word by Word`)

              .setDescription(
                `${result.results.map((w) => `**${w.transliterated_text} (${w.arabic_text}) (${w.root_word_1})**\n\`${w.english_text}\``).join('\n\n')}`.substring(
                  0,
                  4000,
                ),
              )
              .setFooter({
                text: `Quran: The Final Testament`,
              })
              .setColor('DarkButNotBlack'),
          ],
        });
      } else {
        await interaction.reply({
          content: `\`Verse not found\``,
          flags: ['Ephemeral'],
        });
      }
    },
  };
}
