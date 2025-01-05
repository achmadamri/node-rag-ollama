# Node.js RAG System with Ollama and Pinecone

A Retrieval-Augmented Generation (RAG) system built with Node.js, using Ollama for embeddings and text generation, and Pinecone for vector storage. The system supports multiple users with namespace isolation and handles both PDF and TXT documents.

## Features

- Multi-user support with namespace isolation
- PDF and TXT document processing
- Text chunking and preprocessing
- Vector similarity search
- Question answering using context
- RESTful API interface

### Why Mistral?

This project uses the Mistral model through Ollama for several key reasons:

1. Strong Multilingual Capabilities:
   - Excellent performance in both English and Bahasa Indonesia
   - High-quality responses across multiple languages
   - Maintains context accuracy in different languages

2. Performance and Efficiency:
   - Better performance than many larger models
   - Lower resource requirements while maintaining quality
   - Fast response times for real-time applications

3. Context Understanding:
   - Superior handling of context windows
   - Excellent at maintaining conversation coherence
   - Accurate information extraction from provided context

4. Open Source Benefits:
   - Free to use and modify
   - Active community support
   - Regular updates and improvements

### Why Ollama for Deployment?

This project leverages Ollama as the deployment platform for several strategic reasons:

1. Flexible Deployment Options:
   - **Local Deployment**: Run everything on your own hardware with zero cloud costs
   - **Cloud Deployment**: Deploy on any cloud provider (AWS, GCP, Azure) for scalability
   - **Hybrid Setup**: Combine local development with cloud production environment

2. Privacy and Data Control:
   - Complete data sovereignty - all processing happens within your infrastructure
   - No data sharing with external services
   - Compliance-friendly for sensitive enterprise data

3. Cost-Effectiveness:
   - Zero inference costs when running locally
   - Pay only for compute resources in cloud deployments
   - No per-token or API call charges

4. Operational Benefits:
   - Simple Docker-based deployment
   - Easy scaling with container orchestration
   - Consistent environment across local and cloud setups
   - Built-in API server for seamless integration

5. Development Experience:
   - Fast local development iterations
   - No internet dependency for testing
   - Same API interface in all environments

6. Resource Optimization:
   - Efficient CPU inference with optional GPU acceleration
   - Adjustable model quantization for different hardware
   - Memory-efficient model loading

This combination of Mistral and Ollama provides an ideal foundation for both development and production deployments, offering flexibility, control, and cost-effectiveness while maintaining high performance standards.

## Prerequisites

- Node.js 18+
- Ollama running locally with `mistral` model
- Pinecone account and API key

### Installing Ollama

1. Download Ollama:
   - Windows: Visit [Ollama's Windows installation guide](https://github.com/ollama/ollama/blob/main/docs/windows.md)
   - MacOS: Visit [Ollama's website](https://ollama.ai) and download the installer
   - Linux: Run the following command:
     ```bash
     curl -fsSL https://ollama.ai/install.sh | sh
     ```

2. Start Ollama:
   - Windows: Run Ollama from the Start menu or command prompt
   - MacOS: Open Ollama from Applications
   - Linux: The service should start automatically after installation

3. Pull the Mistral model:
   ```bash
   ollama pull mistral
   ```

4. Verify installation:
   ```bash
   ollama list
   ```
   You should see `mistral` in the list of available models.

### Setting up Pinecone

1. Create a free account at [Pinecone](https://www.pinecone.io/)
2. Create an API key from your Pinecone dashboard
3. Copy the API key and add it to your `.env` file

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd node-rag-ollama
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
PINECONE_API_KEY=your_pinecone_api_key
PORT=3000
```

## Usage

1. Start the server:
```bash
node server.js
```

2. Create a user namespace:
```bash
curl -X POST http://localhost:3000/api/users/user-1
```

3. Add documents:

   a. Upload text documents:
   ```bash
   curl -X POST http://localhost:3000/api/users/user-1/documents \
     -H "Content-Type: application/json" \
     -d '{
       "documents": [
         "This is the first document",
         "This is the second document"
       ]
     }'
   ```

   b. Upload a PDF file:
   ```bash
   curl -X POST http://localhost:3000/api/users/user-1/documents/pdf \
     -F "pdf=@/path/to/document.pdf" \
     -F "title=Document Title" \
     -F "author=Document Author"
   ```

   c. Upload a TXT file:
   ```bash
   curl -X POST http://localhost:3000/api/users/user-1/documents/txt \
     -F "txt=@/path/to/document.txt" \
     -F "title=Document Title" \
     -F "author=Document Author"
   ```

4. Ask questions:
```bash
curl -X POST http://localhost:3000/api/users/user-1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What does the document say about X?"
  }'
```

5. Clear user documents:
```bash
curl -X DELETE http://localhost:3000/api/users/user-1/documents
```

6. Delete user namespace:
```bash
curl -X DELETE http://localhost:3000/api/users/user-1
```

## API Endpoints

- `POST /api/users/:userId` - Create user namespace
- `DELETE /api/users/:userId` - Delete user namespace
- `POST /api/users/:userId/documents` - Add text documents
- `POST /api/users/:userId/documents/pdf` - Upload PDF document
- `POST /api/users/:userId/documents/txt` - Upload TXT document
- `DELETE /api/users/:userId/documents` - Clear user documents
- `POST /api/users/:userId/ask` - Ask questions using context
- `GET /health` - Health check endpoint

## Architecture

1. **Document Processing**:
   - Documents are split into chunks of configurable size
   - Text is preprocessed for better embedding quality
   - Each chunk is embedded using Ollama's embedding model

2. **Storage**:
   - Document embeddings are stored in Pinecone
   - Each user has their own namespace
   - Metadata includes document source, chunk information, and timestamps

3. **Retrieval & Generation**:
   - Questions are embedded using the same model
   - Similar documents are retrieved using vector similarity
   - Context is constructed from relevant documents
   - Ollama generates answers based on the context

## Configuration

Key configuration options in `rag.js`:
- `CHUNK_SIZE`: Size of text chunks (default: 1000)
- `MODEL_EMBEDDING`: Model for embeddings (default: 'mistral')
- `MODEL_GENERATION`: Model for text generation (default: 'mistral')

## Error Handling

The system includes comprehensive error handling for:
- File upload issues
- Processing errors
- Index creation/deletion
- Query processing

## Security Considerations

- User data is isolated using Pinecone namespaces
- File size limits are enforced
- Input validation is performed
- Error messages are sanitized

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[Your chosen license]
