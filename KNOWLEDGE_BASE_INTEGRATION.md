# Knowledge Base Integration with Bolna

## Overview
This document explains how to configure and use the Knowledge Base integration between your Megna platform and Bolna AI Voice API.

## Important: Bolna Limitations
⚠️ **Bolna currently accepts only PDF files for knowledge bases.** Other document formats (Word, Excel, Images, etc.) are not supported.

## Key Features
✅ **Single file upload** - Upload one PDF at a time
✅ **Bulk upload** - Upload multiple PDFs (up to 10) in one request
✅ **Automatic sync** - Knowledge bases automatically linked to agents
✅ **Vector embeddings** - PDFs automatically indexed for RAG
✅ **Metadata tracking** - File metadata and Bolna RAG IDs stored

## API Endpoints

### 1. Upload Single Knowledge Base to Bolna
**Endpoint:** `POST /api/knowledge-base/upload-to-bolna`

**Description:** Upload a single PDF document to Bolna's knowledge base system and automatically sync it to your platform database.

**Authentication:** Required (Bearer Token)

**Request Body (Form Data):**
```
file: (PDF file) - Required, max size depends on Bolna API limits
agentId: (string) - Optional, agent ID to associate KB with
title: (string) - Optional, custom title for the knowledge base
category: (string) - Optional, categorize the KB (e.g., "product", "policy")
description: (string) - Optional, describe what the KB contains
```

**Response:**
```json
{
  "success": true,
  "message": "Knowledge base uploaded successfully to Bolna",
  "platformEntry": {
    "id": "kb-123456",
    "organizationId": "org-123",
    "agentId": "agent-456",
    "title": "Product Brochure",
    "contentType": "pdf",
    "fileUrl": "product-brochure.pdf",
    "externalId": "rag-abc123",
    "status": "active",
    "tags": ["bolna", "pdf", "knowledge-base"],
    "metadata": {
      "bolnaRagId": "rag-abc123",
      "uploadedAt": "2025-12-06T02:46:00Z",
      "fileName": "product-brochure.pdf",
      "fileSize": 2048576
    },
    "createdAt": "2025-12-06T02:46:00Z"
  },
  "bolnaKnowledgeBase": {
    "rag_id": "rag-abc123",
    "status": "indexed"
  }
}
```

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/knowledge-base/upload-to-bolna \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@company_policy.pdf" \
  -F "agentId=agent-456" \
  -F "title=Company Policy Manual" \
  -F "category=policies" \
  -F "description=Company HR and conduct policies"
```

### 2. Bulk Upload Multiple Knowledge Bases
**Endpoint:** `POST /api/knowledge-base/upload-batch`

**Description:** Upload multiple PDF documents (up to 10) to Bolna in a single request. All files are processed sequentially and linked to the same agent.

**Authentication:** Required (Bearer Token)

**Request Body (Form Data):**
```
files: (PDF files) - Multiple files, max 10 files per request
agentId: (string) - Optional, agent ID to link all KBs to
category: (string) - Optional, category for all uploaded files
description: (string) - Optional, description for all uploaded files
```

**Response:**
```json
{
  "success": true,
  "message": "Uploaded 3 knowledge bases. 0 failed.",
  "uploaded": [
    {
      "fileName": "policy1.pdf",
      "success": true,
      "platformId": "kb-123",
      "bolnaRagId": "rag-abc123"
    },
    {
      "fileName": "policy2.pdf",
      "success": true,
      "platformId": "kb-124",
      "bolnaRagId": "rag-abc124"
    },
    {
      "fileName": "faq.pdf",
      "success": true,
      "platformId": "kb-125",
      "bolnaRagId": "rag-abc125"
    }
  ],
  "failed": []
}
```

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/knowledge-base/upload-batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@policy1.pdf" \
  -F "files=@policy2.pdf" \
  -F "files=@faq.pdf" \
  -F "agentId=agent-456" \
  -F "category=documentation" \
  -F "description=Company documentation batch"
```

**Error Handling for Batch Upload:**
```json
{
  "success": true,
  "message": "Uploaded 2 knowledge bases. 1 failed.",
  "uploaded": [
    {
      "fileName": "policy1.pdf",
      "success": true,
      "platformId": "kb-123",
      "bolnaRagId": "rag-abc123"
    }
  ],
  "failed": [
    {
      "fileName": "document.docx",
      "error": "Only PDF files accepted. Got application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }
  ]
}
```

