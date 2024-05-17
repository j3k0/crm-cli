import Fuse from "fuse.js";
import { Company, PrintableArray } from "../types";
import Table from "cli-table";
import { defaultTableOptions, fieldToText, tableToString } from "../cli/table";
import { DatabaseSession } from "../database";

export async function companies(database: DatabaseSession, filter?: string, delColumns?: (keyof Company)[]): Promise<PrintableArray<Company>> {
  const data = await database.dump();
  const columns: (keyof Company)[] = ['name', 'url', 'address'];
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
      printAsText: async () => {
          const table = new Table(Object.assign(
              { head: displayColumns },
              defaultTableOptions));
          out.forEach((company) =>
              table.push(displayColumns.map(cname => fieldToText(data, company, cname))));
          console.log(tableToString(table));
      }
  }
}
