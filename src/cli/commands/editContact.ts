import { editJson } from "../editor";
import { findContact } from "../../queries/requests";
import { Contact, Printable } from "../../types";
import { doYouConfirm } from "../utils";
import { DatabaseSession } from "../../database";

export async function editContact(database: DatabaseSession, filter: string): Promise<(Contact & Printable) | undefined> {
  if (!filter) {
      console.log('Usage: crm edit-contact NAME');
      process.exit(1);
  }
  const data = await database.dump();
  const findResult = findContact(data.companies, filter);
  if (!findResult)
      return;
  const contact = findResult.contact;
  const edited = await editJson<Partial<Contact>>({
      firstName: '',
      lastName: '',
      email: '',
      url: '',
      ...(contact as Partial<Contact>),
      updatedAt: undefined,
  });
  if (!edited || !edited.email) {
      console.log('Canceled');
      process.exit(1);
  }
  await doYouConfirm(JSON.stringify(edited, null, 4));
  Object.assign(contact, edited);
  contact.updatedAt = new Date().toISOString();
  await database.updateCompany(findResult.company.name, findResult.company);
  console.log('Contact updated.');
  return {
      ...contact,
      printAsText: () => { }
  };
};
