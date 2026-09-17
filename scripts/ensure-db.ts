import pg from "pg";

const PORT = process.env.FINFAM_DB_PORT ?? "5432";
const USER = process.env.FINFAM_DB_USER ?? "postgres";
const DB = process.env.FINFAM_DB_NAME ?? "finfam";

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function readConfig(): { client: pg.ClientConfig; databaseName: string } {
  const rawUrl = process.env.DATABASE_URL?.trim();

  if (rawUrl) {
    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

    return {
      databaseName: databaseName || DB,
      client: {
        host: url.hostname || "127.0.0.1",
        port: url.port ? Number(url.port) : Number(PORT),
        user: decodeURIComponent(url.username || USER),
        password:
          url.password
            ? decodeURIComponent(url.password)
            : process.env.PGPASSWORD ?? process.env.FINFAM_DB_PASSWORD ?? "",
        database: "postgres",
      },
    };
  }

  return {
    databaseName: DB,
    client: {
      host: "127.0.0.1",
      port: Number(PORT),
      user: USER,
      password: process.env.PGPASSWORD ?? process.env.FINFAM_DB_PASSWORD ?? "",
      database: "postgres",
    },
  };
}

async function main() {
  const { client: clientConfig, databaseName } = readConfig();
  const client = new pg.Client(clientConfig);
  await client.connect();
  const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
  if (res.rowCount === 0) {
    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`[postgres] created database ${databaseName}`);
  } else {
    console.log(`[postgres] database ${databaseName} exists`);
  }
  await client.end();
}

main().catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("client password must be a string")) {
    console.error(
      "[postgres] ensure-db failed: local Postgres requires a password. Add it to DATABASE_URL or set FINFAM_DB_PASSWORD/PGPASSWORD.",
    );
  } else {
    console.error("[postgres] ensure-db failed:", message);
  }
  process.exit(1);
});
