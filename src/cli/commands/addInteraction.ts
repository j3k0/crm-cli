import enquirer from 'enquirer';
import { doYouConfirm } from "../utils";
import { apps } from "../../queries/apps";
import { companies } from "../../queries/companies";
import { contacts } from "../../queries/contacts";
import { interactions } from "../../queries/interactions";
import { Choice, Interaction, Printable } from "../../types";
import { addCompany } from './addCompany';
import { addContact } from './addContact';
import Lib from '../../lib';
import moment from 'moment';
import { DatabaseSession } from '../../database';


export async function addInteraction(database: DatabaseSession, filter: string | undefined): Promise<Interaction & Printable> {
  console.log('');
  console.log('New Interaction:');
  console.log('----------------');

  const data = await database.dump();
  const sumCount: {[summary: string]: number} = {};
  const listOfSummaries = Object.keys((await interactions(database)).content.reduce((acc, x) => {
      acc[x.summary] = (acc[x.summary] || 0) + 1;
      return acc;
  }, sumCount)).sort((a, b) => {
      return sumCount[b] - sumCount[a]; // length - b.length;
  });

  let listOfCompanies = (await companies(database, filter)).content;
  if (listOfCompanies.length === 0) {
      const contact = (await contacts(database, filter)).content;
      if (contact.length > 0)
          listOfCompanies = (await companies(database, contact[0].company)).content;
  }
  if (listOfCompanies.length === 0) {
      const app = (await apps(database, filter)).content;
      if (app.length > 0)
          listOfCompanies = (await companies(database, app[0].company)).content;
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
      const newCompany = await addCompany(database, undefined);
      if ('name' in newCompany) {
        interaction.company = newCompany.name;
      }
  }

  if (interaction.from === 'new_contact') {
      const newContact = await addContact(database, undefined, {company: interaction.company});
      interaction.from = newContact.email;
  }

  if (interaction.followUpDate) {
    interaction.followUpDate = moment(interaction.followUpDate).toISOString();
  }

  // Add it and save
  const newInteraction = await Lib.addInteraction(database, interaction);
  if ('error' in newInteraction) {
      process.exit(1);
  }
  return {
      ...interaction,
      printAsText: async () => { },
  }
};