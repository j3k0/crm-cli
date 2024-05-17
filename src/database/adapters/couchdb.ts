import axios from "axios";
import { App, Company, Config, Contact, Database, Interaction, newCompany } from "../../types";
import { DatabaseSessionCache } from "./sessionCache";
import { DatabaseAdapter, DatabaseSession } from "../types";
import { md5 } from "../../utils/md5";
import { designDocument } from "./couchdbDesign";
import Fuse from "fuse.js";

type CouchDBErrorCode =
  | "file_exists"
  | "conflict"
  | "bad_request"
  | "not_found"
  | "no_code"
  ;

interface CouchDBDocument {
  _id: string;
  _rev: string;
}

interface CouchDBViewResult<DocType, ValueType> {
  offset: number;
  total_rows: number;
  rows: {
    id: string;
    key: string;
    value: ValueType;
    doc: DocType & CouchDBDocument;
  }[];
}

function couchdbError(err: any): CouchDBErrorCode {
  return (err as any)?.response?.data?.error || 'no_code';
}

export class CouchDBAdapter implements DatabaseAdapter {
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  async create(initialData: Database): Promise<void> {
    try {
      const result = await axios.put(this.url);
      console.log('couchdb database created', result?.data);
    }
    catch (err) {
      if (couchdbError(err) === 'file_exists') {
        console.log('database already exists');
      }
      else {
        throw err;
      }
    }
    // insert the design document
    try {
      const result = await axios.post(this.url, designDocument);
      console.log('design document created', result?.data);
    }
    catch (err) {
      console.error(JSON.stringify((err as any)?.response?.data, null, 2));
    }
    try {
      const result = await axios.post(this.url, {
        _id: "config",
        ...initialData.config,
      });
      console.log('config created', result?.data);
    }
    catch (err) {
      console.error(JSON.stringify((err as any)?.response?.data, null, 2));
    }
    for (const company of initialData.companies) {
      try {
        const result = await axios.post(this.url, {
          _id: "company:" + md5(company.name), // somehow limit risks of double insertions
          ...company,
        });
        console.log('company ' + company.name + ' created', result?.data);
      }
      catch (err) {
        console.error(JSON.stringify((err as any)?.response?.data, null, 2));
      }
    }
  }

  async open(): Promise<DatabaseSession> {
    return new DatabaseSessionCache(new CouchDBSession(this.url));
  }
}


export class CouchDBSession implements DatabaseSession {
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  async close(): Promise<void> {}

  async dump(): Promise<Database> {
    let config: Config | undefined;
    const companies: Company[] = [];
    const url = `${this.url}/_all_docs?include_docs=true`;
    const result = await axios.get<CouchDBViewResult<Company | Config, { rev: string }>>(url);
    for (const row of result.data.rows) {
      if (row.id === 'config') {
        config = row.doc as Config;
      }
      else if (row.id.slice(0, 7) === "company") {
        companies.push(newCompany(row.doc as Company));
      }
    }
    if (!config) throw new Error('no config found, database is empty');
    return {config, companies};
  }

  async findAppByEmail(email: string): Promise<{ company: Company; app: App; } | undefined> {
    try {
      const query = new URLSearchParams({
        key: JSON.stringify(email),
        limit: '1',
        include_docs: 'true'
      }).toString();
      const url = `${this.url}/_design/companies/_view/by_email?${query}`;
      const result = await axios.get<CouchDBViewResult<Company, 1>>(url);
      for (const row of result.data.rows) {
        const company = newCompany(row.doc);
        const app = company.apps.find(a => a.email === email);
        if (app) return { company, app };
      }
    }
    catch (err) {
      return this.handleFindErrors('findAppByName', err);
    }
  }

  async findAppByName(appName: string): Promise<{ company: Company; app: App; } | undefined> {
    try {
      const query = new URLSearchParams({
        key: JSON.stringify(appName),
        limit: '1',
        include_docs: 'true'
      }).toString();
      const url = `${this.url}/_design/companies/_view/by_app_name?${query}`;
      const result = await axios.get<CouchDBViewResult<Company, 1>>(url);
      if (result.data.rows.length > 0) {
        const company = newCompany(result.data.rows[0].doc);
        const app = company.apps.find(a => a.appName === appName);
        if (app) return { company, app };
      }
    }
    catch (err) {
      return this.handleFindErrors('findAppByName', err);
    }
  }

  private async handleFindErrors(context: string, err: unknown) {
    const errAny = (err || {}) as any;
    if (couchdbError(errAny) === 'not_found') {
      return undefined;
    }
    else if (couchdbError(errAny) !== 'no_code') {
      console.error(context + ' couchdb error:', errAny?.response?.data);
      throw new Error(errAny.response?.data?.error?.message);
    }
    console.error(context + ' error:', errAny?.data || errAny);
    throw new Error((err as Error)?.message);
  }

