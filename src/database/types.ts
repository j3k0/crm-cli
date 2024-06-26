import { App, Company, Config, Contact, Database, Interaction } from "../types";

/**
 * Typically a session is associated with a single operation / request
 */
export interface DatabaseSession {

  /** load the full content of the database */
  dump(): Promise<Database>;
  
  // companies
  addCompany(company: Company): Promise<Company | {error: string}>;
  updateCompany(name: string, attributes: Partial<Company>): Promise<Company | { error: string }>;
  
  // indices
  findCompanyByName(name: string): Promise<Company | undefined>;
  findAppByName(appName: string): Promise<{company: Company, app: App} | undefined>;
  findAppByEmail(email: string): Promise<{company: Company, app: App} | undefined>;
  findContactByEmail(email: string): Promise<{company: Company, contact: Contact} | undefined>;
  /** find all followup due within a given date range */
  findFollowups(startDate: string, endDate: string): Promise<(Interaction & { company: string })[]>;
  /** find all interactions within a given date range */
  findInteractions(startDate: string, endDate: string): Promise<(Interaction & { company: string })[]>;
  searchCompanies(filter: string): Promise<Company[]>;

  // configuration
  loadConfig(): Promise<Config>;
  updateConfig(attributes: Partial<Config>): Promise<Config | { error: string }>;

  close(): Promise<void>;
}

export interface DatabaseAdapter {

  create(initialData: Database): Promise<void>;

  /**
   * Open a session, data will be cached for the duration of a session.
   * 
   * Typically a session is associated with a single operation / request
   */
  open(): Promise<DatabaseSession>;
}
