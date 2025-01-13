import fetch from 'node-fetch';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

dotenv.config();

const OLLAMA_API = 'http://localhost:11434';
const MODEL_EMBEDDING = 'llama3.2';
const MODEL_GENERATION = 'llama3.2';
const CHUNK_SIZE = 1000; // Size of text chunks for processing
const INDEX_NAME = 'rag-docs-llama'; // Single index for all users

// Initialize Pinecone client
const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

// Function to get index
async function getIndex() {
    return pinecone.index(INDEX_NAME);
}

// Function to get embeddings from Ollama
async function getEmbedding(text) {
    try {
        const response = await fetch(`${OLLAMA_API}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_EMBEDDING,
                prompt: text
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.embedding || !Array.isArray(data.embedding)) {
            throw new Error('Invalid embedding format received from Ollama');
        }
        
        return data.embedding;
    } catch (error) {
        console.error('Error getting embedding:', error.message);
        throw error;
    }
}

// Function to clean and preprocess text
function preprocessText(text) {
    return text
        // Add spaces between camelCase words
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Replace multiple spaces/newlines with single space
        .replace(/\s+/g, ' ')
        // Remove spaces before punctuation
        .replace(/\s+([.,!?])/g, '$1')
        // Add space after punctuation if not followed by space
        .replace(/([.,!?])([^\s])/g, '$1 $2')
        .trim();
}

// Function to split text into chunks
function splitIntoChunks(text, size = CHUNK_SIZE) {
    // First preprocess the text
    const cleanText = preprocessText(text);
    
    const chunks = [];
    const sentences = cleanText.split(/[.!?]+/); // Split by sentence boundaries
    let currentChunk = '';

    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) continue;

        if (currentChunk.length + trimmedSentence.length + 1 <= size) {
            currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
        } else {
            if (currentChunk) chunks.push(currentChunk + '.');
            currentChunk = trimmedSentence;
        }
    }

    if (currentChunk) chunks.push(currentChunk + '.');
    return chunks;
}

// Function to process PDF buffer
async function processPdfBuffer(pdfBuffer) {
    try {
        const data = await pdfParse(pdfBuffer);
        return preprocessText(data.text);
    } catch (error) {
        console.error('Error processing PDF:', error);
        throw new Error('Failed to process PDF file');
    }
}

// Function to wait for index to be ready
async function waitForIndex(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const description = await pinecone.describeIndex(INDEX_NAME);
            if (description.status?.ready) {
                return true;
            }
        } catch (error) {
            console.log(`Waiting for index to be ready (attempt ${i + 1}/${maxAttempts})...`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
    }
    throw new Error(`Index ${INDEX_NAME} not ready after ${maxAttempts} attempts`);
}

// Add document to Pinecone index
async function addDocument(userId, text, metadata = {}) {
    try {
        const index = await getIndex();
        const chunks = splitIntoChunks(text);
        const results = [];

        for (let i = 0; i < chunks.length; i++) {
            console.log(`Processing chunk ${i + 1} of ${chunks.length}`);
            const chunk = chunks[i];
            const embedding = await getEmbedding(chunk);
            const id = `doc_${Date.now()}_chunk_${i}`;

            await index.namespace(userId).upsert([{
                id,
                values: embedding,
                metadata: {
                    ...metadata,
                    text: chunk,
                    chunkIndex: i,
                    totalChunks: chunks.length,
                    timestamp: new Date().toISOString(),
                    userId
                }
            }]);

            results.push({ id, chunk });
        }

        return { 
            success: true, 
            message: `Added document with ${chunks.length} chunks`,
            chunks: results
        };
    } catch (error) {
        console.error('Error adding document:', error.message);
        throw error;
    }
}

// Add PDF document
async function addPdfDocument(userId, pdfBuffer, metadata = {}) {
    try {
        const text = await processPdfBuffer(pdfBuffer);
        return await addDocument(userId, text, {
            ...metadata,
            documentType: 'pdf'
        });
    } catch (error) {
        console.error('Error adding PDF document:', error);
        throw error;
    }
}

// Find similar documents using Pinecone index
async function findSimilarDocuments(userId, query, topK = 3) {
    try {
        const index = await getIndex();
        const queryEmbedding = await getEmbedding(query);
        
        const queryResult = await index.namespace(userId).query({
            vector: queryEmbedding,
            topK,
            includeMetadata: true
        });

        return queryResult.matches.map(match => ({
            text: match.metadata.text,
            similarity: match.score,
            metadata: match.metadata
        }));
    } catch (error) {
        console.error('Error finding similar documents:', error.message);
        throw error;
    }
}

// RAG query function
async function askQuestion(userId, question, returnData = false) {
    try {
        // Find relevant documents
        const similarDocs = await findSimilarDocuments(userId, question, 3); // Increase to 3 docs
        
        // Generate response using context
        const context = similarDocs.map(doc => doc.text).join('\n\n');
        console.log(`\nContext:\n${context}`);
        const response = await fetch(`${OLLAMA_API}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_GENERATION,
                prompt: `
System Prompt:
You are a AI journalist that answers questions based on the provided context
-----------------------------------------------------------------------------------------------------------
Context:
${context}
-----------------------------------------------------------------------------------------------------------
Question:
${question}
-----------------------------------------------------------------------------------------------------------
`,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (returnData) {
            return {
                question,
                relevantDocuments: similarDocs,
                answer: result.response
            };
        } else {
            console.log(`\nQuestion: ${question}`);
            console.log('\nRelevant documents:');
            similarDocs.forEach((doc, i) => {
                console.log(`${i + 1}. ${doc.text.slice(0, 100)}... (similarity: ${doc.similarity.toFixed(3)})`);
            });
            console.log('\nAnswer:', result.response);
        }
    } catch (error) {
        console.error('Error asking question:', error.message);
        throw error;
    }
}

// Add multiple documents for a user
async function addDocuments(userId, documents, metadata = {}) {
    try {
        const results = [];
        // total documents
        let totalDocs = documents.length;
        // counter
        let counter = 0;
        for (const doc of documents) {
            console.log(`Processing document ${counter + 1} of ${totalDocs}...`);
            counter++;            
            console.log(`Processing document...`);            
            const result = await addDocument(userId, doc, metadata);
            results.push(result);
        }
        return results;
    } catch (error) {
        console.error('Error adding documents:', error.message);
        throw error;
    }
}

// Clear user's documents
async function clearIndex(userId) {
    try {
        const index = await getIndex();
        await index.namespace(userId).deleteAll();
        return { success: true, message: `Documents cleared successfully for user ${userId}` };
    } catch (error) {
        console.error('Error clearing documents:', error.message);
        throw error;
    }
}

// Initialize the index if it doesn't exist
async function createUserIndex(userId) {
    try {
        try {
            await pinecone.describeIndex(INDEX_NAME);
            return { success: true, message: `Index ready for user ${userId}` };
        } catch (error) {
            await pinecone.createIndex({
                name: INDEX_NAME,
                dimension: 4096,
                metric: 'cosine',
                spec: {
                    serverless: {
                        cloud: 'aws',
                        region: 'us-east-1'
                    }
                }
            });
            await waitForIndex();
            return { success: true, message: `Created index and ready for user ${userId}` };
        }
    } catch (error) {
        console.error('Error initializing index:', error);
        throw error;
    }
}

// Delete user's documents (not the index)
async function deleteUserIndex(userId) {
    try {
        await clearIndex(userId);
        return { success: true, message: `Deleted all documents for user ${userId}` };
    } catch (error) {
        console.error('Error deleting user documents:', error.message);
        throw error;
    }
}

export { 
    addDocuments,
    addDocument,
    addPdfDocument,
    askQuestion, 
    clearIndex,
    createUserIndex,
    deleteUserIndex 
};
