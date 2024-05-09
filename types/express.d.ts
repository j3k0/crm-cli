import { DatabaseSession } from "../src/database";
import bunyan from 'bunyan';

declare global {
  namespace Express {
    interface Request {
      session: DatabaseSession;
      reqId: string;
      log: bunyan;
    }
  }
}