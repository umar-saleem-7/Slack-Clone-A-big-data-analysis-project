-- Create keyspace for Slack clone
CREATE KEYSPACE IF NOT EXISTS slack_clone
WITH replication = {
    'class': 'SimpleStrategy',
    'replication_factor': 1
};

-- Use the keyspace
USE slack_clone;

-- Messages table
-- Partition key: channel_id (groups messages by channel)
-- Clustering key: message_timestamp (orders messages by time, newest first)
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
  AND gc_grace_seconds = 864000;

-- Message reactions table (optional, for future enhancement)
CREATE TABLE IF NOT EXISTS message_reactions (
    channel_id UUID,
    message_id UUID,
    user_id UUID,
    reaction_type TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY ((channel_id, message_id), user_id, reaction_type)
);

-- Thread messages table (optional, for threaded conversations)
CREATE TABLE IF NOT EXISTS thread_messages (
    parent_message_id UUID,
    message_timestamp TIMESTAMP,
    message_id UUID,
    channel_id UUID,
    user_id UUID,
    user_name TEXT,
    message_text TEXT,
    PRIMARY KEY (parent_message_id, message_timestamp, message_id)
) WITH CLUSTERING ORDER BY (message_timestamp DESC, message_id DESC);
