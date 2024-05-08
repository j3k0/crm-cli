import * as fs from 'fs';
import { InMemorySession } from './inMemory';
import { Database } from '../../types';
import { DatabaseAdapter, DatabaseSession } from '../types';
import { emptyDatabase } from '../emptyDatabase';

export class FileSystemSession extends InMemorySession {

  path: string;
  autoCloseTimeout?: NodeJS.Timeout;

  constructor(database: Database, path: string) {
      super(database);
      this.path = path;
      this.autoCloseTimeout = setTimeout(() => {
          console.log("FileSystemDatabaseSession.autoClose(timeout reached)");
          this.autoCloseTimeout = undefined;
          this.close();
      }, 10000); // auto-close after 10s
  }

  async close(): Promise<void> {
      // console.log("FileSystemDatabaseSession.close()");
      if (this.autoCloseTimeout) {
          clearTimeout(this.autoCloseTimeout);
          this.autoCloseTimeout = undefined;
      }
      if (this.isModified) {
          console.log("FileSystemDatabaseSession.close() > save to disk");
          this.isModified = false;
          // first backup the file
          await fs.promises.copyFile(`${this.path}`, `${this.path}.bak`);
          // then save the new content
          await fs.promises.writeFile(this.path, JSON.stringify(this.database, null, 4), 'utf-8');
      }
  }
}

function trimPath(path: string): string {
  // remove final "/"
  return path.replace(/\/$/, '');
}

export class FileSystemAdapter implements DatabaseAdapter {

  dataFullPath: string;

  constructor(dataFullPath: string) {
      this.dataFullPath = trimPath(dataFullPath);
  }

  async open(): Promise<DatabaseSession> {
      try {
          const fileContent = await fs.promises.readFile(this.dataFullPath, 'utf8');
          const data = JSON.parse(fileContent);
          if (Array.isArray(data)) {
              // old format
              return new FileSystemSession({
                  companies: data,
                  config: emptyDatabase().config,
              }, this.dataFullPath);
          }
          else {
              const loaded = data as Partial<Database>;
              if (!loaded.config) loaded.config = emptyDatabase().config;
              if (!loaded.config?.subscriptionPlans) loaded.config.subscriptionPlans = emptyDatabase().config.subscriptionPlans;
              if (!loaded.config?.staff) loaded.config.staff = {};
              if (!loaded.config?.interactions) loaded.config.interactions = emptyDatabase().config.interactions;
              return new FileSystemSession(data as Database, this.dataFullPath);
          }
      }
      catch (err) {
          if ((err as any)?.code === 'ENOENT') {
              // File does not exists, let's create it.
              await this.create(emptyDatabase());
              console.info(`Database file created.`);
              return await this.open();
          }
          if (err instanceof Error) {
              console.error(`ERROR #${err.name}: ${err.message}.`);
          }
          console.error(`Run "crm init-crm" and I'll create it for you.`);
          throw err;
      }
  }

  async create(data: Database): Promise<void> {
      await fs.promises.writeFile(this.dataFullPath, JSON.stringify(data, null, 4), 'utf-8');
  }
}