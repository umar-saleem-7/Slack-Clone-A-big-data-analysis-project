import { Client } from '@opensearch-project/opensearch';
import dotenv from 'dotenv';

dotenv.config();

// Create OpenSearch client
const opensearchClient = new Client({
    node: process.env.OPENSEARCH_NODE || 'http://localhost:9200',
    ssl: {
        rejectUnauthorized: false,
    },
});

const INDEX_NAME = process.env.OPENSEARCH_INDEX || 'slack_messages';

// Test connection
opensearchClient.info()
    .then(() => console.log('✓ Connected to OpenSearch'))
    .catch((err) => console.error('OpenSearch connection error:', err));

// OpenSearch service helper functions
export const opensearchService = {
    // Create index if it doesn't exist
    createIndex: async () => {
        try {
            const exists = await opensearchClient.indices.exists({ index: INDEX_NAME });

            if (!exists.body) {
                await opensearchClient.indices.create({
                    index: INDEX_NAME,
                    body: {
                        mappings: {
                            properties: {
                                message_id: { type: 'keyword' },
                                channel_id: { type: 'keyword' },
                                workspace_id: { type: 'keyword' },
                                user_id: { type: 'keyword' },
                                user_name: { type: 'text' },
                                message_text: {
                                    type: 'text',
                                    analyzer: 'standard',
                                    fields: {
                                        keyword: { type: 'keyword' }
                                    }
                                },
                                timestamp: { type: 'date' },
                                file_id: { type: 'keyword' },
                                edited: { type: 'boolean' },
                            },
                        },
                        settings: {
                            number_of_shards: 1,
                            number_of_replicas: 0,
                        },
                    },
                });
                console.log(`✓ Created OpenSearch index: ${INDEX_NAME}`);
            }
        } catch (error) {
            console.error('Error creating OpenSearch index:', error);
            throw error;
        }
    },

    // Index a message
    indexMessage: async (message) => {
        try {
            await opensearchClient.index({
                index: INDEX_NAME,
                id: message.message_id,
                body: {
                    message_id: message.message_id,
                    channel_id: message.channel_id,
                    workspace_id: message.workspace_id,
                    user_id: message.user_id,
                    user_name: message.user_name,
                    message_text: message.message_text,
                    timestamp: message.timestamp,
                    file_id: message.file_id || null,
                    edited: message.edited || false,
                },
                refresh: true,
            });
            console.log(`Message indexed: ${message.message_id}`);
        } catch (error) {
            console.error('Error indexing message:', error);
            throw error;
        }
    },

    // Search messages
    searchMessages: async (query, filters = {}) => {
        try {
            const must = [];

            // Add text search
            if (query) {
                must.push({
                    multi_match: {
                        query: query,
                        fields: ['message_text', 'user_name'],
                        fuzziness: 'AUTO',
                    },
                });
            }

            // Add filters
            if (filters.channel_id) {
                must.push({ term: { channel_id: filters.channel_id } });
            }
            if (filters.workspace_id) {
                must.push({ term: { workspace_id: filters.workspace_id } });
            }
            if (filters.user_id) {
                must.push({ term: { user_id: filters.user_id } });
            }

            const response = await opensearchClient.search({
                index: INDEX_NAME,
                body: {
                    query: {
                        bool: { must },
                    },
                    sort: [{ timestamp: { order: 'desc' } }],
                    size: filters.limit || 50,
                    from: filters.offset || 0,
                },
            });

            return {
                total: response.body.hits.total.value,
                results: response.body.hits.hits.map(hit => hit._source),
            };
        } catch (error) {
            console.error('Error searching messages:', error);
            throw error;
        }
    },

    // Update message (for edits)
    updateMessage: async (messageId, updates) => {
        try {
            await opensearchClient.update({
                index: INDEX_NAME,
                id: messageId,
                body: {
                    doc: updates,
                },
                refresh: true,
            });
            console.log(`Message updated: ${messageId}`);
        } catch (error) {
            console.error('Error updating message:', error);
            throw error;
        }
    },

    // Delete message
    deleteMessage: async (messageId) => {
        try {
            await opensearchClient.delete({
                index: INDEX_NAME,
                id: messageId,
                refresh: true,
            });
            console.log(`Message deleted: ${messageId}`);
        } catch (error) {
            console.error('Error deleting message:', error);
            throw error;
        }
    },
};

export default opensearchClient;
