# crm-cli

A command-line Customer Relationship Management software.

## Who is it for?

The geek entrepreneur.

## Why?

 * You own your data.
 * Use an open text-based format:
   * JSON it is.
   * You can create custom reporting tools.
   * You can create your own integrations (import, export, ...)
 * Open-source:
   * The code is very concise, hack into it!

## Installation

    npm install -g crm-cli

## Usage

Get into the directory where you want your data to be stored.
Something shared on Dropbox (or whatever) is a good idea.

The run the bellow command to initialize your data file.

    crm init-crm

This creates a file called `crm.json` in the current directory. You can change the path to that file using the `DATABASE_JSON_FILE` environment variable (example: `DATABASE_JSON_FILE=/home/user/crm.json`)

The full list of commands supported by the tool is available by just entering
`crm` on the command line.

```
usage: crm COMMAND [filter]

Available commands:

 - reports:

    i,interactions ... list of interactions.
    com,companies .... list of companies.
    con,contacts ..... list of contacts.
    a,apps ........... list of apps.
    about ............ all we know about a contact / company.
    f,followup ....... list of required follow-up.

 - data entry:

    add-company ............ register a new company.
    add-contact ............ register a new contact.
    add-app ................ register a new app.
    add-i,add-interaction .. register a new customer interaction.

    edit-company .............. edit an existing company.
    edit-contact .............. edit an existing contact.
    edit-app .................. edit an existing app.
    edit-i,edit-interaction ... edit an existing interaction.
    done ...................... remove follow-up date from interaction.

 - email:

    template FILE .......... fill in values for an email template.
    template-help .......... show the list of template fields.

 - system:

    init-crm ........ create data file in current directory.

```

## Non-local usage

CRM cli features client server architecture.

You can launch a server:

```sh
export SERVER_API_KEY=myapikey
export HOSTNAME=127.0.0.1 # that's the default
export PORT=3000
export DATABASE_URL=file://database.json
crm server
```

Then connect the CRM client to the server:

```sh
export DATABASE_URL=http://myapikey@127.0.0.1:3000
# reset the database, or do whatever
crm init-crm
```

Notice that the CRM server doesn't support SSL, so it's strongly recommended you only expose it through a reverse proxy.

## Note on filters

All reports commands accepts a filter argument, used to restrict the data display.

The filter is a fuzzy case-insensitive operator.

Examples:

 * `crm about microsoft` will show all data you have about `Microsoft`.
 * `crm about marc twain` will show all data you have about `Marc Twain`.

## Best practices

 * Put the `crm.json` file in version control.

## Template emails

Here is how I use the template feature.

I create a file that contains the headers and body of an email (see templates/subscriber-followup.txt for an example)

To initiate an email to our newly subscribed customer (Microsoftware in this example):

```
crm template tempates/fup-registration.txt Microsoftware > email.txt
neomutt -H email.txt
```

This will open a Draft in mutt with all fields replaced.

I guess not everyone uses neomutt, but it's easy to adjust to your need. You can simply paste the output of the `crm template` command and compose your email from gmail or whatever.

## Data format

`crm.json` contains JSON formatted data.

The root element is an array of *Companies*.

#### Company

A *Company* has the following attributes:

 * `name`: string
 * `url`: string
 * `address`: string
 * `contacts`: array of *Contacts*
 * `interactions`: array of *Interactions*
 * `apps`: array of *Apps*

#### Contact

A *Contact* has the following attributes:

 * `firstName`: string
 * `lastName`: string
 * `role`: string
 * `email`: string

The `email` field is considered a primary key. Should appear in only 1 *Contact*
across all *Companies*.

#### Interaction

An *Interaction* has the following attributes:

 * `kind`: string -- the type of interaction (email, github, automated, ...)
 * `date`: string -- date of the interaction (anything javascript `Date` constructor can parse)
 * `from`: string -- email address of the contact
 * `summary`: string -- short summary of the interaction
 * `content`: string (optional) -- full interaction
 * `followUpDate`: string (optional) -- when a follow-up is due

#### Apps

An *App* has the following attributes:

 * `appName`
 * `plan`
 * `email`
 * `createdAt`
 * `upgradedAt`
 * `churnedAt`

Apps is basically one of your products or subscription you're trying to sell...
It's specific to my use case, if the tool is useful to others, we might make the
*App* concept a little more generic.

## Interested by the idea?

Am I launching a rock in the water by sharing this on github? Do you have some interest? Let me know!

PRs are welcome, of course.

## Legal

 * GPL v3 -- https://www.gnu.org/licenses/gpl-3.0.en.html
 * Copyright (c) 2018, Fovea -- https://fovea.cc
