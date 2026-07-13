const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://postgres:jpPLCs4-9rCxKnwWa0xztQ_Nmsq3tB2@db.rhxagubyuidautkejbfm.supabase.co:5432/postgres";

async function runMigration() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const sql = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '20260713_tracking.sql'), 'utf-8');
        await client.query(sql);
        console.log("Migration executed successfully!");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await client.end();
    }
}

runMigration();
