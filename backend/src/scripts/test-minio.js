import { Client } from 'minio';

// Test MinIO connection with exact credentials
const testMinIO = async () => {
    console.log('Testing MinIO connection...\n');

    const client = new Client({
        endPoint: 'localhost',
        port: 9000,
        useSSL: false,
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
    });

    try {
        // Test 1: List buckets
        console.log('Test 1: Listing buckets...');
        const buckets = await client.listBuckets();
        console.log('✓ Buckets:', buckets.map(b => b.name).join(', ') || 'none');

        // Test 2: Check if slack-files bucket exists
        console.log('\nTest 2: Checking slack-files bucket...');
        const exists = await client.bucketExists('slack-files');
        console.log('✓ Bucket exists:', exists);

        if (!exists) {
            console.log('Creating slack-files bucket...');
            await client.makeBucket('slack-files');
            console.log('✓ Bucket created');
        }

        // Test 3: Upload a test file
        console.log('\nTest 3: Uploading test file...');
        const testData = Buffer.from('Hello MinIO!');
        await client.putObject('slack-files', 'test.txt', testData);
        console.log('✓ File uploaded');

        // Test 4: Get presigned URL
        console.log('\nTest 4: Getting presigned URL...');
        const url = await client.presignedGetObject('slack-files', 'test.txt', 3600);
        console.log('✓ Presigned URL:', url);

        // Test 5: Delete test file
        console.log('\nTest 5: Deleting test file...');
        await client.removeObject('slack-files', 'test.txt');
        console.log('✓ File deleted');

        console.log('\n✅ All tests passed! MinIO is working correctly.');
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Error code:', error.code);
        console.error('\nTroubleshooting:');
        console.error('1. Make sure MinIO is running: docker ps | findstr minio');
        console.error('2. Check MinIO logs: docker logs slack-minio');
        console.error('3. Try accessing MinIO console: http://localhost:9001');
        console.error('4. Verify credentials: minioadmin / minioadmin');
    }
};

testMinIO();
