import Fuse from "fuse.js";
import { Database } from "../types";
import { defaultTableOptions, fieldToText, tableToString } from "../cli/table";
import Table from "cli-table";
import { apps } from "./apps";
import { interactions } from "./interactions";

export interface About {
  company: string;
  role?: string;
  email: string;
}

export function about(data: Database, filter: string, delColumns: (keyof About)[]) {
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
          Object.keys(companies).forEach((company) => {
              console.log(`\nApps from ${company}:`);
              apps(data, company, ['company']).printAsText();
              console.log(`\nInteractions with ${company}:`);
              interactions(data, company, ['company']).printAsText();
          });
      }
  };
};

