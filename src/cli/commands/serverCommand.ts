import { DatabaseSession } from '../../database/types';
import { startCrmApiServer } from '../../crmApiServer';
export async function serverRun(database: DatabaseSession, arg: string) {
  await startCrmApiServer();
  return { printAsText: async () => {} };
}