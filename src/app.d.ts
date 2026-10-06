import type { RuntimeConfig } from './lib/server/config';

declare global {
  namespace App {
    interface Locals {
      correlationId: string;
      config?: RuntimeConfig;
    }
    interface Error {
      message: string;
      correlationId?: string;
    }
  }
}

export {};
