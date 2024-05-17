import { Company, Database, PrintableArray, companyEmail, hasInteraction, newCompany } from "../types";
import Fuse from 'fuse.js';
import moment from 'moment';
import Table from 'cli-table';
import { defaultTableOptions, fieldToText, tableToString } from "../cli/table";
import { DatabaseSession } from "../database";

export interface FollowUpsResult {
  id?: number;
  company: string;
  email: string;
  tag?: string;
  summary: string;
  date: string;
}

export async function followups(database: DatabaseSession, filter: string, delColumns: (keyof FollowUpsResult)[]): Promise<PrintableArray<FollowUpsResult>> {
  let out: FollowUpsResult[] = [];
  const columns: (keyof FollowUpsResult)[] = ['id', 'company', 'date', 'tag', 'summary', 'email'];
  const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
  let id = 1;
  const data = await database.dump();
  data.companies.forEach((companyData) => {
      const company = newCompany(companyData);
      if (company.noFollowUp) return;
      // Follow-up 3 days after registration
      if (!hasInteraction(company, 'registration') && !hasInteraction(company, 'subscription')) {
          company.apps.forEach((app) => {
              out.push({
                  company: company.name,
                  email: companyEmail(company),
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
          email: companyEmail(company),
          tag: i.tag,
          summary: i.summary,
          date: i.followUpDate
      })).filter(i => !!i.date).forEach((i) => out.push(i as FollowUpsResult));
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
  return {
      content: out,
      printAsText: async () => {
          const table = new Table( Object.assign(
              {head: displayColumns},
              defaultTableOptions));
          out.forEach((line) =>
              table.push(displayColumns.map(cname => fieldToText(data, line, cname))));
          console.log(tableToString(table));
      },
  };
};
