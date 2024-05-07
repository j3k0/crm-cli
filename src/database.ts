import * as fs from 'fs';
import { Database } from './types';

// directory where the data file is stored
const dataDir = process.env.DATA_DIR || process.cwd();

// name of the data file
const dataFile = process.env.DATA_FILE || 'crm.json';

const dataFullPath = `${dataDir}/${dataFile}`;

export type DataSelector = "all" | "config" | { company: string } | { appName: string };

export async function loadData(selector: DataSelector): Promise<Database> {
    try {
        const fileContent = await fs.promises.readFile(dataFullPath, 'utf8');
        const data = JSON.parse(fileContent);
        if (Array.isArray(data)) {
            // old format
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
    catch (err) {
        if (err instanceof Error) {
            console.error(`ERROR #${err.name}: ${err.message}.`);
        }
        console.error(`Run "crm init-crm" and I'll create it for you.`);
        throw err;
    }
}

export async function saveData(data: Database, selector: DataSelector): Promise<void> {
    // first backup the file
    await fs.promises.copyFile(`${dataDir}/${dataFile}`, `${dataDir}/${dataFile}.bak`);
    // then save the new content
    await fs.promises.writeFile(dataFullPath, JSON.stringify(data, null, 4), 'utf-8');
}

export async function initData(): Promise<Database> {
    const data = emptyDatabase();
    await fs.promises.writeFile(dataFullPath, JSON.stringify(data, null, 4), 'utf-8');
    return data;
}

/**
 * Generate an empty database
 */
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
    init: initData,
    load: loadData,
    save: saveData,
}