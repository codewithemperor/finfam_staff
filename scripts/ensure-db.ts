import pg from "pg";

const PORT = process.env.FINFAM_DB_PORT ?? "5432";
const USER = process.env.FINFAM_DB_USER ?? "postgres";
const DB = process.env.FINFAM_DB_NAME ?? "finfam";

async function main() {
  const client = new pg.Client({ host: "127.0.0.1", port: Number(PORT), user: USER, database: "postgres" });
  await client.connect();
  const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB]);
  if (res.rowCount === 0) {
    await client.query(`CREATE DATABASE "${DB}"`);
    console.log(`[postgres] created database ${DB}`);
  } else {
    console.log(`[postgres] database ${DB} exists`);
  }
  await client.end();
}

main().catch((e) => {
  console.error("[postgres] ensure-db failed:", e.message);
  process.exit(1);
});
