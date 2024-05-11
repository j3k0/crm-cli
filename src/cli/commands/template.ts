import * as fs from 'fs';
import { DatabaseSession } from "../../database";
import { findContactByFilter, renderTemplateText } from "../../lib";

export async function templateHelp(database: DatabaseSession, arg: string) {
  return { printAsText: async () => console.log(`
Here are the available template fields.

{{EMAIL}} .............. Contact's raw email (example: user@example.com
{{FULL_EMAIL}} ......... Contact's full email (example: Jon Snow <jon.snow@example.com>)
{{FULL_NAME}} .......... Contact's full name (example: Henry Ford)
{{NAME}} ............... Alias to {{FULL_NAME}}
{{FIRST_NAME}} ......... Contact's first name
{{LAST_NAME}} .......... Contact's last name
{{FRIENDLY_NAME}} ...... Contact's first name, company name when unknown.
{{APP_NAME}} ........... The appName
{{APP_PLAN}} ........... The plan user's is registered to
{{REGISTRATION_AGO}} ... Time since registration (example: 2 days ago)
{{SUBSCRIPTION_AGO}} ... Time since subscription
{{COMPANY_AGO}} ........ Time since first contact with the company
{{COMPANY_NAME}} ....... Name of the company
{{COMPANY_URL}} ........ Company's URL
{{COMPANY_ADDRESS}} .... Company's website
  `) };
};

export async function template(database: DatabaseSession, arg: string) {
  const [fileName, ...filterArray] = arg.split(' ');
  const filter = filterArray.join(' ');
  if (!fileName || !filter)
      throw 'Usage: crm template <TEMPLATE_FILE> <filter>'
  if (!fs.existsSync(fileName))
      throw `ERROR: ${fileName} does not exists.`;
  let content = await fs.promises.readFile(fileName, {encoding:'utf-8'});

//   const filteredApp: AppResult[] = apps(data, filter).content;
//   const filteredContact: ContactsResult[] = contacts(data, filter).content;
//   const filteredCompany: Company[] = companies(data, filter).content;

  let { contact, company, app } = await findContactByFilter(database, filter);

  if (!contact && company) {
      contact = company.contacts[0];
  }

  if (!contact) {
    throw 'ERROR: No contact found.';
  }

  content = renderTemplateText(content, {app, contact, company});
  return {
      printAsText: async () => console.log(content)
  };
}
