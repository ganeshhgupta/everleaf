from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import requests
from datetime import datetime
from dotenv import load_dotenv
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    print("⚠️  psycopg2 not available - database features disabled")
    PSYCOPG2_AVAILABLE = False
from pinecone import Pinecone
import numpy as np
import math
from sentence_transformers import SentenceTransformer

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
PINECONE_API_KEY = os.getenv('PINECONE_API_KEY', '')
PINECONE_INDEX_NAME = os.getenv('PINECONE_INDEX_NAME', 'everleaf')
HF_API_TOKEN = os.getenv('HUGGINGFACE_API_TOKEN', '')
DATABASE_URL = os.getenv('DATABASE_URL', '')
EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'

# Initialize Pinecone
pinecone_client = None
pinecone_index = None

# Initialize SentenceTransformer model (once)
sentence_model = None

def init_sentence_model():
    global sentence_model
    if sentence_model is None:
        try:
            print("🤗 Initializing SentenceTransformer model...")
            sentence_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
            print("✅ SentenceTransformer model loaded successfully")
        except Exception as e:
            print(f"❌ Failed to load SentenceTransformer model: {e}")
            sentence_model = None
    return sentence_model

def init_pinecone():
    global pinecone_client, pinecone_index
    if PINECONE_API_KEY and not pinecone_client:
        try:
            pinecone_client = Pinecone(api_key=PINECONE_API_KEY)
            pinecone_index = pinecone_client.Index(PINECONE_INDEX_NAME)
            print("✅ Pinecone initialized successfully")
        except Exception as e:
            print(f"❌ Pinecone initialization failed: {e}")
    return pinecone_index

def get_db_connection():
    """Get database connection"""
    if not PSYCOPG2_AVAILABLE:
        print("❌ Database not available - psycopg2 not installed")
        return None
        
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return None

def create_simple_embedding(text):
    """Create a simple hash-based embedding (1024 dimensions to match Pinecone)"""
    print(f"🎯 Creating simple embedding for: {text[:50]}...")
    
    # Normalize text - FIXED regex
    import re
    normalized_text = re.sub(r'[^\w\s]', ' ', text.lower()).strip()
    words = normalized_text.split()
    
    # Create 1024-dimensional embedding to match Pinecone index
    embedding = [0.0] * 1024
    
    # Use words to influence embedding values
    for i, word in enumerate(words[:100]):  # Limit to first 100 words
        for j, char in enumerate(word[:10]):  # Limit to first 10 chars per word
            char_code = ord(char)
            embedding_index = (char_code + i * 7 + j * 3) % 1024
            embedding[embedding_index] += (char_code / 1000.0)
    
    # Normalize the embedding
    magnitude = sum(x * x for x in embedding) ** 0.5
    if magnitude > 0:
        embedding = [x / magnitude for x in embedding]
    
    print(f"✅ Simple embedding created: {len(embedding)} dimensions")
    return embedding

def generate_embedding(text):
    """Generate embedding using local SentenceTransformer to match Node.js backend exactly"""
    
    # Try to use local SentenceTransformer model
    model = init_sentence_model()
    
    if model is not None:
        try:
            print(f"🤗 Generating SentenceTransformer embedding for text: {text[:50]}...")
            
            # Generate embedding using same model as Node.js
            embedding = model.encode(text)  # Returns 384-dim numpy array
            
            print(f"📊 SentenceTransformer embedding dimensions: {len(embedding)}")
            
            # Convert to list and pad to 1024 dimensions to match Pinecone index
            embedding_list = embedding.tolist()
            padded_embedding = embedding_list + [0.0] * (1024 - len(embedding_list))
            
            print(f"📊 Padded to {len(padded_embedding)} dimensions for Pinecone")
            print("✅ SentenceTransformer embedding generated successfully!")
            
            return padded_embedding
            
        except Exception as e:
            print(f"❌ SentenceTransformer embedding error: {e}")
            print("🔄 Falling back to simple embedding...")
    
    else:
        print("⚠️  SentenceTransformer model not available, using simple embedding")
    
    # Fallback to simple embedding
    return create_simple_embedding(text)

