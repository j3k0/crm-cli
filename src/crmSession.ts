import { connectCrmDatabase } from "./database";
import { DatabaseAdapter, DatabaseSession } from "./database/types";
import { StaffDefinition, addApp, addCompany, addContact, addInteraction, addStaff, addTemplate, editApp, editCompany, editConfig, editContact, editInteraction } from "./lib";
import { App, Company, CompanyAttributes, Config, Contact, Database, Interaction, TemplateEmail } from "./types";

export class CrmSession implements DatabaseSession {

  databaseAdapter: DatabaseAdapter;
  databaseSession?: DatabaseSession;

  constructor(database: DatabaseAdapter) {
    this.databaseAdapter = database;
  }

  async close() {
    if (this.databaseSession) {
      await this.databaseSession.close();
      this.databaseSession = undefined;
    }
  }

  async database(): Promise<DatabaseSession> {
    if (!this.databaseSession)
      this.databaseSession = await this.databaseAdapter.open();
    return this.databaseSession;
  }

  async addCompany(company: Partial<CompanyAttributes>): Promise<Company | { error: string }> {
    return await addCompany(await this.database(), company);
  }

  async addApp(app: Partial<App & { company?: string | undefined; }>): Promise<App | { error: string }> {
    return await addApp(await this.database(), app);
  }

  async addContact(attributes: Partial<Contact & { company?: string | undefined; }>): Promise<Contact | { error: string }> {
    return await addContact(await this.database(), attributes);
  }

  async addInteraction(interaction: Interaction & { company: string; }): Promise<Interaction | { error: string }> {
    return await addInteraction(await this.database(), interaction);
  }

  async addStaff(staff: StaffDefinition): Promise<{ [email: string]: string } | { error: string }> {
    return await addStaff(await this.database(), staff);
  }

  async addTemplate(template: TemplateEmail): Promise<TemplateEmail | { error: string }> {
    return await addTemplate(await this.database(), template);
  }

  async updateConfig(attributes: Partial<Config>) {
    return await editConfig(await this.database(), attributes);
  }

  async updateApp(appName: string, attributes: Partial<App>): Promise<App | { error: string }> {
    return await editApp(await this.database(), appName, attributes);
  }

  async updateCompany(name: string, attributes: Partial<CompanyAttributes>): Promise<Company | { error: string }> {
    return await editCompany(await this.database(), name, attributes);
  }

  async updateContact(email: string, attributes: Partial<Contact>): Promise<Contact | { error: string }> {
    return await editContact(await this.database(), email, attributes);
  }

  async updateInteraction(companyName: string, index: number, attributes: Partial<Interaction>): Promise<Interaction | { error: string }> {
    return await editInteraction(await this.database(), companyName, index, attributes);
  }

  async dump(): Promise<Database> {
      return (await this.database()).dump();
  }

  async findAppByEmail(email: string): Promise<{ company: Company; app: App; } | undefined> {
      return await (await this.database()).findAppByEmail(email);
  }

  async findAppByName(appName: string): Promise<{ company: Company; app: App; } | undefined> {
    return await (await this.database()).findAppByName(appName);
  }

  async findCompanyByName(name: string): Promise<Company | undefined> {
    return await (await this.database()).findCompanyByName(name);
  }

  async findContactByEmail(email: string): Promise<{ company: Company; contact: Contact; } | undefined> {
      return await (await this.database()).findContactByEmail(email);
  }

  async findFollowups(startDate: string, endDate: string): Promise<(Interaction & { company: string; })[]> {
    return await (await this.database()).findFollowups(startDate, endDate);
  }

  async searchCompanies(filter: string): Promise<Company[]> {
    return await (await this.database()).searchCompanies(filter);
  }

  async loadConfig(): Promise<Config> {
    return await (await this.database()).loadConfig();
  }
}

/**
 * Keep a reference to the created database adapters.
 * 
 * The process of connecting to a database should sometime
 * not be repeated for each session (depending on the adapter).
 * 
 * This allows keeping connections open.
 */
const databasePool: {[url: string]: DatabaseAdapter} = {}

/**
 * Open a new CRM Session.
 * 
 * This should be short lived (as loaded data will be cached for the duration of the session).
 */
export async function crmSession(url?: string) {
  const poolKey = url ?? '$';
  let adapter = databasePool[poolKey];
  if (!adapter) {
    adapter = databasePool[poolKey] = await connectCrmDatabase(url);
  }
  return new CrmSession(adapter);
}