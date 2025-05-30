
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

class DatabaseService {
  private sqlite: SQLiteConnection;
  private db!: SQLiteDBConnection;
  private initialized = false;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create database connection
      const ret = await this.sqlite.checkConnectionsConsistency();
      const isConn = await this.sqlite.isConnection("foliage_db", false);

      if (ret.result && isConn.result) {
        this.db = await this.sqlite.retrieveConnection("foliage_db", false);
      } else {
        this.db = await this.sqlite.createConnection(
          "foliage_db",
          false,
          "no-encryption",
          1,
          false
        );
      }

      await this.db.open();

      // Create tables if they don't exist
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS leaf_measurements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          image_path TEXT,
          leaf_area REAL,
          timestamp TEXT,
          notes TEXT
        );
      `;

      await this.db.execute(createTableQuery);
      this.initialized = true;
      console.log("Database initialized successfully");
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  async saveLeafMeasurement(
    imagePath: string,
    leafArea: number,
    notes: string = ""
  ): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const timestamp = new Date().toISOString();
      const query = `
        INSERT INTO leaf_measurements (image_path, leaf_area, timestamp, notes)
        VALUES (?, ?, ?, ?);
      `;
      const values = [imagePath, leafArea, timestamp, notes];

      const result = await this.db.run(query, values);
      return result.changes?.lastId || 0;
    } catch (error) {
      console.error("Error saving leaf measurement:", error);
      throw error;
    }
  }

  async getLeafMeasurements(): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const query = `
        SELECT * FROM leaf_measurements 
        ORDER BY timestamp DESC;
      `;
      const result = await this.db.query(query);
      return result.values || [];
    } catch (error) {
      console.error("Error fetching leaf measurements:", error);
      return [];
    }
  }

  async getLeafMeasurementById(id: number): Promise<any | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const query = `
        SELECT * FROM leaf_measurements 
        WHERE id = ?;
      `;
      const result = await this.db.query(query, [id]);
      return result.values && result.values.length > 0
        ? result.values[0]
        : null;
    } catch (error) {
      console.error(`Error fetching leaf measurement with ID ${id}:`, error);
      return null;
    }
  }

  async updateLeafMeasurement(
    id: number,
    updates: {
      leafArea?: number;
      notes?: string;
    }
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      let setStatements = [];
      let values = [];

      if (updates.leafArea !== undefined) {
        setStatements.push("leaf_area = ?");
        values.push(updates.leafArea);
      }

      if (updates.notes !== undefined) {
        setStatements.push("notes = ?");
        values.push(updates.notes);
      }

      if (setStatements.length === 0) {
        return false;
      }

      // Add the ID to the values array
      values.push(id);

      const query = `
        UPDATE leaf_measurements 
        SET ${setStatements.join(", ")} 
        WHERE id = ?;
      `;

      const result = await this.db.run(query, values);
      return result.changes?.changes > 0;
    } catch (error) {
      console.error(`Error updating leaf measurement with ID ${id}:`, error);
      return false;
    }
  }

  async deleteLeafMeasurement(id: number): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const query = `DELETE FROM leaf_measurements WHERE id = ?;`;
      const result = await this.db.run(query, [id]);
      return result.changes?.changes > 0;
    } catch (error) {
      console.error(`Error deleting leaf measurement with ID ${id}:`, error);
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.db.close();
      this.initialized = false;
    } catch (error) {
      console.error("Error closing database:", error);
    }
  }
}

export const databaseService = new DatabaseService();
