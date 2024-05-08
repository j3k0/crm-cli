import { FileSystemAdapter } from './adapters/filesystem';
import { DatabaseAdapter } from './types';
import { InMemoryAdapter } from './adapters/inMemory';
import { emptyDatabase } from './emptyDatabase';
import { RemoteApiAdapter } from './adapters/remoteAPI';
import { CouchDBAdapter } from './adapters/couchdb';

export type DatabaseConnectParsedOptions = {
    type: "filesystem";
    path: string;
} | {
    type: "couchdb";
    url: string;
} | {
    type: "memory";
} | {
    type: "remote";
    url: string;
};

export type DatabaseConnectOptions = DatabaseConnectParsedOptions | string;

function parseOptions(options?: DatabaseConnectOptions): DatabaseConnectParsedOptions {
    if (!options && process.env.DATABASE_URL) {
        options = process.env.DATABASE_URL;
    }
    if (!options) {
        options = {
            type: "filesystem",
            path: process.env.DATABASE_JSON_FILE || (process.cwd() + '/crm.json'),
        }
    }
    if (typeof options !== "string") {
        return options;
    }
    // parse the URL
    const url = new URL(options);
    switch (url.protocol) {
        case "file:": return {
            type: "filesystem",
            path: url.hostname
                ? process.cwd() + '/' + url.hostname + url.pathname // relative path
                : url.pathname // absolute path
        }
        case "memory:": return {
            type: "memory"
        }
        case "http:": case "https:": return {
            type: "remote",
            url: options,
        }
        case "couchdb:": case "couchdbs:": return {
            type: "couchdb",
            url: options.replace(/^couchdb/, 'http')
        }
        default:
            throw new Error("invalid database URL: " + options);
    }
}

export async function connectDatabase(options?: DatabaseConnectOptions): Promise<DatabaseAdapter> {
    options = parseOptions(options);
    switch (options.type) {
        case "memory":
            return new InMemoryAdapter(emptyDatabase());
        case "filesystem":
            return new FileSystemAdapter(options.path);
        case "remote":
            return new RemoteApiAdapter(options.url);
        case "couchdb":
            return new CouchDBAdapter(options.url);
    }
}

export { DatabaseAdapter, DatabaseSession } from './types';

export default {
    connectDatabase,
}