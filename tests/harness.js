// Dependency-free test harness. Test files call test(); the runner calls run().
const registry = [];

export function test(id, fn) {
  registry.push({ id, fn });
}

export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`.trim());
  }
}

export function assertDeep(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message} expected ${e}, got ${a}`.trim());
}

export async function loadJSON(relativeUrl) {
  const response = await fetch(new URL(relativeUrl, import.meta.url));
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${relativeUrl}`);
  return response.json();
}

export async function run() {
  const failed = [];
  let passed = 0;
  for (const { id, fn } of registry) {
    try {
      await fn();
      passed += 1;
    } catch (error) {
      failed.push({ id, message: error?.message ?? String(error) });
    }
  }
  return { total: registry.length, passed, failed };
}
