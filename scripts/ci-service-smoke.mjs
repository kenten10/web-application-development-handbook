#!/usr/bin/env node

import net from 'node:net';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const plan = JSON.parse(readFileSync(join(root, 'config/ci-plan.json'), 'utf8'));

function connect(host, port, timeoutMs = 5000) {
  return new Promise((resolvePromise, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`${host}:${port} connection timeout`));
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolvePromise();
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

const targets = [
  ['postgres', process.env.POSTGRES_HOST ?? '127.0.0.1', Number(process.env.POSTGRES_PORT ?? plan.serviceContainers.postgres.port)],
  ['redis', process.env.REDIS_HOST ?? '127.0.0.1', Number(process.env.REDIS_PORT ?? plan.serviceContainers.redis.port)],
];

let failed = false;
for (const [name, host, port] of targets) {
  try {
    await connect(host, port);
    console.log(`${name}: ${host}:${port} ready`);
  } catch (error) {
    failed = true;
    console.error(`::error title=${name} service unavailable::${error.message}`);
  }
}

if (failed) process.exit(1);
