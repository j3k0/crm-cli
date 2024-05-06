import { saveDataSync } from "../../database";
import { findApp } from "../../queries/requests";
import { Database } from "../../types";
import { editJson } from "../editor";
import { doYouConfirm } from "../utils";

export async function editApp(data: Database, filter: string) {
  if (!filter) {
      console.log('Usage: crm edit-app NAME');
      process.exit(1);
  }
  const app = findApp(data, filter); // fuzzy search for the company
  if (!app)
      return;
  const edited = await editJson(Object.assign(
      {
          appName: '',
          plan: 'free',
          email: '',
      },
      app,
      {
          updatedAt: undefined,
      }));
  if (!edited || !edited.appName) {
      console.log('Canceled');
      process.exit(1);
  }
  await doYouConfirm(JSON.stringify(edited, null, 4));
  Object.assign(app, edited);
  app.updatedAt = new Date().toISOString();
  saveDataSync(data);
  console.log('Contact updated.');
  return {
      ...app,
      printAsText: () => { }
  }
};
