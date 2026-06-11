import type postgres from 'postgres';

export async function ensureSchemaExists(
  sql: ReturnType<typeof postgres>,
  schemaName: string,
): Promise<void> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.schemata WHERE schema_name = ${schemaName}
    ) AS exists
  `;

  if (!rows[0]?.exists) {
    await sql.unsafe(`CREATE SCHEMA "${schemaName}"`);
  }
}
