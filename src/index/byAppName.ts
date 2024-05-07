import { findApp, findAppByName } from "../queries/requests";
import { Database } from "../types";

/** company name indexed by appName */
export class IndexByAppName {
  data: Database;
  constructor(data: Database) {
    this.data = data;
  }
  async getCompanyName(appName: string): Promise<string | undefined> {
    return findAppByName(this.data, appName)?.company.name;
  }
}