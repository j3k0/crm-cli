import { saveDataSync } from "../../database";
import { editJson } from "../editor";
import { findContact } from "../../queries/requests";
import { Contact, Database, Printable } from "../../types";
import { doYouConfirm } from "../utils";

export async function editContact(data: Database, filter: string): Promise<(Contact & Printable) | undefined> {
  if (!filter) {
      console.log('Usage: crm edit-contact NAME');
      process.exit(1);
  }
  const findResult = findContact(data, filter); // fuzzy search for the company
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
  saveDataSync(data, { type: "company", name: findResult.company.name });
  console.log('Contact updated.');
  return {
      ...contact,
      printAsText: () => { }
  };
};
