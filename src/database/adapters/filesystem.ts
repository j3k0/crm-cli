import * as fs from 'fs';
import { InMemorySession } from './inMemory';
import { Database } from '../../types';
import { DatabaseAdapter, DatabaseSession } from '../types';
import { emptyDatabase } from '../emptyDatabase';

/** Copies a file, doing nothing if it doesn't exist. */
async function backupFile(from: string, to: string): Promise<void> {
  try {
    await fs.promises.copyFile(from, to);
  }
  catch (err) {
    if ((err as any)?.code !== 'ENOENT') throw err;
  }
}

export class FileSystemSession extends InMemorySession {

  path: string;
  autoCloseTimeout?: NodeJS.Timeout;
  release?: () => void;

  /**
   * @param release - called once when the session closes, to let the next session open the file.
   */
  constructor(database: Database, path: string, release?: () => void) {
      super(database);
      this.path = path;
      this.release = release;
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
      try {
          if (this.isModified) {
              console.log("FileSystemDatabaseSession.close() > save to disk");
              this.isModified = false;
              // first backup the file
              await backupFile(this.path, `${this.path}.bak`);
              // then save the new content
              await fs.promises.writeFile(this.path, JSON.stringify(this.database, null, 4), 'utf-8');
          }
      }
      finally {
          const release = this.release;
          this.release = undefined;
          release?.();
      }
  }
}

function trimPath(path: string): string {
  // remove final "/"
  return path.replace(/\/$/, '');
}

export class FileSystemAdapter implements DatabaseAdapter {

  dataFullPath: string;

  /**
   * Sessions read the whole file, then write it back on close. Only one session
   * at a time may be open (in this process), otherwise concurrent writes lose data.
   */
  private lockQueue: Promise<void> = Promise.resolve();

  constructor(dataFullPath: string) {
      this.dataFullPath = trimPath(dataFullPath);
  }

  /** Waits for the lock, resolves with the function that releases it. */
  private acquire(): Promise<() => void> {
      let release!: () => void;
      const released = new Promise<void>(resolve => release = resolve);
      const acquired = this.lockQueue.then(() => release);
      this.lockQueue = this.lockQueue.then(() => released);
      return acquired;
  }

  async open(): Promise<DatabaseSession> {
      const release = await this.acquire();
      try {
          return new FileSystemSession(await this.load(), this.dataFullPath, release);
      }
      catch (err) {
          release();
          throw err;
      }
  }

  private async load(): Promise<Database> {
      try {
          const fileContent = await fs.promises.readFile(this.dataFullPath, 'utf8');
          const data = JSON.parse(fileContent);
          if (Array.isArray(data)) {
              // old format
              return {
                  companies: data,
                  config: emptyDatabase().config,
              };
          }
          else {
              const loaded = data as Partial<Database>;
              if (!loaded.config) loaded.config = emptyDatabase().config;
              if (!loaded.config?.subscriptionPlans) loaded.config.subscriptionPlans = emptyDatabase().config.subscriptionPlans;
              if (!loaded.config?.staff) loaded.config.staff = {};
              if (!loaded.config?.interactions) loaded.config.interactions = emptyDatabase().config.interactions;
              return data as Database;
          }
      }
      catch (err) {
          if ((err as any)?.code === 'ENOENT') {
              // File does not exists, let's create it.
              await this.write(emptyDatabase());
              console.info(`Database file created.`);
              return await this.load();
          }
          if (err instanceof Error) {
              console.error(`ERROR #${err.name}: ${err.message}.`);
          }
          console.error(`Run "crm init-crm" and I'll create it for you.`);
          throw err;
      }
  }

  /**
   * Replaces the whole database. The previous file is kept as `<path>.before-reset-<date>.bak`.
   */
  async create(data: Database & { update_design_document?: boolean }): Promise<void> {
      // Design documents are a CouchDB thing: nothing to update here, and don't wipe the data.
      if (data.update_design_document) return;
      const release = await this.acquire();
      try {
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          await backupFile(this.dataFullPath, `${this.dataFullPath}.before-reset-${stamp}.bak`);
          await this.write(data);
      }
      finally {
          release();
      }
  }

  private async write(data: Database): Promise<void> {
      await fs.promises.writeFile(this.dataFullPath, JSON.stringify(data, null, 4), 'utf-8');
  }
}
