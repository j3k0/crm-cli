export interface TemplateEmail {
    subject: string;
    content: string;
}

export interface Config {
    subscriptionPlans: string[];
    staff: { [email: string]: string };
    interactions: {
        kinds: string[];
        tags: string[];
    };
    templates?: TemplateEmail[];
}

/**
 * A Company in the CRM database
 */
export interface Company {
    createdAt?: string;
    updatedAt?: string;
    name: string;
    address?: string;
    url?: string;
    contacts: Contact[];
    apps: App[];
    interactions: Interaction[];
    noFollowUp?: boolean;
}

/**
 * A contact in a company
 */
export interface Contact {
    firstName?: string;
    lastName?: string;
    role?: string;
    email: string;
    linkedin?: string;
    github?: string;
    url?: string;
    twitter?: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * One of the apps (project) with a company
 */
export interface App {
    appName: string;
    plan: string;
    email: string;
    createdAt: string;
    updatedAt: string;
    upgradedAt?: string;
    churnedAt?: string;
}

/**
 * An interaction with the company
 */
export interface Interaction {
    kind: string;
    from: string;
    to?: string;
    summary: string;
    date: string; // ISODate
    updatedAt?: string; // ISODate
    tag?: string;
    followUpDate?: string;
}

/**
 * Fills up required fields for a company
 */
export function newCompany(data: Partial<Company>): Company {
    const ret: Company = {
        name: 'Company',
        contacts: [],
        apps: [],
        interactions: [],
        ...data,
    };
    return ret;
}

export function hasInteraction(company: Company, summary: string) {
    const s = summary.toLowerCase();
    return company.interactions
        .filter((i) => i.summary.toLowerCase().indexOf(s) >= 0
            || (i.tag && i.tag.indexOf(s) >= 0))
        .length > 0;
}

export function companyEmail(company: Company) {
    const fromContact = company.contacts.reduce((acc, c) => {
        const name = `${c.firstName} ${c.lastName}`.replace(/(^ )|( $)/g, '');
        if (name)
            return `"${name}" <${c.email}>`;
        else if (c.email)
            return c.email;
        else
            return acc;
    }, '');
    if (fromContact) return fromContact;
    const fromApp = company.apps.reduce((acc, a) => {
        return a.email || acc;
    }, '');
    return fromApp;
}

/*
export class Company implements Company {

    createdAt?: string;
    updatedAt?: string;
    name: string;
    address?: string;
    url: string;
    contacts: Contact[];
    apps: App[];
    interactions: Interaction[];
    noFollowUp?: boolean;

    constructor(data: Company) {
        Object.assign(this, data);
        this.name = data.name;
        this.address = data.address;
        this.url = data.url;
        this.contacts = data.contacts || [];
        this.apps = data.apps || [];
        this.interactions = data.interactions || [];
        this.noFollowUp = data.noFollowUp;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    get email () {
        const fromContact = this.contacts.reduce((acc, c) => {
            const name = `${c.firstName} ${c.lastName}`.replace(/(^ )|( $)/g, '');
            if (name)
                return `"${name}" <${c.email}>`;
            else if (c.email)
                return c.email;
            else
                return acc;
        }, '');
        if (fromContact) return fromContact;
        const fromApp = this.apps.reduce((acc, a) => {
            return a.email || acc;
        }, '');
        return fromApp;
    }

    hasInteraction (summary: string) {
        const s = summary.toLowerCase();
        return this.interactions
            .filter((i) => i.summary.toLowerCase().indexOf(s) >= 0
                || (i.tag && i.tag.indexOf(s) >= 0))
            .length > 0;
    }
}
*/

export interface Printable {
    printAsText: () => Promise<void>;
}

export interface PrintableArray<T> {
    content: T[];
    printAsText: () => Promise<void>;
}

export interface Choice {
    message: string;
    value: string;
}

/**
 * Full content of the CRM database
 */
export interface Database {
    companies: Company[];
    config: Config;
}