import enquirer from 'enquirer';
import { App, Choice, Database } from "../../types";
import { doYouConfirm } from '../utils';
import { addCompany } from './addCompany';
import { addContact } from './addContact';
import Lib from '../../lib';
import { DatabaseSession } from '../../database';

export const addApp = async (database: DatabaseSession, filter: string, values: Partial<App & {company?: string}> = {}) => {
  const data = await database.dump();
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
      const newCompany = await addCompany(database, undefined);
      if ('name' in newCompany)
        app.company = newCompany.name;
  }

  if (app.email === 'new_contact') {
      const newContact = await addContact(database, undefined, {company: app.company});
      app.email = newContact.email;
  }

  const addedApp = await Lib.addApp(database, app);
  if ('error' in addedApp) {
    process.exit(1);
  }
  return {
    ...addedApp,
    printAsText: () => { },
  };
};
