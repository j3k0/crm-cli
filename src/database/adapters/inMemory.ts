import { companies } from "../../queries/companies";
import { App, Company, CompanyAttributes, Config, Contact, Database } from "../../types";
import { emptyDatabase } from "../emptyDatabase";
import { DatabaseAdapter, DatabaseSession } from "../types";

/** Non persistent database adapter where data is stored in memory */
export class InMemoryAdapter implements DatabaseAdapter {

  database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  async create(initialData: Database): Promise<void> {
    this.database = emptyDatabase();
  }

  async open(): Promise<DatabaseSession> {
    return new InMemorySession(this.database);
  }
}


export class InMemorySession implements DatabaseSession {

  database: Database;
  isModified: boolean;

  constructor(database: Database) {
      this.database = database;
      this.isModified = false;
  }

  async dump(): Promise<Database> {
      return this.database;
  }

  async findCompanyByName(name: string): Promise<Company | undefined> {
      return this.database.companies.find((c) => c.name.toLowerCase() === name.toLowerCase());
  }

  async searchCompanies(filter: string): Promise<Company[]> {
      return (await companies(this, filter)).content;
  }

  async addCompany(companyAttributes: CompanyAttributes): Promise<Company | { error: string }> {
      if (!this.findCompanyByName(companyAttributes.name)) {
          this.isModified = true;
          const company = new Company(companyAttributes);
          this.database.companies.push(company);
          return company;
      }
      else {
          return {error: 'company already exists'};
      }
  }

  async updateCompany(name: string, attributes: Partial<CompanyAttributes>): Promise<Company | { error: string; }> {
      const company = await this.findCompanyByName(name);
      if (!company) {
          return { error: 'company not found' };
      }
      if (attributes.name !== undefined && attributes.name !== name) {
          return { error: 'incorrect body name' };
      }
      this.isModified = true;
      Object.assign(company, {
          ...attributes,
          updatedAt: new Date().toISOString(),
      });
      return company;
  }

  async findAppByName(appName: string): Promise<{ company: Company; app: App; } | undefined> {
      if (!appName) return;
      appName = appName.toLowerCase();
      return this.database.companies.reduce((result, company) => {
          if (result) return result; // found already
          const app = company.apps.find(app => app.appName?.toLowerCase() === appName);
          if (app) return { app, company };
      }, undefined as ({ company: Company; app: App; } | undefined));
  }

  async findAppByEmail(email: string): Promise<{ company: Company; app: App; } | undefined> {
      if (!email) return;
      email = email.toLowerCase();
      return this.database.companies.reduce((result, company) => {
          if (result) return result; // found already
          const app = company.apps.find(app => app.email?.toLowerCase() === email);
          if (app) return { app, company };
      }, undefined as ({ company: Company; app: App; } | undefined));
  }

  async findContactByEmail(email: string): Promise<{ company: Company; contact: Contact; } | undefined> {
      if (!email) return;
      email = email.toLowerCase();
      return this.database.companies.reduce((result, company) => {
          if (result) return result; // found already
          const contact = company.contacts.find(contact => contact.email?.toLowerCase() === email);
          if (contact) return { contact, company };
      }, undefined as ({ company: Company; contact: Contact; } | undefined));
  }

  async loadConfig(): Promise<Config> {
      return this.database.config;
  }

  async updateConfig(attributes: Partial<Config>): Promise<Config | { error: string }> {
      this.isModified = true;
      Object.assign(this.database.config, attributes);
      return this.database.config;
  }

  async close(): Promise<void> {
      this.isModified = false;
  }
}