def query_embeddings(query_text, namespace, project_id, top_k=5, threshold=-0.8):  # Even lower threshold for testing
    """Query Pinecone for relevant chunks with better debugging"""
    try:
        index = init_pinecone()
        if not index:
            print("❌ Pinecone index not available")
            return []
        
        print(f"🔍 Querying embeddings for: {query_text[:50]}...")
        print(f"🎯 Namespace: {namespace}")
        print(f"🎯 Threshold: {threshold}")
        
        # Generate query embedding
        query_embedding = generate_embedding(query_text)
        if not query_embedding:
            print("❌ Failed to generate query embedding")
            return []
        
        print(f"✅ Query embedding generated: {len(query_embedding)} dimensions")
        
        # Query Pinecone
        results = index.query(
            namespace=namespace,
            vector=query_embedding,
            top_k=top_k * 2,  # Get more results initially
            include_metadata=True
        )
        
        print(f"📊 Raw Pinecone results: {len(results.matches)} matches")
        
        # Log all scores for debugging
        if results.matches:
            print("🔍 All match scores:")
            for i, match in enumerate(results.matches):
                print(f"   Match {i+1}: Score = {match.score:.4f}, ID = {match.id}")
        else:
            print("⚠️  No matches returned from Pinecone")
        
        # Filter by threshold and extract relevant info
        relevant_chunks = []
        for match in results.matches:
            chunk_data = {
                'id': match.id,
                'score': match.score,
                'text': match.metadata.get('text', '') if match.metadata else '',
                'document_id': match.metadata.get('documentId') if match.metadata else None,
                'chunk_index': match.metadata.get('chunkIndex', 0) if match.metadata else 0
            }
            
            if match.score >= threshold:
                relevant_chunks.append(chunk_data)
                print(f"✅ Added chunk: Score={match.score:.4f}, Text preview: {chunk_data['text'][:50]}...")
            else:
                print(f"❌ Filtered out: Score={match.score:.4f} < threshold={threshold}")
        
        print(f"✅ Found {len(relevant_chunks)} relevant chunks (threshold >= {threshold})")
        return relevant_chunks[:top_k]  # Return only requested number
        
    except Exception as e:
        print(f"❌ Embedding query error: {e}")
        import traceback
        traceback.print_exc()
        return []

def get_project_namespaces(project_id):
    """Get all Pinecone namespaces for a project"""
    try:
        conn = get_db_connection()
        if not conn:
            return []
        
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT pinecone_namespace
                FROM project_documents
                WHERE project_id = %s AND processing_status = 'completed'
            """, (project_id,))
            
            results = cursor.fetchall()
            namespaces = [row['pinecone_namespace'] for row in results]
            
        conn.close()
        print(f"📊 Found {len(namespaces)} namespaces for project {project_id}")
        return namespaces
        
    except Exception as e:
        print(f"❌ Database query error: {e}")
        return []

def get_relevant_context(project_id, query_text, max_chunks=5):
    """Get relevant context from all project documents"""
    try:
        print(f"🔍 Getting relevant context for project {project_id}")
        
        # Get all namespaces for the project
        namespaces = get_project_namespaces(project_id)
        if not namespaces:
            print("⚠️ No completed documents found for project")
            return {'chunks': [], 'document_ids': []}
        
        all_chunks = []
        
        # Query each namespace
        for namespace in namespaces:
            print(f"🔍 Searching namespace: {namespace}")
            chunks = query_embeddings(query_text, namespace, project_id, max_chunks * 2)
            all_chunks.extend(chunks)
        
        # Sort by score and take top chunks
        all_chunks.sort(key=lambda x: x['score'], reverse=True)
        top_chunks = all_chunks[:max_chunks]
        
        # Get document info
        document_ids = list(set(chunk['document_id'] for chunk in top_chunks if chunk['document_id']))
        
        document_info = {}
        if document_ids:
            conn = get_db_connection()
            if conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT id, original_filename, upload_date
                        FROM project_documents
                        WHERE id = ANY(%s)
                    """, (document_ids,))
                    
                    for doc in cursor.fetchall():
                        document_info[doc['id']] = {
                            'filename': doc['original_filename'],
                            'upload_date': doc['upload_date']
                        }
                conn.close()
        
        # Add document info to chunks
        for chunk in top_chunks:
            if chunk['document_id'] in document_info:
                chunk['document'] = document_info[chunk['document_id']]
        
        result = {
            'chunks': top_chunks,
            'document_ids': document_ids
        }
        
        print(f"✅ Context retrieval completed: {len(top_chunks)} chunks")
        return result
        
    except Exception as e:
        print(f"❌ Context retrieval error: {e}")
        return {'chunks': [], 'document_ids': []}

