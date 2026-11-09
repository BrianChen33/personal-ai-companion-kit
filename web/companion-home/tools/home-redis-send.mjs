// Called locally by home_relay.py. Private snapshots travel over stdin, never argv.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

let client;
try {
  const credentials = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const { default: Redis } = await import(pathToFileURL(process.argv[3]).href);
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const command = JSON.parse(input);
  if (command[0] !== 'EVAL' || command[2] !== 1 || !command[3]) {
    throw new Error('invalid_home_publish_command');
  }
  client = new Redis({
    host: credentials.host, port: credentials.port, password: credentials.password,
    tls: { servername: credentials.host }, lazyConnect: true,
    connectTimeout: 10000, commandTimeout: 10000, maxRetriesPerRequest: 0,
    retryStrategy: () => null, enableOfflineQueue: false,
  });
  client.on('error', () => {});
  await client.connect();
  const result = await client.eval(...command.slice(1));
  process.stdout.write(JSON.stringify({ result }));
} catch (error) {
  process.stderr.write(JSON.stringify({ error: error.name || 'PublishError' }));
  process.exitCode = 1;
} finally {
  client?.disconnect();
}
