const pdf = require('pdf-parse');
const fs = require('fs').promises;
const { query } = require('../config/database');
const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');
const FormData = require('form-data');

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Configuration
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'everleaf';
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const HF_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const LLAMAPARSE_API_KEY = process.env.LLAMAPARSE_API_KEY; // LlamaParse API key
const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'; // This one works better

// Alternative models with 1024 dimensions:
// const EMBEDDING_MODEL = 'intfloat/e5-large-v2'; // 1024 dimensions

// Pinecone index instance
let pineconeIndex;

async function initializePinecone() {
  if (!pineconeIndex) {
    try {
      console.log('🔄 Initializing Pinecone connection...');
      console.log('📊 Pinecone API Key:', process.env.PINECONE_API_KEY ? `${process.env.PINECONE_API_KEY.substring(0, 8)}...` : 'NOT SET');
      console.log('📊 Pinecone Index Name:', PINECONE_INDEX_NAME);
      
      pineconeIndex = pinecone.index(PINECONE_INDEX_NAME);
      
      // Test connection
      console.log('🧪 Testing Pinecone connection...');
      const stats = await pineconeIndex.describeIndexStats();
      console.log('📊 Pinecone index stats:', JSON.stringify(stats, null, 2));
      console.log('✅ Pinecone index initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Pinecone:', error);
      console.error('📊 Error details:', error.message);
      console.error('📊 Error stack:', error.stack);
      throw error;
    }
  }
  return pineconeIndex;
}

