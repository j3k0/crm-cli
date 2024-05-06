export type InteractionKind =
    | 'system'
    | 'email'
    | 'github'
    | 'contact-form'
    | 'phone'
    | 'real-life'
    | 'linkedin'
    | 'none'
;

export type Database = {
    companies: Company[];
    config: {
        subscriptionPlans: string[];
        staff: { [email: string]: string };
        interactions: {
            kinds: string[];
            tags: string[];
        },
    }
}

export interface CompanyAttributes {
    createdAt?: string;
    updatedAt?: string;
    name: string;
    address?: string;
    url: string;
    contacts: Contact[];
    apps: App[];
    interactions: Interaction[];
    noFollowUp?: boolean;
}

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

export interface App {
    appName: string;
    plan: string;
    email: string;
    createdAt: string;
    updatedAt: string;
    upgradedAt?: string;
    churnedAt?: string;
}

export interface Interaction {
    kind: InteractionKind;
    from: string;
    summary: string;
    date: string; // ISODate
    updatedAt?: string; // ISODate
    tag?: string;
    followUpDate?: string;
}

export class Company implements CompanyAttributes {

    createdAt?: string;
    updatedAt?: string;
    name: string;
    address?: string;
    url: string;
    contacts: Contact[];
    apps: App[];
    interactions: Interaction[];
    noFollowUp?: boolean;

    constructor(data: CompanyAttributes) {
        Object.assign(this, data);
        this.name = data.name;
        this.address = data.address;
        this.url = data.url;
        this.contacts = data.contacts;
        this.apps = data.apps;
        this.interactions = data.interactions;
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

export interface Printable {
    printAsText: () => void;
}

export interface PrintableArray<T> {
    content: T[];
    printAsText: () => void;
}

export interface Choice {
    message: string;
    value: string;
}
