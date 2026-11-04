import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bunyan from 'bunyan';
import { connectCrmDatabase } from './database';
import { emptyDatabase } from './database/emptyDatabase';
import { randomUUID } from 'crypto';
import { CrmSession } from './crmSession';
import { findContactByFilter, renderTemplateEmail, renderTemplateEmailForContact } from './lib';
import { Company, TemplateEmail } from './types';
import path from 'path';

const log = bunyan.createLogger({
  name: 'crm-server',
});

const MIN_API_KEY_LENGTH = 16;

/** Default limit for JSON request bodies. */
const BODY_LIMIT = '5mb';

/** Limit for POST /reset, which carries a full database import. */
const RESET_BODY_LIMIT = '256mb';

/**
 * Returns the API key from SERVER_API_KEY, or a random one when unset.
 *
 * Refuses weak keys (empty, the old Docker default "change_me", or too short).
 */
function resolveApiKey(): { apiKey: string; generated: boolean } {
  const fromEnv = process.env.SERVER_API_KEY;
  if (!fromEnv) {
    return { apiKey: randomUUID().replace(/-/g, ''), generated: true };
  }
  if (fromEnv === 'change_me' || fromEnv.length < MIN_API_KEY_LENGTH) {
    throw new Error(`SERVER_API_KEY is too weak: use at least ${MIN_API_KEY_LENGTH} random characters (and not "change_me").`);
  }
  return { apiKey: fromEnv, generated: false };
}

