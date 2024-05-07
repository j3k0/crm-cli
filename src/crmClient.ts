import axios from 'axios';
import { App, CompanyAttributes, Config, Contact } from './types';

export class CrmClient {
  baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
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

  async allCompanies(): Promise<CompanyAttributes[] | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/companies`);
      return response.data?.rows;
    } catch (error) {
      console.error('Error fetching companies:', error);
      throw error;
    }
  }

  async addCompany(companyData: CompanyAttributes): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/companies`, companyData);
      return response.data;
    } catch (error) {
      console.error('Error adding company:', error);
      throw error;
    }
  }

  async addContact(contactData: Contact & { company: string }): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/contacts`, contactData);
      return response.data;
    } catch (error) {
      console.error('Error adding contact:', error);
      throw error;
    }
  }

  async addApp(appData: App & { company: string }): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/apps`, appData);
      return response.data;
    } catch (error) {
      console.error('Error adding app:', error);
      throw error;
    }
  }
  
  async findContact(email: string): Promise<App | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/contacts/find/${encodeURIComponent(email)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching contact:', error);
      throw error;
    }
  }
  
  async findApp(appName: string): Promise<App | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/apps/find/${encodeURIComponent(appName)}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching app:', error);
      throw error;
    }
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
  
  async searchApps(filter: string): Promise<App[] | undefined> {
    try {
      const response = await axios.get(`${this.baseUrl}/apps/search/${encodeURIComponent(filter)}`);
      return response.data?.rows;
    } catch (error) {
      console.error('Error fetching apps:', error);
      throw error;
    }
  }

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
