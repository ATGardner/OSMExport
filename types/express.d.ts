import type { Visitor } from 'universal-analytics';

declare global {
  namespace Express {
    interface Request {
      visitor?: Visitor;
    }
  }
}

export { };