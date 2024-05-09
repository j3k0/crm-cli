import { connectCrmDatabase } from "../database";
import { about } from "../queries/about";
import { apps } from "../queries/apps";
import { companies } from "../queries/companies";
import { contacts } from "../queries/contacts";
import { followups } from "../queries/followups";
import { interactions } from "../queries/interactions";
import { addApp } from "./commands/addApp";
import { addCompany } from "./commands/addCompany";
import { addContact } from "./commands/addContact";
import { addInteraction } from "./commands/addInteraction";
import { doneInteraction } from "./commands/doneInteraction";
import { editApp } from "./commands/editApp";
import { editCompany } from "./commands/editCompany";
import { editContact } from "./commands/editContact";
import { editInteraction } from "./commands/editInteraction";
import { template, templateHelp } from "./commands/template";
import { serverRun } from "./commands/serverCommand";

module.exports = {
    // utils: {
    //     editData,
    //     editJson,
    //     editFile,
    // },
    data: {
        connectCrmDatabase: connectCrmDatabase,
    },
    interactions: {
        edit: editInteraction,
        add: addInteraction,
    //     find: findInteraction,
        query: interactions,
    //     tags: TAGS,
    //     kinds: KINDS,
    },
    companies: {
        edit: editCompany,
        add: addCompany,
    //     find: findCompany,
        query: companies,
    },
    apps: {
        edit: editApp,
        add: addApp,
    //     find: findApp,
        query: apps,
    },
    contacts: {
        edit: editContact,
        add: addContact,
    //     find: findContact,
        query: contacts,
    },
    followups: {
        done: doneInteraction,
        query: followups,
    },
    templates: {
        help: templateHelp,
        run: template,
    },
    server: {
        run: serverRun,
    },
    about,
};
