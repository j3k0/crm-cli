import moment from "moment";
import { DatabaseSession } from "./database";
import { App, Company, Config, Contact, Interaction, TemplateEmail, newCompany } from "./types";

export async function addCompany(database: DatabaseSession, company: Partial<Company>): Promise<Company | {error: string}> {

  if (!company.name) {
    console.error(`ERROR: incomplete data, name missing.`);
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
  const ret = newCompany(company as Company);
  await database.addCompany(ret);
  return ret;
}

export async function editCompany(database: DatabaseSession, name: string, attributes: Partial<Company>): Promise<Company | {error: string}> {
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
      ].sort((a, b) => a.date == b.date ? 0 : a.date > b.date ? 1 : -1)
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
    interactions: company.interactions.sort((a, b) => a.date == b.date ? 0 : a.date > b.date ? 1 : -1)
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

export async function addTemplate(database: DatabaseSession, template: TemplateEmail): Promise<TemplateEmail | { error: string }> {
  if (template.content && template.subject) {
    const config = await database.loadConfig();
    if (!config.templates) config.templates = [];
    config.templates.push(template);
    await database.updateConfig({templates: config.templates});
    return template;
  }
  else {
    return {error: 'incomplete data: subject or content is missing'};
  }
}

export async function addStaff(database: DatabaseSession, staff: StaffDefinition): Promise<{ [email: string]: string } | { error: string }> {
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

/**
 * Here are the available template fields.
 * 
 *  - {{EMAIL}} .............. Contact's raw email (example: user@example.com
 *  - {{FULL_EMAIL}} ......... Contact's full email (example: Jon Snow <jon.snow@example.com>)
 *  - {{FULL_NAME}} .......... Contact's full name (example: Henry Ford)
 *  - {{NAME}} ............... Alias to {{FULL_NAME}}
 *  - {{FIRST_NAME}} ......... Contact's first name
 *  - {{LAST_NAME}} .......... Contact's last name
 *  - {{FRIENDLY_NAME}} ...... Contact's first name, company name when unknown.
 *  - {{APP_NAME}} ........... The appName
 *  - {{APP_PLAN}} ........... The plan user's is registered to
 *  - {{REGISTRATION_AGO}} ... Time since registration (example: 2 days ago)
 *  - {{SUBSCRIPTION_AGO}} ... Time since subscription
 *  - {{COMPANY_AGO}} ........ Time since first contact with the company
 *  - {{COMPANY_NAME}} ....... Name of the company (its display name when set)
 *  - {{COMPANY_URL}} ........ Company's URL
 *  - {{COMPANY_ADDRESS}} .... Company's website
 */
/**
 * Replaces every occurrence of a tag with a value.
 *
 * Unlike String.replace with a string, "$&", "$1"... in the value are kept as-is.
 */
function replaceTag(content: string, tag: string, value: string): string {
    return content.split(tag).join(String(value));
}

export function renderTemplateText(content: string, elements: { app?: App, contact?: Contact, company?: Company }): string {
    const { app, contact, company } = elements;
    if (contact) {
        const defaultName = company?.displayName || company?.name || app?.appName || 'user';
        const friendlyName = contact.firstName || defaultName;
        const name = `${contact.firstName} ${contact.lastName}`.replace(/(^ )|( $)/g, '') || defaultName;
        content = replaceTag(content, '{{EMAIL}}', `${contact.email}`);
        content = replaceTag(content, '{{FULL_EMAIL}}', `"${name}" <${contact.email}>`);
        content = replaceTag(content, '{{FULL_NAME}}', name);
        content = replaceTag(content, '{{NAME}}', name);
        content = replaceTag(content, '{{FRIENDLY_NAME}}', friendlyName);
        content = replaceTag(content, '{{FIRST_NAME}}', contact.firstName || '');
        content = replaceTag(content, '{{LAST_NAME}}', contact.lastName || '');
    }
    if (app) {
        content = replaceTag(content, '{{APP_NAME}}', app.appName);
        content = replaceTag(content, '{{APP_PLAN}}', app.plan);
        content = replaceTag(content, '{{REGISTRATION_AGO}}', moment(new Date(app.createdAt)).fromNow());
        content = replaceTag(content, '{{SUBSCRIPTION_AGO}}', app.upgradedAt ? moment(new Date(app.upgradedAt)).fromNow() : '(never upgraded)');
    }
    if (company) {
        content = replaceTag(content, '{{COMPANY_AGO}}', company.createdAt ? moment(new Date(company.createdAt)).fromNow() : '(unknown)');
        content = replaceTag(content, '{{COMPANY_NAME}}', company.displayName || company.name);
        content = replaceTag(content, '{{COMPANY_URL}}', company.url || '');
        content = replaceTag(content, '{{COMPANY_ADDRESS}}', company.address || '');
    }
    return content;
}

/**
 * @param filter - Email, App Name or Company Name
 */
export async function findContactByFilter(database: DatabaseSession, filter: string): Promise<{app?: App; contact?: Contact; company?: Company }> {
    const app = (await database.findAppByName(filter)) || (await database.findAppByEmail(filter));

    // If any results are non-ambiguous
    if (app) {
        const contact = await database.findContactByEmail(app.app.email);
        return { app: app.app, contact: contact?.contact, company: app.company }
    }

    const contact = await database.findContactByEmail(filter);
    if (contact) {
        const company = contact.company;
        return { company, app: company?.apps[0], contact: contact.contact };
    }

    let company = await database.findCompanyByName(filter);
    if (company) {
        return {
            company,
            contact: company.contacts[0],
            app: company.apps[0],
        }
    }

    return {};
}

export function renderTemplateEmail(email: TemplateEmail, elements: { app?: App, contact?: Contact, company?: Company }): TemplateEmail {
  return {
    subject: renderTemplateText(email.subject, elements),
    content: renderTemplateText(email.content, elements),
  };
}

export async function renderTemplateEmailForContact(database: DatabaseSession, filter: string, email: TemplateEmail): Promise<TemplateEmail> {
  const elements = await findContactByFilter(database, filter);
  return renderTemplateEmail(email, elements);
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

  renderTemplateText,
}