### 3. Sync Knowledge Bases to Bolna
**Endpoint:** `POST /api/knowledge-base/agent/:agentId/sync-to-bolna`

**Description:** Verify all knowledge bases for an agent are properly synced to Bolna and update agent configuration with all knowledge base IDs.

**Authentication:** Required (Bearer Token)

**Response:**
```json
{
  "message": "Knowledge base sync complete",
  "agentId": "agent-456",
  "total": 3,
  "synced": [
    {
      "kbId": "kb-123",
      "title": "Company Policy",
      "fileUrl": "policy1.pdf",
      "bolnaRagId": "rag-abc123",
      "status": "synced"
    }
  ],
  "failed": []
}
```

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/knowledge-base/agent/agent-456/sync-to-bolna \
  -H "Authorization: Bearer YOUR_TOKEN"
```
```bash
curl -X POST http://localhost:5000/api/knowledge-base/upload-to-bolna \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "agentId=agent-456" \
  -F "title=Product Catalog" \
  -F "category=products" \
  -F "description=Complete product list with pricing"
```

### 2. Get All Knowledge Bases
**Endpoint:** `GET /api/knowledge-base`

**Description:** Retrieve all knowledge bases for your organization or filter by agent.

**Authentication:** Required

**Query Parameters:**
- `agentId` (optional) - Filter KBs by specific agent

**Response:**
```json
[
  {
    "id": "kb-123456",
    "organizationId": "org-123",
    "agentId": "agent-456",
    "title": "Product Brochure",
    "content": "PDF Document: product-brochure.pdf",
    "contentType": "pdf",
    "category": "document",
    "description": "Uploaded PDF: product-brochure.pdf",
    "fileUrl": "product-brochure.pdf",
    "status": "active",
    "tags": ["bolna", "pdf", "knowledge-base"],
    "createdAt": "2025-12-06T02:46:00Z",
    "updatedAt": "2025-12-06T02:46:00Z"
  }
]
```

**Example Request:**
```bash
# Get all KBs for organization
curl http://localhost:5000/api/knowledge-base \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get KBs for specific agent
curl "http://localhost:5000/api/knowledge-base?agentId=agent-456" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Get Knowledge Base Details
**Endpoint:** `GET /api/knowledge-base/:id`

**Description:** Get detailed information about a specific knowledge base.

**Authentication:** Required

**Response:**
```json
{
  "id": "kb-123456",
  "organizationId": "org-123",
  "agentId": "agent-456",
  "title": "Product Brochure",
  "content": "PDF Document: product-brochure.pdf",
  "contentType": "pdf",
  "category": "document",
  "fileUrl": "product-brochure.pdf",
  "status": "active",
  "createdAt": "2025-12-06T02:46:00Z",
  "updatedAt": "2025-12-06T02:46:00Z"
}
```

### 4. Update Knowledge Base Metadata
**Endpoint:** `PATCH /api/knowledge-base/:id`

**Description:** Update knowledge base metadata (title, description, category, etc.). Note: PDF content cannot be changed; delete and re-upload if needed.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "category": "policies",
  "tags": ["updated", "policy", "bolna"],
  "status": "active"
}
```

**Response:** Updated knowledge base object

**Example Request:**
```bash
curl -X PATCH http://localhost:5000/api/knowledge-base/kb-123456 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Product Catalog",
    "category": "products-v2"
  }'
```

### 5. Delete Knowledge Base
**Endpoint:** `DELETE /api/knowledge-base/:id`

**Description:** Delete a knowledge base from both your platform and Bolna.

**Authentication:** Required

**Response:**
```json
{
  "message": "Knowledge base deleted successfully"
}
```

**Example Request:**
```bash
curl -X DELETE http://localhost:5000/api/knowledge-base/kb-123456 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Sync Agent Knowledge Bases to Bolna
**Endpoint:** `POST /api/knowledge-base/agent/:agentId/sync-to-bolna`

**Description:** Verify and sync all knowledge bases associated with an agent to Bolna.

**Authentication:** Required

**Response:**
```json
{
  "message": "Knowledge base sync complete",
  "agentId": "agent-456",
  "synced": [
    {
      "kbId": "kb-123456",
      "title": "Product Brochure",
      "fileUrl": "product-brochure.pdf"
    }
  ],
  "failed": []
}
```

