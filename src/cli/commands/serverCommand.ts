import { DatabaseSession } from '../../database/types';
import { createServer } from '../../server';
export async function serverRun(database: DatabaseSession, arg: string) {
  await createServer();
  return { printAsText: async () => {} };
}