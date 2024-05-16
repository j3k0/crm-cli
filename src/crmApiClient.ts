import axios from 'axios';
import { App, Company, CompanyAttributes, Config, Contact, Database, Interaction, TemplateEmail } from './types';

/**
 * Client for the CrmApiServer
 */
export class CrmApiClient {
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

  async findFollowups(startDate: string, endDate: string): Promise<(Interaction & { company: string; })[]> {
    try {
      const query = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      }).toString();
      const response = await axios.get(`${this.baseUrl}/followups?${query}`);
      return response.data?.followups || [];
    } catch (error) {
      console.error('Error fetching followups:', error);
      throw error;
    }
  }

  async findInteractions(startDate: string, endDate: string): Promise<(Interaction & { company: string; })[]> {
    try {
      const query = new URLSearchParams({
        start_date: startDate,
        end_date: endDate
      }).toString();
      const response = await axios.get(`${this.baseUrl}/interactions?${query}`);
      return response.data?.followups || [];
    } catch (error) {
      console.error('Error fetching interactions:', error);
      throw error;
    }
  }

  async updateInteraction(companyName: string, index: number, attributes: Partial<Interaction>): Promise<Interaction | { error: string }> {
    try {
      const response = await axios.put(`${this.baseUrl}/interactions/${encodeURIComponent(companyName)}/${index}`, attributes);
      if (response.data.interaction) {
        return response.data.interaction;
      }
      else return {error: 'interaction not updated'};
    } catch (error) {
      console.error('Error in update interaction:', error);
      throw error;
    }
  }

  async doneInteraction(companyName: string, index: number): Promise<Interaction | { error: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/interactions/${encodeURIComponent(companyName)}/${index}/done`);
      if (response.data.interaction) {
        return response.data.interaction;
      }
      else return {error: 'interaction not done'};
    } catch (error) {
      console.error('Error in done interaction:', error);
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

  async updateContact(email: string, contactData: Contact & { company: string }): Promise<Contact> {
    try {
      const response = await axios.put(`${this.baseUrl}/contacts/${encodeURIComponent(email)}`, contactData);
      return response.data;
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  async addInteraction(interaction: Interaction & { company: string }): Promise<Interaction> {
    try {
      const response = await axios.post(`${this.baseUrl}/interactions`, interaction);
      return response.data?.interaction;
    } catch (error) {
      console.error('Error adding interaction:', error);
      throw error;
    }
  }

  async addContact(contactData: Contact & { company: string }): Promise<Contact> {
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

  async updateApp(appName: string, attributes: Partial<App>): Promise<App | undefined> {
    try {
      const response = await axios.put(`${this.baseUrl}/apps/${encodeURIComponent(appName)}`, attributes);
      return response.data;
    } catch (error) {
      console.error('Error updating app:', error);
      throw error;
    }
  }

  async findContactByEmail(email: string): Promise<Contact & { company: string } | undefined> {
    return (await axios.get(`${this.baseUrl}/contacts/by-email/${encodeURIComponent(email)}`)).data;
  }
  
  async findAppByName(appName: string): Promise<App & { company: string } | undefined> {
    return (await axios.get(`${this.baseUrl}/apps/by-name/${encodeURIComponent(appName)}`)).data;
  }
  
  async findAppByEmail(appName: string): Promise<App & { company: string } | undefined> {
    return (await axios.get(`${this.baseUrl}/apps/by-email/${encodeURIComponent(appName)}`)).data;
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

  /**
   * Fetch all templates
   * 
   * @param renderFor - render all templates for the provided contact (specify an email, app name or company name)
   */
  async getTemplates(renderFor?: string): Promise<{templates: TemplateEmail[]}> {
    try {
      const response = await axios.get(`${this.baseUrl}/config/templates${renderFor ? '?renderFor=' + encodeURIComponent(renderFor) : ''}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  async addTemplate(attributes: TemplateEmail): Promise<TemplateEmail | undefined> {
    try {
      const response = await axios.post(`${this.baseUrl}/config/templates`, attributes);
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      return response.data.template;
    } catch (error) {
      console.error('Error updating config apps:', error);
      throw error;
    }
  }

  async renderTemplate(template: TemplateEmail, filter: string): Promise<TemplateEmail> {
    try {
      const response = await axios.post(`${this.baseUrl}/render-template`, {
        template,
        filter,
      });
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      return response.data.template;
    } catch (error) {
      console.error('Error updating config apps:', error);
      throw error;
    }
  }
}

const clientsPool: { [url: string]: CrmApiClient } = {};

export function crmApiClient(url?: string) {
  const defaultPort = parseInt(process.env.PORT || '3954');
  url = url || `http://localhost:${defaultPort}`;
  return clientsPool[url] ?? (clientsPool[url] = new CrmApiClient(url));
}
