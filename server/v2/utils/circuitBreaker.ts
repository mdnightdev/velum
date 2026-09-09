import Opossum from 'opossum';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingWindow?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
}

export interface CircuitBreakerStats {
  failures: number;
  successes: number;
  total: number;
  timeouts?: number;
  rejects?: number;
}

export class CircuitBreaker {
  private breaker: Opossum;

  constructor(
    operation: (...args: any[]) => Promise<any>,
    options?: CircuitBreakerOptions
  ) {
    const opts: Opossum.Options = {
      timeout: options?.timeout ?? 10000,
      errorThresholdPercentage: options?.errorThresholdPercentage ?? 50,
      resetTimeout: options?.resetTimeout ?? 30000,
      rollingCountTimeout: options?.rollingCountTimeout ?? 10000,
      rollingCountBuckets: options?.rollingCountBuckets ?? 10,
    };
    this.breaker = new Opossum(operation, opts);
  }

  async execute(...args: any[]): Promise<any> {
    return this.breaker.fire(...args);
  }

  getState(): CircuitState {
    if (this.breaker.opened) return 'open';
    if (this.breaker.halfOpen) return 'half-open';
    return 'closed';
  }

  getStats(): CircuitBreakerStats {
    const s = this.breaker.stats;
    return {
      failures: s.failures,
      successes: s.successes,
      total: s.fires,
      timeouts: s.timeouts,
      rejects: s.rejects
    };
  }

  forceOpen(): void {
    this.breaker.open();
  }

  forceClose(): void {
    this.breaker.close();
  }

  get rawBreaker(): Opossum {
    return this.breaker;
  }
}

export function createCircuitBreaker(
  operation: (...args: any[]) => Promise<any>,
  options?: CircuitBreakerOptions
): CircuitBreaker {
  return new CircuitBreaker(operation, options);
}
