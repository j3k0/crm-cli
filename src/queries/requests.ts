import Fuse from "fuse.js";
import { App, CompanyAttributes, Contact, Database } from "../types";

// Requests
export const allContacts = (data: Database) =>
    data.companies.reduce((acc: Contact[], company: CompanyAttributes) => {
        company.contacts.forEach((contact: Contact) => acc.push(contact));
        return acc;
     }, [] as Contact[]);

export const allApps = (data: Database) =>
    data.companies.reduce(function (acc, company) {
        company.apps.forEach((app) => acc.push(app));
        return acc;
    }, [] as App[]);

function fuseFind<T> (keys: (keyof T)[], data: readonly T[], search?: string): T | undefined {
    if (!search) return;
    return (new Fuse(data,
        {
            matchAllTokens: true,
            threshold: 0.1,
            location: 0,
            distance: 100,
            findAllMatches: true,
            // limit: 1,
            keys,
        }))
        .search(search)[0];
}

export const findContact = (data: Database, search: string | undefined) =>
    fuseFind(['firstName', 'lastName', 'email'], allContacts(data), search);

export const findCompany = (data: Database, search: string | undefined) =>
    fuseFind(['name'], data.companies, search);

export const findApp = (data: Database, search: string | undefined) =>
    fuseFind(['appName', 'email'], allApps(data), search);

export const findInteraction = (data: Database, indexAsString: string) => {
    const index = parseInt(indexAsString) | 0;
    let id = 1;
    for (const company of data.companies)
        for (const interaction of company.interactions)
            if (id++ === index)
                return interaction;
};