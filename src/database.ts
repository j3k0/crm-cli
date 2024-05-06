import * as fs from 'fs';
import { Database } from './types';

// directory where the data file is stored
const dataDir = process.env.DATA_DIR || process.cwd();

// name of the data file
const dataFile = process.env.DATA_FILE || 'crm.json';

export function loadDataSync(): Database {
    if (fs.existsSync(`${dataDir}/${dataFile}`)) {
        const data = require(`${dataDir}/${dataFile}`);
        if (Array.isArray(data)) {
            return {
                companies: data,
                config: emptyDatabase().config,
            }
        }
        else {
            const loaded = data as Partial<Database>;
            if (!loaded.config) loaded.config = emptyDatabase().config;
            if (!loaded.config?.subscriptionPlans) loaded.config.subscriptionPlans = emptyDatabase().config.subscriptionPlans;
            if (!loaded.config?.staff) loaded.config.staff = {};
            if (!loaded.config?.interactions) loaded.config.interactions = emptyDatabase().config.interactions;
            return data as Database;
        }
    }
    else {
        console.error(`ERROR: File ${dataDir}/${dataFile} not found.`);
        console.error(`Run "crm init-crm" and I'll create it for you.`);
        process.exit(1);
    }
}

export function saveDataSync(data: Database) {
    fs.copyFileSync(`${dataDir}/${dataFile}`, `${dataDir}/${dataFile}.bak`);
    fs.writeFileSync(`${dataDir}/${dataFile}`, JSON.stringify(data, null, 4));
}

export const initDataSync = () => {
    fs.writeFileSync(`${dataDir}/${dataFile}`, JSON.stringify(emptyDatabase(), null, 4));
};

function emptyDatabase(): Database {
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
    initSync: initDataSync,
    loadSync: loadDataSync,
    saveSync: saveDataSync,
}