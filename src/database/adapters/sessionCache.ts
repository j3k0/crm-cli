import { App, Company, CompanyAttributes, Config, Contact, Database } from "../../types";
import { emptyDatabase } from "../emptyDatabase";
import { InMemorySession } from "./inMemory";
import { DatabaseSession } from "../types";

export class DatabaseSessionCache implements DatabaseSession {

  session: DatabaseSession;
  config?: Config;
  companies: Company[];
  memory: InMemorySession;

  /** True if the cache is complete with all data from the database */
  isDump: boolean;

  constructor(session: DatabaseSession) {
    this.isDump = false;
    this.session = session;
    this.companies = [];

    // Used for querying the cache
    this.memory = new InMemorySession(emptyDatabase());
  }

  private updateMemory():InMemorySession {
    this.memory.database.companies = this.companies || [];
    return this.memory;
  }

  private clearCache() {
    this.isDump = false;
    this.companies = [];
  }

  addCompany(company: CompanyAttributes): Promise<Company | { error: string; }> {
    this.clearCache();
    return this.session.addCompany(company);
  }

  async close(): Promise<void> {
      this.isDump = false;
      this.config = undefined;
      this.companies = [];
      this.session.close();
  }

  dumpPromise: Promise<Database> | undefined;
  async dump(): Promise<Database> {
    if (this.dumpPromise) return this.dumpPromise;
    if (this.isDump && this.config && this.companies) {
      return { config: this.config, companies: this.companies }
    }
    this.dumpPromise = this.session.dump();
    const dump = await this.dumpPromise;
    this.dumpPromise = undefined;
    this.config = dump.config;
    this.companies = dump.companies;
    this.isDump = true;
    return dump;
  }

  private cacheCompanyChild<T extends {company: Company}>(hasCompany: T | undefined): T | undefined {
    if (hasCompany?.company) {
      // cache it if not already cached
      if (!this.companies.find(c => c.name === hasCompany.company.name)) {
        this.companies.push(hasCompany.company);
      }
    }
    return hasCompany;
  }

  private cacheCompany(company: Company | undefined): Company | undefined {
    if (company) {
      // cache it if not already cached
      if (!this.companies.find(c => c.name === company.name)) {
        this.companies.push(company);
      }
    }
    return company;
  }

  async findAppByEmail(email: string): Promise<{ company: Company; app: App; } | undefined> {
    return await this.updateMemory().findAppByEmail(email)
      || this.cacheCompanyChild(await this.session.findAppByEmail(email));
  }

  async findAppByName(appName: string): Promise<{ company: Company; app: App; } | undefined> {
    return await this.updateMemory().findAppByName(appName)
      || this.cacheCompanyChild(await this.session.findAppByName(appName));
  }

  async findCompanyByName(name: string): Promise<Company | undefined> {
    return await this.updateMemory().findCompanyByName(name)
      || this.cacheCompany(await this.session.findCompanyByName(name));
  }

  async findFollowups(startDate: string, endDate: string) {
    return this.isDump
      ? await this.updateMemory().findFollowups(startDate, endDate)
      : await this.session.findFollowups(startDate, endDate);
  }

  async findInteractions(startDate: string, endDate: string) {
    return this.isDump
      ? await this.updateMemory().findInteractions(startDate, endDate)
      : await this.session.findInteractions(startDate, endDate);
  }

  async findContactByEmail(email: string): Promise<{ company: Company; contact: Contact; } | undefined> {
    return await this.updateMemory().findContactByEmail(email)
      || this.cacheCompanyChild(await this.session.findContactByEmail(email));
  }

  async loadConfig(): Promise<Config> {
    if (this.config) return this.config;
    this.config = await this.session.loadConfig();
    return this.config;
  }
  
  searchCompanies(filter: string): Promise<Company[]> {
    return this.session.searchCompanies(filter);
  }

  async updateCompany(name: string, attributes: Partial<CompanyAttributes>): Promise<Company | { error: string; }> {
    let company = await this.findCompanyByName(name);
    if (!company) { // this company doesn't exists
      return { error: 'company not found' };
    }
    this.clearCache();
    return this.session.updateCompany(name, this.merge(attributes, company));
  }

  async updateConfig(attributes: Partial<Config>): Promise<Config | { error: string; }> {
    let cache = this.config;
    if (!cache) cache = await this.session.loadConfig();
    this.config = undefined;
    this.isDump = false;
    const result = await this.session.updateConfig(this.merge(attributes, cache));
    if ('error' in result) return result;
    this.config = result;
    return result;
  }

  private merge<T>(t: Partial<T>, cache: T): T;
  private merge<T>(t: Partial<T>, cache: undefined): undefined;
  private merge<T>(t: Partial<T>, cache: T | undefined): T | undefined {
    if (!cache) return;
    const ret:T = {
      ...cache,
      ...t
    }
    return ret;
  }
}
