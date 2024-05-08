import * as fs from 'fs';
import { App, Company, CompanyAttributes, Config, Contact, Database } from './types';
import { companies } from './queries/companies';

export type DataSelector = "all" | "config" | { company: string } | { appName: string };

/**
 * Typically a session is associated with a single operation / request
 */
export interface DatabaseSession {

    /** load the full content of the database */
    dump(): Promise<Database>;
    
    // companies
    addCompany(company: CompanyAttributes): Promise<Company | {error: string}>;
    updateCompany(name: string, attributes: Partial<CompanyAttributes>): Promise<Company | { error: string }>;
    
    // indices
    findCompanyByName(name: string): Promise<Company | undefined>;
    findAppByName(appName: string): Promise<{company: Company, app: App} | undefined>;
    findAppByEmail(email: string): Promise<{company: Company, app: App} | undefined>;
    findContactByEmail(email: string): Promise<{company: Company, contact: Contact} | undefined>;
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

export class InMemoryDatabaseSession implements DatabaseSession {

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
        // console.log("InMemoryDatabaseSession.close()");
        this.isModified = false;
    }
}

export class FileSystemDatabaseSession extends InMemoryDatabaseSession {

    path: string;
    autoCloseTimeout?: NodeJS.Timeout;

    constructor(database: Database, path: string) {
        super(database);
        this.path = path;
        this.autoCloseTimeout = setTimeout(() => {
            this.autoCloseTimeout = undefined;
            this.close();
        }, 10000); // auto-close after 10s
    }

    async close(): Promise<void> {
        // console.log("FileSystemDatabaseSession.close()");
        if (this.autoCloseTimeout) {
            clearTimeout(this.autoCloseTimeout);
            this.autoCloseTimeout = undefined;
        }
        if (this.isModified) {
            // console.log("FileSystemDatabaseSession.close() > save to disk");
            this.isModified = false;
            // first backup the file
            await fs.promises.copyFile(`${this.path}`, `${this.path}.bak`);
            // then save the new content
            await fs.promises.writeFile(this.path, JSON.stringify(this.database, null, 4), 'utf-8');
        }
    }
}

export class FileSystemDatabaseAdapter implements DatabaseAdapter {

    dataFullPath: string;

    constructor(dataFullPath: string) {
        this.dataFullPath = dataFullPath;
    }

    async open(): Promise<DatabaseSession> {
        try {
            const fileContent = await fs.promises.readFile(this.dataFullPath, 'utf8');
            const data = JSON.parse(fileContent);
            if (Array.isArray(data)) {
                // old format
                return new FileSystemDatabaseSession({
                    companies: data,
                    config: emptyDatabase().config,
                }, this.dataFullPath);
            }
            else {
                const loaded = data as Partial<Database>;
                if (!loaded.config) loaded.config = emptyDatabase().config;
                if (!loaded.config?.subscriptionPlans) loaded.config.subscriptionPlans = emptyDatabase().config.subscriptionPlans;
                if (!loaded.config?.staff) loaded.config.staff = {};
                if (!loaded.config?.interactions) loaded.config.interactions = emptyDatabase().config.interactions;
                return new FileSystemDatabaseSession(data as Database, this.dataFullPath);
            }
        }
        catch (err) {
            if (err instanceof Error) {
                console.error(`ERROR #${err.name}: ${err.message}.`);
            }
            console.error(`Run "crm init-crm" and I'll create it for you.`);
            throw err;
        }
    }

    async create(data: Database): Promise<void> {
        await fs.promises.writeFile(this.dataFullPath, JSON.stringify(data, null, 4), 'utf-8');
    }
}

export type DatabaseConnectOptions = {
    type: "filesystem";
    dataDir?: string;
    dataFile?: string;
}

export async function connectDatabase(options?: DatabaseConnectOptions): Promise<DatabaseAdapter> {
    if (!options) options = {
        type: "filesystem",
        dataDir: process.env.DATA_DIR || process.cwd(),
        dataFile: process.env.DATA_FILE || 'crm.json',
    }
    options = {
        dataDir: process.env.DATA_DIR || process.cwd(),
        dataFile: process.env.DATA_FILE || 'crm.json',
        ...options,
    }
    const dataFullPath = `${options.dataDir}/${options.dataFile}`;
    return new FileSystemDatabaseAdapter(dataFullPath);
}

/**
 * Generate an empty database
 */
export function emptyDatabase(): Database {
    return {
        companies: [],
        config: {
            staff: {},
            subscriptionPlans: ['free', 'silver', 'gold'],
            interactions: {
                kinds: ['email', 'github', 'contact-form', 'phone', 'real-life', 'linkedin', 'none'],
                tags: ['registration', 'subscription', 'bug', 'question'],
            }
        }
    }
}

export default {
    connectDatabase,
}