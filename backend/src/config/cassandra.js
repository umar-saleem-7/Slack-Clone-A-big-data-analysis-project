import cassandra from 'cassandra-driver';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = cassandra;

// Track connection status
let isConnected = false;
let mainClient = null;

const KEYSPACE = process.env.CASSANDRA_KEYSPACE || 'slack_clone';
const DATACENTER = process.env.CASSANDRA_LOCAL_DATACENTER || 'datacenter1';
const CONTACT_POINTS = (process.env.CASSANDRA_CONTACT_POINTS || 'localhost').split(',');

// Create initial client WITHOUT keyspace to create it if needed
const initClient = new Client({
    contactPoints: CONTACT_POINTS,
    localDataCenter: DATACENTER,
    socketOptions: {
        connectTimeout: 10000,
        readTimeout: 30000
    },
    queryOptions: {
        consistency: cassandra.types.consistencies.localOne
    }
});

// Initialize keyspace and tables
const initializeDatabase = async () => {
    // Create keyspace
    await initClient.execute(`
        CREATE KEYSPACE IF NOT EXISTS ${KEYSPACE}
        WITH replication = {
            'class': 'SimpleStrategy',
            'replication_factor': 1
        }
    `);
    console.log(`✓ Keyspace '${KEYSPACE}' ready`);

    // Create messages table
    await initClient.execute(`
        CREATE TABLE IF NOT EXISTS ${KEYSPACE}.messages (
            channel_id UUID,
            message_timestamp TIMESTAMP,
            message_id UUID,
            user_id UUID,
            user_name TEXT,
            message_text TEXT,
            file_id UUID,
            edited BOOLEAN,
            edited_at TIMESTAMP,
            PRIMARY KEY (channel_id, message_timestamp, message_id)
        ) WITH CLUSTERING ORDER BY (message_timestamp DESC, message_id DESC)
    `);
    console.log('✓ Messages table ready');
};

// Connect to Cassandra with retry logic (non-blocking)
const connectWithRetry = async (retries = 3, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            // Connect initial client
            await initClient.connect();
            console.log('✓ Connected to Cassandra');

            // Initialize database schema
            await initializeDatabase();

            // Create main client with keyspace
            mainClient = new Client({
                contactPoints: CONTACT_POINTS,
                localDataCenter: DATACENTER,
                keyspace: KEYSPACE,
                socketOptions: {
                    connectTimeout: 10000,
                    readTimeout: 30000
                },
                queryOptions: {
                    consistency: cassandra.types.consistencies.localOne,
                    prepare: true
                }
            });

            await mainClient.connect();
            isConnected = true;
            console.log('✓ Cassandra fully initialized');

            // Close init client
            await initClient.shutdown();

            return true;
        } catch (error) {
            console.error(`Cassandra connection attempt ${i + 1} failed:`, error.message);
            if (i < retries - 1) {
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.warn('⚠ Cassandra unavailable - message features will be limited');
                isConnected = false;
                return false;
            }
        }
    }
    return false;
};

// Initialize connection (non-blocking - don't crash server)
connectWithRetry().catch(err => {
    console.warn('⚠ Cassandra connection failed, continuing without it:', err.message);
    isConnected = false;
});

// Check if Cassandra is connected
export const isCassandraConnected = () => isConnected;

// Get client (returns main client or a dummy that will fail gracefully)
const getClient = () => {
    if (!mainClient) {
        throw new Error('Cassandra not connected');
    }
    return mainClient;
};

// Handle shutdown
process.on('SIGINT', async () => {
    if (mainClient) {
        await mainClient.shutdown();
        console.log('Cassandra connection closed');
    }
    process.exit(0);
});

// Export a proxy that uses the main client
export default {
    execute: (...args) => getClient().execute(...args),
    batch: (...args) => getClient().batch(...args),
    shutdown: () => mainClient?.shutdown()
};
