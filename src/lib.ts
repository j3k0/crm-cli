import { saveDataSync } from "./database";
import { findApp, findCompany, findContact } from "./queries/requests";
import { App, Company, CompanyAttributes, Config, Contact, Database, Interaction } from "./types";

export function addCompany(data: Database, company: Partial<CompanyAttributes>): Company | {} {

  const found = company.name && data.companies.find((c) => c.name.toLowerCase() === company.name!.toLowerCase());
  if (company.name && !found) {
      company.createdAt = new Date().toISOString();
      company.updatedAt = new Date().toISOString();
      company.contacts = [];
      company.interactions = [];
      company.apps = [];
      const ret = new Company(company as CompanyAttributes);
      data.companies.push(ret);
      saveDataSync(data, { type: "company", name: ret.name });
      console.log('Company added.');
      return ret;
  }

  if (found) {
      console.error(`ERROR: A company with name "${company.name}" already exists.`);
      return found;
  }

  console.error({company}, `ERROR: incomplete data, name missing.`);

  return {}
}

export function editApp(data: Database, appName: string, attributes: Partial<App>): App | {error: string} {
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    if (!appName) {
      return {error: 'missing appName'};
    }
    const app = findApp(data, appName);
    if (!app || app.app.appName !== appName) {
      return {error: 'app not found'};
    }
    if (attributes.appName !== undefined && attributes.appName !== appName) {
      return {error: 'incorrect body appName'};
    }
    Object.assign(app.app, {
      ...attributes,
      updatedAt: new Date().toISOString(),
    });
    saveDataSync(data, { type: "company", name: app.company.name });
    console.log('App updated.');
    return app.app;
}

export function addContact(data: Database, attributes: Partial<Contact & { company?: string | undefined; }>): Contact | {error: string} {
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    if (!attributes.company || !attributes.email) {
      return {error: 'missing company or email'};
    }
    const companyName = attributes.company;
    const company = findCompany(data, companyName); // fuzzy search for the company
    delete attributes.company;
    const existing = findContact(data, attributes.email);
    if (existing?.contact.email === attributes.email) {
      return {error: 'contact already exists in company ' + existing?.company.name};
    }
    if (company) {
        attributes.createdAt = (attributes.createdAt ? new Date(attributes.createdAt) : new Date()).toISOString();
        attributes.updatedAt = new Date().toISOString();
        // Find the company in the data
        const ret = attributes as Contact;
        company.contacts.push(ret);
        saveDataSync(data, { type: "company", name: company.name });
        console.log('Contact added.');
        return ret;
    }
    else {
        console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
        return {
          error: `Company with name "${companyName}" doesn't exists.`
        };
    }
}

export function addApp(data: Database, app: Partial<App & { company?: string | undefined; }>): App | {error: string} {
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    if (!app.company || !app.appName) {
      return {error: 'missing company or appName'};
    }
    const companyName = app.company;
    const company = findCompany(data, companyName); // fuzzy search for the company
    delete app.company;
    if (company) {
        app.createdAt = (app.createdAt ? new Date(app.createdAt) : new Date()).toISOString();
        app.upgradedAt = app.upgradedAt ? new Date(app.upgradedAt).toISOString() : undefined;
        app.updatedAt = new Date().toISOString();
        // Find the company in the data
        const ret = app as App;
        company.apps.push(ret);
        saveDataSync(data, { type: "company", name: company.name });
        console.log('App added.');
        return ret;
    }
    else {
        console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
        return {
          error: `Company with name "${companyName}" doesn't exists.`
        };
    }
}

export function addInteraction(data: Database, interaction: Interaction & { company: string; }): Interaction | {error: string} {
    if (!interaction.summary) {
      return {error: '"summary" is missing'};
    }
    if (!interaction.from) {
      return {error: '"from" is missing'};
    }
    const companyName = interaction.company;
    const company = findCompany(data, companyName); // fuzzy search for the company
    delete (interaction as any).company;
    const contact = findContact(data, interaction.from);
    if (company && contact) {
        // interaction.createdAt = new Date().toISOString();
        // Find the company in the data
        interaction.date = interaction.date || new Date().toISOString();
        interaction.from = contact.contact.email;
        company.interactions.push(interaction);
      saveDataSync(data, { type: "company", name: company.name });
        console.log('Interaction added.');
    }
    else if (!company) {
        console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
        return { error: `Company with name "${companyName}" doesn't exists.` };
    }
    else if (!contact) {
        console.error(`ERROR: Contact with email "${interaction.from}" doesn't exists.`);
        return { error: `Contact with email "${interaction.from}" doesn't exists.` };
    }
    return interaction;
}

interface StaffDefinition {
  name: string;
  email: string;
}

export function addStaff(data: Database, staff: Partial<StaffDefinition>): { [email: string]: string } | { error: string } {
  if (staff.name && staff.email) {
    data.config.staff[staff.email] = staff.name;
    saveDataSync(data, { type: "config" });
    return data.config.staff;
  }
  else {
    return {error: 'incomplete data: name or email missing'};
  }
}

export function editConfig(data: Database, attributes: Partial<Config>): Config | { error: string } {
  Object.assign(data.config, attributes);
  saveDataSync(data, { type: "config" });
  return data.config;
}

export default {
  addCompany,
  addApp,
  addContact,
  addInteraction,
  editApp,
  addStaff,
  editConfig,
}