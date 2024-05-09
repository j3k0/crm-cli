import { DatabaseAdapter, DatabaseSession, connectCrmDatabase } from "./database";
import { App, Company, CompanyAttributes, Config, Contact, Interaction } from "./types";

export async function addCompany(database: DatabaseSession, company: Partial<CompanyAttributes>): Promise<Company | {error: string}> {

  if (!company.name) {
    console.error({ company }, `ERROR: incomplete data, name missing.`);
    return {error: 'name is missing'};
  }
  const found = await database.findCompanyByName(company.name);
  if (found) {
      console.error(`ERROR: A company with name "${company.name}" already exists.`);
      return {error: 'a company with this already exists'};
  }
  company.createdAt = new Date().toISOString();
  company.updatedAt = new Date().toISOString();
  company.contacts = company.contacts || [];
  company.interactions = [];
  company.apps = company.apps || [];
  const ret = new Company(company as CompanyAttributes);
  await database.addCompany(ret);
  return ret;
}

export async function editCompany(database: DatabaseSession, name: string, attributes: Partial<CompanyAttributes>): Promise<Company | {error: string}> {
    if (!name) {
      return {error: 'missing name'};
    }
    attributes.updatedAt = new Date().toISOString();
    if (attributes.name && attributes.name !== name) {
      const existingRename = await database.findCompanyByName(attributes.name);
      if (existingRename) {
        return { error: 'A company with that name already exists.' };
      }
    }
    const company = await database.updateCompany(name, attributes);
    return company;
}

export async function editContact(database: DatabaseSession, email: string, attributes: Partial<Contact>): Promise<Contact | { error: string }> {
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    if (!email) {
      return {error: 'missing email'};
    }
    const found = await database.findContactByEmail(email);
    if (!found || found.contact.email !== email) {
      return {error: 'contact not found'};
    }
    if (attributes.email && attributes.email !== email) {
      const existingRename = await database.findContactByEmail(attributes.email);
      if (existingRename) {
        return { error: 'a contact with that email already exists' };
      }
    }
    Object.assign(found.contact, {
      ...attributes,
      updatedAt: new Date().toISOString(),
    });
    const result = await database.updateCompany(found.company.name, {
      contacts: [
        ...found.company.contacts.filter(c => c.email !== email),
        found.contact,
      ]
    });
    if ('error' in result) {
      return result;
    }
    return found.contact;
}

export async function editApp(database: DatabaseSession, appName: string, attributes: Partial<App>): Promise<App | {error: string}> {
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    if (!appName) {
      return {error: 'missing appName'};
    }
    const found = await database.findAppByName(appName);
    if (!found || found.app.appName !== appName) {
      return {error: 'app not found'};
    }
    if (attributes.appName !== undefined && attributes.appName !== appName) {
      return {error: 'incorrect body appName'};
    }
    Object.assign(found.app, {
      ...attributes,
      updatedAt: new Date().toISOString(),
    });
    const result = await database.updateCompany(found.company.name, {
      apps: [
        ...found.company.apps.filter(a => a.appName !== appName),
        found.app,
      ]
    });
    if ('error' in result) {
      return result;
    }
    return found.app;
}

export async function addContact(database: DatabaseSession, attributes: Partial<Contact & { company?: string | undefined; }>): Promise<Contact | {error: string}> {
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    if (!attributes.company || !attributes.email) {
      return {error: 'missing company or email'};
    }
    attributes.email = attributes.email.toLowerCase();
    const companyName = attributes.company;
    const company = await database.findCompanyByName(companyName);
    delete attributes.company;
    const existing = await database.findContactByEmail(attributes.email);
    if (existing?.contact.email === attributes.email) {
      return {error: 'contact already exists in company ' + existing?.company.name};
    }
    if (company) {
        attributes.createdAt = (attributes.createdAt ? new Date(attributes.createdAt) : new Date()).toISOString();
        attributes.updatedAt = new Date().toISOString();
        // Find the company in the data
        const contact = attributes as Contact;
        const result = await database.updateCompany(companyName, {
          contacts: [
            ...company.contacts,
            contact
          ]
        });
        if ('error' in result) {
          return result;
        }
        console.log('Contact added.');
        return contact;
    }
    else {
        console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
        return {
          error: `Company with name "${companyName}" doesn't exists.`
        };
    }
}

export async function addApp(database: DatabaseSession, app: Partial<App & { company?: string | undefined; }>): Promise<App | {error: string}> {
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    if (!app.company || !app.appName) {
      return {error: 'missing company or appName'};
    }
    const companyName = app.company;
    const company = await database.findCompanyByName(companyName);
    delete app.company;
    if (company) {
        app.createdAt = (app.createdAt ? new Date(app.createdAt) : new Date()).toISOString();
        app.upgradedAt = app.upgradedAt ? new Date(app.upgradedAt).toISOString() : undefined;
        app.updatedAt = new Date().toISOString();
        const newApp = app as App;
        await database.updateCompany(companyName, {
          apps: [
            ...company.apps,
            newApp,
          ]
        });
        console.log('App added.');
        return newApp;
    }
    else {
        console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
        return {
          error: `Company with name "${companyName}" doesn't exists.`
        };
    }
}

export async function addInteraction(database: DatabaseSession, interaction: Interaction & { company: string; }): Promise<Interaction | {error: string}> {
    if (!interaction.summary) {
      return {error: '"summary" is missing'};
    }
    if (!interaction.from) {
      return {error: '"from" is missing'};
    }
    const companyName = interaction.company;
    const company = await database.findCompanyByName(companyName);
    if (!company) {
      return {error: 'company not found'};
    }
    delete (interaction as any).company;
    // interaction.createdAt = new Date().toISOString();
    // Find the company in the data
    interaction.date = interaction.date || new Date().toISOString();
    const ret = await database.updateCompany(companyName, {
      interactions: [
        ...company.interactions,
        interaction
      ]
    });
    if ('error' in ret) return ret;
    console.log('Interaction added.');
    return interaction;
}

export async function editInteraction(database: DatabaseSession, companyName: string, index: number, attributes: Partial<Interaction>): Promise<Interaction | {error: string}> {
  // If name is filled and there isn't a company with the given name.
  // Add it and save
  if (!companyName || !isFinite(index)) {
    return {error: 'missing interaction company or id'};
  }
  const company = await database.findCompanyByName(companyName);
  if (!company) {
    return {error: 'company not found'};
  }
  if (index < 0 || index >= company.interactions.length) {
    return {error: 'interaction index out of range'};
  }
  const interaction = company.interactions[index];
  Object.assign(interaction, {
    ...attributes,
    updatedAt: new Date().toISOString(),
  });
  const result = await database.updateCompany(companyName, {
    interactions: company.interactions
  });
  if ('error' in result) {
    return result;
  }
  return interaction;
}

export interface StaffDefinition {
  name: string;
  email: string;
}

export async function addStaff(database: DatabaseSession, staff: Partial<StaffDefinition>): Promise<{ [email: string]: string } | { error: string }> {
  if (staff.name && staff.email) {
    const config = await database.loadConfig();
    config.staff[staff.email] = staff.name;
    await database.updateConfig({staff: config.staff});
    return config.staff;
  }
  else {
    return {error: 'incomplete data: name or email missing'};
  }
}

export async function editConfig(database: DatabaseSession, attributes: Partial<Config>) {
    return await database.updateConfig(attributes);
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
  editContact,
  editInteraction,
}