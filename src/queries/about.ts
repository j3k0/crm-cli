import Fuse from "fuse.js";
import { defaultTableOptions, fieldToText, tableToString } from "../cli/table";
import Table from "cli-table";
import { apps } from "./apps";
import { interactions } from "./interactions";
import { DatabaseSession } from "../database";

export interface About {
  company: string;
  role?: string;
  email: string;
}

export async function about(database: DatabaseSession, filter: string, delColumns: (keyof About)[]) {
  const data = await database.dump();
  let out: About[] = [];
  const columns: (keyof About)[] = ['company', 'role', 'email'];
  const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
  data.companies.forEach((company) => {
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

  return {
      ...out,
      printAsText: () => {

          const table = new Table(Object.assign(
              { head: displayColumns },
              defaultTableOptions));
          const companies: {[companyName: string]: boolean} = {};
          out.forEach((line) => {
              companies[line.company] = true;
              table.push(displayColumns.map(cname => fieldToText(data, line, cname)));
          });
          console.log('\nContacts:');
          console.log(tableToString(table));
          Object.keys(companies).forEach(async (company) => {
              console.log(`\nApps from ${company}:`);
              (await apps(database, company, ['company'])).printAsText();
              console.log(`\nInteractions with ${company}:`);
              (await interactions(database, company, ['company'])).printAsText();
          });
      }
  };
};