def debug_namespace_contents(namespace, project_id):
    """Debug function to inspect what's actually in Pinecone"""
    try:
        index = init_pinecone()
        if not index:
            return {"error": "Pinecone not available"}
        
        print(f"🔍 Debugging namespace: {namespace}")
        
        # Get index stats
        stats = index.describe_index_stats()
        namespace_stats = stats.namespaces.get(namespace, {})
        print(f"📊 Namespace stats: {namespace_stats}")
        
        # Try a broad query to see what vectors exist
        dummy_vector = [0.1] * 1024  # Dummy query vector
        
        results = index.query(
            namespace=namespace,
            vector=dummy_vector,
            top_k=10,
            include_metadata=True
        )
        
        print(f"📋 Found {len(results.matches)} vectors in namespace")
        
        debug_info = {
            "namespace": namespace,
            "vector_count": namespace_stats.get('vector_count', 0),
            "sample_vectors": []
        }
        
        for i, match in enumerate(results.matches[:3]):  # Show first 3
            sample = {
                "id": match.id,
                "score": match.score,
                "metadata_keys": list(match.metadata.keys()) if match.metadata else [],
                "text_preview": match.metadata.get('text', '')[:100] if match.metadata else ''
            }
            debug_info["sample_vectors"].append(sample)
            print(f"🔍 Vector {i+1}: ID={match.id}, Score={match.score:.4f}")
            print(f"   Metadata keys: {sample['metadata_keys']}")
            print(f"   Text preview: {sample['text_preview']}")
        
        return debug_info
        
    except Exception as e:
        print(f"❌ Debug error: {e}")
        return {"error": str(e)}

def ask_groq_with_context(message, context_chunks, model_type="text"):
    """Intelligent Groq API with enhanced RAG context processing"""
    
    if not GROQ_API_KEY:
        return "❌ Get free Groq API key at: https://console.groq.com/"
    
    # Step 1: Analyze the query to understand what type of information is needed
    query_analysis = analyze_query_intent(message)
    
    # Step 2: Intelligently select and format the most relevant context
    formatted_context = format_intelligent_context(context_chunks, query_analysis, message)
    
    # Step 3: Use multi-step reasoning if needed
    if query_analysis.get('requires_multi_step', False):
        return multi_step_groq_reasoning(message, formatted_context, model_type)
    
    # Step 4: Create enhanced system prompt based on query type
    system_prompt = create_adaptive_system_prompt(query_analysis, model_type)
    
    # Step 5: Make the API call with optimized parameters
    return make_groq_request(message, formatted_context, system_prompt, model_type, query_analysis)

