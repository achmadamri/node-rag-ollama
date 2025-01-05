import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import { addDocuments, addPdfDocument, addDocument, askQuestion, clearIndex, createUserIndex, deleteUserIndex } from './rag.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for handling file uploads
const upload = multer({
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Middleware to validate user ID
function validateUserId(req, res, next) {
    const userId = req.params.userId || req.body.userId;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    next();
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Create new user index
app.post('/api/users/:userId', validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await createUserIndex(userId);
        res.json(result);
    } catch (error) {
        console.error('Error creating user index:', error);
        res.status(500).json({ 
            error: 'Failed to create user index',
            details: error.message 
        });
    }
});

// Delete user index
app.delete('/api/users/:userId', validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await deleteUserIndex(userId);
        res.json(result);
    } catch (error) {
        console.error('Error deleting user index:', error);
        res.status(500).json({ 
            error: 'Failed to delete user index',
            details: error.message 
        });
    }
});

// Add documents for a user
app.post('/api/users/:userId/documents', validateUserId, async (req, res) => {
    try {
        const { documents } = req.body;
        if (!Array.isArray(documents)) {
            return res.status(400).json({ error: 'Documents must be an array of strings' });
        }
        const results = await addDocuments(req.params.userId, documents);
        res.json(results);
    } catch (error) {
        console.error('Error adding documents:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload PDF document
app.post('/api/users/:userId/documents/pdf', validateUserId, upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const title = req.body.title || 'Untitled Document';
        const author = req.body.author || 'Unknown Author';
        
        const result = await addPdfDocument(req.params.userId, req.file.buffer, {
            title,
            author,
            filename: req.file.originalname,
            filesize: req.file.size,
            uploadDate: new Date().toISOString()
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error adding PDF document:', error);
        res.status(500).json({ error: error.message });
    }
});

// Upload TXT document
app.post('/api/users/:userId/documents/txt', validateUserId, upload.single('txt'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No TXT file uploaded' });
        }

        const title = req.body.title || 'Untitled Document';
        const author = req.body.author || 'Unknown Author';
        
        // Convert buffer to text
        const text = req.file.buffer.toString('utf-8');
        
        const result = await addDocument(req.params.userId, text, {
            title,
            author,
            documentType: 'txt',
            filename: req.file.originalname,
            filesize: req.file.size,
            uploadDate: new Date().toISOString()
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error adding TXT document:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear user's documents
app.delete('/api/users/:userId/documents', validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await clearIndex(userId);
        res.json(result);
    } catch (error) {
        console.error('Error clearing documents:', error);
        res.status(500).json({ 
            error: 'Failed to clear documents',
            details: error.message 
        });
    }
});

// Ask question using user's documents
app.post('/api/users/:userId/ask', validateUserId, async (req, res) => {
    try {
        const { userId } = req.params;
        const { question } = req.body;
        
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }
        
        const result = await askQuestion(userId, question, true);
        res.json(result);
    } catch (error) {
        console.error('Error processing question:', error);
        res.status(500).json({ 
            error: 'Failed to process question',
            details: error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  POST   /api/users/:userId           - Create new user index');
    console.log('  DELETE /api/users/:userId           - Delete user index');
    console.log('  POST   /api/users/:userId/documents - Add documents for user');
    console.log('  POST   /api/users/:userId/documents/pdf - Upload PDF document');
    console.log('  POST   /api/users/:userId/documents/txt - Upload TXT document');
    console.log('  DELETE /api/users/:userId/documents - Clear user documents');
    console.log('  POST   /api/users/:userId/ask      - Ask questions using user documents');
    console.log('  GET    /health                     - Health check');
});