// Extract text from PDF using LlamaParse API (cloud-based)
async function extractTextFromPDFCloud(filePath) {
  try {
    console.log('🦙 Using LlamaParse API for text extraction...');
    console.log('📄 File path:', filePath);
    console.log('📊 LlamaParse API Key:', LLAMAPARSE_API_KEY ? `${LLAMAPARSE_API_KEY.substring(0, 8)}...` : 'NOT SET');
    
    const formData = new FormData();
    formData.append('file', await fs.readFile(filePath), {
      filename: 'document.pdf',
      contentType: 'application/pdf'
    });
    
    // LlamaParse configuration
    formData.append('result_type', 'text');
    formData.append('verbose', 'true');
    formData.append('language', 'en');
    
    console.log('📤 Sending request to LlamaParse...');
    const response = await axios.post(
      'https://api.cloud.llamaindex.ai/api/parsing/upload',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`,
          ...formData.getHeaders()
        },
        timeout: 120000 // 2 minutes timeout
      }
    );
    
    const jobId = response.data.id;
    console.log(`📄 LlamaParse job started: ${jobId}`);
    
    // Poll for completion
    let result;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      try {
        console.log(`⏳ Checking LlamaParse status (attempt ${attempts + 1}/${maxAttempts})...`);
        const statusResponse = await axios.get(
          `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
            }
          }
        );
        
        console.log(`⏳ LlamaParse status: ${statusResponse.data.status}`);
        
        if (statusResponse.data.status === 'SUCCESS') {
          // Get the actual result - try different endpoints
          let text;
          
          try {
            console.log('📄 Trying text endpoint...');
            // Try the text endpoint first
            const resultResponse = await axios.get(
              `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/text`,
              {
                headers: {
                  'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
                }
              }
            );
            console.log('📄 Text endpoint response type:', typeof resultResponse.data);
            console.log('📄 Text endpoint response keys:', Object.keys(resultResponse.data));
            
            // Extract text from the response object
            if (resultResponse.data.text) {
              text = resultResponse.data.text;
            } else if (typeof resultResponse.data === 'string') {
              text = resultResponse.data;
            } else {
              throw new Error('Text not found in expected format');
            }
          } catch (textError) {
            console.log('📄 Text endpoint failed:', textError.response?.status, textError.message);
            try {
              console.log('📄 Trying markdown endpoint...');
              // Try markdown endpoint as fallback
              const markdownResponse = await axios.get(
                `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`,
                {
                  headers: {
                    'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
                  }
                }
              );
              console.log('📄 Markdown endpoint response type:', typeof markdownResponse.data);
              console.log('📄 Markdown endpoint response:', markdownResponse.data);
              text = markdownResponse.data;
            } catch (markdownError) {
              console.log('📄 Markdown endpoint failed:', markdownError.response?.status, markdownError.message);
              try {
                console.log('📄 Trying JSON endpoint...');
                // Try JSON endpoint as last resort
                const jsonResponse = await axios.get(
                  `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/json`,
                  {
                    headers: {
                      'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
                    }
                  }
                );
                
                console.log('📄 JSON endpoint response type:', typeof jsonResponse.data);
                console.log('📄 JSON endpoint response:', JSON.stringify(jsonResponse.data, null, 2));
                
                // Extract text from JSON response
                if (Array.isArray(jsonResponse.data)) {
                  text = jsonResponse.data.map(item => {
                    if (typeof item === 'string') return item;
                    return item.text || item.content || item.value || '';
                  }).join('\n');
                } else if (jsonResponse.data.text) {
                  text = jsonResponse.data.text;
                } else if (jsonResponse.data.content) {
                  text = jsonResponse.data.content;
                } else if (typeof jsonResponse.data === 'string') {
                  text = jsonResponse.data;
                } else {
                  text = JSON.stringify(jsonResponse.data);
                }
              } catch (jsonError) {
                console.log('📄 JSON endpoint failed:', jsonError.response?.status, jsonError.message);
                
                // Try getting the job info instead
                try {
                  console.log('📄 Trying job info endpoint...');
                  const jobInfoResponse = await axios.get(
                    `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
                    {
                      headers: {
                        'Authorization': `Bearer ${LLAMAPARSE_API_KEY}`
                      }
                    }
                  );
                  console.log('📄 Job info response:', JSON.stringify(jobInfoResponse.data, null, 2));
                  
                  // Extract text from job info if available
                  if (jobInfoResponse.data.result) {
                    text = jobInfoResponse.data.result.text || jobInfoResponse.data.result.content || '';
                  }
                } catch (jobInfoError) {
                  console.log('📄 Job info endpoint failed:', jobInfoError.response?.status, jobInfoError.message);
                  throw new Error('All LlamaParse result endpoints failed');
                }
              }
            }
          }
          
          console.log(`✅ LlamaParse completed! Text length: ${text?.length || 0}`);
          console.log(`📄 Text type: ${typeof text}`);
          if (text && text.length > 0) {
            console.log(`📄 First 200 chars: ${text.substring(0, 200)}...`);
          }
          
          if (!text || typeof text !== 'string' || text.trim().length < 50) {
            throw new Error(`LlamaParse returned insufficient text. Got: ${typeof text}, length: ${text?.length || 0}`);
          }
          
          console.log('🔄 Splitting text into chunks...');
          const chunks = splitTextIntoChunks(text);
          console.log(`📊 Created ${chunks.length} chunks`);
          
          return {
            text: text,
            pageCount: Math.ceil(text.length / 3000), // Estimate pages
            chunks: chunks,
            info: { processed_by: 'llamaparse' }
          };
          
        } else if (statusResponse.data.status === 'ERROR') {
          throw new Error(`LlamaParse processing failed: ${statusResponse.data.error || 'Unknown error'}`);
        }
        
        attempts++;
      } catch (error) {
        console.log(`⏳ Polling attempt ${attempts + 1}/${maxAttempts} failed:`, error.message);
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw new Error('LlamaParse job timed out');
        }
      }
    }
    
    throw new Error('LlamaParse job timed out');
    
  } catch (error) {
    console.error('❌ LlamaParse API failed:', error.message);
    console.log('🔄 Falling back to local PDF processing...');
    throw error; // Re-throw to trigger fallback
  }
}

// Alternative: Jina AI Document Segmenter (completely free)
async function extractTextFromPDFJina(filePath) {
  try {
    console.log('🤖 Using Jina AI for text extraction...');
    console.log('📄 File path:', filePath);
    
    const formData = new FormData();
    formData.append('file', await fs.readFile(filePath), {
      filename: 'document.pdf',
      contentType: 'application/pdf'
    });
    
    console.log('📤 Sending request to Jina AI...');
    const response = await axios.post(
      'https://segment.jina.ai/',
      formData,
      {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 60000
      }
    );
    
    console.log('📨 Jina AI response received');
    const segments = response.data.segments || [];
    console.log(`📊 Jina AI extracted ${segments.length} segments`);
    
    const text = segments.map(seg => seg.content).join('\n');
    console.log(`📄 Combined text length: ${text.length}`);
    
    const chunks = segments.map((segment, index) => ({
      text: segment.content.trim(),
      startIndex: index * 1000,
      endIndex: (index + 1) * 1000,
      length: segment.content.trim().length,
      metadata: {
        type: segment.type || 'text',
        page_number: segment.metadata?.page_number || null
      }
    })).filter(chunk => chunk.length > 50);
    
    console.log(`📊 Created ${chunks.length} valid chunks from Jina AI segments`);
    
    return {
      text: text,
      pageCount: Math.max(...segments.map(s => s.metadata?.page_number || 1)),
      chunks: chunks,
      info: { processed_by: 'jina-ai' }
    };
    
  } catch (error) {
    console.error('❌ Jina AI failed:', error.message);
    console.log('🔄 Falling back to local PDF processing...');
    return await extractTextFromPDFLocal(filePath);
  }
}

// Fallback: Local PDF extraction
async function extractTextFromPDFLocal(filePath) {
  try {
    console.log('📄 Using local PDF extraction...');
    console.log('📄 File path:', filePath);
    
    const dataBuffer = await fs.readFile(filePath);
    console.log(`📊 File loaded, size: ${dataBuffer.length} bytes`);
    
    console.log('🔄 Parsing PDF with pdf-parse...');
    const data = await pdf(dataBuffer);
    console.log(`📄 Local extraction complete - Text length: ${data.text.length}, Pages: ${data.numpages}`);
    console.log(`📄 First 200 chars: ${data.text.substring(0, 200)}...`);
    
    const chunks = splitTextIntoChunks(data.text);
    console.log(`📊 Created ${chunks.length} chunks from local extraction`);
    
    return {
      text: data.text,
      pageCount: data.numpages,
      chunks: chunks,
      info: data.info
    };
  } catch (error) {
    console.error('❌ Failed to extract text from PDF locally:', error);
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

// Smart text extraction - tries cloud APIs, falls back to local
async function extractTextFromPDF(filePath) {
  console.log('🔄 Starting text extraction process...');
  console.log('📄 File path:', filePath);
  
  // Try LlamaParse first (if API key available)
  if (LLAMAPARSE_API_KEY) {
    console.log('🦙 LlamaParse API key found, trying LlamaParse...');
    try {
      return await extractTextFromPDFCloud(filePath);
    } catch (error) {
      console.log('🦙 LlamaParse failed, trying Jina AI...');
    }
  } else {
    console.log('🦙 No LlamaParse API key, skipping to Jina AI...');
  }
  
  // Try Jina AI (completely free, no API key needed)
  try {
    console.log('🤖 Trying Jina AI extraction...');
    return await extractTextFromPDFJina(filePath);
  } catch (error) {
    console.log('🤖 Jina AI failed, using local processing...');
  }
  
  // Fallback to local processing
  console.log('⚠️ Using local PDF processing as final fallback');
  return await extractTextFromPDFLocal(filePath);
}

// Split text into chunks (for local processing)
function splitTextIntoChunks(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  console.log(`🔄 Splitting text into chunks (size: ${chunkSize}, overlap: ${overlap})...`);
  console.log(`📊 Input text length: ${text.length}`);
  
  // Early return for very short text
  if (text.length <= chunkSize) {
    console.log('📄 Text is shorter than chunk size, returning single chunk');
    if (text.trim().length > 50) {
      return [{
        text: text.trim(),
        startIndex: 0,
        endIndex: text.length,
        length: text.trim().length,
        metadata: {
          type: 'text',
          page_number: null
        }
      }];
    } else {
      console.log('📄 Text too short even for a single chunk');
      return [];
    }
  }
  
  const chunks = [];
  let startIndex = 0;
  let chunkCount = 0;
  const maxChunks = Math.ceil(text.length / (chunkSize - overlap)) + 1; // More realistic max
  
  while (startIndex < text.length && chunkCount < maxChunks) {
    console.log(`📄 Creating chunk ${chunkCount + 1}, startIndex: ${startIndex}`);
    
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    const chunk = text.substring(startIndex, endIndex);
    
    console.log(`📄 Chunk ${chunkCount + 1}: ${startIndex}-${endIndex} (${chunk.length} chars)`);
    
    if (chunk.trim().length > 50) {
      chunks.push({
        text: chunk.trim(),
        startIndex,
        endIndex,
        length: chunk.trim().length,
        metadata: {
          type: 'text',
          page_number: null
        }
      });
      console.log(`✅ Chunk ${chunkCount + 1} added (${chunk.trim().length} chars)`);
    } else {
      console.log(`⚠️ Chunk ${chunkCount + 1} too short, skipping`);
    }
    
    // Calculate next start position - FIXED LOGIC
    const nextStart = startIndex + chunkSize - overlap;
    
    // Ensure we make progress and don't create infinite loops
    if (nextStart <= startIndex || nextStart >= text.length) {
      console.log(`🏁 No more meaningful chunks possible, stopping`);
      break;
    }
    
    startIndex = nextStart;
    chunkCount++;
  }
  
  console.log(`📊 Chunking completed: Created ${chunks.length} chunks`);
  console.log(`📊 Chunk details: ${chunks.map(c => c.length).join(', ')} characters each`);
  
  return chunks;
}

// Generate embeddings using multiple free APIs with fallbacks
async function generateEmbedding(text) {
  console.log('🧠 Generating embedding...');
  console.log('📊 Text length:', text.length);
  console.log('📄 Text preview:', text.substring(0, 100) + '...');
  
  // Method 1: HuggingFace Inference API (free tier)
  if (HF_API_TOKEN) {
    try {
      console.log('🤗 Trying HuggingFace embeddings...');
      console.log('📊 HF API Token:', HF_API_TOKEN ? `${HF_API_TOKEN.substring(0, 8)}...` : 'NOT SET');
      console.log('📊 Embedding model:', EMBEDDING_MODEL);
      
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${EMBEDDING_MODEL}`,
        { inputs: text },
        {
          headers: {
            'Authorization': `Bearer ${HF_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // Increased timeout
        }
      );
      
      console.log('📨 HuggingFace embedding response received');
      console.log('📊 Response type:', typeof response.data);
      console.log('📊 Response length:', Array.isArray(response.data) ? response.data.length : 'Not array');
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
      
      throw new Error('Invalid HuggingFace response format');
      
    } catch (error) {
      console.error('❌ HuggingFace embedding failed:', error.response?.data || error.message);
      console.error('📊 Error status:', error.response?.status);
      
      if (error.response?.status === 503) {
        console.log('⏳ HuggingFace model is loading, waiting 15 seconds...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        // Try once more after waiting
        try {
          console.log('🔄 Retrying HuggingFace after wait...');
          const retryResponse = await axios.post(
            `https://api-inference.huggingface.co/models/${EMBEDDING_MODEL}`,
            { inputs: text },
            {
              headers: {
                'Authorization': `Bearer ${HF_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              timeout: 60000
            }
          );
          
          if (Array.isArray(retryResponse.data) && retryResponse.data.length > 0) {
            console.log('✅ HuggingFace retry successful!');
            return retryResponse.data;
          }
        } catch (retryError) {
          console.log('❌ HuggingFace retry also failed, trying alternatives...');
        }
      }
      
      console.log('🔄 Falling back to alternative methods...');
    }
  } else {
    console.log('🤗 No HuggingFace API token, trying alternatives...');
  }
  
  // Method 2: Jina AI Embeddings (completely free, no API key needed)
  try {
    console.log('🔮 Trying Jina AI embeddings...');
    
    const response = await axios.post(
      'https://api.jina.ai/v1/embeddings',
      {
        input: [text],
        model: 'jina-embeddings-v2-base-en'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    console.log('📨 Jina AI embedding response received');
    console.log('📊 Response type:', typeof response.data);
    
    if (response.data && response.data.data && response.data.data[0]) {
      console.log('✅ Jina AI embedding successful!');
      return response.data.data[0].embedding;
    }
    
    throw new Error('Invalid Jina AI response format');
    
  } catch (error) {
    console.error('❌ Jina AI embedding failed:', error.response?.data || error.message);
    console.log('🔄 Trying next method...');
  }
  
  // Method 3: Sentence Transformers via HuggingFace (different model)
  try {
    console.log('🔄 Trying alternative HuggingFace model...');
    
    const altModel = 'sentence-transformers/all-mpnet-base-v2';
    console.log('📊 Alternative model:', altModel);
    
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${altModel}`,
      { inputs: text },
      {
        headers: HF_API_TOKEN ? {
          'Authorization': `Bearer ${HF_API_TOKEN}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    console.log('📨 Alternative HuggingFace model response received');
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log('✅ Alternative HuggingFace model successful!');
      return response.data;
    }
    
    throw new Error('Invalid alternative HuggingFace response');
    
  } catch (error) {
    console.error('❌ Alternative HuggingFace model failed:', error.response?.data || error.message);
    console.log('🔄 Trying final fallback...');
  }
  
  // Method 4: Local/Simple embedding fallback (basic but works)
  try {
    console.log('🎯 Using simple local embedding fallback...');
    
    // Create a simple hash-based embedding (768 dimensions)
    const embedding = createSimpleEmbedding(text);
    
    console.log('✅ Simple embedding created successfully!');
    console.log('📊 Embedding dimensions:', embedding.length);
    
    return embedding;
    
  } catch (error) {
    console.error('❌ Even simple embedding failed:', error);
    throw new Error(`All embedding methods failed. Last error: ${error.message}`);
  }
}

// Simple local embedding fallback (basic but functional)
function createSimpleEmbedding(text) {
  console.log('🎯 Creating simple hash-based embedding...');
  
  // Normalize text
  const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = normalizedText.split(' ').filter(word => word.length > 2);
  
  // Create 1024-dimensional embedding to match Pinecone index
  const embedding = new Array(1024).fill(0);
  
  // Use words to influence embedding values
  words.forEach((word, index) => {
    for (let i = 0; i < word.length; i++) {
      const charCode = word.charCodeAt(i);
      const embeddingIndex = (charCode + index * 7) % 1024;
      embedding[embeddingIndex] += Math.sin(charCode * 0.1) * 0.1;
    }
  });
  
  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = embedding[i] / magnitude;
    }
  }
  
  console.log('✅ Simple embedding normalized');
  return embedding;
}

// Store embeddings in Pinecone
async function storeEmbeddings(chunks, documentId, namespace) {
  try {
    console.log('🔄 Starting embedding storage process...');
    console.log('📊 Document ID:', documentId);
    console.log('📊 Namespace:', namespace);
    console.log('📊 Chunks to process:', chunks.length);
    
    const index = await initializePinecone();
    const vectors = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`🧠 Processing chunk ${i + 1}/${chunks.length}...`);
      const chunk = chunks[i];
      const truncatedText = chunk.text.length > 500 ? chunk.text.substring(0, 500) : chunk.text;
      
      console.log(`📄 Chunk ${i} text length: ${chunk.text.length}, truncated: ${truncatedText.length}`);
      
      const embedding = await generateEmbedding(truncatedText);
      
      const vectorId = `doc_${documentId}_chunk_${i}`;
      console.log(`📊 Vector ID: ${vectorId}`);
      
      // Clean metadata - remove null values and ensure proper types
      const metadata = {
        documentId: documentId,
        chunkIndex: i,
        text: chunk.text,
        startIndex: chunk.startIndex,
        endIndex: chunk.endIndex,
        length: chunk.length
      };
      
      // Only add pageNumber if it's not null
      if (chunk.metadata?.page_number !== null && chunk.metadata?.page_number !== undefined) {
        metadata.pageNumber = chunk.metadata.page_number;
      }
      
      vectors.push({
        id: vectorId,
        values: embedding,
        metadata: metadata
      });
      
      console.log('💾 Storing chunk in database...');
      await query(`
        INSERT INTO document_chunks (
          document_id, chunk_index, chunk_text, chunk_tokens, 
          page_number, embedding_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        documentId,
        i,
        chunk.text,
        chunk.length,
        chunk.metadata?.page_number || null,
        vectorId,
        JSON.stringify({
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
          length: chunk.length,
          type: chunk.metadata?.type || 'text'
        })
      ]);
      
      console.log(`✅ Chunk ${i + 1} processed and stored in DB`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('📤 Upserting vectors to Pinecone...');
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      console.log(`📤 Upserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(vectors.length/batchSize)} (${batch.length} vectors)...`);
      
      await index.namespace(namespace).upsert(batch);
      console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} uploaded successfully`);
    }
    
    console.log(`✅ Stored ${vectors.length} embeddings for document ${documentId}`);
    return vectors.length;
    
  } catch (error) {
    console.error('❌ Failed to store embeddings:', error);
    console.error('📊 Error details:', error.message);
    console.error('📊 Error stack:', error.stack);
    throw new Error(`Embedding storage failed: ${error.message}`);
  }
}

// Main document processing function
async function processDocument(documentId, filePath) {
  try {
    console.log('🚀 ==========================================');
    console.log(`🚀 Starting processing for document ${documentId}`);
    console.log('🚀 ==========================================');
    console.log('📄 File path:', filePath);
    console.log('⏰ Process start time:', new Date().toISOString());
    
    console.log('💾 Updating document status to processing...');
    await query(`
      UPDATE project_documents 
      SET processing_status = 'processing'
      WHERE id = $1
    `, [documentId]);
    
    console.log('🔍 Fetching document details from database...');
    const docResult = await query(`
      SELECT pinecone_namespace, original_filename
      FROM project_documents
      WHERE id = $1
    `, [documentId]);
    
    if (docResult.rows.length === 0) {
      throw new Error('Document not found in database');
    }
    
    const { pinecone_namespace, original_filename } = docResult.rows[0];
    console.log('📊 Document details:');
    console.log('   - Namespace:', pinecone_namespace);
    console.log('   - Filename:', original_filename);
    
    console.log(`📄 Extracting text from ${original_filename}`);
    const { text, pageCount, chunks } = await extractTextFromPDF(filePath);
    
    console.log('✅ Text extraction completed!');
    console.log('📊 Extraction results:');
    console.log('   - Text length:', text?.length || 0);
    console.log('   - Page count:', pageCount);
    console.log('   - Chunks count:', chunks?.length || 0);
    
    if (!text || text.trim().length < 100) {
      throw new Error('PDF contains insufficient text content');
    }
    
    const finalChunks = chunks && chunks.length > 0 ? chunks : splitTextIntoChunks(text);
    console.log('📊 Final chunks to process:', finalChunks.length);
    
    if (finalChunks.length === 0) {
      throw new Error('No valid chunks created from document');
    }
    
    console.log(`🧠 Generating embeddings for ${finalChunks.length} chunks using Hugging Face`);
    const embeddingCount = await storeEmbeddings(finalChunks, documentId, pinecone_namespace);
    
    console.log('💾 Updating document status to completed...');
    await query(`
      UPDATE project_documents 
      SET processing_status = 'completed', 
          processed_date = CURRENT_TIMESTAMP,
          text_content = $1,
          page_count = $2,
          error_message = NULL
      WHERE id = $3
    `, [text.substring(0, 5000), pageCount, documentId]);
    
    console.log('🎉 ==========================================');
    console.log(`🎉 Successfully processed document ${documentId} with ${embeddingCount} embeddings`);
    console.log('🎉 ==========================================');
    console.log('⏰ Process end time:', new Date().toISOString());
    
  } catch (error) {
    console.error('💥 ==========================================');
    console.error(`💥 Processing failed for document ${documentId}:`, error);
    console.error('💥 ==========================================');
    console.error('📊 Error message:', error.message);
    console.error('📊 Error stack:', error.stack);
    console.error('⏰ Error time:', new Date().toISOString());
    
    console.log('💾 Updating document status to failed...');
    await query(`
      UPDATE project_documents 
      SET processing_status = 'failed',
          error_message = $1
      WHERE id = $2
    `, [error.message, documentId]);
    
    throw error;
  }
}

// Query embeddings for RAG
async function queryEmbeddings(queryText, namespace, topK = 5, threshold = 0.3) {
  try {
    console.log('🔍 Querying embeddings...');
    console.log('📊 Query text:', queryText);
    console.log('📊 Namespace:', namespace);
    console.log('📊 Top K:', topK);
    console.log('📊 Threshold:', threshold);
    
    const index = await initializePinecone();
    
    console.log('🧠 Generating query embedding...');
    const queryEmbedding = await generateEmbedding(queryText);
    
    console.log('🔍 Searching Pinecone...');
    const queryResponse = await index.namespace(namespace).query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true
    });
    
    console.log('📨 Query response received');
    console.log('📊 Matches found:', queryResponse.matches?.length || 0);
    
    const relevantChunks = queryResponse.matches
      .filter(match => match.score >= threshold)
      .map(match => ({
        id: match.id,
        score: match.score,
        text: match.metadata.text,
        documentId: match.metadata.documentId,
        chunkIndex: match.metadata.chunkIndex
      }));
    
    console.log('📊 Relevant chunks after filtering:', relevantChunks.length);
    
    return relevantChunks;
    
  } catch (error) {
    console.error('❌ Failed to query embeddings:', error);
    throw new Error(`Embedding query failed: ${error.message}`);
  }
}

// Delete document embeddings from Pinecone
async function deleteDocumentEmbeddings(namespace, documentId) {
  try {
    console.log('🗑️ Deleting document embeddings...');
    console.log('📊 Namespace:', namespace);
    console.log('📊 Document ID:', documentId);
    
    const index = await initializePinecone();
    
    console.log('🔍 Finding embedding IDs in database...');
    const chunks = await query(`
      SELECT embedding_id 
      FROM document_chunks 
      WHERE document_id = $1
    `, [documentId]);
    
    console.log('📊 Found embeddings to delete:', chunks.rows.length);
    
    if (chunks.rows.length > 0) {
      const vectorIds = chunks.rows.map(row => row.embedding_id);
      
      const batchSize = 1000;
      for (let i = 0; i < vectorIds.length; i += batchSize) {
        const batch = vectorIds.slice(i, i + batchSize);
        console.log(`🗑️ Deleting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(vectorIds.length/batchSize)} (${batch.length} vectors)...`);
        await index.namespace(namespace).deleteMany(batch);
      }
      
      console.log(`🗑️ Deleted ${vectorIds.length} embeddings for document ${documentId}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to delete embeddings:', error);
    throw error;
  }
}

// Get relevant context for RAG chat
async function getRelevantContext(projectId, queryText, maxChunks = 5) {
  try {
    console.log('🔍 Getting relevant context...');
    console.log('📊 Project ID:', projectId);
    console.log('📊 Query text:', queryText);
    console.log('📊 Max chunks:', maxChunks);
    
    const docResult = await query(`
      SELECT DISTINCT pinecone_namespace
      FROM project_documents
      WHERE project_id = $1 AND processing_status = 'completed'
    `, [projectId]);
    
    console.log('📊 Found namespaces:', docResult.rows.length);
    
    if (docResult.rows.length === 0) {
      console.log('⚠️ No completed documents found for project');
      return { chunks: [], documentIds: [] };
    }
    
    let allChunks = [];
    
    for (const row of docResult.rows) {
      const namespace = row.pinecone_namespace;
      console.log('🔍 Searching namespace:', namespace);
      const chunks = await queryEmbeddings(queryText, namespace, maxChunks * 2);
      allChunks = allChunks.concat(chunks);
    }
    
    console.log('📊 Total chunks found:', allChunks.length);
    
    allChunks.sort((a, b) => b.score - a.score);
    const topChunks = allChunks.slice(0, maxChunks);
    
    console.log('📊 Top chunks selected:', topChunks.length);
    
    const documentIds = [...new Set(topChunks.map(chunk => chunk.documentId))];
    console.log('📊 Unique document IDs:', documentIds.length);
    
    const docInfo = await query(`
      SELECT id, original_filename, upload_date
      FROM project_documents
      WHERE id = ANY($1::int[])
    `, [documentIds]);
    
    const documentMap = {};
    docInfo.rows.forEach(doc => {
      documentMap[doc.id] = {
        filename: doc.original_filename,
        uploadDate: doc.upload_date
      };
    });
    
    const result = {
      chunks: topChunks.map(chunk => ({
        ...chunk,
        document: documentMap[chunk.documentId]
      })),
      documentIds
    };
    
    console.log('✅ Context retrieval completed');
    return result;
    
  } catch (error) {
    console.error('❌ Failed to get relevant context:', error);
    return { chunks: [], documentIds: [] };
  }
}

module.exports = {
  processDocument,
  queryEmbeddings,
  deleteDocumentEmbeddings,
  getRelevantContext,
  initializePinecone
};