import { WDiscordCommandResult } from "../types/w-discord-command-result";
import { WEventListener } from "../types/w-event-listener";
import { authenticateMember } from "../utils/discord/authenticate-member";
import { HandleMediaRequest } from "../utils/discord/handle-request-media";
import { HandleNewslettersRequest } from "../utils/discord/handle-request-newsletters";
import { HandleQuranRequest } from "../utils/discord/handle-request-quran";
import { SerializedInteraction } from "../utils/discord/serialized-interaction";
import { getSupabaseClient } from "../utils/get-supabase-client";

export default function listener(): WEventListener {
  return {
    name: 'interactionCreate',
    handler: async (interaction) => {
      if (interaction.isButton()) {
        if (interaction.customId.startsWith('page_')) {
          // Get cached interaction.
          const db = getSupabaseClient();
          const request = await db
            .from('GlobalCache')
            .select('*')
            .eq('key', interaction.message.interactionMetadata?.id || '')
            .single();

          if (request && request.data?.value) {
            const cachedInteraction: SerializedInteraction = JSON.parse(
              request.data.value,
            );

            // Verify if requestor can change the page.
            if (
              // Original requester.
              cachedInteraction.user === interaction.user.id ||
              // Or, insider and above.
              authenticateMember(interaction.member, 'INSIDER_AND_ABOVE')
            ) {
              // Extract desired page from custom ID.
              const desiredPage = parseInt(
                interaction.customId.split('_')[1],
                10,
              );

              // Get new data.
              try {
                let output: WDiscordCommandResult;

                switch (cachedInteraction.commandName) {
                  case 'search-newsletters':
                    output = await new HandleNewslettersRequest(
                      cachedInteraction,
                      desiredPage,
                    ).getResults();
                    break;

                  case 'search-media':
                    output = await new HandleMediaRequest(
                      cachedInteraction,
                      desiredPage,
                    ).getResults();
                    break;

                  default: // === "search-quran"
                    output = await new HandleQuranRequest(
                      cachedInteraction,
                      desiredPage,
                    ).getResults();
                }

                // Update the embed.
                if (output) {
                  await interaction.update({
                    content: output.content,
                    embeds: output.embeds,
                    components: output.components,
                  });
                } else {
                  // Would be weird if we end up here, but might as well add it:
                  await interaction.reply({
                    content: `\`Unknown command\``,
                    flags: ['Ephemeral'],
                  });
                }
              } catch (error: any) {
                // Errors thrown from re-processing the request, or otherwise an internal error.
                await interaction.reply({
                  content: `\`${error.message || 'Internal Server Error'}\``,
                  flags: ['Ephemeral'],
                });
              }
            } else {
              // User not authorized to change page.
              await interaction.reply({
                content:
                  '`Only the original requester may change the page. You can make your own request.`',
                flags: ['Ephemeral'],
              });
              return;
            }
          } else {
            // Cached interaction not found in DB.
            await interaction.reply({
              content: '`Request expired. Please make a new one.`',
              flags: ['Ephemeral'],
            });
          }
        }
      }
    },
  };
}
