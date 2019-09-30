const fs = require('fs');
const dataDir = process.cwd(); // 'data';
const dataFile = 'crm.json';
const Table = require('cli-table');
const Fuse = require('fuse.js');
const moment = require('moment');
const enquirer = require('enquirer');
const tmp = require('tmp');
tmp.setGracefulCleanup();

const STAFF = {'hoelt@fovea.cc': 'jc'};
const KINDS = ['email', 'github', 'contact-form', 'phone', 'real-life', 'linkedin', 'none'];
const TAGS = ['registration', 'subscription', 'bug', 'question'];

//
//
//

const spawn = require('child_process').spawn;

function editFile (file) {
    return new Promise((resolve, reject) => {
        const ed = /^win/.test(process.platform) ? 'notepad' : 'vim';
        const editor = process.env.VISUAL || process.env.EDITOR || ed;
        const args = editor.split(/\s+/);
        const bin = args.shift();
        const ps = spawn(bin, args.concat([file]), { stdio: 'inherit' });
        ps.on('exit', (exitCode, signal) => {
            resolve({exitCode, signal});
        });
        ps.on('error', (err) => {
            reject(err.code === 'ENOENT' ? 127 : 1);
        });
    });
}

async function editData (data) {
    const tmpobj = tmp.fileSync({prefix: 'crm-', postfix: '.json'});
    // write to file
    fs.writeFileSync(tmpobj.name, data);
    const ret = await editFile(tmpobj.name);
    const content = fs.readFileSync(tmpobj.fd, {encoding: 'utf-8'});
    tmpobj.removeCallback();
    if (content === data)
        throw 'Canceled. Content didn\'t change.';
    return content;
}

async function editJson (data) {
    let ret = await editData(JSON.stringify(data, null, 4));
    while (true) {
        try {
            return JSON.parse(ret);
        }
        catch (e) {
            const action = await enquirer.prompt({
                type: 'autocomplete',
                name: 'value',
                message: 'Invalid JSON: ' + e.message,
                choices: [{
                    message: 'Keep Editing',
                    value: 'edit'
                }, {
                    message: 'Cancel',
                    value: 'cancel'
                }],
            });
            if (!action || action.value !== 'edit') {
                console.log('Canceled');
                process.exit(1);
            }
            ret = await editData(ret);
        }
    }
}

//
//
//

