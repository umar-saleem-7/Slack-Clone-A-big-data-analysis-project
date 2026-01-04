import { opensearchService } from '../config/opensearch.js';

const initOpenSearch = async () => {
    try {
        console.log('Initializing OpenSearch index...');

        await opensearchService.createIndex();

        console.log('\n✅ OpenSearch initialization complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ OpenSearch initialization failed:', error);
        process.exit(1);
    }
};

initOpenSearch();