def analyze_query_intent(message):
    """Analyze the user's query to determine intent and required processing approach"""
    message_lower = message.lower()
    
    analysis = {
        'query_type': 'general',
        'requires_multi_step': False,
        'info_needed': [],
        'temporal_aspect': 'current',  # past, current, future
        'specificity': 'specific',     # general, specific
        'complexity': 'simple'         # simple, complex
    }
    
    # Detect query type
    if any(word in message_lower for word in ['where', 'which', 'what university', 'what college', 'school']):
        analysis['query_type'] = 'location_education'
        analysis['info_needed'] = ['university', 'college', 'school', 'education', 'degree']
    
    elif any(word in message_lower for word in ['what degree', 'studying', 'pursuing', 'major']):
        analysis['query_type'] = 'degree_program'
        analysis['info_needed'] = ['degree', 'major', 'program', 'thesis', 'specialization']
    
    elif any(word in message_lower for word in ['experience', 'work', 'job', 'position', 'role']):
        analysis['query_type'] = 'professional_experience'
        analysis['info_needed'] = ['work', 'job', 'position', 'experience', 'company']
    
    elif any(word in message_lower for word in ['skills', 'technology', 'programming', 'tools']):
        analysis['query_type'] = 'technical_skills'
        analysis['info_needed'] = ['skills', 'technology', 'programming', 'tools', 'languages']
    
    # Detect temporal aspect
    if any(word in message_lower for word in ['graduated', 'completed', 'finished', 'past']):
        analysis['temporal_aspect'] = 'past'
    elif any(word in message_lower for word in ['currently', 'now', 'present', 'studying', 'pursuing']):
        analysis['temporal_aspect'] = 'current'
    elif any(word in message_lower for word in ['will', 'future', 'plan', 'next']):
        analysis['temporal_aspect'] = 'future'
    
    # Detect complexity
    if ' and ' in message_lower or len(message.split()) > 10:
        analysis['complexity'] = 'complex'
        analysis['requires_multi_step'] = True
    
    return analysis

def format_intelligent_context(context_chunks, query_analysis, original_message):
    """Intelligently format context based on query analysis"""
    if not context_chunks:
        return ""
    
    # Score chunks based on relevance to query intent
    scored_chunks = []
    for chunk in context_chunks:
        score = calculate_chunk_relevance_score(chunk, query_analysis, original_message)
        scored_chunks.append((chunk, score))
    
    # Sort by relevance score
    scored_chunks.sort(key=lambda x: x[1], reverse=True)
    
    # Format context with intelligent emphasis
    context_parts = []
    context_parts.append("=== RELEVANT INFORMATION FROM DOCUMENTS ===\n")
    
    for i, (chunk, relevance_score) in enumerate(scored_chunks[:5], 1):  # Top 5 chunks
        doc_name = chunk.get('document', {}).get('filename', 'Unknown document')
        chunk_text = chunk['text']
        
        # Highlight relevant portions
        highlighted_text = highlight_relevant_info(chunk_text, query_analysis)
        
        context_parts.append(f"[SOURCE {i} - {doc_name} - Relevance: {relevance_score:.2f}]")
        context_parts.append(f"{highlighted_text}")
        context_parts.append("---")
    
    context_parts.append("=== END OF DOCUMENT INFORMATION ===\n")
    
    return "\n".join(context_parts)

def calculate_chunk_relevance_score(chunk, query_analysis, original_message):
    """Calculate how relevant a chunk is to the query"""
    chunk_text = chunk['text'].lower()
    score = 0.0
    
    # Base score from similarity
    base_score = chunk.get('score', 0.0)
    score += base_score * 10  # Amplify the existing similarity score
    
    # Keyword matching based on query type
    for keyword in query_analysis['info_needed']:
        if keyword in chunk_text:
            score += 5.0
    
    # Specific term matching
    query_words = original_message.lower().split()
    for word in query_words:
        if len(word) > 3 and word in chunk_text:  # Ignore short words
            score += 2.0
    
    # Bonus for certain key phrases based on query type
    if query_analysis['query_type'] == 'location_education':
        if any(phrase in chunk_text for phrase in ['university', 'college', 'teaching assistant', 'graduate']):
            score += 10.0
    
    elif query_analysis['query_type'] == 'degree_program':
        if any(phrase in chunk_text for phrase in ['master', 'degree', 'thesis', 'specialization']):
            score += 10.0
    
    # Penalize irrelevant chunks
    if 'genpaper' in chunk_text and 'ganesh' not in chunk_text:
        score -= 5.0
    
    return score

def highlight_relevant_info(text, query_analysis):
    """Highlight the most relevant parts of the text"""
    # For now, return full text but could implement actual highlighting
    # In production, you might want to truncate less relevant parts
    return text

