export interface SqlDb {
  /**
   * Executes a SQL query and returns the resulting rows.
   *
   * @param query The SQL query string (optionally with placeholders)
   * @param params Parameters for the query, if any
   * @returns Array of result rows as objects
   */
  query<T = any>(query: string, params?: any[]): Promise<T[]>;

  /**
   * Executes a SQL command that does not return rows (e.g., INSERT, UPDATE, DELETE).
   *
   * @param query The SQL query string (optionally with placeholders)
   * @param params Parameters for the command, if any
   * @returns Number of affected rows or suitable result
   */
  execute(query: string, params?: any[]): Promise<{ rowCount: number }>;

  /**
   * Optionally, closes the database connection if needed.
   */
  close?(): Promise<void>;
}
