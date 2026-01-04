import { Client } from 'cassandra-driver';
import dotenv from 'dotenv';

dotenv.config();

const initCassandra = async () => {
  // Create client WITHOUT keyspace for initialization
  const client = new Client({
    contactPoints: (process.env.CASSANDRA_CONTACT_POINTS || 'localhost').split(','),
    localDataCenter: process.env.CASSANDRA_LOCAL_DATACENTER || 'datacenter1',
    // Don't specify keyspace yet - it doesn't exist!
  });

  try {
    console.log('Connecting to Cassandra...');
    await client.connect();
    console.log('✓ Connected to Cassandra');

    console.log('Creating keyspace...');
    // Create keyspace
    await client.execute(`
      CREATE KEYSPACE IF NOT EXISTS slack_clone
      WITH replication = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `);
    console.log('✓ Keyspace created');

    // Now use the keyspace
    await client.execute('USE slack_clone');

    console.log('Creating messages table...');
    // Create messages table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS messages (
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
        AND compaction = {'class': 'TimeWindowCompactionStrategy'}
        AND gc_grace_seconds = 864000
    `);
    console.log('✓ Messages table created');

    console.log('Creating reactions table...');
    // Create reactions table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        channel_id UUID,
        message_id UUID,
        user_id UUID,
        reaction_type TEXT,
        created_at TIMESTAMP,
        PRIMARY KEY ((channel_id, message_id), user_id, reaction_type)
      )
    `);
    console.log('✓ Reactions table created');

    console.log('Creating thread messages table...');
    // Create thread messages table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS thread_messages (
        parent_message_id UUID,
        message_timestamp TIMESTAMP,
        message_id UUID,
        channel_id UUID,
        user_id UUID,
        user_name TEXT,
        message_text TEXT,
        PRIMARY KEY (parent_message_id, message_timestamp, message_id)
      ) WITH CLUSTERING ORDER BY (message_timestamp DESC, message_id DESC)
    `);
    console.log('✓ Thread messages table created');

    console.log('\n✅ Cassandra initialization complete!');

    await client.shutdown();
    process.exit(0);
  } catch (error) {
    console.error('❌ Cassandra initialization failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure Cassandra is running: docker ps | findstr cassandra');
    console.error('2. Wait 2-3 minutes for Cassandra to fully start');
    console.error('3. Check Cassandra logs: docker logs slack-cassandra');

    await client.shutdown();
    process.exit(1);
  }
};

initCassandra();
