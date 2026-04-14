interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers: Map<string, CircuitBreakerState> = new Map();

const DEFAULT_THRESHOLD = 5;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RESET_TIMEOUT_MS = 60000;

export interface CircuitBreakerOptions {
  threshold?: number;
  timeoutMs?: number;
  resetTimeoutMs?: number;
}

function getCircuitBreakerKey(name: string): string {
  return `cb:${name}`;
}

export function getCircuitBreakerState(name: string): CircuitBreakerState {
  const key = getCircuitBreakerKey(name);
  return circuitBreakers.get(key) ?? {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
  };
}

function updateCircuitBreakerState(
  name: string,
  update: Partial<CircuitBreakerState>,
  options: CircuitBreakerOptions
) {
  const key = getCircuitBreakerKey(name);
  const current = getCircuitBreakerState(name);
  const now = Date.now();
  const state: CircuitBreakerState = {
    ...current,
    ...update,
  };

  if (state.failures >= (options.threshold ?? DEFAULT_THRESHOLD)) {
    state.isOpen = true;
    state.lastFailure = now;
  }

  if (
    state.isOpen &&
    now - state.lastFailure > (options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS)
  ) {
    state.isOpen = false;
    state.failures = 0;
  }

  circuitBreakers.set(key, state);
  return state;
}

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = {}
): Promise<T> {
  const state = getCircuitBreakerState(name);
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (state.isOpen) {
    const timeSinceFailure = Date.now() - state.lastFailure;
    if (timeSinceFailure < (options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS)) {
      throw new Error(
        `Circuit breaker '${name}' abierto. Intenta de nuevo más tarde.`
      );
    }
  }

  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      ),
    ]);

    updateCircuitBreakerState(name, { failures: 0 }, options);
    return result;
  } catch (error) {
    updateCircuitBreakerState(
      name,
      { failures: (state.failures || 0) + 1, lastFailure: Date.now() },
      options
    );
    throw error;
  }
}

export function resetCircuitBreaker(name: string) {
  const key = getCircuitBreakerKey(name);
  circuitBreakers.set(key, {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
  });
}

export function getAllCircuitBreakers(): Record<string, { failures: number; isOpen: boolean }> {
  const result: Record<string, { failures: number; isOpen: boolean }> = {};
  for (const [key, state] of circuitBreakers) {
    const name = key.replace("cb:", "");
    result[name] = {
      failures: state.failures,
      isOpen: state.isOpen,
    };
  }
  return result;
}
