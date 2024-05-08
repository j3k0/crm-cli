import { CrmClient, crmClient } from "../crmClient";
import { App, Company, CompanyAttributes, Config, Contact, Database } from "../types";
import { DatabaseSessionCache } from "./databaseSessionCache";
import { DatabaseAdapter, DatabaseSession } from "./types";

/**
 * Use a remote CRM API server
 */
export class RemoteDatabaseAdapter implements DatabaseAdapter {

  client: CrmClient;

  constructor(url: string) {
    this.client = crmClient(url);
  }

  async create(initialData: Database): Promise<void> {
    await this.client.resetDatabase(initialData);
  }

  async open(): Promise<DatabaseSession> {
    return new DatabaseSessionCache(new RemoteDatabaseSession(this.client));
  }
}

export class RemoteDatabaseSession implements DatabaseSession {

  client: CrmClient;

  constructor(client: CrmClient) {
    this.client = client;
  }

  async addCompany(company: CompanyAttributes): Promise<Company | { error: string; }> {
    return this.catchErrors(this.client.addCompany(company));
  }

  async close(): Promise<void> {}

  async dump(): Promise<Database> {
    console.log('> RemoteDatabase.dump');
    const ret = await this.client.dump();
    console.log('< RemoteDatabase.dump');
    return ret;
  }

  private async catch404<T, U>(call: Promise<T | undefined>, transform: (t: T) => Promise<U>): Promise<U | undefined> {
    try {
      const value = await call;
      if (!value) return;
      return await transform(value);
    }
    catch (err) {
      if ((err as any)?.response?.status === 404) {
        return undefined;
      }
      throw err;
    }
  }

  findAppByName(appName: string): Promise<{ company: Company; app: App; } | undefined> {
    return this.catch404(this.client.findAppByName(appName), async (app) => ({
      app, company: await this.companyOf(app) 
    }));
  }

  findAppByEmail(email: string): Promise<{ company: Company; app: App; } | undefined> {
    return this.catch404(this.client.findAppByEmail(email), async app => ({
      app, company: await this.companyOf(app),
    }));
  }

  findCompanyByName(name: string): Promise<Company | undefined> {
    return this.catch404(this.client.findCompany(name), async company => new Company(company));
  }

  findContactByEmail(email: string): Promise<{ company: Company; contact: Contact; } | undefined> {
    return this.catch404(this.client.findContactByEmail(email), async contact => ({
      contact, company: await this.companyOf(contact)
    }));
  }

  async loadConfig(): Promise<Config> {
    const config = await this.client.getConfig();
    if (!config) throw new Error('failed to load config (empty)');
    return config;
  }

  async searchCompanies(filter: string): Promise<Company[]> {
    return (await this.client.searchCompanies(filter))?.map(c => new Company(c)) || [];
  }

  updateCompany(name: string, attributes: Partial<CompanyAttributes>): Promise<Company | { error: string; }> {
    return this.catchErrors(this.client.updateCompany(name, attributes));
  }

  updateConfig(attributes: Partial<Config>): Promise<Config | { error: string; }> {
    return this.catchErrors(this.client.updateConfig(attributes));
  }

  /** Fetch the company from the "company" field, and delete that field */
  private async companyOf<T extends { company: string }>(value: T | undefined): Promise<Company> {
    if (value?.company) {
      const company = await this.client.findCompany(value?.company);
      delete (value as any)?.company;
      if (company) {
        return new Company(company);
      }
    }
    throw new Error('Company "' + (value?.company ?? '<NO VALUE>') + '" not found with');
  }

  private async catchErrors<T>(call: Promise<T | undefined>): Promise<T | { error: string }> {
    try {
      const ret = await call;
      if (!ret) return { error: 'object not found' };
      return ret;
    }
    catch (err) {
      return { error: (err as Error).message };
    }
  }
}