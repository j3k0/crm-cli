import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Parse the content of a .env file (KEY=value lines).
 * Supports blank lines, `#` comment lines, an optional `export ` prefix and
 * single/double quoted values. No inline comments, no variable expansion.
 */
export function parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (let line of content.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        line = line.replace(/^export\s+/, '');
        const eq = line.indexOf('=');
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (value.length >= 2 && /^(["']).*\1$/.test(value)) value = value.slice(1, -1);
        result[key] = value;
    }
    return result;
}

export function configDir(): string {
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'crm-cli');
}

/** A value containing "/" or ending with ".env" is a path; anything else is a name. */
export function resolveEnvFile(arg: string): string {
    return arg.includes('/') || arg.endsWith('.env')
        ? path.resolve(arg)
        : path.join(configDir(), arg + '.env');
}

/**
 * Remove `--environment X` / `--environment=X` from argv (in place).
 * @returns the value, or undefined if the flag is absent.
 */
export function extractEnvironmentFlag(argv: string[]): string | undefined {
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--environment') {
            const value = argv[i + 1];
            if (!value) throw new Error('--environment requires a value (NAME or PATH)');
            argv.splice(i, 2);
            return value;
        }
        if (arg.startsWith('--environment=')) {
            const value = arg.slice('--environment='.length);
            if (!value) throw new Error('--environment requires a value (NAME or PATH)');
            argv.splice(i, 1);
            return value;
        }
    }
    return undefined;
}

/**
 * Load an env file into process.env. Existing environment variables win.
 * A missing "default" file is ignored; any other missing file is an error.
 * @returns the path of the loaded file, if any.
 */
export function loadEnvironment(arg: string = 'default'): string | undefined {
    const file = resolveEnvFile(arg);
    if (!fs.existsSync(file)) {
        if (arg === 'default') return undefined;
        throw new Error(`environment file not found: ${file}`);
    }
    if (!fs.statSync(file).isFile())
        throw new Error(`environment is not a file: ${file}`);
    const values = parseEnvFile(fs.readFileSync(file, 'utf-8'));
    for (const key of Object.keys(values)) {
        if (!(key in process.env)) process.env[key] = values[key];
    }
    return file;
}
