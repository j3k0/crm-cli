import enquirer from 'enquirer';
import { Company, CompanyAttributes, Database, Printable } from '../../types';
import { doYouConfirm } from '../utils';
import { saveDataSync } from '../../database';

export async function addCompany(data: Database, filter: string | undefined, values: Partial<CompanyAttributes> = {}): Promise<CompanyAttributes & Printable> {
  let company: Partial<CompanyAttributes> = {
      ...values
  };
  console.log('');
  console.log('New Company:');
  console.log('-----------');
  if (!values.name) Object.assign(company, await enquirer.prompt({
      type: 'input',
      name: 'name',
      message: 'Name',
  }));
  if (!values.address) Object.assign(company, await enquirer.prompt({
      type: 'input',
      name: 'address',
      message: 'Address',
  }));
  if (!values.url) Object.assign(company, await enquirer.prompt({
      type: 'input',
      name: 'url',
      message: 'URL',
  }));
  await doYouConfirm();
  // If name is filled and there isn't a company with the given name.
  // Add it and save
  const found = company.name && data.companies.find((c) => c.name.toLowerCase() === company.name!.toLowerCase());
  if (company.name && !found) {
      company.createdAt = new Date().toISOString();
      company.updatedAt = new Date().toISOString();
      company.contacts = [];
      company.interactions = [];
      company.apps = [];
      data.companies.push(new Company(company as CompanyAttributes));
      saveDataSync(data);
      console.log('Company added.');
  }
  else if (found) {
      console.error(`ERROR: A company with name "${company.name}" already exists.`);
      company = found;
  }
  else {
      process.exit(1);
  }
  return {
      ...(company as CompanyAttributes),
      printAsText: () => { },
  }
}
