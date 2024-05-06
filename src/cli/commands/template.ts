import moment from "moment";
import { AppResult, apps } from "../../queries/apps";
import { companies } from "../../queries/companies";
import { ContactsResult, contacts } from "../../queries/contacts";
import { findApp, findCompany, findContact } from "../../queries/requests";
import { App, Company, Contact, Database } from "../../types";
import * as fs from 'fs';

export async function templateHelp(data: Database, arg: string) {
  return { printAsText: () => console.log(`
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

export async function template(data: Database, arg: string) {
  const [fileName, ...filterArray] = arg.split(' ');
  const filter = filterArray.join(' ');
  if (!fileName || !filter)
      throw 'Usage: crm template <TEMPLATE_FILE> <filter>'
  if (!fs.existsSync(fileName))
      throw `ERROR: ${fileName} does not exists.`;
  let content = fs.readFileSync(fileName, {encoding:'utf-8'});

  const filteredApp: AppResult[] = apps(data, filter).content;
  const filteredContact: ContactsResult[] = contacts(data, filter).content;
  const filteredCompany: Company[] = companies(data, filter).content;

  let app: App | undefined;
  let contact: Contact | undefined;
  let company: Company | undefined;

  // If any results are non-ambiguous
  if (filteredApp && filteredApp.length === 1) {
      contact = findContact(data, filteredApp[0].email)?.contact;
      company = findCompany(data, filteredApp[0].company);
      app = findApp(data, filteredApp[0].email)?.app;
  }
  else if (filteredContact && filteredContact.length === 1) {
      app = findApp(data, filteredContact[0].company)?.app;
      company = findCompany(data, filteredContact[0].company);
      contact = findContact(data, filteredContact[0].email)?.contact;
  }
  else if (filteredCompany && filteredCompany.length === 1) {
      app = findApp(data, filteredCompany[0].name)?.app;
      contact = findContact(data, filteredCompany[0].name)?.contact;
      company = findCompany(data, filteredCompany[0].name);
  }
  // If some results are ambiguous, pick app, or contact, or company
  else if (filteredApp && filteredApp.length > 1) {
      contact = findContact(data, filteredApp[0].email)?.contact;
      company = findCompany(data, filteredApp[0].company);
      app = findApp(data, filteredApp[0].email)?.app;
  }
  else if (filteredContact && filteredContact.length > 1) {
      app = findApp(data, filteredContact[0].company)?.app;
      company = findCompany(data, filteredContact[0].company);
      contact = findContact(data, filteredContact[0].email)?.contact;
  }
  else if (filteredCompany && filteredCompany.length > 1) {
      app = findApp(data, filteredCompany[0].name)?.app;
      contact = findContact(data, filteredCompany[0].name)?.contact;
      company = findCompany(data, filteredCompany[0].name);
  }
  // Else, no result
  else {
      throw 'ERROR: No contact found.';
  }

  if (!contact && company) {
      contact = company.contacts[0];
  }

  if (contact) {
      const defaultName = company?.name || app?.appName || 'user';
      const friendlyName = contact.firstName || defaultName;
      const name = `${contact.firstName} ${contact.lastName}`.replace(/(^ )|( $)/g, '') || defaultName;
      content = content.replace(new RegExp('{{EMAIL}}', 'g'), `${contact.email}`);
      content = content.replace(new RegExp('{{FULL_EMAIL}}', 'g'), `"${name}" <${contact.email}>`);
      content = content.replace(new RegExp('{{FULL_NAME}}', 'g'), name);
      content = content.replace(new RegExp('{{NAME}}', 'g'), name);
      content = content.replace(new RegExp('{{FRIENDLY_NAME}}', 'g'), friendlyName);
      content = content.replace(new RegExp('{{FIRST_NAME}}', 'g'), contact.firstName || '');
      content = content.replace(new RegExp('{{LAST_NAME}}', 'g'), contact.lastName || '');
  }
  if (app) {
      content = content.replace(new RegExp('{{APP_NAME}}', 'g'), app.appName);
      content = content.replace(new RegExp('{{APP_PLAN}}', 'g'), app.plan);
      content = content.replace(new RegExp('{{REGISTRATION_AGO}}', 'g'), moment(new Date(app.createdAt)).fromNow());
      content = content.replace(new RegExp('{{SUBSCRIPTION_AGO}}', 'g'), app.upgradedAt ? moment(new Date(app.upgradedAt)).fromNow() : '(never upgraded)');
  }
  if (company) {
      content = content.replace(new RegExp('{{COMPANY_AGO}}', 'g'), company.createdAt ? moment(new Date(company.createdAt)).fromNow() : '(unknown)');
      content = content.replace(new RegExp('{{COMPANY_NAME}}', 'g'), company.name);
      content = content.replace(new RegExp('{{COMPANY_URL}}', 'g'), company.url);
      content = content.replace(new RegExp('{{COMPANY_ADDRESS}}', 'g'), company.address || '');
  }
  return {
      printAsText: () => console.log(content)
  };
}
