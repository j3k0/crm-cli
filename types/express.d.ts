import { CrmSession } from "../src/crmSession";
import bunyan from 'bunyan';

declare global {
  namespace Express {
    interface Request {
      session: CrmSession;
      reqId: string;
      log: bunyan;
    }
  }
}