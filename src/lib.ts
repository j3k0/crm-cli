import { saveData } from "./database";
import { findApp, findAppByName, findCompany, findCompanyByName, findContact } from "./queries/requests";
import { App, Company, CompanyAttributes, Config, Contact, Database, Interaction } from "./types";

export async function addCompany(data: Database, company: Partial<CompanyAttributes>): Promise<Company | {}> {

  const found = company.name && data.companies.find((c) => c.name.toLowerCase() === company.name!.toLowerCase());
  if (company.name && !found) {
      company.createdAt = new Date().toISOString();
      company.updatedAt = new Date().toISOString();
      company.contacts = [];
      company.interactions = [];
      company.apps = [];
      const ret = new Company(company as CompanyAttributes);
      data.companies.push(ret);
      await saveData(data, { company: ret.name });
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

export async function editCompany(data: Database, name: string, attributes: Partial<CompanyAttributes>): Promise<Company | {error: string}> {
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    if (!name) {
      return {error: 'missing name'};
    }
    const company = findCompanyByName(data, name);
    if (!company) {
      return {error: 'company not found'};
    }
    if (attributes.name !== undefined && attributes.name !== name) {
      return {error: 'incorrect body name'};
    }
    Object.assign(company, {
      ...attributes,
      updatedAt: new Date().toISOString(),
    });
    await saveData(data, { company: name });
    console.log('Company updated.');
    return company;
}

export async function editApp(data: Database, appName: string, attributes: Partial<App>): Promise<App | {error: string}> {
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    if (!appName) {
      return {error: 'missing appName'};
    }
    const app = findAppByName(data, appName);
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
    await saveData(data, { company: app.company.name });
    console.log('App updated.');
    return app.app;
}

export async function addContact(data: Database, attributes: Partial<Contact & { company?: string | undefined; }>): Promise<Contact | {error: string}> {
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
        await saveData(data, { company: company.name });
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

export async function addApp(data: Database, app: Partial<App & { company?: string | undefined; }>): Promise<App | {error: string}> {
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
        await saveData(data, { company: company.name });
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

export async function addInteraction(data: Database, interaction: Interaction & { company: string; }): Promise<Interaction | {error: string}> {
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
        await saveData(data, { company: company.name });
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

export async function addStaff(data: Database, staff: Partial<StaffDefinition>): Promise<{ [email: string]: string } | { error: string }> {
  if (staff.name && staff.email) {
    data.config.staff[staff.email] = staff.name;
    await saveData(data, "config");
    return data.config.staff;
  }
  else {
    return {error: 'incomplete data: name or email missing'};
  }
}

export async function editConfig(data: Database, attributes: Partial<Config>): Promise<Config | { error: string }> {
  Object.assign(data.config, attributes);
  await saveData(data, "config");
  return data.config;
}

export default {
  addCompany,
  addApp,
  addContact,
  addInteraction,
  addStaff,
  editApp,
  editConfig,
  editCompany,
}