import Fuse from "fuse.js";
import { App, Company, CompanyAttributes, Contact, Database, Interaction } from "../types";

export interface CompanyContact {
    contact: Contact;
    company: Company;
    firstName: Contact["firstName"];
    lastName: Contact["lastName"];
    email: Contact["email"];
}
export interface CompanyApp {
    app: App;
    company: Company;
    appName: App["appName"];
    email: App["email"];
}

export interface CompanyInteraction {
    interaction: Interaction;
    company: Company;
}

// Requests
export const allContacts = (data: Database): CompanyContact[] =>
    data.companies.reduce((acc, company: Company) => {
        company.contacts.forEach((contact: Contact) => acc.push({
            contact,
            company,
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
        }));
        return acc;
     }, [] as CompanyContact[]);

export const allApps = (data: Database) =>
    data.companies.reduce(function (acc, company) {
        company.apps.forEach((app) => acc.push({
            app,
            company,
            email: app.email,
            appName: app.appName,
        }));
        return acc;
    }, [] as CompanyApp[]);

function fuseFind<T> (keys: (keyof T)[], data: readonly T[], search?: string): T | undefined {
    if (!search) return;
    const searchResults = (new Fuse(data,
        {
            matchAllTokens: true,
            threshold: 0.1,
            location: 0,
            distance: 100,
            findAllMatches: true,
            // limit: 1,
            keys,
        }))
        .search(search);
    // find exact match
    for (const result of searchResults) {
        if (result[keys[0]] === search) return result;
    }
    // no exact match, return first match
    return searchResults[0];
}

export const findContact = (data: Database, search: string | undefined): { contact: Contact, company: Company } | undefined =>
    fuseFind(['email', 'firstName', 'lastName'], allContacts(data), search);

export const findCompany = (data: Database, search: string | undefined) =>
    fuseFind(['name'], data.companies, search);

export const findCompanyByName = (data: Database, companyName: string | undefined): Company | undefined =>
    data.companies.find(value => value.name === companyName);

export const findApp = (data: Database, search: string | undefined): { app: App, company: Company } | undefined =>
    fuseFind(['appName', 'email'], allApps(data), search);

export const findAppByName = (data: Database, appName: string | undefined): { app: App, company: Company } | undefined =>
    allApps(data).find(value => value.appName === appName);

export const findInteraction = (data: Database, indexAsString: string): { interaction: Interaction, company: Company } | undefined => {
    const index = parseInt(indexAsString) | 0;
    let id = 1;
    for (const company of data.companies)
        for (const interaction of company.interactions)
            if (id++ === index)
                return {company, interaction};
};