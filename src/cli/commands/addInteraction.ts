import enquirer from 'enquirer';
import { doYouConfirm } from "../utils";
import { apps } from "../../queries/apps";
import { companies } from "../../queries/companies";
import { contacts } from "../../queries/contacts";
import { interactions } from "../../queries/interactions";
import { Choice, Database, Interaction, Printable } from "../../types";
import { findCompany, findContact } from '../../queries/requests';
import { saveDataSync } from '../../database';
import { addCompany } from './addCompany';
import { addContact } from './addContact';


export async function addInteraction(data: Database, filter: string | undefined): Promise<Interaction & Printable> {
  console.log('');
  console.log('New Interaction:');
  console.log('----------------');

  const sumCount: {[summary: string]: number} = {};
  const listOfSummaries = Object.keys(interactions(data).content.reduce((acc, x) => {
      acc[x.summary] = (acc[x.summary] || 0) + 1;
      return acc;
  }, sumCount)).sort((a, b) => {
      return sumCount[b] - sumCount[a]; // length - b.length;
  });

  let listOfCompanies = companies(data, filter).content;
  if (listOfCompanies.length === 0) {
      const contact = contacts(data, filter).content;
      if (contact.length > 0)
          listOfCompanies = companies(data, contact[0].company).content;
  }
  if (listOfCompanies.length === 0) {
      const app = apps(data, filter).content;
      if (app.length > 0)
          listOfCompanies = companies(data, app[0].company).content;
  }
  const newCompany: Choice = {
      message: 'New Company',
      value: 'new_company',
  };
  let listOfChoices: (Choice | string)[] = listOfCompanies.map(c => c.name);
  if (listOfChoices.length == 1)
      listOfChoices = listOfChoices.concat([newCompany]);
  else
      listOfChoices = ([newCompany] as (Choice | string)[]).concat(listOfChoices);

  const interaction: (Interaction & {company: string}) = await enquirer.prompt([{
      type: 'autocomplete',
      name: 'company',
      message: 'Company Name',
      choices: listOfCompanies.map((c) => c.name || c),
      limit: 10,
  }, {
      type: 'autocomplete',
      name: 'kind',
      message: 'Kind',
      choices: data.config.interactions.kinds,
  }, {
      type: 'autocomplete',
      name: 'tag',
      message: 'Tag',
      choices: ([{
          message: '<empty>',
          value: '',
      }] as (Choice | string)[]).concat(data.config.interactions.tags),
      limit: 10,
  }, {
  }]);

  let newSummary = '';
  
  Object.assign(interaction, await enquirer.prompt([{
      type: 'autocomplete',
      name: 'from',
      message: 'From',
      choices: data.companies
          .filter(c => interaction.company === c.name)
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
              }].concat(Object.keys(data.config.staff).map((email) => ({
                  message: `${data.config.staff[email]} <${email}>`,
                  value: email,
              })))),
      limit: 10
  }, {
      type: 'input',
      name: 'date',
      message: 'Date',
  }, {
      type: 'input',
      name: 'followUpDate',
      message: 'Follow-Up Date',
  }, {
      type: 'autocomplete',
      name: 'summary',
      message: 'Summary',
      limit: 3,
      choices: (listOfSummaries as (string | Choice)[]).concat({
          value: 'new_summary',
          message: '',
      }),
      suggest: (input: string, choices: Choice[]) => {
          const inputLowerCase = input.toLowerCase();
          return choices.filter(choice =>
              choice.value === 'new_summary'
              && (newSummary = choice.message = input)
              || choice.message.toLowerCase().startsWith(inputLowerCase));
      },
  }]));
  await doYouConfirm();
  interaction.tag = interaction.tag?.replace('<empty>', '');

  if (interaction.summary === 'new_summary')
      interaction.summary = newSummary;

  if (interaction.company === 'new_company') {
      const newCompany = await addCompany(data, undefined);
      interaction.company = newCompany.name;
  }

  if (interaction.from === 'new_contact') {
      const newContact = await addContact(data, undefined, {company: interaction.company});
      interaction.from = newContact.email;
  }

  // Add it and save
  const companyName = interaction.company;
  const company = findCompany(data, companyName); // fuzzy search for the company
  delete (interaction as any).company;
  const contact = findContact(data, interaction.from);
  if (company && contact) {
      // interaction.createdAt = new Date().toISOString();
      // Find the company in the data
      interaction.date = interaction.date || new Date().toISOString();
      interaction.from = contact.email;
      company.interactions.push(interaction);
      saveDataSync(data);
      console.log('Interaction added.');
  }
  else if (!company) {
      console.error(`ERROR: Company with name "${companyName}" doesn't exists.`);
      process.exit(1);
  }
  else if (!contact) {
      console.error(`ERROR: Contact with email "${interaction.from}" doesn't exists.`);
      process.exit(1);
  }
  return {
      ...interaction,
      printAsText: () => { },
  }
};