def create_adaptive_system_prompt(query_analysis, model_type):
    """Create a system prompt tailored to the query type"""
    base_prompt = """You are an intelligent document analysis assistant. Your job is to carefully analyze the provided document information and answer questions accurately based on ONLY the information present in the documents.

CRITICAL INSTRUCTIONS:
1. Read ALL the provided document sources carefully
2. Look for information that directly answers the user's question
3. If you find relevant information, state it clearly and mention which document it came from
4. If information is incomplete, say what you found and what's missing
5. NEVER say "I don't have information" if relevant details are actually present in the sources
6. Pay special attention to employment, education, and personal details"""
    
    if query_analysis['query_type'] == 'location_education':
        specific_prompt = """
SPECIFIC FOCUS: The user is asking about educational institutions, universities, colleges, or schools.
- Look for terms like: university, college, school, graduate, teaching assistant, student
- Pay attention to institutional names, locations, and current/past affiliations
- Note any degree programs, enrollment status, or educational roles"""
    
    elif query_analysis['query_type'] == 'degree_program':
        specific_prompt = """
SPECIFIC FOCUS: The user is asking about academic degrees, programs, or specializations.
- Look for terms like: degree, major, thesis, specialization, program, masters, bachelor
- Pay attention to field of study, research topics, and academic focus areas
- Note any current vs. completed educational programs"""
    
    elif query_analysis['query_type'] == 'professional_experience':
        specific_prompt = """
SPECIFIC FOCUS: The user is asking about work experience, jobs, or professional roles.
- Look for terms like: job, work, position, role, company, employer, experience
- Pay attention to job titles, company names, employment dates, and responsibilities"""
    
    else:
        specific_prompt = """
SPECIFIC FOCUS: Provide accurate information based on the document contents.
- Read carefully and extract relevant details
- Be specific and cite sources when possible"""
    
    return base_prompt + specific_prompt

def multi_step_groq_reasoning(message, context, model_type):
    """Handle complex queries with multiple steps"""
    
    # Step 1: Break down the complex question
    breakdown_prompt = f"""Break down this complex question into simpler parts that can be answered separately:
    Question: {message}
    
    Provide a numbered list of sub-questions."""
    
    breakdown_response = make_groq_request(
        breakdown_prompt, "", 
        "You are a question analysis expert. Break complex questions into simpler parts.",
        model_type, {'complexity': 'simple'}
    )
    
    # Step 2: Answer each part using the context
    parts_prompt = f"""Based on the document information provided, answer each part of this question:
    Original Question: {message}
    Question Parts: {breakdown_response}
    
    For each part, provide what information you can find in the documents."""
    
    parts_response = make_groq_request(
        parts_prompt, context,
        "You are a thorough document analyst. Answer each question part based on the provided information.",
        model_type, {'complexity': 'simple'}
    )
    
    # Step 3: Synthesize the final answer
    synthesis_prompt = f"""Synthesize a complete answer to the original question:
    Original Question: {message}
    Partial Answers: {parts_response}
    
    Provide a comprehensive, well-structured final answer."""
    
    return make_groq_request(
        synthesis_prompt, "",
        "You are a synthesis expert. Combine partial answers into a complete response.",
        model_type, {'complexity': 'simple'}
    )

def make_groq_request(message, context, system_prompt, model_type, query_analysis):
    """Make the actual Groq API request with optimized parameters"""
    
    # Combine message and context intelligently
    if context:
        full_message = f"{context}\n\nUSER QUESTION: {message}\n\nPlease answer based on the document information provided above."
    else:
        full_message = message
    
    # Adjust temperature based on query type
    temperature = 0.1 if query_analysis.get('query_type') in ['location_education', 'degree_program'] else 0.3
    
    # Pick the right model
    models = {
        "code": "llama-3.1-8b-instant",
        "text": "llama-3.1-8b-instant", 
        "chat": "llama-3.1-8b-instant"
    }
    
    model = models.get(model_type, "llama-3.1-8b-instant")
    
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": full_message}
                ],
                "max_tokens": 2000,  # Increased for complex responses
                "temperature": temperature
            },
            timeout=45  # Increased timeout for complex processing
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("choices") and len(result["choices"]) > 0:
                return result["choices"][0]["message"]["content"].strip()
        
        return f"❌ Groq Error: {response.status_code} - {response.text[:100]}"
        
    except Exception as e:
        return f"❌ Error: {str(e)}"