const defaultTableOptions = process.env.CSV ? {
    chars: {
        'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': '',
        'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': '',
        'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': '',
        'right': '' , 'right-mid': '' ,
        'middle': ','
    },
    style: {
        'padding-left': 0,
        'padding-right': 0,
        border: [], head: [], compact: true
    }
} : {
    chars: {'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''}
};

const tableToString = (table) => {
    if (process.env.CSV)
        return table.toString().replace(/ +/g, ' ').replace(/ ,/g, ',');
    else
        return table.toString();
}

const fieldToText = (object, field) =>
    ['date', 'created', 'upgraded', 'churned', 'followup'].indexOf(field) >= 0
        ? (object[field] && moment(new Date(object[field])).fromNow() || '')
        : field === 'from'
        ? STAFF[object.from] || object.from.split(/[@.]/)[0]
        : (object[field] || '');

// const loadData = () =>
//     fs.readdirSync(dataDir).map((file) => require('./' + dataDir + '/' + file));

const loadDataSync = () => {
    if (fs.existsSync(`${dataDir}/${dataFile}`))
        return require(`${dataDir}/${dataFile}`);
    else {
        console.error(`ERROR: File ${dataDir}/${dataFile} not found.`);
        console.error(`Run "crm init-crm" and I'll create it for you.`);
        process.exit(1);
    }
};
const saveDataSync = (data) => {
    fs.copyFileSync(`${dataDir}/${dataFile}`, `${dataDir}/${dataFile}.bak`);
    fs.writeFileSync(`${dataDir}/${dataFile}`, JSON.stringify(data, null, 4));
};
const initDataSync = () => {
    fs.writeFileSync(`${dataDir}/${dataFile}`, JSON.stringify([], null, 4));
};

// Requests
const allContacts = (data) =>
    data.reduce((acc, company) => company.contacts.reduce((acc, contact) =>
        acc.push(contact) && acc, acc), []);
const allApps = (data) =>
    data.reduce((acc, company) => company.apps.reduce((acc, app) =>
        acc.push(app) && acc, acc), []);

const fuseFind = (keys, data, search) =>
    (new Fuse(data,
        Object.assign({
            matchAllTokens: true,
            threshold: 0.1,
            location: 0,
            distance: 100,
            findAllMatches: true,
            limit: 1,
        }, {keys})))
        .search(search)[0];

const findContact = (data, search) =>
    fuseFind(['firstName', 'lastName', 'email'], allContacts(data), search);

const findCompany = (data, search) =>
    fuseFind(['name'], data, search);

const findApp = (data, search) =>
    fuseFind(['appName', 'email'], allApps(data), search);

const findInteraction = (data, index) => {
    index = index|0;
    let id = 1;
    for (const company of data)
        for (const interaction of company.interactions)
            if (id++ === index)
                return interaction;
    return null;
};

// Reports
const companies = (data, filter, delColumns) => {
    const columns = ['name', 'url', 'address'];
    const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
    let out = data.map(x => x);
    if (filter) {
        const fuse = new Fuse(out, {
            keys: columns,
            matchAllTokens: true,
            threshold: 0.1,
            location: 0,
            distance: 100,
            findAllMatches: true,
        });
        out = fuse.search(filter);
    }
    out.printAsText = () => {
        const table = new Table(Object.assign(
            {head: displayColumns},
            defaultTableOptions));
        out.forEach((company) =>
            table.push(displayColumns.map(cname => fieldToText(company, cname))));
        console.log(tableToString(table));
    };
    return out;
};

const about = (data, filter, delColumns) => {
    let out = [];
    const columns = ['company', 'role', 'email'];
    const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
    data.forEach((company) => {
        company.contacts.forEach((c) => {
            const name = `${c.firstName} ${c.lastName}`.replace(/(^ )|( $)/g, '');
            out.push({
                company: company.name,
                role: c.role,
                email: name ? `"${name}" <${c.email}>` : c.email,
            });
        });
    });
    if (filter) {
        const fuse = new Fuse(out, {
            keys: ['company', 'email'],
            matchAllTokens: true,
            threshold: 0.1,
            location: 0,
            distance: 500,
            findAllMatches: true,
        });
        out = fuse.search(filter);
    }

    out.printAsText = () => {

        const table = new Table( Object.assign(
            {head: displayColumns},
            defaultTableOptions));
        const companies = {};
        out.forEach((line) => {
            companies[line.company] = true;
            table.push(displayColumns.map(cname => fieldToText(line, cname)));
        });
        console.log('\nContacts:');
        console.log(tableToString(table));
        Object.keys(companies).forEach((company) => {
            console.log(`\nApps from ${company}:`);
            apps(data, company, ['company']).printAsText();
            console.log(`\nInteractions with ${company}:`);
            interactions(data, company, ['company']).printAsText();
        });
    };
    return out;
};


const contacts = (data, filter, delColumns) => {
    let out = [];
    const columns = ['company', 'role', 'email'];
    const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
    data.forEach((company) => {
        company.contacts.forEach((c) => {
            const name = `${c.firstName} ${c.lastName}`.replace(/(^ )|( $)/g, '');
            out.push({
                company: company.name,
                role: c.role,
                email: name ? `"${name}" <${c.email}>` : c.email,
                rawEmail: c.email,
            });
        });
    });
    if (filter) {
        const fuse = new Fuse(out, {
            keys: ['company', 'email'],
            matchAllTokens: true,
            threshold: 0.1,
            location: 0,
            distance: 500,
            findAllMatches: true,
        });
        out = fuse.search(filter);
    }

    out.printAsText = () => {
        const table = new Table( Object.assign(
            {head: displayColumns},
            defaultTableOptions));
        out.forEach((line) =>
            table.push(displayColumns.map(cname => fieldToText(line, cname))));
        console.log(tableToString(table));
    };
    return out;
};

const apps = (data, filter, delColumns) => {
    let out = [];
    const columns = ['company', 'plan', 'created', 'upgraded', 'churned', 'name', 'email'];
    const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
    data.forEach((company) => {
        company.apps.forEach((app) => {
            out.push({
                company: company.name,
                created: app.createdAt,
                upgraded: app.upgradedAt,
                churned: app.churnedAt,
                email: app.email,
                name: app.appName,
                plan: app.plan,
            });
        });
    });
    if (filter) {
        const fuse = new Fuse(out, {
            keys: columns,
            matchAllTokens: true,
            threshold: 0.1,
            location: 0,
            distance: 100,
            findAllMatches: true,
        });
        out = fuse.search(filter);
    }
    out = out.sort((a, b) => (+new Date(a.date)) - (+new Date(b.date)));

    out.printAsText = () => {
        const table = new Table( Object.assign(
            {head: displayColumns},
            defaultTableOptions));
        out.forEach((line) =>
            table.push(displayColumns.map(cname => fieldToText(line, cname))));
        console.log(tableToString(table));
    };
    return out;
};

class Company {
    constructor (data) {
        Object.assign(this, data);
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

    hasInteraction (summary) {
        const s = summary.toLowerCase();
        return this.interactions
            .filter((i) => i.summary.toLowerCase().indexOf(s) >= 0
                || (i.tag && i.tag.indexOf(s) >= 0))
            .length > 0;
    }
}

const followups = (data, filter, delColumns) => {
    let out = [];
    const columns = ['id', 'company', 'date', 'tag', 'summary', 'email'];
    const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
    let id = 1;
    data.forEach((companyData) => {
        const company = new Company(companyData);
        if (company.noFollowUp) return;
        // Follow-up 3 days after registration
        if (!company.hasInteraction('registration') && !company.hasInteraction('subscription')) {
            company.apps.forEach((app) => {
                out.push({
                    company: company.name,
                    email: company.email,
                    tag: 'R+3d',
                    summary: '3d after registration',
                    date: moment(new Date(app.createdAt)).add(3, 'days').format()
                });
            });
        }
        // Follow-up after subscription
        /*
        if (!company.hasInteraction('subscription')) {
            company.apps.forEach((app) => {
                if (app.upgradedAt) {
                    out.push({
                        company: company.name,
                        email: company.email,
                        tag: 'S+4w',
                        summary: '4 weeks after subscription',
                        date: moment(new Date(app.upgradedAt)).add(4, 'weeks').format()
                    });
                }
            });
        }
        */
        company.interactions.map((i) => ({
            id: id++,
            company: company.name,
            email: company.email,
            tag: i.tag,
            summary: i.summary,
            date: i.followUpDate
        })).filter((i) => i.date).forEach((i) => out.push(i));
    });
    if (filter) {
        const fuse = new Fuse(out, {
            keys: columns,
            matchAllTokens: true,
            threshold: 0.1,
            location: 0,
            distance: 100,
            findAllMatches: true,
        });
        out = fuse.search(filter);
    }
    // Ignore bots
    out = out.filter((i) => i.company.indexOf('[BOT]') < 0);
    // Only keep what's due in less than 3 days
    out = out.filter((i) => ((+new Date(i.date) - 3 * 24 * 3600000) - (+new Date()) < 0));
    out = out.sort((a, b) => (+new Date(b.date)) - (+new Date(a.date)));
    out.printAsText = () => {
        const table = new Table( Object.assign(
            {head: displayColumns},
            defaultTableOptions));
        out.forEach((line) =>
            table.push(displayColumns.map(cname => fieldToText(line, cname))));
        console.log(tableToString(table));
    };
    return out;
};

const interactionId = (companyName, date, summary) =>
    md5(`${companyName}:${date}:${summary}`).slice(0, 4);

const interactions = (data, filter, delColumns) => {
    let out = [];
    const columns = ['id', 'company', 'kind', 'date', 'from', 'summary', 'followup'];
    const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
    let id = 1;
    function pushWithId(data) {
        data.id = id++; // interactionId(data.company, data.date, 'registration');
        out.push(data);
    }
    data.forEach((company) => {
        company.apps.forEach((app) => {
            out.push({
                company: company.name,
                kind: 'system',
                date: app.createdAt || '',
                from: app.email,
                summary: `Registered ${app.appName}`,
                followup: '',
            });
            if (app.upgradedAt) {
                out.push({
                    company: company.name,
                    kind: 'system',
                    date: app.upgradedAt || '',
                    from: app.email,
                    summary: `Upgraded ${app.appName} to ${app.plan}`,
                    followup: '',
                });
            }
            if (app.churnedAt) {
                out.push({
                    company: company.name,
                    kind: 'system',
                    date: app.churnedAt || '',
                    from: app.email,
                    summary: `Churned ${app.appName}`,
                    followup: '',
                });
            }
        });
        company.interactions.forEach((interaction) => {
            pushWithId({
                company: company.name,
                kind: interaction.kind || '',
                date: interaction.date || '',
                from: interaction.from,
                summary: interaction.summary.replace(/([.?!]) /g, '$1\n'),
                followup: interaction.followUpDate || '',
            });
        });
    });
    if (filter) {
        const fuse = new Fuse(out, {
            keys: columns,
            matchAllTokens: true,
            threshold: 0.1,
            location: 0,
            distance: 100,
            findAllMatches: true,
        });
        out = fuse.search(filter);
    }
    out = out.sort((a, b) => (+new Date(a.date)) - (+new Date(b.date)));

    out.printAsText = () => {
        const table = new Table( Object.assign(
            {head: displayColumns},
            defaultTableOptions));
        out.forEach((line) =>
            table.push(displayColumns.map(cname => fieldToText(line, cname))));
        console.log(tableToString(table));
    };
    return out;
};

const templateHelp = async (data, arg) => {
    return { printAsText: () => console.log(`
Here are the available template fields.

{{EMAIL}} .............. Contact's raw email (example: user@example.com
{{FULL_EMAIL}} ......... Contact's full email (example: Jon Snow <jon.snow@example.com>)
{{FULL_NAME}} .......... Contact's full name (example: Henry Ford)
{{NAME}} ............... Alias to {{FULL_NAME}}
{{FIRST_NAME}} ......... Contact's first name
{{LAST_NAME}} .......... Contact's last name
{{FRIENDLY_NAME}} ...... Contact's first name, company name when unknown.
{{APP_NAME}} ........... The appName
{{APP_PLAN}} ........... The plan user's is registered to
{{REGISTRATION_AGO}} ... Time since registration (example: 2 days ago)
{{SUBSCRIPTION_AGO}} ... Time since subscription
{{COMPANY_AGO}} ........ Time since first contact with the company
{{COMPANY_NAME}} ....... Name of the company
{{COMPANY_URL}} ........ Company's URL
{{COMPANY_ADDRESS}} .... Company's website
    `) };
};

const template = async (data, arg) => {
    const [fileName, ...filterArray] = arg.split(' ');
    const filter = filterArray.join(' ');
    if (!fileName || !filter)
        throw 'Usage: crm template <TEMPLATE_FILE> <filter>'
    if (!fs.existsSync(fileName))
        throw `ERROR: ${fileName} does not exists.`;
    let content = fs.readFileSync(fileName, {encoding:'utf-8'});

    let app = apps(data, filter);
    let contact = contacts(data, filter);
    let company = companies(data, filter);

    // If any results are non-ambiguous
    if (app && app.length === 1) {
        contact = findContact(data, app[0].email);
        company = findCompany(data, app[0].company);
        app = findApp(data, app[0].email);
    }
    else if (contact && contact.length === 1) {
        app = findApp(data, contact[0].company);
        company = findCompany(data, contact[0].company);
        contact = findContact(data, contact[0].email);
    }
    else if (company && company.length === 1) {
        app = findApp(data, company[0].name);
        contact = findContact(data, company[0].name);
        company = findCompany(data, company[0].name);
    }
    // If some results are ambiguous, pick app, or contact, or company
    else if (app && app.length > 1) {
        contact = findContact(data, app[0].email);
        company = findCompany(data, app[0].company);
        app = findApp(data, app[0].email);
    }
    else if (contact && contact.length > 1) {
        app = findApp(data, contact[0].company);
        company = findCompany(data, contact[0].company);
        contact = findContact(data, contact[0].email);
    }
    else if (company && company.length > 1) {
        app = findApp(data, company[0].name);
        contact = findContact(data, company[0].name);
        company = findCompany(data, company[0].name);
    }
    // Else, no result
    else {
        throw 'ERROR: No contact found.';
    }

    if (!contact && company) {
        contact = company.contacts[0];
    }

    if (contact) {
        const defaultName = company.name || app.appName || 'user'
        const friendlyName = contact.firstName || defaultName;
        const name = `${contact.firstName} ${contact.lastName}`.replace(/(^ )|( $)/g, '') || defaultName;
        content = content.replace(new RegExp('{{EMAIL}}', 'g'), `${contact.email}`);
        content = content.replace(new RegExp('{{FULL_EMAIL}}', 'g'), `"${name}" <${contact.email}>`);
        content = content.replace(new RegExp('{{FULL_NAME}}', 'g'), name);
        content = content.replace(new RegExp('{{NAME}}', 'g'), name);
        content = content.replace(new RegExp('{{FRIENDLY_NAME}}', 'g'), friendlyName);
        content = content.replace(new RegExp('{{FIRST_NAME}}', 'g'), contact.firstName);
        content = content.replace(new RegExp('{{LAST_NAME}}', 'g'), contact.lastName);
    }
    if (app) {
        content = content.replace(new RegExp('{{APP_NAME}}', 'g'), app.appName);
        content = content.replace(new RegExp('{{APP_PLAN}}', 'g'), app.plan);
        content = content.replace(new RegExp('{{REGISTRATION_AGO}}', 'g'), moment(new Date(app.createdAt)).fromNow());
        content = content.replace(new RegExp('{{SUBSCRIPTION_AGO}}', 'g'), moment(new Date(app.upgradedAt)).fromNow());
    }
    if (company) {
        content = content.replace(new RegExp('{{COMPANY_AGO}}', 'g'), moment(new Date(company.createdAt)).fromNow());
        content = content.replace(new RegExp('{{COMPANY_NAME}}', 'g'), company.name);
        content = content.replace(new RegExp('{{COMPANY_URL}}', 'g'), company.url);
        content = content.replace(new RegExp('{{COMPANY_ADDRESS}}', 'g'), company.address);
    }
    return {
        printAsText: () => console.log(content)
    };
};

const readColumns = async (columns) => {
    const r = await enquirer.prompt(columns.map((c) => ({
        type: 'input',
        name: c,
        message: c,
    })));
    let c = {};
    while (['y','n'].indexOf(c.confirm) < 0) {
        c = await enquirer.prompt({
            type: 'input', name: 'confirm', message: 'Confirm? (y/n)', choices: ['y','n'],
        });
    }
    if (c.confirm === 'y')
        return r;
    throw 'Canceled';
};

/*
const readColumns = async (columns) => new Promise((resolve, reject) => {
    const typed = [];
    const object = {};
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    const onLine = function (cmd) {
        if (typed.length < columns.length) {
            object[columns[typed.length]] = cmd.replace(/([.?!]) /g, '$1\n');
            typed.push(cmd);
        }
        else if (cmd === 'y') {
            // console.log(JSON.stringify(object, null, 2));
            rl.off('line', onLine);
            return resolve(object);
        }
        else if (cmd === 'n') {
            rl.off('line', onLine);
            return reject();
        }

        if (typed.length < columns.length) {
            console.log(columns[typed.length] + ':');
        }
        else {
            console.log(JSON.stringify(object, null, 2));
            console.log('Confirm? (y/n)');
        }
    };
    console.log(columns[typed.length] + ':');
    rl.on('line', onLine);
});
*/

const addApp = async (data, filter, values = {}) => {
    console.log('');
    console.log('New App:');
    console.log('--------');
    const app = await enquirer.prompt([{
        type: 'input',
        initial: values.appName,
        name: 'appName',
        message: 'Application Name',
    }, {
        type: 'autocomplete',
        name: 'company',
        message: 'Company Name',
        choices: [{
            message: 'New Company',
            value: 'new_company',
        }].concat(data.map((c) => c.name)),
        limit: 10,
        initial: values.company,
    }, {
        type: 'select',
        name: 'plan',
        message: 'Plan',
        choices: ['free', 'silver', 'gold'],
        initial: values.plan,
    }]);
    
    Object.assign(app, await enquirer.prompt([{
        type: 'autocomplete',
        name: 'email',
        message: 'Contact',
        choices: data
            .filter(c => app.company === c.name)
            .reduce((acc, company) =>
                company.contacts.reduce((acc, c) => {
                    acc.push({
                        message: `${c.firstName} ${c.lastName} <${c.email}>`,
                        value: c.email,
                    });
                    return acc;
                }, acc), [{
                    message: 'New Contact',
                    value: 'new_contact',
                }]),
        limit: 10,
    }, {
        type: 'input',
        name: 'createdAt',
        message: 'Creation date',
    }, {
        type: 'input',
        name: 'upgradedAt',
        message: 'Upgrade date',
    }]));
    await doYouConfirm();

    if (app.company === 'new_company') {
        const newCompany = await addCompany(data, undefined);
        app.company = newCompany.name;
    }

    if (app.email === 'new_contact') {
        const newContact = await addContact(data, undefined, {company: app.company});
        app.email = newContact.email;
    }

    // If name is filled and there isn't a company with the given name.
    // Add it and save
    const companyName = app.company;
    const company = findCompany(data, companyName); // fuzzy search for the company
    delete app.company;
    if (company) {
        app.createdAt = (app.createdAt ? new Date(app.createdAt) : new Date()).toISOString();
        app.upgradedAt = app.upgradedAt ? new Date(app.upgradedAt).toISOString() : undefined;
        app.updatedAt = new Date().toISOString();
        // Find the company in the data
        company.apps.push(app);
        saveDataSync(data);
        console.log('App added.');
    }
    else {
        console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
        process.exit(1);
    }
    app.printAsText = () => {};
    return app;
};

const addContact = async (data, filter, values = {}) => {
    let contact = Object.assign({}, values);
    console.log('');
    console.log('New Contact:');
    console.log('------------');
    if (!values.company) Object.assign(contact, await enquirer.prompt({
        type: 'autocomplete',
        name: 'company',
        message: 'Company Name',
        choices: data.map((c) => c.name),
        limit: 10,
    }));
    if (!values.firstName) Object.assign(contact, await enquirer.prompt({
        type: 'input',
        name: 'firstName',
        message: 'First Name',
    }));
    if (!values.lastName) Object.assign(contact, await enquirer.prompt({
        type: 'input',
        name: 'lastName',
        message: 'Last Name',
    }));
    if (!values.role) Object.assign(contact, await enquirer.prompt({
        type: 'input',
        name: 'role',
        message: 'Role',
    }));
    if (!values.email) Object.assign(contact, await enquirer.prompt({
        type: 'input',
        name: 'email',
        message: 'Email',
    }));
    await doYouConfirm();
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    const companyName = contact.company;
    const company = findCompany(data, companyName); // fuzzy search for the company
    delete contact.company;
    if (company) {
        contact.createdAt = new Date().toISOString();
        contact.updatedAt = new Date().toISOString();
        contact.firstName = contact.firstName || '';
        contact.lastName = contact.lastName || '';
        // Find the company in the data
        company.contacts.push(contact);
        saveDataSync(data);
        console.log('Contact added.');
        // contacts(data, company.name).printAsText();;
        // process.exit(0);
    }
    else {
        console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
        process.exit(1);
    }
    contact.printAsText = () => {};
    return contact;
};

const addInteraction = async (data, filter) => {
    console.log('');
    console.log('New Interaction:');
    console.log('----------------');

    const sumCount = {};
    const listOfSummaries = Object.keys(interactions(data).reduce((acc, x) => {
        acc[x.summary] = (acc[x.summary] || 0) + 1;
        return acc;
    }, sumCount)).sort((a, b) => {
        return sumCount[b] - sumCount[a]; // length - b.length;
    });

    let listOfCompanies = companies(data, filter);
    if (listOfCompanies.length === 0) {
        const contact = contacts(data, filter);
        if (contact.length > 0)
            listOfCompanies = companies(data, contact[0].company);
    }
    if (listOfCompanies.length === 0) {
        const app = apps(data, filter);
        if (app.length > 0)
            listOfCompanies = companies(data, app[0].company);
    }
    const newCompany = {
        message: 'New Company',
        value: 'new_company',
    };
    if (listOfCompanies.length == 1)
        listOfCompanies = listOfCompanies.concat([newCompany]);
    else
        listOfCompanies = [newCompany].concat(listOfCompanies);

    const interaction = await enquirer.prompt([{
        type: 'autocomplete',
        name: 'company',
        message: 'Company Name',
        choices: listOfCompanies.map((c) => c.name || c),
        limit: 10,
    }, {
        type: 'autocomplete',
        name: 'kind',
        message: 'Kind',
        choices: KINDS,
    }, {
        type: 'autocomplete',
        name: 'tag',
        message: 'Tag',
        choices: [{
            message: '<empty>',
            value: '',
        }].concat(TAGS),
        limit: 10,
    }, {
    }]);

    let newSummary = '';
    
    Object.assign(interaction, await enquirer.prompt([{
        type: 'autocomplete',
        name: 'from',
        message: 'From',
        choices: data
            .filter(c => interaction.company === c.name)
            .reduce((acc, company) =>
                company.contacts.reduce((acc, c) => {
                    acc.push({
                        message: `${c.firstName} ${c.lastName} <${c.email}>`,
                        value: c.email,
                    });
                    return acc;
                }, acc), [{
                    message: 'New Contact',
                    value: 'new_contact',
                }].concat(Object.keys(STAFF).map((email) => ({
                    message: `${STAFF[email]} <${email}>`,
                    value: email,
                })))),
        limit: 10
    }, {
        type: 'input',
        name: 'date',
        message: 'Date',
    }, {
        type: 'input',
        name: 'followUpDate',
        message: 'Follow-Up Date',
    }, {
        type: 'autocomplete',
        name: 'summary',
        message: 'Summary',
        limit: 3,
        choices: listOfSummaries.concat({
            value: 'new_summary',
            message: '',
        }),
        suggest: (input, choices) => {
            const inputLowerCase = input.toLowerCase();
            return choices.filter(choice =>
                choice.value === 'new_summary'
                && (newSummary = choice.message = input)
                || choice.message.toLowerCase().startsWith(inputLowerCase));
        },
    }]));
    await doYouConfirm();
    interaction.tag = interaction.tag.replace('<empty>', '');

    if (interaction.summary === 'new_summary')
        interaction.summary = newSummary;

    if (interaction.company === 'new_company') {
        const newCompany = await addCompany(data, undefined);
        interaction.company = newCompany.name;
    }

    if (interaction.from === 'new_contact') {
        const newContact = await addContact(data, undefined, {company: interaction.company});
        interaction.from = newContact.email;
    }

    // Add it and save
    const companyName = interaction.company;
    const company = findCompany(data, companyName); // fuzzy search for the company
    delete interaction.company;
    const contact = findContact(data, interaction.from);
    if (company && contact) {
        // interaction.createdAt = new Date().toISOString();
        // Find the company in the data
        interaction.date = interaction.date || new Date().toISOString();
        interaction.from = contact.email;
        company.interactions.push(interaction);
        saveDataSync(data);
        console.log('Interaction added.');
    }
    else if (!company) {
        console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
        process.exit(1);
    }
    else if (!contact) {
        console.error(`ERROR: Contact with email "${interaction.from}" doesn't exists.`);
        process.exit(1);
    }
    interaction.printAsText = () => {};
    return interaction;
};

const doYouConfirm = async (message) => {
    if (message)
        console.log(message);
    const confirm = await enquirer.prompt({
        type: 'autocomplete',
        name: 'value',
        message: 'Do you confirm?',
        choices: ['Confirm', 'Cancel'],
    });
    if (!confirm || confirm.value !== 'Confirm') {
        console.log('Canceled');
        process.exit(1);
    }
};

const editApp = async (data, filter) => {
    if (!filter) {
        console.log('Usage: crm edit-app NAME');
        process.exit(1);
    }
    const app = findApp(data, filter); // fuzzy search for the company
    if (!app)
        return;
    const edited = await editJson(Object.assign(
        {
            appName: '',
            plan: 'free',
            email: '',
        },
        app,
        {
            updatedAt: undefined,
        }));
    if (!edited || !edited.appName) {
        console.log('Canceled');
        process.exit(1);
    }
    await doYouConfirm(JSON.stringify(edited, null, 4));
    Object.assign(app, edited);
    app.updatedAt = new Date().toISOString();
    saveDataSync(data);
    console.log('Contact updated.');
    app.printAsText = () => {};
    return app;
};

const doneInteraction = async (data, filter) => {
    if (!filter) {
        console.log('Usage: crm done ID');
        process.exit(1);
    }
    let interaction;
    if ('' + parseInt(filter) === filter) {
        interaction = findInteraction(data, filter);
        if (!interaction)
            throw `ERROR: Interaction with ID "${filter}" not found.`;
        interaction.updatedAt = new Date().toISOString();
        interaction.followUpDate = undefined;
        await doYouConfirm(JSON.stringify(interaction, null, 4));
        saveDataSync(data);
        console.log('Interaction updated.');
    }
    return { printAsText: () => {} };
};

const editInteraction = async (data, filter) => {
    if (!filter) {
        console.log('Usage: crm edit-interaction ID');
        process.exit(1);
    }
    let interaction;
    if ('' + parseInt(filter) === filter) {
        interaction = findInteraction(data, filter);
        if (!interaction)
            throw `ERROR: Interaction with ID "${filter}" not found.`;
        const edited = await editJson(Object.assign(
            {
                followUpDate: '',
                tag: '',
                summary: '',
                from: '',
                kind: '',
            },
            interaction,
            {
                updatedAt: undefined,
            }));
        if (!edited || !edited.summary) {
            console.log('Canceled');
            process.exit(1);
        }
        await doYouConfirm(JSON.stringify(edited, null, 4));
        Object.assign(interaction, edited);
        interaction.updatedAt = new Date().toISOString();
        saveDataSync(data);
        console.log('Interaction updated.');
    }
    if (!interaction)
        interaction = {};
    interaction.printAsText = () => {};
    return interaction;
};

const editContact = async (data, filter) => {
    if (!filter) {
        console.log('Usage: crm edit-contact NAME');
        process.exit(1);
    }
    const contact = findContact(data, filter); // fuzzy search for the company
    if (!contact)
        return;
    const edited = await editJson(Object.assign(
        {
            firstName: '',
            lastName: '',
            email: '',
            url: '',
        },
        contact,
        {
            updatedAt: undefined,
        }));
    if (!edited || !edited.email) {
        console.log('Canceled');
        process.exit(1);
    }
    await doYouConfirm(JSON.stringify(edited, null, 4));
    Object.assign(contact, edited);
    contact.updatedAt = new Date().toISOString();
    saveDataSync(data);
    console.log('Contact updated.');
    contact.printAsText = () => {};
    return contact;
};

const editCompany = async (data, filter) => {
    if (!filter) {
        console.log('Usage: crm edit-company NAME');
        process.exit(1);
    }
    const company = findCompany(data, filter); // fuzzy search for the company
    if (!company)
        return;
    const edited = await editJson(Object.assign(
        {
            name: '',
            url: '',
            address: '',
        },
        company,
        {
            updatedAt: undefined,
            interactions: undefined,
            apps: undefined,
            contacts: undefined,
        }));
    if (!edited || !edited.name) {
        console.log('Canceled');
        process.exit(1);
    }
    await doYouConfirm(JSON.stringify(edited, null, 4));
    Object.assign(company, edited);
    company.updatedAt = new Date().toISOString();
    saveDataSync(data);
    console.log('Company updated.');
    company.printAsText = () => {};
    return company;
};

const addCompany = async (data, filter, values = {}) => {
    let company = Object.assign({}, values);
    console.log('');
    console.log('New Company:');
    console.log('-----------');
    if (!values.name) Object.assign(company, await enquirer.prompt({
        type: 'input',
        name: 'name',
        message: 'Name',
    }));
    if (!values.address) Object.assign(company, await enquirer.prompt({
        type: 'input',
        name: 'address',
        message: 'Address',
    }));
    if (!values.url) Object.assign(company, await enquirer.prompt({
        type: 'input',
        name: 'url',
        message: 'URL',
    }));
    await doYouConfirm();
    // If name is filled and there isn't a company with the given name.
    // Add it and save
    const found = company.name && data.find((c) => c.name.toLowerCase() === company.name.toLowerCase());
    if (company.name && !found) {
        company.createdAt = new Date().toISOString();
        company.updatedAt = new Date().toISOString();
        company.contacts = [];
        company.interactions = [];
        company.apps = [];
        data.push(company);
        saveDataSync(data);
        console.log('Company added.');
    }
    else if (found) {
        console.error(`ERROR: A company with name "${company.name}" already exists.`);
        company = found;
    }
    else {
        process.exit(1);
    }
    company.printAsText = () => {};
    return company;
};

module.exports = {
    utils: {
        editData,
        editJson,
        editFile,
    },
    data: {
        initSync: initDataSync,
        loadSync: loadDataSync,
        saveSync: saveDataSync,
    },
    interactions: {
        edit: editInteraction,
        add: addInteraction,
        find: findInteraction,
        query: interactions,
        tags: TAGS,
        kinds: KINDS,
    },
    companies: {
        edit: editCompany,
        add: addCompany,
        find: findCompany,
        query: companies,
    },
    apps: {
        edit: editApp,
        add: addApp,
        find: findApp,
        query: apps,
    },
    contacts: {
        edit: editContact,
        add: addContact,
        find: findContact,
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
    about,
};