  async findCompanyByName(name: string): Promise<Company | undefined> {
    try {
      const query = new URLSearchParams({
        key: JSON.stringify(name),
        limit: '1',
        include_docs: 'true'
      }).toString();
      const url = `${this.url}/_design/companies/_view/by_name?${query}`;
      const result = await axios.get<CouchDBViewResult<Company, 1>>(url);
      if (result.data.rows.length > 0) {
        // console.error('findCompanyByName', result.data.rows[0]);
        return newCompany(result.data.rows[0].doc);
      }
      else {
        return undefined;
      }
    }
    catch (err) {
      return this.handleFindErrors('findCompanyByName', err);
    }
  }

  async findContactByEmail(email: string): Promise<{ company: Company; contact: Contact; } | undefined> {
    try {
      const query = new URLSearchParams({
        key: JSON.stringify(email),
        limit: '1',
        include_docs: 'true'
      }).toString();
      const url = `${this.url}/_design/companies/_view/by_email?${query}`;
      const result = await axios.get<CouchDBViewResult<Company, 1>>(url);
      for (const row of result.data.rows) {
        const company = newCompany(row.doc);
        const contact = company.contacts.find(c => c.email === email);
        if (contact) return { company, contact };
      }
    }
    catch (err) {
      return this.handleFindErrors('findContactByEmail', err);
    }
  }

  async findFollowups(startDate: string, endDate: string): Promise<(Interaction & { company: string; })[]> {
    try {
      const query = new URLSearchParams({
        start_key: JSON.stringify(startDate.slice(0, 10)),
        end_key: JSON.stringify(endDate.slice(0, 10) + 'Z'),
        inclusive_end: 'true',
        include_docs: 'true'
      }).toString();
      const url = `${this.url}/_design/companies/_view/by_followup_date?${query}`;
      const result = await axios.get<CouchDBViewResult<Company, number>>(url);
      const ret: (Interaction & { company: string; })[] = [];
      for (const row of result.data.rows) {
        const company = row.doc;
        const index = row.value;
        const interaction = company.interactions ? company.interactions[index] : undefined;
        if (interaction) ret.push({
          ...interaction,
          company: company.name
        });
      }
      return ret;
    }
    catch (err) {
      return (await this.handleFindErrors('findFollowups', err)) || [];
    }
  }

  async findInteractions(startDate: string, endDate: string): Promise<(Interaction & { company: string; })[]> {
    try {
      const query = new URLSearchParams({
        start_key: JSON.stringify(startDate.slice(0, 10)),
        end_key: JSON.stringify(endDate.slice(0, 10) + 'Z'),
        inclusive_end: 'true',
        include_docs: 'true'
      }).toString();
      const url = `${this.url}/_design/companies/_view/by_interaction_date?${query}`;
      // console.log(url);
      const result = await axios.get<CouchDBViewResult<Company, number>>(url);
      const ret: (Interaction & { company: string; })[] = [];
      for (const row of result.data.rows) {
        const company = row.doc;
        const index = row.value;
        const interaction = company.interactions ? company.interactions[index] : undefined;
        if (interaction) ret.push({
          ...interaction,
          company: company.name
        });
      }
      return ret;
    }
    catch (err) {
      return (await this.handleFindErrors('findInteractions', err)) || [];
    }
  }


  async loadConfig(): Promise<Config> {
    const result = await axios.get<CouchDBDocument & Config>(`${this.url}/config`);
    return result.data;
  }

  async updateConfig(attributes: Partial<Config>): Promise<Config | { error: string; }> {
    const result = await axios.put<CouchDBDocument & Config>(`${this.url}/config`, attributes);
    return result.data;
  }

  async searchCompanies(filter: string): Promise<Company[]> {
    const companyNames = await this.allCompanyNames();
    const filtered = new Fuse(companyNames.map(name => ({name})), {
      keys: ['name'],
      matchAllTokens: true,
      threshold: 0.1,
      location: 0,
      distance: 500,
      findAllMatches: true,
    }).search(filter);
    const ret:Company[] = [];
    for (const result of filtered) {
      const company = await this.findCompanyByName(result.name);
      if (company) ret.push(company);
    }
    return ret;
  }
    
  async allCompanyNames(): Promise<string[]> {
    const url = `${this.url}/_design/companies/_view/by_name`;
    const result = await axios.get<CouchDBViewResult<Company, 1>>(url);
    return result.data.rows.map(row => row.key);
  }

  async addCompany(company: Company): Promise<Company | { error: string; }> {
    try {
      const result = await axios.post<Company & CouchDBDocument>(this.url, {
        _id: "company:" + md5(company.name || ''),
        ...company
      });
      console.log('company ' + company.name + ' added', result.data);
      return result.data;
    }
    catch (err) {
      console.error(JSON.stringify((err as any)?.response?.data, null, 2));
      return {
        error: couchdbError(err),
      }
    }
  }

  async updateCompany(name: string, attributes: Partial<Company & CouchDBDocument>): Promise<Company | { error: string; }> {
    try {
      const docId = attributes._id || ("company:" + md5(name || ''));
      const result = await axios.put<Company & CouchDBDocument>(`${this.url}/${docId}`, attributes);
      console.log('company ' + attributes.name + ' updated', result.data);
      return result.data;
    }
    catch (err) {
      console.error(JSON.stringify((err as any)?.response?.data, null, 2));
      return {
        error: couchdbError(err),
      }
    }
  }
}