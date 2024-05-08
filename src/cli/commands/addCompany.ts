import enquirer from 'enquirer';
import { Company, CompanyAttributes, Database, Printable } from '../../types';
import { doYouConfirm } from '../utils';
import { DatabaseSession } from '../../database';
import Lib from '../../lib';

export async function addCompany(database: DatabaseSession, filter: string | undefined, values: Partial<CompanyAttributes> = {}): Promise<(CompanyAttributes | {}) & Printable> {
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
  const ret = await Lib.addCompany(database, company);
  if ('error' in ret) {
    console.error(ret.error);
    process.exit(1);
  }
  return {
      ...ret,
      printAsText: () => { },
  }
}
