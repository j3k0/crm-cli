import Fuse from "fuse.js";
import { defaultTableOptions, fieldToText, tableToString } from "../cli/table";
import Table from "cli-table";
import { apps } from "./apps";
import { interactions } from "./interactions";
import { DatabaseSession } from "../database";

export interface About {
  company: string;
  displayName?: string;
  role?: string;
  email: string;
}

export async function about(database: DatabaseSession, filter: string, delColumns: (keyof About)[]) {
  const data = await database.dump();
  let out: About[] = [];
  const columns: (keyof About)[] = ['company', 'role', 'email'];
  const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
  (data.companies || []).forEach((company) => {
      (company.contacts || []).forEach((c) => {
          const name = `${c.firstName} ${c.lastName}`.replace(/(^ )|( $)/g, '');
          out.push({
              company: company.name,
              displayName: company.displayName,
              role: c.role,
              email: name ? `"${name}" <${c.email}>` : c.email,
          });
      });
  });
  if (filter) {
      const fuse = new Fuse(out, {
          keys: ['company', 'displayName', 'email'],
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
      printAsText: async () => {

          const table = new Table(Object.assign(
              { head: displayColumns },
              defaultTableOptions));
          // company name (record key) => label shown to the user
          const companies: {[companyName: string]: string} = {};
          (out || []).forEach((line) => {
              const label = line.displayName ? `${line.displayName} (${line.company})` : line.company;
              companies[line.company] = label;
              table.push(displayColumns.map(cname => cname === 'company' ? label : fieldToText(data, line, cname)));
          });
          console.log('\nContacts:');
          console.log(tableToString(table));
          for (const [company, label] of Object.entries(companies)) {
              console.log(`\nApps from ${label}:`);
              (await apps(database, company, ['company'])).printAsText();
              console.log(`\nInteractions with ${label}:`);
              (await interactions(database, company, ['company'])).printAsText();
          }
      }
  };
};

