import { saveDataSync } from "../../database";
import { editJson } from "../editor";
import { findInteraction } from "../../queries/requests";
import { Database, Interaction, Printable } from "../../types";
import { doYouConfirm } from "../utils";

export async function editInteraction(data: Database, filter?: string): Promise<(Interaction | {}) & Printable> {
  if (!filter) {
      console.log('Usage: crm edit-interaction ID');
      process.exit(1);
  }
  let interaction: Interaction | undefined;
  if ('' + parseInt(filter) === filter) {
      interaction = findInteraction(data, filter);
      if (!interaction)
          throw `ERROR: Interaction with ID "${filter}" not found.`;
      const edited = await editJson(Object.assign(
          {
              followUpDate: '',
              tag: '',
              summary: '',
              from: '',
              kind: '',
          },
          interaction,
          {
              updatedAt: undefined,
          }));
      if (!edited || !edited.summary) {
          console.log('Canceled');
          process.exit(1);
      }
      await doYouConfirm(JSON.stringify(edited, null, 4));
      Object.assign(interaction, edited);
      interaction.updatedAt = new Date().toISOString();
      saveDataSync(data);
      console.log('Interaction updated.');
  }
  if (!interaction) {
      return {
          printAsText: () => {},
      };
  }
  else {
      return {
          ...interaction,
          printAsText: () => {},
      };
  }
};