/** Constant-time string comparison (hashing first hides the length). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** JSON.parse reviver: drops keys that could alter object prototypes. */
function dropPrototypeKeys(key: string, value: unknown) {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype')
    return undefined;
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidDate(value: string): boolean {
  return !isNaN(Date.parse(value));
}

export async function startCrmApiServer() {
  const app = express();
  const hostname = process.env.HOSTNAME || 'localhost';
  const port = parseInt(process.env.PORT || '3954');
  const { apiKey, generated: apiKeyGenerated } = resolveApiKey();
  const allowReset = process.env.ALLOW_RESET === '1';
  const database = await connectCrmDatabase();

  app.disable('x-powered-by');

  app.use(function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.get('/', function healthCheck(req, res, next) {
    res.json({ok: true}).end();
  });

  app.use('/doc', express.static(path.join(__dirname, '..', 'doc')));

  app.use(
    /**
     * Sets up a logger for each request using the Bunyan logging library.
     * It assigns a unique request ID to each request, either from a well-formed 'x-request-id'
     * header or by generating a new UUID. The logger is then attached to the request object
     * for use in subsequent middleware or route handlers. When the response is sent, it logs
     * the method, the route pattern (not the actual path, which can contain emails or names),
     * the query parameter names (not their values), the status and the duration.
     */
    function setupLogger(req, res, next) {
      let reqId = req.headers['x-request-id'];
      if (Array.isArray(reqId)) reqId = reqId[0];
      if (!reqId || !/^[\w.-]{1,128}$/.test(reqId)) reqId = crypto.randomUUID().toLowerCase();
      req.reqId = reqId;
      req.log = log.child({
        req_id: reqId,
      });
      res.setHeader('x-request-id', reqId);
      const start = Date.now();
      res.on('finish', function logRequest() {
        const route = req.route ? req.baseUrl + req.route.path : '(unmatched)';
        req.log.info({
          status: res.statusCode,
          ms: Date.now() - start,
          query_keys: Object.keys(req.query),
        }, req.method + ' ' + route);
      });
      next();
    });

  /**
   * Middleware function to authenticate incoming requests.
   * 
   * It checks if the request's Authorization header matches the server's API key
   * or if the username/password matches the API key.
   * 
   * If authentication is successful, it calls the next middleware in the stack.
   * Otherwise, it responds with a 401 Unauthorized status.
   *
   * @param {express.Request} req - The Express request object.
   * @param {express.Response} res - The Express response object.
   * @param {express.NextFunction} next - The next middleware function in the stack.
   * @returns {void}
   */
  app.use(async function authenticateRequest(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && safeEqual(authHeader, apiKey)) {
      // authHeader set to the api key
      return next();
    }
    else if (authHeader && authHeader.startsWith('Basic ')) {
      // username or password set to the api key
      // Remove 'Basic ' from the header
      const base64Credentials = authHeader.substring(6);
      // Decode the Base64 string
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      // Split the decoded string into username and password
      const [username, password] = credentials.split(':', 2);

      // Evaluate both comparisons (no short-circuit) to keep timing constant
      const usernameMatches = safeEqual(username ?? '', apiKey);
      const passwordMatches = safeEqual(password ?? '', apiKey);
      if (usernameMatches || passwordMatches) {
        return next();
      }
    }
    res
      .header('WWW-Authenticate', `Basic realm="CRM Server"`)
      .status(401)
      .json({ error: 'Unauthorized' });
  });

  // Body parsing happens after authentication, so anonymous clients can't make
  // the server buffer large bodies. Only /reset accepts large ones.
  const parseJson = express.json({ limit: BODY_LIMIT, reviver: dropPrototypeKeys });
  const parseLargeJson = express.json({ limit: RESET_BODY_LIMIT, reviver: dropPrototypeKeys });
  app.use(function parseBody(req, res, next) {
    if (req.path === '/reset') parseLargeJson(req, res, next);
    else parseJson(req, res, next);
  });

  app.use(function validateBody(req, res, next) {
    if (req.method !== 'POST' && req.method !== 'PUT') return next();
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ error: 'request body must be a JSON object' });
    }
    // Top-level fields starting with "_" are reserved by CouchDB (_id, _rev, _deleted...).
    // Clients must not be able to set them.
    for (const key of Object.keys(req.body)) {
      if (key.startsWith('_')) delete req.body[key];
    }
    next();
  });

  function tryCatch<T>(middleware: (req: Request, res: Response, next: NextFunction) => Promise<T>) {
    return async function (req: Request, res: Response, next: NextFunction) {
      try {
        await middleware(req, res, next);
      }
      catch (err) {
        req.log.warn(err);
        next(err);
      }
    }
  }

  app.post('/reset', tryCatch(
    /**
     * Resets the database with the provided data.
     * 
     * If some required fields aren't specified, they are set from the default empty database structure.
     * 
     * This is useful for initializing the database with a clean state.
     *
     * @api {post} /reset Reset the database
     * @apiName ResetDatabase
     * @apiGroup Database
     *
     * @apiBody {Company[]} companies Companies to import
     * @apiBody {Config} config Initial configuration
     * @apiBody {boolean} update_design_document Refresh couchdb's design document (CouchDB backend only)
     * @apiExample {json} Request-Example:
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
     * @apiSuccessInterface (./types.ts) {Config}
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
     * @apiError (500) {String} error An error message indicating the failure to reset the database.
     *
     * @apiExample {curl} Example usage:
     *     curl -X POST -H "Content-Type: application/json" -d @requestBody.json http://localhost:3954/reset
     *
     * @apiError (403) {String} error Reset is disabled. Only `update_design_document` is allowed unless the server runs with `ALLOW_RESET=1`.
     */
    async function postReset(req, res) {
      if (!allowReset && req.body.update_design_document !== true) {
        return res.status(403).json({ error: 'database reset is disabled on this server (ALLOW_RESET=1 enables it)' });
      }
      const data = {
        ...emptyDatabase(),
        ...req.body
      };
      await database.create(data);
      const session = await database.open();
      try {
        res.json(await session.loadConfig());
      }
      finally {
        await session.close();
      }
    }));

  app.use(tryCatch(
    /**
     * Middleware function to open a database session for each request.
     * 
     * This middleware opens a database session and attaches it to the request object.
     * It also sets up an event listener to close the database session once the response is finished.
     * 
     * @param {express.Request} req - The Express request object.
     * @param {express.Response} res - The Express response object.
     * @param {express.NextFunction} next - The next middleware function in the stack.
     * @returns {void}
     */
    async function openDatabaseSession(req, res, next) {
      req.session = new CrmSession(database);
      // Close database session ('close' also fires when the client aborts)
      res.on('close', async function closeDatabaseSessionOnClose() {
        if (req.session) {
          await req.session.close();
        }
      });
      next();
    }));

  
  /**
   * @api {get} /companies/search/:filter Search for companies
   * @apiName SearchCompanies
   * @apiGroup Companies
   * 
   * @apiDescription Searches for companies based on a filter query.
   * 
   * @apiParam {String} filter The filter to apply when searching for companies (e.g., name=Acme).
   * 
   * @apiSuccessInterface (./types.ts) {Company[]} rows
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "rows": [{
   *         "id": "1",
   *         "name": "Acme Corp",
   *         "url": "https://acme-corp.example.com",
   *         "contacts": [],
   *         "apps": []
   *       }]
   *     }
   * 
   * @apiError {String} error Description of the error.
   * @apiErrorExample {json} Error-Response:
   *     HTTP/1.1 400 Bad Request
   *     {
   *       "error": "Invalid filter syntax"
   *     }
   */
  app.get('/companies/search/:filter', tryCatch(
    async function getSearchCompanies(req, res) {
      res.json({
        rows: await req.session.searchCompanies(req.params.filter)
      });
    }));

  /**
   * @api {get} /dump Dump the content of the database
   * @apiName DumpDatabase
   * @apiGroup Database
   * 
   * @apiDescription Dump the full content of the database
   * 
   * @apiSuccessInterface (./types.ts) {Config} config
   * @apiSuccessInterface (./types.ts) {Company[]} companies
   */
  app.get('/dump', tryCatch(async function getDump(req, res) {
    res.json(await req.session.dump());
  }));

  /**
   * Responds with the result of a CRM library operation, handling both success and error cases.
   * 
   * This function checks if the provided value contains an error. If so, it passes the error to the next middleware.
   * Otherwise, it formats the value using the provided format function and sends it as a JSON response.
   * 
   * @template T - The type of the successful result.
   * @template U - The type of the formatted result sent back to the client.
   * @param {express.Request} req - The Express request object.
   * @param {express.Response} res - The Express response object.
   * @param {express.NextFunction} next - The next middleware function in the stack.
   * @param {T | { error: string }} value - The result of the library operation, which can be either a successful result or an error object.
   * @param {(t: T) => U} format - A function that formats the successful result before sending it as a response.
   */
  function respondWithLibResult<T extends object, U>(req: express.Request, res: express.Response, next: express.NextFunction, value: T | { error: string }, format: (t: T) => U) {
    if ('error' in value) {
      // Library errors are user-facing messages ("company not found"...), safe to return.
      res.status(400).json({ error: value.error });
    }
    else {
      res.json(format(value));
    }
  }

  /**
   * @api {get} /companies
   * Retrieves a list of companies
   * @apiName GetCompanies
   * @apiGroup Companies
   * @apiSuccessInterface (./types.ts) {Company[]} body
   * @apiSuccessExample {json} Success-Response
   * [{
   *   "name": "New Company Name",
   *   "url": "https://newcompany.com",
   *   "contacts": [
   *     {
   *       "email": "newcontact@example.com",
   *       "role": "CTO"
   *     }
   *   ],
   *   "apps": [
   *     {
   *       "appName": "New App",
   *       "plan": "Premium",
   *       "email": "newapp@example.com"
   *     }
   *   ]
   * }]
   */
  app.get('/companies', tryCatch(async function getAllCompanies(req, res) {
    res.json((await req.session.dump()).companies as Company[]);
  }));

  /**
   * @api {get} /companies/:name
   * Retrieves a company by name
   * @apiParam {string} name Name of the company
   * @apiName GetCompany
   * @apiGroup Companies
   * @apiSuccessInterface (./types.ts) {Company} body
   */
  app.get('/companies/:name', tryCatch(async function getFindCompanies(req, res) {
    const company = await req.session.findCompanyByName(req.params.name);
    res.json(company);
  }));

  app.post('/companies', tryCatch(
    /**
    * Handles the creation of a new company.
    * 
    * This endpoint expects a JSON object in the request body with the company's details.
    * If the company is successfully created, it returns the created company object.
    * If the company name already exists or if the request body is missing the 'name' field,
    * it returns a 400 status code with an error message.
    *
    * @api {post} /companies Create a new company
    * @apiName PostCompanies
    * @apiGroup Companies
    *
    * @apiBodyInterface (./types.ts) {Company} body
    * @apiExample {json} Request-Example:
    * {
    *   "name": "Example Company",
    *   "url": "https://example.com",
    *   "contacts": [
    *     {
    *       "email": "contact@example.com",
    *       "role": "CEO"
    *     }
    *   ],
    *   "apps": [
    *     {
    *       "appName": "Example App",
    *       "plan": "Premium",
    *       "email": "app@example.com"
    *     }
    *   ]
    * }
    *
    * @apiSuccess {Object} company The created company object.
    * @apiSuccessExample {json} Success-Response:
    * {
    *   "name": "Example Company",
    *   "url": "https://example.com",
    *   "contacts": [
    *     {
    *       "email": "contact@example.com",
    *       "role": "CEO"
    *     }
    *   ],
    *   "apps": [
    *     {
    *       "appName": "Example App",
    *       "plan": "Premium",
    *       "email": "app@example.com"
    *     }
    *   ]
    * }
    *
    * @apiError (400) {String} error The error message indicating the failure to create the company.
    *
    * @apiExample {curl} Example usage:
    *     curl -X POST -H "Content-Type: application/json" -d @requestBody.json http://localhost:3954/companies
    */ 
  async function postCompanies(req, res, next) {
    const newCompany = req.body; // Assuming the request body contains the new app data
    if ('name' in newCompany) {
      const company = await req.session.addCompany(newCompany);
      respondWithLibResult(req, res, next, company, c => c);
    }
    else {
      res.status(400).json({
        error: 'Failed to add company'
      });
    }
  }));

  app.put('/companies/:name', tryCatch(
    /**
     * Updates an existing company with new attributes.
     * 
     * This endpoint updates a company's attributes based on the provided request body.
     * It requires the company's name to be specified in the URL parameters and optionally
     * allows the new name to be provided in the request body. If the new name is provided,
     * it must match the name specified in the URL parameters.
     * 
     * @api {put} /companies/:name Update a company
     * @apiName PutCompanies
     * @apiGroup Companies
     * 
     * @apiParam {String} name The current name of the company.
     * @apiBody {Object} requestBody The new attributes for the company.
     * @apiExample {json} Request-Example:
     * {
     *   "name": "New Company Name",
     *   "url": "https://newcompany.com",
     *   "contacts": [
     *     {
     *       "email": "newcontact@example.com",
     *       "role": "CTO"
     *     }
     *   ],
     *   "apps": [
     *     {
     *       "appName": "New App",
     *       "plan": "Premium",
     *       "email": "newapp@example.com"
     *     }
     *   ]
     * }
     * 
     * @apiSuccess {Object} company The updated company object.
     * @apiSuccessExample {json} Success-Response:
     * {
     *   "name": "New Company Name",
     *   "url": "https://newcompany.com",
     *   "contacts": [
     *     {
     *       "email": "newcontact@example.com",
     *       "role": "CTO"
     *     }
     *   ],
     *   "apps": [
     *     {
     *       "appName": "New App",
     *       "plan": "Premium",
     *       "email": "newapp@example.com"
     *     }
     *   ]
     * }
     * 
     * @apiError (400) {String} error The error message indicating the failure to update the company.
     * 
     * @apiExample {curl} Example usage:
     *     curl -X PUT -H "Content-Type: application/json" -d @requestBody.json http://localhost:3954/companies/OldCompanyName
     */ 
    async function putCompanies(req, res, next) {
      const name = req.params.name;
      const newCompany = req.body; // Assuming the request body contains the new app data
      const company = await req.session.updateCompany(name, newCompany);
      respondWithLibResult(req, res, next, company, company => ({ company }));
    }));

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
  app.post('/interactions', tryCatch(
    /**
     * Handles the creation of a new interaction.
     * 
     * This endpoint expects a JSON object in the request body with the interaction's details, including the company name.
     * If the interaction is successfully created, it returns the created interaction object.
     * If the company name is missing or if the interaction details are incomplete, it returns a 400 status code with an error message.
     *
     * @api {post} /interactions Create a new interaction
     * @apiName PostInteractions
     * @apiGroup Interactions
     *
     * @apiBody {Object} requestBody The interaction object to be created.
     * @apiExample {json} Request-Example:
     * {
     *   "company": "Example Company",
     *   "summary": "Meeting with the team",
     *   "from": "John Doe",
     *   "date": "2023-04-01T00:00:00.000Z"
     * }
     *
     * @apiSuccess {Object} interaction The created interaction object.
     * @apiSuccessExample {json} Success-Response:
     * {
     *   "company": "Example Company",
     *   "summary": "Meeting with the team",
     *   "from": "John Doe",
     *   "date": "2023-04-01T00:00:00.000Z",
     *   "createdAt": "2023-04-01T00:00:00.000Z"
     * }
     */
    async function postInteractions(req, res, next) {
      const newInteraction = req.body;
      const company: string | undefined = newInteraction.company;
      if (!company || typeof company !== 'string')
        return res.status(400).json({ error: '"company" missing' });
      const result = await req.session.addInteraction(newInteraction);
      respondWithLibResult(req, res, next, result, interaction => ({ interaction }));
    }));

  // PUT to update an interaction
  app.put('/interactions/:companyName/:index', tryCatch(
    /**
     * @param {express.Request} req - The Express request object.
     * @param {express.Response} res - The Express response object.
     * @param {express.NextFunction} next - The next middleware function in the stack.
     * @returns {void}
     */
    async function updateInteractionMiddleware(req, res, next) {
      const company = req.params.companyName;
      if (!/^\d+$/.test(req.params.index))
        return res.status(400).json({ error: 'invalid interaction index' });
      const index = parseInt(req.params.index);
      const result = await req.session.updateInteraction(company, index, req.body);
      respondWithLibResult(req, res, next, result, interaction => ({ interaction }));
    }));

  // POST to clear followup date for an interaction
  app.post('/interactions/:companyName/:index/done', tryCatch(
    /**
     * @param {express.Request} req - The Express request object.
     * @param {express.Response} res - The Express response object.
     * @param {express.NextFunction} next - The next middleware function in the stack.
     * @returns {void}
     */
    async function doneInteractionMiddleware(req, res, next) {
      const company = req.params.companyName;
      if (!/^\d+$/.test(req.params.index))
        return res.status(400).json({ error: 'invalid interaction index' });
      const index = parseInt(req.params.index);
      const result = await req.session.doneInteraction(company, index);
      respondWithLibResult(req, res, next, result, interaction => ({ interaction }));
    }));

  app.get('/interactions', tryCatch(
    /**
     * @param {express.Request} req - The Express request object.
     * @param {express.Response} res - The Express response object.
     * @returns {void}
     */
    async function getInteractions(req, res) {
      const startDate = req.query.start_date ? '' + req.query.start_date : undefined;
      const endDate = req.query.end_date ? '' + req.query.end_date : undefined;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }
      if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return res.status(400).json({ error: 'start_date and end_date must be valid dates' });
      }
      const interactions = await req.session.findInteractions(startDate, endDate);
      res.json({
        interactions
      });
      res.end();
    }));


  app.get('/followups', tryCatch(
    /**
     * @param {express.Request} req - The Express request object.
     * @param {express.Response} res - The Express response object.
     * @returns {void}
     */
    async function getFollowups(req, res) {
      const startDate = req.query.start_date ? '' + req.query.start_date : undefined;
      const endDate = req.query.end_date ? '' + req.query.end_date : undefined;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'start_date and end_date are required' });
      }
      if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return res.status(400).json({ error: 'start_date and end_date must be valid dates' });
      }
      const followups = await req.session.findFollowups(startDate, endDate);
      res.json({
        followups
      });
      res.end();
    }));


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
  app.get('/contacts/by-email/:email', tryCatch(
    async function getFindContactByEmail(req, res) {
      const result = await req.session.findContactByEmail(req.params.email);
      if (!result)
        return res.status(404).json({ error: 'contact not found' });
      res.json({
        ...result.contact,
        company: result.company.name
      });
    }));

  // POST endpoint to create a new contact
  app.post('/contacts', tryCatch(
    async function postContacts(req, res, next) {
      const newContact = req.body; // Assuming the request body contains the new contact data
      const company = newContact.company;
      if (!company || typeof company !== 'string')
        return res.status(400).json({ error: '"company" missing' });
      const added = await req.session.addContact(newContact);
      respondWithLibResult(req, res, next, added, contact => ({ contact }));
    }));

  // PUT endpoint to update an existing contact
  app.put('/contacts/:email', tryCatch(
    async function putContact(req, res, next) {
      const email = req.params.email;
      const result = await req.session.updateContact(email, req.body);
      respondWithLibResult(req, res, next, result, contact => ({contact}));
    }));

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
  app.get('/apps/by-name/:appName', tryCatch(async function getFindApps(req, res) {
    const appName = req.params.appName;
    if (!appName) {
      res.status(400).json({ error: '"appName" is missing' });
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
  }));

  app.get('/apps/by-email/:email', tryCatch(async function getFindAppsByEmail(req, res) {
    const email = req.params.email;
    if (!email) {
      res.status(400).json({ error: '"email" is missing' });
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
  }));

  app.post('/apps', tryCatch(
    /**
     * Handles the creation of a new app.
     * 
     * This endpoint expects a JSON object in the request body with the app's details, including the company name.
     * If the app is successfully created, it returns the created app object.
     * 
     * If the company name is missing or if the app name already exists, it returns a 400 status code with an error message.
     *
     * @api {post} /apps Create a new app
     * @apiName PostApps
     * @apiGroup Apps
     *
     * @apiBody {Object} requestBody The app object to be created.
     * @apiExample {json} Request-Example:
     * {
     *   "company": "Example Company",
     *   "appName": "Example App",
     *   "plan": "Premium",
     *   "email": "app@example.com"
     * }
     *
     * @apiSuccess {Object} app The created app object.
     * @apiSuccessExample {json} Success-Response:
     * {
     *   "company": "Example Company",
     *   "appName": "Example App",
     *   "plan": "Premium",
     *   "email": "app@example.com",
     *   "createdAt": "2023-04-01T00:00:00.000Z",
     *   "upgradedAt": "2023-04-01T00:00:00.000Z",
     *   "updatedAt": "2023-04-01T00:00:00.000Z"
     * }
     *
     * @apiError (400) {String} error The error message indicating the failure to create the app.
     *
     * @apiExample {curl} Example usage:
     *     curl -X POST -H "Content-Type: application/json" -d @requestBody.json http://localhost:3954/apps
     */
    async function postApps(req, res, next) {
      const newApp = req.body;
      const company = newApp.company;
      if (!company || typeof company !== 'string') {
        return res.status(400).json({ error: '"company" missing' });
      }
      const result = await req.session.addApp(newApp);
      respondWithLibResult(req, res, next, result, app => ({ app }));
    }));

  // PUT to update an app
  app.put('/apps/:appName', tryCatch(async function putApps(req, res) {
    const attributes = req.body;
    const added = await req.session.updateApp(req.params.appName, attributes);
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
  }));

  app.put('/config', tryCatch(async function putConfig(req, res) {
    const attributes = req.body;
    const config = await req.session.updateConfig(attributes);
    res.json(config);
  }));

  app.get('/config', tryCatch(async function getConfig(req, res) {
    res.json(await req.session.loadConfig());
  }));

  app.get('/config/staff', tryCatch(async function getConfigStaff(req, res) {
    const staff = (await req.session.loadConfig()).staff;
    res.json(staff);
  }));

  app.post('/config/staff', tryCatch(
    async function postConfigStaff(req, res, next) {
      const newStaff = req.body; // format: { "name": "User Full Name", "email": "email@domain.com" }
      const added = await req.session.addStaff(newStaff);
      respondWithLibResult(req, res, next, added, staff => ({staff}));
    }));

  app.get('/config/templates', tryCatch(async function getConfigTemplates(req, res) {
    const templates = (await req.session.loadConfig()).templates || [];
    const filter = req.query.renderFor;
    if (filter !== undefined && typeof filter !== 'string') {
      return res.status(400).json({ error: '"renderFor" must be a string' });
    }
    if (filter) {
      const elements = await findContactByFilter(req.session, '' + filter);
      const rendered: TemplateEmail[] = [];
      for (const template of templates) {
        rendered.push(await renderTemplateEmail(template, elements));
      }
      res.json({templates: rendered});
    }
    else {
      res.json({templates});
    }
  }));

  app.post('/config/templates', tryCatch(
    async function postConfigTemplates(req, res, next) {
      const newTemplate = req.body; // format: { "content": "Email Content", "subject": "Email Subject" }
      const added = await req.session.addTemplate(newTemplate);
      respondWithLibResult(req, res, next, added, template => ({template}));
    }));

  app.post('/render-template', tryCatch(
    async function postRenderTemplate(req, res, next) {
      const {template, filter} = req.body;
      if (!isPlainObject(template) || typeof template.subject !== 'string' || typeof template.content !== 'string' || typeof filter !== 'string') {
        return res.status(400).json({ error: '"template" ({subject, content}) and "filter" are required' });
      }
      const result = await renderTemplateEmailForContact(req.session, filter, { subject: template.subject, content: template.content });
      res.json({template: result});
    }));

  app.get('*',
    /** Catch requests to non existing endpoints */
    function notFound(req, res, next) {
      res.status(404).json({ error: 'endpoint not found' });
    });

  app.use(
    /**
     * Middleware function to handle errors in the application.
     * 
     * This function logs the error. Client errors flagged as safe to expose (e.g. malformed or
     * too large JSON bodies) are returned with their status and message. Anything else gets a
     * generic 500 response with the request ID, so internals (database URLs, stack details)
     * never reach the client.
     */ 
    function handleErrors(err: any, req: express.Request, res: express.Response, next: express.NextFunction): void {
      req.log.warn(err);
      if (res.headersSent) {
        return next(err)
      }
      if (err?.expose && typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'internal server error', request_id: req.reqId });
    });

  // Start the server
  app.listen(port, hostname, () => {
    const url = `http://${hostname}:${port}`;
    console.log(`CRM API server running at ${url}`);
    if (apiKeyGenerated) {
      // Only a generated key is printed: it's the only way to learn it.
      console.log(`SERVER_API_KEY is not set, using a random key for this run: ${apiKey}\n`
        + `Test some endpoints (user "admin", password = the key):\n`
        + ` - ${url}/config\n`
        + ` - ${url}/companies\n`);
    }
    if (allowReset) {
      console.log('ALLOW_RESET=1: POST /reset can overwrite the database.');
    }
  });

  
}

// if this script is the entrypoint, call createServer
if (require.main === module) {
  startCrmApiServer().catch(err => {
    log.error(err, 'Failed to start the CRM API server');
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    log.error(err, 'Uncaught Exception:');
    // process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    log.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  });
}