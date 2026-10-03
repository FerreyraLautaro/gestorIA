import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { closeServer, startServer } from './startServer.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
});

describe('startServer', () => {
  it('resolves with the listening server', async () => {
    const server = await startServer(express(), 0);
    servers.push(server);

    expect(server.listening).toBe(true);
    expect((server.address() as AddressInfo).port).toBeGreaterThan(0);
  });

  it('rejects when the port is already in use', async () => {
    const first = await startServer(express(), 0);
    servers.push(first);
    const { port } = first.address() as AddressInfo;

    await expect(startServer(express(), port)).rejects.toMatchObject({ code: 'EADDRINUSE' });
  });
});
