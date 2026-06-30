import EmbeddedPostgres from 'embedded-postgres';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'mac',
  password: 'mac',
  port: 5433,
  persistent: true,
});

const isNew = !existsSync(dataDir);

if (isNew) {
  await pg.initialise();
}
await pg.start();

if (isNew) {
  try {
    await pg.createDatabase('empire_fleet_control');
  } catch (e) {
    console.log('DB peut-être déjà existante:', e.message);
  }
}

console.log('PostgreSQL embarqué démarré sur le port 5433, base "empire_fleet_control" prête.');
console.log('Laissez ce processus tourner. Ctrl+C pour arrêter.');

process.on('SIGINT', async () => {
  await pg.stop();
  process.exit(0);
});
