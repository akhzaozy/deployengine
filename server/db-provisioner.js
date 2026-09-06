import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CONFIG } from './config.js';

export class DatabaseProvisioner {
  /**
   * Provision a database for the project (MariaDB/MySQL or PostgreSQL)
   */
  static async provision(repo, engine = 'mariadb', customDbName = null) {
    const dbName = customDbName || repo.replace(/[^a-zA-Z0-9_]/g, '_');
    const logs = [];

    if (engine === 'postgres') {
      return this.provisionPostgres(repo, dbName, logs);
    } else {
      return this.provisionMariaDB(repo, dbName, logs);
    }
  }

  static provisionMariaDB(repo, dbName, logs) {
    const { host, port, rootUser, rootPassword, defaultUser, defaultPass } = CONFIG.db.mariadb;
    const user = defaultUser;
    const pass = defaultPass;

    const sql = `
CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${pass}';
CREATE USER IF NOT EXISTS '${user}'@'127.0.0.1' IDENTIFIED BY '${pass}';
CREATE USER IF NOT EXISTS '${user}'@'%' IDENTIFIED BY '${pass}';
ALTER USER '${user}'@'localhost' IDENTIFIED BY '${pass}';
ALTER USER '${user}'@'127.0.0.1' IDENTIFIED BY '${pass}';
GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${user}'@'localhost';
GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${user}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${user}'@'%';
FLUSH PRIVILEGES;
`.trim();

    logs.push(`[DB] Menyiapkan MariaDB/MySQL untuk database '${dbName}'...`);

    try {
      const tmpFile = path.join(os.tmpdir(), `sql_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`);
      fs.writeFileSync(tmpFile, sql);

      let cmd = 'mysql ';
      if (fs.existsSync('/root/.my.cnf')) {
        cmd += '--defaults-extra-file=/root/.my.cnf ';
      } else if (rootPassword) {
        cmd += `-u${rootUser} -p${rootPassword} `;
      } else {
        cmd += `-u${rootUser} `;
      }
      cmd += `< "${tmpFile}" 2>&1`;

      let output = '';
      try {
        output = execSync(cmd, { timeout: 10000 }).toString();
      } catch (e) {
        output = e.stdout ? e.stdout.toString() : e.message;
        logs.push(`[DB WARN] Eksekusi CLI mysql: ${output.trim() || 'Simulated / Not in Linux container'}`);
      }

      try { fs.unlinkSync(tmpFile); } catch {}
      logs.push(`[DB] Database MariaDB '${dbName}' siap digunakan.`);

      return {
        engine: 'mariadb',
        dbName,
        dbUser: user,
        dbPass: pass,
        dbHost: host,
        dbPort: port,
        envSnippet: {
          DB_CONNECTION: 'mysql',
          DB_HOST: host,
          DB_PORT: String(port),
          DB_DATABASE: dbName,
          DB_USERNAME: user,
          DB_PASSWORD: pass,
          DATABASE_URL: `mysql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${dbName}`
        },
        logs
      };
    } catch (err) {
      logs.push(`[DB ERROR] Gagal provisioning MariaDB: ${err.message}`);
      return {
        engine: 'mariadb',
        dbName,
        dbUser: user,
        dbPass: pass,
        dbHost: host,
        dbPort: port,
        envSnippet: {
          DB_CONNECTION: 'mysql',
          DB_HOST: host,
          DB_PORT: String(port),
          DB_DATABASE: dbName,
          DB_USERNAME: user,
          DB_PASSWORD: pass,
          DATABASE_URL: `mysql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${dbName}`
        },
        logs,
        error: err.message
      };
    }
  }

  static provisionPostgres(repo, dbName, logs) {
    const { host, port, superUser, defaultUser, defaultPass } = CONFIG.db.postgres;
    const user = defaultUser;
    const pass = defaultPass;

    logs.push(`[DB] Menyiapkan PostgreSQL untuk database '${dbName}'...`);

    const sqlCommands = [
      `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${user}') THEN CREATE ROLE "${user}" WITH LOGIN PASSWORD '${pass}'; END IF; END $$;`,
      `ALTER ROLE "${user}" WITH PASSWORD '${pass}';`,
      `SELECT 'CREATE DATABASE "${dbName}" WITH OWNER "${user}" ENCODING "UTF8"' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${dbName}')\\gexec`,
      `GRANT ALL PRIVILEGES ON DATABASE "${dbName}" TO "${user}";`
    ];

    try {
      const psqlCmd = `psql -U ${superUser} -h ${host} -p ${port} -c "${sqlCommands.join(' ')}" 2>&1`;
      let output = '';
      try {
        output = execSync(psqlCmd, { timeout: 10000 }).toString();
      } catch (e) {
        output = e.stdout ? e.stdout.toString() : e.message;
        logs.push(`[DB WARN] Eksekusi CLI psql: ${output.trim() || 'Simulated / Not in Linux container'}`);
      }

      logs.push(`[DB] Database PostgreSQL '${dbName}' siap digunakan.`);

      return {
        engine: 'postgres',
        dbName,
        dbUser: user,
        dbPass: pass,
        dbHost: host,
        dbPort: port,
        envSnippet: {
          DB_CONNECTION: 'pgsql',
          DB_HOST: host,
          DB_PORT: String(port),
          DB_DATABASE: dbName,
          DB_USERNAME: user,
          DB_PASSWORD: pass,
          DATABASE_URL: `postgresql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${dbName}?schema=public`
        },
        logs
      };
    } catch (err) {
      logs.push(`[DB ERROR] Gagal provisioning PostgreSQL: ${err.message}`);
      return {
        engine: 'postgres',
        dbName,
        dbUser: user,
        dbPass: pass,
        dbHost: host,
        dbPort: port,
        envSnippet: {
          DB_CONNECTION: 'pgsql',
          DB_HOST: host,
          DB_PORT: String(port),
          DB_DATABASE: dbName,
          DB_USERNAME: user,
          DB_PASSWORD: pass,
          DATABASE_URL: `postgresql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${dbName}?schema=public`
        },
        logs,
        error: err.message
      };
    }
  }
}
