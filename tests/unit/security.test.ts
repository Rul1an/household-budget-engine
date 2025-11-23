import assert from 'assert';
import { validateFileSignature } from '../../src/app/actions/import-transactions';

// Mock File class since we are in Node environment
class MockFile {
    name: string;
    type: string;
    content: Buffer;

    constructor(content: Buffer, name: string, type: string) {
        this.content = content;
        this.name = name;
        this.type = type;
    }

    async arrayBuffer() {
        return this.content.buffer.slice(this.content.byteOffset, this.content.byteOffset + this.content.byteLength);
    }
}

async function runTests() {
    console.log('▶ Security - File Validation');

    // Test 1: Valid PDF
    {
        const pdfContent = Buffer.from('%PDF-1.4\n...');
        const file = new MockFile(pdfContent, 'test.pdf', 'application/pdf') as unknown as File;
        const isValid = await validateFileSignature(file);
        assert.strictEqual(isValid, true, 'Valid PDF should be accepted');
        console.log('  ✔ Valid PDF accepted');
    }

    // Test 2: Invalid PDF (Text file renamed)
    {
        const textContent = Buffer.from('This is just a text file');
        const file = new MockFile(textContent, 'fake.pdf', 'application/pdf') as unknown as File;
        const isValid = await validateFileSignature(file);
        assert.strictEqual(isValid, false, 'Fake PDF should be rejected');
        console.log('  ✔ Fake PDF rejected');
    }

    // Test 3: Valid CSV
    {
        const csvContent = Buffer.from('Date,Amount,Description\n2025-01-01,100,Test');
        const file = new MockFile(csvContent, 'test.csv', 'text/csv') as unknown as File;
        const isValid = await validateFileSignature(file);
        assert.strictEqual(isValid, true, 'Valid CSV should be accepted');
        console.log('  ✔ Valid CSV accepted');
    }

    // Test 4: Invalid CSV (Binary content)
    {
        const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03]);
        const file = new MockFile(binaryContent, 'fake.csv', 'text/csv') as unknown as File;
        const isValid = await validateFileSignature(file);
        assert.strictEqual(isValid, false, 'Binary CSV should be rejected');
        console.log('  ✔ Binary CSV rejected');
    }
}

runTests().catch(console.error);
