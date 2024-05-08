import Fuse from "fuse.js";
import { App, Company, Database, PrintableArray } from "../types";
import { defaultTableOptions, fieldToText, tableToString } from "../cli/table";
import Table from "cli-table";
import { DatabaseSession } from "../database";

export interface InteractionsResult {
  id?: number;
  company: Company["name"];
  kind: string;
  date: App["createdAt"] | '';
  from: string;
  summary: string;
  followup: string;
}

export async function interactions(database: DatabaseSession, filter?: string, delColumns?: (keyof InteractionsResult)[]): Promise<PrintableArray<InteractionsResult>> {
  let out: InteractionsResult[] = [];
  const columns: (keyof InteractionsResult)[] = ['id', 'company', 'kind', 'date', 'from', 'summary', 'followup'];
  const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
  let id = 1;
  function pushWithId(data: Omit<InteractionsResult, "id">) {
      out.push({
          ...data,
          id: id++
      });
  }
  const data = await database.dump();
  data.companies.forEach((company) => {
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
              summary: (interaction.summary || '').replace(/([.?!]) /g, '$1\n'),
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

  return {
      content: out,
      printAsText: () => {
          const table = new Table( Object.assign(
              {head: displayColumns},
              defaultTableOptions));
          out.forEach((line) =>
              table.push(displayColumns.map(cname => fieldToText(data, line, cname))));
          console.log(tableToString(table));
      }
  };
}
