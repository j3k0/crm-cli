import express from 'express';
import { initData, loadData } from './database';
import { companies } from './queries/companies';
import Lib from './lib';
import { contacts } from './queries/contacts';
import { interactions } from './queries/interactions';
import { apps } from './queries/apps';
import { findAppByName, findCompanyByName, findContact } from './queries/requests';

const app = express();
const port = parseInt(process.env.PORT || '3954');

app.use(express.json());

app.post('/reset', async function postReset(req, res) {
  await initData();
  res.json(await loadData("config"));
});

app.get('/companies', async function getCompanies(req, res) {
    res.json({
      rows: companies(await loadData("all")).content
    });
});

app.get('/companies/search/:filter', async function getSearchCompanies(req, res) {
    res.json({
      rows: companies(await loadData("all"), req.params.filter).content
    });
});

app.get('/companies/find/:name', async function getFindCompanies(req, res) {
    console.log(`GET /companies/find/${req.params.name}`);
    res.json(findCompanyByName(await loadData({ company: req.params.name }), req.params.name));
});

app.post('/companies', async function postCompanies(req, res) {
  const newCompany = req.body; // Assuming the request body contains the new app data
  if ('name' in newCompany) {
    const company = await Lib.addCompany(await loadData({company: newCompany.name}), newCompany);
    res.json({
      message: 'Company added successfully',
      company,
    });
  }
  else {
    res.status(400).json({
      message: 'Failed to add company'
    });
  }
});

app.put('/companies/:name', async function postCompanies(req, res) {
  const newCompany = req.body; // Assuming the request body contains the new app data
  const name = req.params.name;
  if (name && name === newCompany.name) {
    const company = await Lib.editCompany(await loadData({company: name}), name, newCompany);
    res.json({
      message: 'error' in company ? company.error : 'Company updated',
      company,
    });
  }
  else {
    res.status(400).json({ message: 'Failed to update company' });
  }
});

// GET endpoint to retrieve all interactions
app.get('/interactions', async function getInteractions(req, res) {
    res.json({
        rows: interactions(await loadData("all")).content,
    });
});

// GET endpoint to retrieve some interactions
app.get('/interactions/search/:filter', async function searchInteractions(req, res) {
    res.json({
        rows: interactions(await loadData("all"), req.params.filter).content,
    });
});

// POST to add an interaction
app.post('/interactions', async function postInteractions(req, res) {
  const newInteraction = req.body;
  const company = newInteraction.company;
  if (!company) {
    res.status(400).json({ message: '"company" missing' });
    return;
  }
  const added = await Lib.addInteraction(await loadData({ company }), newInteraction);
  if ('error' in added) {
    res.status(400).json({
      message: 'Failed to add interaction: ' + added.error
    });
  }
  else {
    res.json({
      message: 'App added successfully',
      app: added,
    });
  }
});


// GET endpoint to retrieve all contacts
app.get('/contacts', async function getContacts(req, res) {
    res.json({
        rows: contacts(await loadData("all")).content,
    });
});

// GET endpoint to retrieve some contacts
app.get('/contacts/search/:filter', async function getSearchContacts (req, res) {
    res.json({
        rows: contacts(await loadData("all"), req.params.filter).content,
    });
});

// GET endpoint to retrieve some contacts
app.get('/contacts/find/:email', async function getFindContacts(req, res) {
    res.json(findContact(await loadData("all"), req.params.email)?.contact);
});

// POST endpoint to create a new contact
app.post('/contacts', async function postContacts(req, res) {
    const newContact = req.body; // Assuming the request body contains the new contact data
    const company = newContact.company;
    if (!company) {
      res.status(400).json({ message: '"company" missing' });
      return;
    }
    const added = await Lib.addContact(await loadData({company}), newContact);
    if ('error' in added) {
      res.status(400).json({
        message: 'Failed to add interaction: ' + added.error
      });
      return;
    }
    res.json({
        message: 'Contact added successfully',
        contact: added,
    });
});

// PUT endpoint to update an existing contact
app.put('/contacts/:email', (req, res) => {
    const contactEmail = req.params.email;
    const updatedContact = req.body; // Assuming the request body contains the updated contact data
    // Implement logic to update an existing contact
    res.json({
        message: 'Contact updated successfully',
        contact: {}, // Replace with actual contact data
    });
});

// DELETE endpoint to delete a contact
app.delete('/contacts/:id', (req, res) => {
    const contactId = req.params.id;
    // Implement logic to delete a contact
    res.json({
        message: 'Contact deleted successfully',
    });
});

// GET endpoint to retrieve all apps
app.get('/apps', async function getApps(req, res) {
    res.json({
        rows: apps(await loadData("all")).content,
    });
});

// GET endpoint to retrieve some apps
app.get('/apps/search/:filter', async function getSearchApps(req, res) {
    res.json({
        rows: apps(await loadData("all"), req.params.filter).content,
    });
});

// GET endpoint to retrieve an app
app.get('/apps/find/:appName', async function getFindApps(req, res) {
  const appName = req.params.appName;
  if (!appName) {
    res.status(400).json({ message: '"appName" is missing' });
    return;
  }
  const result = findAppByName(await loadData({ appName }), appName);
  if (!result) {
    return res.status(404);
  }
  res.json({
    ...result.app,
    company: result.company.name,
  });
});

// POST to add an app
app.post('/apps', async function postApps(req, res) {
  const newApp = req.body;
  const company = newApp.company;
  if (!company) {
    res.status(400).json({ message: '"company" missing' });
    return;
  }
  const added = await Lib.addApp(await loadData({ company }), newApp);
  if ('error' in added) {
    res.status(400).json({
      message: 'Failed to add app: ' + added.error
    });
  }
  else {
    res.json({
      message: 'App added successfully',
      app: added,
    });
  }
});

// PUT to update an app
app.put('/apps/:appName', async function putApps(req, res) {
  const attributes = req.body;
  console.log(`PUT /apps/${req.params.appName}: ${JSON.stringify(attributes)}`);
  const added = await Lib.editApp(await loadData({ appName: req.params.appName }), req.params.appName, attributes);
  if ('error' in added) {
    res.status(400).json({
      message: 'Failed to update app: ' + added.error
    });
  }
  else {
    res.json({
      message: 'App updated successfully',
      app: added,
    });
  }
});

app.put('/config', async function putConfig(req, res) {
  const attributes = req.body;
  res.json(await Lib.editConfig(await loadData("config"), attributes));
});

app.get('/config', async function getConfig(req, res) {
  res.json((await loadData("config")).config);
});

app.get('/config/staff', async function getConfigStaff(req, res) {
  res.json((await loadData("config")).config.staff);
});

app.post('/config/staff', async function postConfigStaff(req, res) {
  const newStaff = req.body; // format: { "name": "User Full Name", "email": "email@domain.com" }
  const added = await Lib.addStaff(await loadData("config"), newStaff);
  if ('error' in added) {
    res.status(400).json({ message: 'Failed to add staff: ' + added.error });
  }
  else {
    res.json({
      message: 'Staff added successfully',
      staff: added,
    });
  }
});

// Start the server
app.listen(port, () => {
    console.log(`CRM API server running at http://localhost:${port}`);
});
