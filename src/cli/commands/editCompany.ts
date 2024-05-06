import { saveDataSync } from "../../database";
import { editJson } from "../editor";
import { findCompany } from "../../queries/requests";
import { CompanyAttributes, Database, Printable } from "../../types";
import { doYouConfirm } from "../utils";

export async function editCompany(data: Database, filter?: string): Promise<(CompanyAttributes & Printable) | undefined> {
  if (!filter) {
      console.log('Usage: crm edit-company NAME');
      process.exit(1);
  }
  const company = findCompany(data, filter); // fuzzy search for the company
  if (!company)
      return;
  const edited = await editJson(Object.assign(
      {
          name: '',
          url: '',
          address: '',
      },
      company,
      {
          updatedAt: undefined,
          interactions: undefined,
          apps: undefined,
          contacts: undefined,
      }));
  if (!edited || !edited.name) {
      console.log('Canceled');
      process.exit(1);
  }
  await doYouConfirm(JSON.stringify(edited, null, 4));
  Object.assign(company, edited);
  company.updatedAt = new Date().toISOString();
  saveDataSync(data);
  console.log('Company updated.');
  return {
      ...company,
      printAsText: () => {}
  }
};
