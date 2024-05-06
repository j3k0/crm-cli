import enquirer from 'enquirer';
import { App, Choice, Database } from "../../types";
import { doYouConfirm } from '../utils';
import { addCompany } from './addCompany';
import { addContact } from './addContact';
import { saveDataSync } from '../../database';
import { findCompany } from '../../queries/requests';

export const addApp = async (data: Database, filter: string, values: Partial<App & {company?: string}> = {}) => {
  console.log('');
  console.log('New App:');
  console.log('--------');
  const app: Partial<App & {company?: string}> = await enquirer.prompt([{
      type: 'input',
      initial: values.appName,
      name: 'appName',
      message: 'Application Name',
  }, {
      type: 'autocomplete',
      name: 'company',
      message: 'Company Name',
      choices: ([{
          message: 'New Company',
          value: 'new_company',
      }] as (Choice | string)[]).concat(data.companies.map((c) => c.name)),
      limit: 10,
      initial: values.company,
  }, {
      type: 'select',
      name: 'plan',
      message: 'Plan',
      choices: data.config.subscriptionPlans,
      initial: values.plan,
  }]);
  
  Object.assign(app, await enquirer.prompt([{
      type: 'autocomplete',
      name: 'email',
      message: 'Contact',
      choices: data.companies
          .filter(c => app.company === c.name)
          .reduce((acc, company) =>
              company.contacts.reduce((acc, c) => {
                  acc.push({
                      message: `${c.firstName} ${c.lastName} <${c.email}>`,
                      value: c.email,
                  });
                  return acc;
              }, acc), [{
                  message: 'New Contact',
                  value: 'new_contact',
              }]),
      limit: 10,
  }, {
      type: 'input',
      name: 'createdAt',
      message: 'Creation date',
  }, {
      type: 'input',
      name: 'upgradedAt',
      message: 'Upgrade date',
  }]));
  await doYouConfirm();

  if (app.company === 'new_company') {
      const newCompany = await addCompany(data, undefined);
      app.company = newCompany.name;
  }

  if (app.email === 'new_contact') {
      const newContact = await addContact(data, undefined, {company: app.company});
      app.email = newContact.email;
  }

  // If name is filled and there isn't a company with the given name.
  // Add it and save
  const companyName = app.company;
  const company = findCompany(data, companyName); // fuzzy search for the company
  delete app.company;
  if (company) {
      app.createdAt = (app.createdAt ? new Date(app.createdAt) : new Date()).toISOString();
      app.upgradedAt = app.upgradedAt ? new Date(app.upgradedAt).toISOString() : undefined;
      app.updatedAt = new Date().toISOString();
      // Find the company in the data
      company.apps.push(app as App);
      saveDataSync(data);
      console.log('App added.');
  }
  else {
      console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
      process.exit(1);
  }
  return {
    ...app,
    printAsText: () => { },
  };
};
