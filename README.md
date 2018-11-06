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

This creates a file called `crm.json`.

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

 - data entry:

    add-company ............ register a new company.
    add-contact ............ register a new contact.
    add-app ................ register a new app.
    add-i,add-interaction .. register a new customer interaction.

 - system:

    init-crm ........ create data file in current directory.
```

## Note on filters

All reports commands accepts a filter argument, used to restrict the data display.

The filter is a fuzzy case-insensitive operator.

Examples:

 * `crm about microsft` will show all data you have about `Microsoft`.
 * `crm about marc twain` will show all data you have about `Marc Twain`.

## Best practices

 * Put the `crm.json` file in version control.

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
