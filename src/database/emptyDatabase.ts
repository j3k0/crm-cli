import { Database } from "../types";

export const EMPTY_DATABASE = {
  companies: [],
  config: {
    staff: {},
    subscriptionPlans: ['free', 'silver', 'gold'],
    interactions: {
      kinds: ['email', 'github', 'contact-form', 'phone', 'real-life', 'linkedin', 'none'],
      tags: ['registration', 'subscription', 'bug', 'question'],
    }
  }
}

/**
 * Generate an empty database
 */
export function emptyDatabase(): Database {
  return EMPTY_DATABASE;
}
