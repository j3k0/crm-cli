import { saveDataSync } from "../../database";
import { findApp } from "../../queries/requests";
import { App, Database } from "../../types";
import { editJson } from "../editor";
import { doYouConfirm } from "../utils";

export async function editApp(data: Database, filter: string) {
  if (!filter) {
      console.log('Usage: crm edit-app NAME');
      process.exit(1);
  }
  const findResult = findApp(data, filter); // fuzzy search for the company
  if (!findResult)
      return;
  const app = findResult.app;
  const edited = await editJson<Partial<App>>({
      appName: '',
      plan: 'free',
      email: '',
      ...(app as Partial<App>),
      updatedAt: undefined,
  });
  if (!edited || !edited.appName) {
      console.log('Canceled');
      process.exit(1);
  }
  await doYouConfirm(JSON.stringify(edited, null, 4));
  Object.assign(app, edited);
  app.updatedAt = new Date().toISOString();
  saveDataSync(data, { type: "company", name: findResult.company.name });
  console.log('Contact updated.');
  return {
      ...app,
      printAsText: () => { }
  }
};
