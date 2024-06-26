import Table from "cli-table";
import { App, Company, Database, PrintableArray } from "../types";
import { defaultTableOptions, fieldToText, tableToString } from "../cli/table";
import Fuse from "fuse.js";
import { DatabaseSession } from "../database";

export interface AppResult {
    company: Company["name"];
    created: App["createdAt"];
    upgraded: App["upgradedAt"];
    churned: App["churnedAt"];
    email: App["email"];
    name: App["appName"];
    plan: App["plan"];
}

export async function apps (database: DatabaseSession, filter?: string, delColumns?: (keyof AppResult)[]): Promise<PrintableArray<AppResult>> {
    let out: AppResult[] = [];
    const columns: (keyof AppResult)[] = ['company', 'plan', 'created', 'upgraded', 'churned', 'name', 'email'];
    const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
    const data = await database.dump();
    data.companies.forEach((company) => {
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
    out = out.sort((a, b) => (+new Date(a.created)) - (+new Date(b.created)));

    return {
        content: out,
        printAsText: async () => {
            const table = new Table( Object.assign(
                {head: displayColumns},
                defaultTableOptions));
            out.forEach((line) =>
                table.push(displayColumns.map(cname => fieldToText(data, line, cname))));
            console.log(tableToString(table));
        }
    };
};
