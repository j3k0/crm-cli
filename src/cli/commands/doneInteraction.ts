import { DatabaseSession } from "../../database";
import { findInteraction } from "../../queries/requests";
import { doYouConfirm } from "../utils";

export async function doneInteraction(database: DatabaseSession, filter?: string) {
  if (!filter) {
      console.log('Usage: crm done ID');
      process.exit(1);
  }
  const data = await database.dump();
  let interaction;
  if ('' + parseInt(filter) === filter) {
      const findResult = findInteraction(data, filter);
      if (!findResult)
          throw `ERROR: Interaction with ID "${filter}" not found.`;
      interaction = findResult.interaction;
      interaction.updatedAt = new Date().toISOString();
      interaction.followUpDate = undefined;
      await doYouConfirm(JSON.stringify(interaction, null, 4));
      await database.updateCompany(findResult.company.name, findResult.company);
      console.log('Interaction updated.');
  }
  return { printAsText: () => {} };
};
