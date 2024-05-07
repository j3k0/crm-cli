import express from 'express';
import { initDataSync, loadDataSync } from './database';
import { companies } from './queries/companies';
import Lib from './lib';
import { contacts } from './queries/contacts';
import { interactions } from './queries/interactions';
import { apps } from './queries/apps';
import { findApp, findCompany, findContact } from './queries/requests';

const app = express();
const port = parseInt(process.env.PORT || '3954');

app.use(express.json());

app.post('/reset', (req, res) => {
  initDataSync();
  res.json(loadDataSync());
});

app.get('/companies', (req, res) => {
    res.json({
      rows: companies(loadDataSync()).content
    });
});

app.get('/companies/search/:filter', (req, res) => {
    res.json({
      rows: companies(loadDataSync(), req.params.filter).content
    });
});

app.get('/companies/find/:name', (req, res) => {
    console.log(`GET /companies/find/${req.params.name}`);
    res.json({
      rows: findCompany(loadDataSync(), req.params.name)
    });
});

app.post('/companies', (req, res) => {
  const newCompany = req.body; // Assuming the request body contains the new app data
  const company = Lib.addCompany(loadDataSync(), newCompany);
  if ('name' in newCompany) {
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

// GET endpoint to retrieve all interactions
app.get('/interactions', (req, res) => {
    res.json({
        rows: interactions(loadDataSync()).content,
    });
});

// GET endpoint to retrieve some interactions
app.get('/interactions/search/:filter', (req, res) => {
    res.json({
        rows: interactions(loadDataSync(), req.params.filter).content,
    });
});

// POST to add an interaction
app.post('/interactions', (req, res) => {
  const newInteraction = req.body;
  const added = Lib.addInteraction(loadDataSync(), newInteraction);
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
app.get('/contacts', (req, res) => {
    res.json({
        rows: contacts(loadDataSync()).content,
    });
});

// GET endpoint to retrieve some contacts
app.get('/contacts/search/:filter', (req, res) => {
    res.json({
        rows: contacts(loadDataSync(), req.params.filter).content,
    });
});

// GET endpoint to retrieve some contacts
app.get('/contacts/find/:email', (req, res) => {
    res.json(findContact(loadDataSync(), req.params.email)?.contact);
});

// POST endpoint to create a new contact
app.post('/contacts', (req, res) => {
    const newContact = req.body; // Assuming the request body contains the new contact data
    const added = Lib.addContact(loadDataSync(), newContact);
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
app.get('/apps', (req, res) => {
    res.json({
        rows: apps(loadDataSync()).content,
    });
});

// GET endpoint to retrieve some apps
app.get('/apps/search/:filter', (req, res) => {
    res.json({
        rows: apps(loadDataSync(), req.params.filter).content,
    });
});

// GET endpoint to retrieve some apps
app.get('/apps/find/:appName', (req, res) => {
    res.json(findApp(loadDataSync(), req.params.appName)?.app);
});

// POST to add an app
app.post('/apps', (req, res) => {
  const newApp = req.body;
  const added = Lib.addApp(loadDataSync(), newApp);
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
app.put('/apps/:appName', (req, res) => {
  const attributes = req.body;
  console.log(`PUT /apps/${req.params.appName}: ${JSON.stringify(attributes)}`);
  const added = Lib.editApp(loadDataSync(), req.params.appName, attributes);
  if ('error' in added) {
    res.status(400).json({
      message: 'Failed to updated app: ' + added.error
    });
  }
  else {
    res.json({
      message: 'App added successfully',
      app: added,
    });
  }
});

app.put('/config', (req, res) => {
  const attributes = req.body;
  res.json(Lib.editConfig(loadDataSync(), attributes));
});

app.get('/config', (req, res) => {
  res.json(loadDataSync().config);
});

app.get('/config/staff', (req, res) => {
  res.json(loadDataSync().config.staff);
});

app.post('/config/staff', (req, res) => {
  const newStaff = req.body; // format: { "name": "User Full Name", "email": "email@domain.com" }
  const added = Lib.addStaff(loadDataSync(), newStaff);
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
