import { saveDataSync } from "../../database";
import { findInteraction } from "../../queries/requests";
import { Database } from "../../types";
import { doYouConfirm } from "../utils";

export async function doneInteraction(data: Database, filter?: string) {
  if (!filter) {
      console.log('Usage: crm done ID');
      process.exit(1);
  }
  let interaction;
  if ('' + parseInt(filter) === filter) {
      const findResult = findInteraction(data, filter);
      if (!findResult)
          throw `ERROR: Interaction with ID "${filter}" not found.`;
      interaction = findResult.interaction;
      interaction.updatedAt = new Date().toISOString();
      interaction.followUpDate = undefined;
      await doYouConfirm(JSON.stringify(interaction, null, 4));
      saveDataSync(data, { type: "company", name: findResult.company.name });
      console.log('Interaction updated.');
  }
  return { printAsText: () => {} };
};
