import express from 'express';
import Lib from './lib';
import { DatabaseAdapter, connectDatabase } from './database';
import { emptyDatabase } from './database/emptyDatabase';

export async function createServer() {
  const app = express();
  const hostname = process.env.HOSTNAME || 'localhost';
  const port = parseInt(process.env.PORT || '3954');
  const database = await connectDatabase();

  app.use(express.json());

  /**
   * Resets the database with the provided data, merging it with the default empty database structure.
   * 
   * This is useful for initializing the database with a clean state.
   *
   * @api {post} /reset Reset the database
   * @apiName ResetDatabase
   * @apiGroup Database
   *
   * @apiParam {Object} requestBody Initial database structure.
   * @apiParamExample {json} Request-Example:
   * {
   *   "companies": [
   *     {
   *       "name": "Example Company",
   *       "url": "https://example.com",
   *       "contacts": [
   *         {
   *           "email": "contact@example.com",
   *           "role": "CEO"
   *         }
   *       ],
   *       "apps": [
   *         {
   *           "appName": "Example App",
   *           "plan": "Premium",
   *           "email": "app@example.com"
   *         }
   *       ]
   *     }
   *   ],
   *   "config": {
   *     "subscriptionPlans": ["Free", "Premium"],
   *     "staff": {
   *       "john@example.com": "John Doe"
   *     },
   *     "interactions": {
   *       "kinds": ["email", "phone"],
   *       "tags": ["urgent", "follow-up"]
   *     }
   *   }
   * }
   *
   * @apiSuccess {Object} config The configuration of the database after resetting.
   * @apiSuccessExample {json} Success-Response:
   * {
   *   "subscriptionPlans": ["Free", "Premium"],
   *   "staff": {
   *     "john@example.com": "John Doe"
   *   },
   *   "interactions": {
   *     "kinds": ["email", "phone"],
   *     "tags": ["urgent", "follow-up"]
   *   }
   * }
   *
   * @apiError (500) {String} message An error message indicating the failure to reset the database.
   *
   * @apiExample {curl} Example usage:
   *     curl -X POST -H "Content-Type: application/json" -d @requestBody.json http://localhost:3954/reset
   */
  app.post('/reset', async function postReset(req, res) {
    const data = {
      ...emptyDatabase(),
      ...req.body
    };
    await database.create(data);
    const session = await database.open();
    res.json(await session.loadConfig());
  });

  // Open a database session when request starts
  // Close it when it ends
  app.use(async function openDatabaseSession(req, res, next) {
    req.session = await database.open();
      // Close database session
      res.on('finish', async function closeDatabaseSessionOnFinish() {
        if (req.session) {
          req.session.close();
        }
      });
    next();
  });

  // app.get('/companies/search/:filter', async function getSearchCompanies(req, res) {
  //   res.json({
  //     rows: await req.session.searchCompanies(req.params.filter).content
  //   });
  // });

  app.get('/dump', async function getDump(req, res) {
    console.log(`GET /dump`);
    res.json(await req.session.dump());
  });

  app.get('/companies', async function getAllCompanies(req, res) {
    res.json((await req.session.dump()).companies);
  });

  app.get('/companies/find/:name', async function getFindCompanies(req, res) {
    console.log(`GET /companies/find/${req.params.name}`);
    const company = await req.session.findCompanyByName(req.params.name);
    res.json(company);
  });

  app.post('/companies', async function postCompanies(req, res) {
    const newCompany = req.body; // Assuming the request body contains the new app data
    if ('name' in newCompany) {
      const company = await Lib.addCompany(req.session, newCompany);
      res.json(company);
    }
    else {
      res.status(400).json({
        error: 'Failed to add company'
      });
    }
  });

  app.put('/companies/:name', async function putCompanies(req, res) {
    console.log(`PUT /companies/${req.params.name}`);
    const newCompany = req.body; // Assuming the request body contains the new app data
    console.log(JSON.stringify(newCompany, null, 4));
    const name = req.params.name;
    if (name && !newCompany.name || (name === newCompany.name)) {
      const company = await Lib.editCompany(req.session, name, newCompany);
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
  // app.get('/interactions', async function getInteractions(req, res) {
  //   res.json({
  //     rows: interactions(await loadData("all")).content,
  //   });
  // });

  // GET endpoint to retrieve some interactions
  // app.get('/interactions/search/:filter', async function searchInteractions(req, res) {
  //   res.json({
  //     rows: interactions(await loadData("all"), req.params.filter).content,
  //   });
  // });

  // POST to add an interaction
  app.post('/interactions', async function postInteractions(req, res) {
    const newInteraction = req.body;
    const company: string | undefined = newInteraction.company;
    if (!company || typeof company !== 'string') {
      res.status(400).json({ message: '"company" missing' });
      return;
    }
    const added = await Lib.addInteraction(req.session, newInteraction);
    if ('error' in added) {
      res.status(400).json({
        message: 'Failed to add interaction: ' + added.error
      });
    }
    else {
      res.json({
        message: 'Interaction added successfully',
        interaction: added,
      });
    }
  });

  // GET endpoint to retrieve all contacts
  // app.get('/contacts', async function getContacts(req, res) {
  //   res.json({
  //     rows: contacts(await loadData("all")).content,
  //   });
  // });

  // GET endpoint to retrieve some contacts
  // app.get('/contacts/search/:filter', async function getSearchContacts(req, res) {
  //   res.json({
  //     rows: contacts(await loadData("all"), req.params.filter).content,
  //   });
  // });

  // GET endpoint to retrieve a contact by email
  app.get('/contacts/by-email/:email', async function getFindContacts(req, res) {
    console.log('GET /contacts/by-email/' + req.params.email);
    res.json(await req.session.findContactByEmail(req.params.email));
  });

  // POST endpoint to create a new contact
  app.post('/contacts', async function postContacts(req, res) {
    console.log('POST /contacts');
    const newContact = req.body; // Assuming the request body contains the new contact data
    const company = newContact.company;
    if (!company) {
      res.status(400).json({ message: '"company" missing' });
      return;
    }
    const added = await Lib.addContact(req.session, newContact);
    if ('error' in added) {
      res.status(400).json({
        message: 'Failed to add contact: ' + added.error
      });
      return;
    }
    res.json({
      message: 'Contact added successfully',
      contact: added,
    });
  });

  // PUT endpoint to update an existing contact
  // app.put('/contacts/:email', (req, res) => {
  //   const contactEmail = req.params.email;
  //   const updatedContact = req.body; // Assuming the request body contains the updated contact data
  //   // Implement logic to update an existing contact
  //   res.json({
  //     message: 'Contact updated successfully',
  //     contact: {}, // Replace with actual contact data
  //   });
  // });

  // DELETE endpoint to delete a contact
  // app.delete('/contacts/:id', (req, res) => {
  //   const contactId = req.params.id;
  //   // Implement logic to delete a contact
  //   res.json({
  //     message: 'Contact deleted successfully',
  //   });
  // });

  // GET endpoint to retrieve all apps
  // app.get('/apps', async function getApps(req, res) {
  //   res.json({
  //     rows: apps(await loadData("all")).content,
  //   });
  // });

  // GET endpoint to retrieve some apps
  // app.get('/apps/search/:filter', async function getSearchApps(req, res) {
  //   res.json({
  //     rows: apps(await loadData("all"), req.params.filter).content,
  //   });
  // });

  // GET endpoint to retrieve an app
  app.get('/apps/by-name/:appName', async function getFindApps(req, res) {
    console.log('GET /apps/by-name/' + req.params.appName);
    const appName = req.params.appName;
    if (!appName) {
      res.status(400).json({ message: '"appName" is missing' });
      return;
    }
    const result = await req.session.findAppByName(appName);
    if (!result) {
      return res.status(404).json({ error: 'app not found' });
    }
    res.json({
      ...result.app,
      company: result.company.name,
    });
  });

  app.get('/apps/by-email/:email', async function getFindAppsByEmail(req, res) {
    console.log('GET /apps/by-email/' + req.params.email);
    const email = req.params.email;
    if (!email) {
      res.status(400).json({ message: '"email" is missing' });
      return;
    }
    const result = await req.session.findAppByEmail(email);
    if (!result) {
      return res.status(404).json({ error: 'app not found' });
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
    const added = await Lib.addApp(req.session, newApp);
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
    const added = await Lib.editApp(req.session, req.params.appName, attributes);
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
    const config = await Lib.editConfig(req.session, attributes);
    res.json(config);
  });

  app.get('/config', async function getConfig(req, res) {
    const session = await database.open();
    const config = await session.loadConfig();
    res.json(config);
    session.close();
  });

  app.get('/config/staff', async function getConfigStaff(req, res) {
    const staff = (await (await database.open()).loadConfig()).staff
    res.json(staff);
  });

  app.post('/config/staff', async function postConfigStaff(req, res) {
    const newStaff = req.body; // format: { "name": "User Full Name", "email": "email@domain.com" }
    const added = await Lib.addStaff(req.session, newStaff);
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
  app.listen(port, hostname, () => {
    console.log(`CRM API server running at http://${hostname}:${port}`);
  });
}

// if this script is the entrypoint, call createServer
if (require.main === module) {
  createServer();
}