import axios from 'axios';
import { App, Company, CompanyAttributes, Config, Contact, Database } from './types';

export class CrmClient {
  baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async resetDatabase(initialData: Database): Promise<Config> {
    try {
      const response = await axios.post(`${this.baseUrl}/reset`, initialData);
      return response.data;
    }
    catch (error) {
      console.error('Error resetting database:', error);
      throw error;
    }
  }
  
  async searchCompanies(filter: string): Promise<CompanyAttributes[] | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/companies/search/${encodeURIComponent(filter)}`);
      return response.data?.rows;
    } catch (error) {
      console.error('Error fetching companies:', error);
      throw error;
    }
  }

  async findCompany(name: string): Promise<CompanyAttributes | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/companies/${encodeURIComponent(name)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching company:', error);
      throw error;
    }
  }

  async updateCompany(name: string, attributes: Partial<CompanyAttributes>): Promise<Company | undefined> {
    try {
      const response = await axios.put(`${this.baseUrl}/companies/${encodeURIComponent(name)}`, attributes);
      if (response.data) {
        return new Company(response.data);
      }
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  }

  async dump(): Promise<Database> {
      return (await axios.get(`${this.baseUrl}/dump`)).data;
  }

  async allCompanies(): Promise<CompanyAttributes[] | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/companies`);
      return response.data?.rows;
    } catch (error) {
      console.error('Error fetching companies:', error);
      throw error;
    }
  }

  async addCompany(companyData: CompanyAttributes): Promise<Company> {
    try {
      const response = await axios.post(`${this.baseUrl}/companies`, companyData);
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      return new Company(response.data);
    } catch (error) {
      console.error('Error adding company:', error);
      throw error;
    }
  }

  // async addContact(contactData: Contact & { company: string }): Promise<Contact> {
  //   try {
  //     const response = await axios.post(`${this.baseUrl}/contacts`, contactData);
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error adding contact:', error);
  //     throw error;
  //   }
  // }

  // async addApp(appData: App & { company: string }): Promise<any> {
  //   try {
  //     const response = await axios.post(`${this.baseUrl}/apps`, appData);
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error adding app:', error);
  //     throw error;
  //   }
  // }
  
  async findContactByEmail(email: string): Promise<Contact & { company: string } | undefined> {
    return (await axios.get(`${this.baseUrl}/contacts/by-email/${encodeURIComponent(email)}`)).data;
  }
  
  async findAppByName(appName: string): Promise<App & { company: string } | undefined> {
    return (await axios.get(`${this.baseUrl}/apps/by-name/${encodeURIComponent(appName)}`)).data;
  }
  
  async findAppByEmail(appName: string): Promise<App & { company: string } | undefined> {
    return (await axios.get(`${this.baseUrl}/apps/by-email/${encodeURIComponent(appName)}`)).data;
  }
  
  async updateApp(appName: string, attributes: Partial<App>): Promise<App | undefined> {
    try {
      const response = await axios.put(`${this.baseUrl}/apps/${encodeURIComponent(appName)}`, attributes);
      return response.data;
    } catch (error) {
      console.error('Error updating app:', error);
      throw error;
    }
  }
  
  // async searchApps(filter: string): Promise<(App & { company: string }[] | undefined> {
  //   try {
  //     const response = await axios.get(`${this.baseUrl}/apps/search/${encodeURIComponent(filter)}`);
  //     return response.data?.rows;
  //   } catch (error) {
  //     console.error('Error fetching apps:', error);
  //     throw error;
  //   }
  // }

  async getConfig(): Promise<Config | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/config`);
      return response.data;
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  }

  async updateConfig(attributes: Partial<Config>): Promise<Config | undefined> {
    try {
      const response = await axios.put(`${this.baseUrl}/config`, attributes);
      return response.data;
    } catch (error) {
      console.error('Error updating config apps:', error);
      throw error;
    }
  }
}

const clientsPool: { [url: string]: CrmClient } = {};

export function crmClient(url?: string) {
  const defaultPort = parseInt(process.env.PORT || '3954');
  url = url || `http://localhost:${defaultPort}`;
  return clientsPool[url] ?? (clientsPool[url] = new CrmClient(url));
}
