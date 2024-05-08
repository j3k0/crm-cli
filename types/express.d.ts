import { DatabaseSession } from "../src/database";

declare global {
  namespace Express {
    interface Request {
      session: DatabaseSession;
    }
  }
}