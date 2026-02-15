import fs from 'fs';
import path from 'path';

async function verifyAutoPost() {
    console.log('Verifying Auto-Post API...');

    try {
        const response = await fetch('http://localhost:3000/api/auto-post', {
            method: 'POST',
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (response.ok && data.success) {
            console.log('SUCCESS: Auto-post verified.');
        } else {
            console.error('FAILURE: Auto-post returned error or failure status.');
            if (data.error) console.error('Error details:', data.error);
        }
    } catch (error) {
        console.error('ERROR: Failed to fetch auto-post API. Is the server running?', error);
    }
}

verifyAutoPost();
