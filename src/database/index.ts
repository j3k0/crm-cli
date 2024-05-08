import { FileSystemDatabaseAdapter } from './filesystemDatabase';
import { DatabaseAdapter } from './types';
import { InMemoryDatabaseAdapter } from './inMemoryDatabase';
import { emptyDatabase } from './emptyDatabase';
import { RemoteDatabaseAdapter } from './remoteDatabase';

export type DatabaseConnectParsedOptions = {
    type: "filesystem";
    path: string;
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
        default:
            throw new Error("invalid database URL: " + options);
    }
}

export async function connectDatabase(options?: DatabaseConnectOptions): Promise<DatabaseAdapter> {
    options = parseOptions(options);
    switch (options.type) {
        case "memory":
            return new InMemoryDatabaseAdapter(emptyDatabase());
        case "filesystem":
            return new FileSystemDatabaseAdapter(options.path);
        case "remote":
            return new RemoteDatabaseAdapter(options.url);
    }
}

export { DatabaseAdapter, DatabaseSession } from './types';

export default {
    connectDatabase,
}