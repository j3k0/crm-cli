import enquirer from 'enquirer';
import { doYouConfirm } from "../utils";
import { DatabaseSession } from "../../database";
import { findCompany } from "../../queries/requests";
import { Contact, Printable } from "../../types";
import Lib from "../../lib";

export async function addContact(database: DatabaseSession, filter: string | undefined, values: Partial<Contact & { company: string }> = {}): Promise<Contact & Printable> {
  const data = await database.dump();
  let contact: Partial<Contact & { company: string } & Printable> = { ...values };
  console.log('');
  console.log('New Contact:');
  console.log('------------');
  if (!values.company) Object.assign(contact, await enquirer.prompt({
      type: 'autocomplete',
      name: 'company',
      message: 'Company Name',
      choices: data.companies.map((c) => c.name),
      limit: 10,
  }));
  if (!values.firstName) Object.assign(contact, await enquirer.prompt({
      type: 'input',
      name: 'firstName',
      message: 'First Name',
  }));
  if (!values.lastName) Object.assign(contact, await enquirer.prompt({
      type: 'input',
      name: 'lastName',
      message: 'Last Name',
  }));
  if (!values.role) Object.assign(contact, await enquirer.prompt({
      type: 'input',
      name: 'role',
      message: 'Role',
  }));
  if (!values.email) Object.assign(contact, await enquirer.prompt({
      type: 'input',
      name: 'email',
      message: 'Email',
  }));
  await doYouConfirm();
  // If name is filled and there isn't a company with the given name.
  // Add it and save
  const companyName = contact.company;
  const company = findCompany(data, companyName); // fuzzy search for the company
  if (company) {
      contact.createdAt = new Date().toISOString();
      contact.updatedAt = new Date().toISOString();
      contact.firstName = contact.firstName || '';
      contact.lastName = contact.lastName || '';
      // Find the company in the data
    //   company.contacts.push(contact as Contact);
      await Lib.addContact(database, contact);
      console.log('Contact added.');
      // contacts(data, company.name).printAsText();;
      // process.exit(0);
  }
  else {
      console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
      process.exit(1);
  }
  contact.printAsText = () => {};
  return contact as (Contact & Printable);
};
