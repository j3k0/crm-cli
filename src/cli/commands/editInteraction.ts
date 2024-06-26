import { editJson } from "../editor";
import { findInteraction } from "../../queries/requests";
import { Interaction, Printable } from "../../types";
import { doYouConfirm } from "../utils";
import moment from "moment";
import { DatabaseSession } from "../../database";

export async function editInteraction(database: DatabaseSession, filter?: string): Promise<(Interaction | {}) & Printable> {
  const data = await database.dump();
  if (!filter) {
      console.log('Usage: crm edit-interaction ID');
      process.exit(1);
  }
  let interaction: Interaction | undefined;
  if ('' + parseInt(filter) === filter) {
      const findResult = findInteraction(data, filter);
      if (!findResult)
          throw `ERROR: Interaction with ID "${filter}" not found.`;
      interaction = findResult.interaction;
      const edited = await editJson<Partial<Interaction>>({
          followUpDate: '',
          tag: '',
          summary: '',
          from: '',
          kind: '',
          ...(interaction as Partial<Interaction>),
          updatedAt: undefined,
      });
      if (!edited || !edited.summary) {
          console.log('Canceled');
          process.exit(1);
      }
      await doYouConfirm(JSON.stringify(edited, null, 4));
      Object.assign(interaction, edited);
      if (interaction.followUpDate) {
          interaction.followUpDate = moment(interaction.followUpDate).toISOString();
      }
      interaction.updatedAt = new Date().toISOString();
      await database.updateCompany(findResult.company.name, findResult.company);
      console.log('Interaction updated.');
  }
  if (!interaction) {
      return {
          printAsText: async () => {},
      };
  }
  else {
      return {
          ...interaction,
          printAsText: async () => {},
      };
  }
};