**Example Request:**
```bash
curl -X POST http://localhost:5000/api/knowledge-base/agent/agent-456/sync-to-bolna \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7. List Bolna Knowledge Bases (Direct Bolna API)
**Endpoint:** `GET /api/bolna/knowledge-bases`

**Description:** List all knowledge bases in your Bolna account directly.

**Authentication:** Required

**Response:**
```json
[
  {
    "rag_id": "rag-abc123",
    "name": "Product Brochure",
    "status": "indexed",
    "created_at": "2025-12-06T02:46:00Z"
  }
]
```

### 8. Get Bolna Knowledge Base Details (Direct Bolna API)
**Endpoint:** `GET /api/bolna/knowledge-bases/:ragId`

**Description:** Get details about a specific Bolna knowledge base by RAG ID.

**Authentication:** Required

**Response:**
```json
{
  "rag_id": "rag-abc123",
  "name": "Product Brochure",
  "status": "indexed",
  "documents": 1,
  "chunks": 245,
  "embedding_model": "openai-embedding-3-small"
}
```

## How to Use Knowledge Base with Agents

### Step 1: Prepare Your PDF
- Convert your document to PDF format
- Ensure it's readable and properly formatted
- Recommended: Keep file size under 25MB for best performance

### Step 2: Upload to Your Agent
```bash
curl -X POST http://localhost:5000/api/knowledge-base/upload-to-bolna \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/your/document.pdf" \
  -F "agentId=your-agent-id" \
  -F "title=Your Document Title" \
  -F "category=products"
```

### Step 3: Configure Agent Settings
When creating or updating an agent, the knowledge base IDs are automatically added to:
- `knowledgeBaseIds` array in agent configuration

### Step 4: Agent Uses KB in Conversations
When agents have knowledge bases attached, they automatically use the PDF content to:
- Answer customer questions
- Provide product information
- Share policy details
- Maintain conversation context

## Important Notes

### PDF Requirements
- ✅ **Supported:** PDF files only
- ❌ **Not Supported:** 
  - Word (.docx, .doc)
  - Excel (.xlsx, .xls)
  - Images (.jpg, .png, .gif)
  - Text files (.txt)
  - Web content
  
⚠️ **Workaround:** If you have other document types, convert them to PDF first:
- Use Google Docs → Download as PDF
- Use Microsoft Word → Save as PDF
- Use online converters (Zamzar, CloudConvert, etc.)

### Best Practices
1. **One PDF per Knowledge Base:** Upload one document per KB entry for better organization
2. **Clear Titles:** Use descriptive titles so agents can reference them
3. **Categorize:** Use categories to organize KBs (products, policies, FAQs, etc.)
4. **Update Periodically:** If KB content changes, delete old and upload new version
5. **Test:** Always test agent responses with KB to ensure accuracy

### Performance Tips
- Optimal file size: 2-10 MB
- Split large documents (>25MB) into multiple PDFs
- Well-structured PDFs work better than scanned images
- Ensure PDF is searchable (not just image scans)

## Error Handling

### Error: "Bolna only accepts PDF files"
**Solution:** Convert your document to PDF format before uploading

### Error: "No file uploaded"
**Solution:** Ensure you're sending the file in the correct form-data format

### Error: "Failed to create knowledge base"
**Solution:** 
- Check file size (should be under 25MB)
- Ensure PDF is valid and readable
- Check Bolna API key in environment variables

### Error: "Agent not found"
**Solution:** Verify the agentId exists and belongs to your organization

## Database Schema

Knowledge bases are stored in the `knowledge_base` table:
```sql
CREATE TABLE knowledge_base (
  id VARCHAR PRIMARY KEY,
  organization_id VARCHAR NOT NULL,
  agent_id VARCHAR,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'text',
  category VARCHAR(100),
  description TEXT,
  file_url TEXT,
  source_url TEXT,
  status VARCHAR(50) DEFAULT 'active',
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Integration with Agents

When an agent is created with knowledge bases:
```json
{
  "id": "agent-456",
  "name": "Priya",
  "knowledgeBaseIds": ["rag-abc123", "rag-def456"],
  ...
}
```

The agent will automatically use these knowledge bases during conversations to provide relevant information from your documents.

## Future Enhancements

Planned features:
- Support for multiple document formats (convert to PDF automatically)
- Web URL ingestion (scrape and convert to KB)
- Real-time document updates
- Knowledge base versioning
- Similarity search and preview

## Support

For issues:
1. Check logs: `tail -f /tmp/app.log | grep "KB"`
2. Verify PDF is valid: Try opening in PDF reader
3. Check Bolna API status: Ensure API key is correct
4. Contact Bolna support for knowledge base specific issues
