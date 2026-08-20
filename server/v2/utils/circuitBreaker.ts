// Simple Circuit Breaker Implementation
// Based on the Circuit Breaker pattern for handling external service failures

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  timeout: number; // Operation timeout in ms
  errorThresholdPercentage: number; // Error percentage to trigger open state
  resetTimeout: number; // Time in ms to wait before trying half-open state
  rollingWindow: number; // Number of operations to consider for error rate
}

interface CircuitBreakerStats {
  failures: number;
  successes: number;
  total: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private stats: CircuitBreakerStats = { failures: 0, successes: 0, total: 0 };
  private nextAttempt: number = 0;
  private operationHistory: boolean[] = []; // true = success, false = failure

  constructor(
    private operation: (...args: any[]) => Promise<any>,
    private options: CircuitBreakerOptions
  ) {
    this.validateOptions();
  }

  private validateOptions() {
    if (this.options.errorThresholdPercentage < 0 || this.options.errorThresholdPercentage > 100) {
      throw new Error('errorThresholdPercentage must be between 0 and 100');
    }
    if (this.options.rollingWindow < 1) {
      throw new Error('rollingWindow must be at least 1');
    }
  }

  private getErrorRate(): number {
    if (this.stats.total === 0) return 0;
    return (this.stats.failures / this.stats.total) * 100;
  }

  private shouldAttemptReset(): boolean {
    return Date.now() >= this.nextAttempt;
  }

  private recordSuccess() {
    this.stats.successes++;
    this.stats.total++;
    this.operationHistory.push(true);
    
    // Keep only recent operations
    if (this.operationHistory.length > this.options.rollingWindow) {
      const removed = this.operationHistory.shift();
      if (removed === false) this.stats.failures--;
      this.stats.total--;
    }
  }

  private recordFailure() {
    this.stats.failures++;
    this.stats.total++;
    this.operationHistory.push(false);
    
    // Keep only recent operations
    if (this.operationHistory.length > this.options.rollingWindow) {
      const removed = this.operationHistory.shift();
      if (removed === true) this.stats.successes--;
      this.stats.total--;
    }
  }

  private openCircuit() {
    this.state = 'open';
    this.nextAttempt = Date.now() + this.options.resetTimeout;
  }

  private resetCircuit() {
    this.state = 'closed';
    this.stats = { failures: 0, successes: 0, total: 0 };
    this.operationHistory = [];
  }

  async execute(...args: any[]): Promise<any> {
    // Check if circuit is open and should be reset
    if (this.state === 'open' && this.shouldAttemptReset()) {
      this.state = 'half-open';
    }

    // Reject if circuit is open
    if (this.state === 'open') {
      throw new Error('Circuit breaker is OPEN - service unavailable');
    }

    try {
      // Execute operation with timeout
      const result = await Promise.race([
        this.operation(...args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), this.options.timeout)
        )
      ]);

      // Success handling
      if (this.state === 'half-open') {
        this.resetCircuit();
      }
      this.recordSuccess();
      
      return result;
    } catch (error) {
      // Failure handling
      this.recordFailure();
      
      // Check if error rate threshold is exceeded
      if (this.getErrorRate() >= this.options.errorThresholdPercentage) {
        this.openCircuit();
      }
      
      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return { ...this.stats };
  }

  forceOpen() {
    this.state = 'open';
    this.nextAttempt = Date.now() + this.options.resetTimeout;
  }

  forceClose() {
    this.resetCircuit();
  }
}

// Factory function for creating circuit breakers
export function createCircuitBreaker(
  operation: (...args: any[]) => Promise<any>,
  options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
  const defaultOptions: CircuitBreakerOptions = {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    rollingWindow: 10
  };

  return new CircuitBreaker(operation, { ...defaultOptions, ...options });
}