import Fuse from "fuse.js";
import { Company, CompanyAttributes, Contact, Database, PrintableArray } from "../types";
import Table from "cli-table";
import { defaultTableOptions, fieldToText, tableToString } from "../cli/table";
import { DatabaseSession } from "../database";

export interface ContactsResult {
  company: Company["name"];
  role: Contact["role"];
  email: string;
  rawEmail: Contact["email"];
}

function makeContactsResult(c: Contact, company: CompanyAttributes): ContactsResult {
  const name = `${c.firstName} ${c.lastName}`.replace(/(^ )|( $)/g, '');
  return {
      company: company.name,
      role: c.role,
      email: name ? `"${name}" <${c.email}>` : c.email,
      rawEmail: c.email,
  }
}

export async function contacts(database: DatabaseSession, filter?: string, delColumns?: (keyof ContactsResult)[]): Promise<PrintableArray<ContactsResult>> {
  let out: ContactsResult[] = [];
  const columns: (keyof ContactsResult)[] = ['company', 'role', 'email'];
  const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
  const data = await database.dump();
  data.companies.forEach((company) => {
      company.contacts.forEach((c) => {
          out.push(makeContactsResult(c, company));
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
};
