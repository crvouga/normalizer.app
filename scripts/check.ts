#!/usr/bin/env bun

export {};

const steps = [
  { name: 'Type Check', command: ['run', 'type-check:once'] },
  { name: 'Circular Dependency Check', command: ['run', 'circular'] },
  { name: 'Test', command: ['run', 'test'] },
  { name: 'E2E Tests', command: ['run', 'e2e'] },
] as const;

async function runStep(name: string, command: readonly string[]): Promise<boolean> {
  console.log(`\n▶ ${name}`);
  const proc = Bun.spawn([process.execPath, ...command], {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`\n✗ ${name} failed (exit ${exitCode})`);
    return false;
  }
  console.log(`✓ ${name}`);
  return true;
}

async function main(): Promise<void> {
  console.log('Running deployment pipeline checks…');

  for (const step of steps) {
    const passed = await runStep(step.name, step.command);
    if (!passed) {
      process.exit(1);
    }
  }

  console.log('\nAll checks passed.');
}

void main();
