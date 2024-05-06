import * as fs from 'fs';
import * as tmp from 'tmp';
import enquirer from 'enquirer';
import { spawn } from 'child_process';

tmp.setGracefulCleanup();

export function editFile(file: string): Promise<{ exitCode: number; signal: string }> {
    return new Promise((resolve, reject) => {
        const ed = /^win/.test(process.platform) ? 'notepad' : 'vim';
        const editor = process.env.VISUAL || process.env.EDITOR || ed;
        const args = editor.split(/\s+/);
        const bin = args.shift();
        if (!bin) {
          return reject('bin not found');
        }
        // console.log('spawn: ' + bin + ' ' + args.concat([file]).join(' '));
        const ps = spawn(bin, args.concat([file]), { stdio: 'inherit' });
        ps.on('exit', (exitCode: number, signal: string) => {
            // console.log('exit');
            resolve({ exitCode, signal });
        });
        ps.on('error', (err: any) => {
            reject(err.code === 'ENOENT' ? 127 : 1);
        });
    });
}

export async function editData (data: string) {
    const tmpobj = tmp.fileSync({prefix: 'crm-', postfix: '.json'});
    // write to file
    fs.writeFileSync(tmpobj.name, data);
    const ret = await editFile(tmpobj.name);
    const content = fs.readFileSync(tmpobj.name, {encoding: 'utf-8'});
    tmpobj.removeCallback();
    if (content === data)
        throw 'Canceled. Content didn\'t change.';
    return content;
}

export async function editJson<T extends object> (data: T): Promise<Partial<T>> {
    let ret = await editData(JSON.stringify(data, null, 4));
    while (true) {
        try {
            return JSON.parse(ret) as Partial<T>;
        }
        catch (e) {
            const action = await enquirer.prompt({
                type: 'autocomplete',
                name: 'value',
                message: 'Invalid JSON: ' + (e as Error).message,
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
