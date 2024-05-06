import Fuse from "fuse.js";
import { Company, CompanyAttributes, Database, PrintableArray } from "../types";
import Table from "cli-table";
import { defaultTableOptions, fieldToText, tableToString } from "../cli/table";

export function companies(data: Database, filter?: string, delColumns?: (keyof CompanyAttributes)[]): PrintableArray<Company> {
  const columns: (keyof CompanyAttributes)[] = ['name', 'url', 'address'];
  const displayColumns = columns.filter((c) => !delColumns || delColumns.indexOf(c) < 0);
  let out = data.companies.map(x => x);
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
  return {
      content: out,
      printAsText: () => {
          const table = new Table(Object.assign(
              { head: displayColumns },
              defaultTableOptions));
          out.forEach((company) =>
              table.push(displayColumns.map(cname => fieldToText(data, company, cname))));
          console.log(tableToString(table));
      }
  }
}