print("="*50)
print("🚀 ULTRA-SIMPLE GROQ SERVER WITH RAG")
print(f"🔑 Groq API Key: {'✅ Ready' if GROQ_API_KEY else '❌ Missing'}")
print(f"🧠 Pinecone API Key: {'✅ Ready' if PINECONE_API_KEY else '❌ Missing'}")
print(f"🤗 HuggingFace Token: {'✅ Ready' if HF_API_TOKEN else '❌ Missing'}")
print(f"💾 Database: {'✅ Ready' if DATABASE_URL and PSYCOPG2_AVAILABLE else '❌ Missing/Disabled'}")
print("="*50)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "groq_configured": bool(GROQ_API_KEY),
        "pinecone_configured": bool(PINECONE_API_KEY),
        "hf_configured": bool(HF_API_TOKEN),
        "db_configured": bool(DATABASE_URL),
        "timestamp": datetime.now().isoformat()
    })

@app.route('/test', methods=['GET'])
def test():
    """Test if all services are working"""
    # Test Groq
    groq_result = ask_groq_with_context("Write a simple hello world function in Python", [], "code")
    
    # Test database
    db_working = get_db_connection() is not None
    
    # Test Pinecone
    pinecone_working = init_pinecone() is not None
    
    return jsonify({
        "groq_test": groq_result,
        "groq_working": not groq_result.startswith("❌"),
        "database_working": db_working,
        "pinecone_working": pinecone_working,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/chat', methods=['POST'])
def chat():
    """Enhanced chat endpoint with RAG support"""
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({"error": "Message required"}), 400
        
        message = data['message'].strip()
        model_type = data.get('model_type', 'text')
        project_id = data.get('project_id')  # Optional project ID for RAG
        use_rag = data.get('use_rag', False)  # Whether to use RAG
        
        if not message:
            return jsonify({"error": "Empty message"}), 400
        
        print(f"💬 Question: {message[:50]}...")
        print(f"🎯 Project ID: {project_id}")
        print(f"🧠 Use RAG: {use_rag}")
        
        context_chunks = []
        
        # Get relevant context if RAG is enabled and project_id provided
        if use_rag and project_id:
            print(f"🔍 Getting context for project {project_id}")
            context_result = get_relevant_context(project_id, message)
            context_chunks = context_result.get('chunks', [])
            print(f"📊 Found {len(context_chunks)} relevant chunks")
        
        # Ask Groq with context
        response = ask_groq_with_context(message, context_chunks, model_type)
        
        print(f"✅ Answer: {response[:50]}...")
        
        return jsonify({
            "response": response,
            "model_type": model_type,
            "context_used": len(context_chunks),
            "success": True,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/latex-assist', methods=['POST'])
def latex_assist():
    """Enhanced LaTeX help endpoint with RAG support"""
    try:
        data = request.get_json()
        
        if not data or 'action' not in data:
            return jsonify({"error": "Action required"}), 400
        
        action = data['action']
        selected_text = data.get('selected_text', '')
        user_request = data.get('request', '')
        project_id = data.get('project_id')
        use_rag = data.get('use_rag', True)  # Default to using RAG for LaTeX assistance
        
        # Create prompts based on action
        if action == 'generate':
            prompt = f"Generate LaTeX code for: {user_request}"
        elif action == 'fix':
            prompt = f"Fix this LaTeX code:\n{selected_text}\n\nRequest: {user_request}"
        elif action == 'explain':
            prompt = f"Explain this LaTeX code:\n{selected_text}"
        elif action == 'improve':
            prompt = f"Improve this LaTeX code:\n{selected_text}\n\nRequest: {user_request}"
        elif action == 'complete':
            prompt = f"Complete this LaTeX code:\n{selected_text}\n\nRequest: {user_request}"
        else:
            return jsonify({"error": "Invalid action"}), 400
        
        print(f"🔧 LaTeX action: {action}")
        print(f"🎯 Project ID: {project_id}")
        print(f"🧠 Use RAG: {use_rag}")
        
        context_chunks = []
        
        # Get relevant context if RAG is enabled
        if use_rag and project_id:
            print(f"🔍 Getting LaTeX context for project {project_id}")
            context_result = get_relevant_context(project_id, prompt)
            context_chunks = context_result.get('chunks', [])
            print(f"📊 Found {len(context_chunks)} relevant chunks for LaTeX")
        
        # Ask Groq with context
        response = ask_groq_with_context(prompt, context_chunks, "code")
        
        return jsonify({
            "response": response,
            "action": action,
            "context_used": len(context_chunks),
            "success": True,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/projects/<int:project_id>/query-context', methods=['POST'])
def query_context(project_id):
    """Endpoint to query document context without generating response"""
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({"error": "Query required"}), 400
        
        query_text = data['query'].strip()
        max_chunks = data.get('maxChunks', 5)
        
        if not query_text:
            return jsonify({"error": "Empty query"}), 400
        
        print(f"🔍 Querying context: {query_text[:50]}...")
        print(f"🎯 Project ID: {project_id}")
        
        context_result = get_relevant_context(project_id, query_text, max_chunks)
        
        return jsonify({
            "success": True,
            "context": context_result,
            "message": f"Found {len(context_result.get('chunks', []))} relevant chunks"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/projects/<int:project_id>/debug-vectors', methods=['GET'])
def debug_project_vectors(project_id):
    """Debug endpoint to inspect project vectors"""
    try:
        print(f"🔍 Debugging vectors for project {project_id}")
        
        # Get all namespaces for the project
        namespaces = get_project_namespaces(project_id)
        
        if not namespaces:
            return jsonify({
                "error": "No namespaces found for project",
                "project_id": project_id
            }), 404
        
        debug_results = {}
        
        for namespace in namespaces:
            debug_info = debug_namespace_contents(namespace, project_id)
            debug_results[namespace] = debug_info
        
        return jsonify({
            "project_id": project_id,
            "namespaces_found": len(namespaces),
            "debug_results": debug_results,
            "success": True
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Legacy endpoint for backward compatibility
@app.route('/query-context', methods=['POST'])
def query_context_legacy():
    """Legacy endpoint to query document context without generating response"""
    try:
        data = request.get_json()
        
        if not data or 'query' not in data or 'project_id' not in data:
            return jsonify({"error": "Query and project_id required"}), 400
        
        query_text = data['query'].strip()
        project_id = data['project_id']
        max_chunks = data.get('max_chunks', 5)
        
        if not query_text:
            return jsonify({"error": "Empty query"}), 400
        
        print(f"🔍 Querying context: {query_text[:50]}...")
        print(f"🎯 Project ID: {project_id}")
        
        context_result = get_relevant_context(project_id, query_text, max_chunks)
        
        return jsonify({
            "context": context_result,
            "success": True,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    print(f"🚀 Starting Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
    
    missing_configs = []
    if not GROQ_API_KEY:
        missing_configs.append("GROQ_API_KEY")
    if not PINECONE_API_KEY:
        missing_configs.append("PINECONE_API_KEY") 
    if not HF_API_TOKEN:
        missing_configs.append("HUGGINGFACE_API_TOKEN")
    if not DATABASE_URL:
        missing_configs.append("DATABASE_URL")
    
    if missing_configs:
        print(f"\n⚠️  MISSING CONFIGURATION:")
        for config in missing_configs:
            print(f"📝 Add to .env: {config}=your_key_here")
        print("🔄 Then restart server\n")
    
    # Initialize Pinecone on startup
    init_pinecone()
    
    # Initialize SentenceTransformer model on startup
    init_sentence_model()
    
    print(f"🚀 Starting enhanced server with RAG on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)