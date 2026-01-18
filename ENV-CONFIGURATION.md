# Environment Configuration Guide

## Required Configuration

Create a `.env` file in the project root with the following settings:

```env
# AI Model Configuration
AI_MODEL_NAME=mistral
AI_MAX_CONTEXT_TOKENS=512
AI_REQUEST_TIMEOUT=120000

# Python Server Model Path
MODEL_PATH=./AI/mistral-7b-instruct-v0.2.Q4_K_M.gguf

# AI Server URL
AI_SERVER_URL=http://localhost:8000
AI_API_KEY=

# GPU/CUDA Configuration
USE_CUDA=false
GPU_LAYERS=

# Feature Flags
NEXT_PUBLIC_AI_ENABLED=true
AI_ENABLED=true
```

## Model-Specific Configurations

### Mistral-7B (Current - 512 token context)
```env
AI_MODEL_NAME=mistral
AI_MAX_CONTEXT_TOKENS=512
MODEL_PATH=./AI/mistral-7b-instruct-v0.2.Q4_K_M.gguf
```

### Llama-3.2-1B (Recommended - 2048+ token context)
```env
AI_MODEL_NAME=llama
AI_MAX_CONTEXT_TOKENS=2048
MODEL_PATH=./AI/Llama-3.2-1B-Instruct-IQ4_XS.gguf
```

### Orca-Mini-3B (Alternative - 2048 token context)
```env
AI_MODEL_NAME=orca
AI_MAX_CONTEXT_TOKENS=2048
MODEL_PATH=./AI/orca-mini-3b.q4_0.gguf
```

### TinyLlama-1.1B (Fast but lower quality)
```env
AI_MODEL_NAME=tinyllama
AI_MAX_CONTEXT_TOKENS=2048
MODEL_PATH=./AI/tinyllama-1.1b-chat-v0.4.q4_k_m.gguf
```

## Configuration Details

### AI_MODEL_NAME
- Used for automatic model detection
- Options: `mistral`, `llama`, `orca`, `tinyllama`, `qwen`
- Default: `mistral` (if not set)

### AI_MAX_CONTEXT_TOKENS
- Maximum context window size for the model
- **Critical**: Must match your actual model's capabilities
- Mistral-7B: `512`
- Llama-3.2-1B: `2048` or `4096`
- Qwen: `65536`
- Default: `512` (conservative)

### AI_REQUEST_TIMEOUT
- Request timeout in milliseconds
- Small context models need more time (more compression overhead)
- Recommended: `120000` (120 seconds) for Mistral
- Recommended: `60000` (60 seconds) for larger models
- Default: `120000`

### MODEL_PATH
- Path to the model file
- Can be relative (from project root) or absolute
- Must match the model file in your `AI/` folder
- Default: `./AI/mistral-7b-instruct-v0.2.Q4_K_M.gguf`

### AI_SERVER_URL
- URL of the Python AI server
- Default: `http://localhost:8000`
- Change if server runs on different port/host

### USE_CUDA
- Enable GPU acceleration using CUDA (if available)
- Options: `true`, `false`, `1`, `0`, `yes`, `no`
- Default: `false` (uses CPU)
- **Note**: Requires CUDA-compatible GPU and proper drivers installed
- The server will automatically detect CUDA availability and fall back to CPU if not available

### GPU_LAYERS
- Number of model layers to offload to GPU (optional)
- If not set or empty, all available layers will be used on GPU
- Set a specific number (e.g., `35`) to use only that many layers on GPU
- Only used when `USE_CUDA=true` and CUDA is available
- Default: `""` (use all available layers)

## Verification

After setting up `.env`, verify configuration:

1. **Check Model Detection**:
   - Look for log: `[AI Service] Model: mistral, context: 512 tokens`
   - If you see this, detection is working

2. **Test Create Table**:
   - Try creating a simple table
   - Should complete without context limit errors
   - Response should be valid JSON

3. **Check Server Logs**:
   - Should NOT see "Number of tokens exceeded" errors
   - Should see successful 200 OK responses

## Troubleshooting

### Still Getting Context Limit Errors?

1. **Verify Model Context**:
   ```bash
   # Check what model is actually loaded
   # Look at server startup logs
   ```

2. **Reduce Schema Size**:
   - The system automatically truncates, but very large schemas may still cause issues
   - Consider using a model with larger context

3. **Increase Timeout**:
   ```env
   AI_REQUEST_TIMEOUT=180000  # 3 minutes
   ```

### Model Not Detected?

1. **Set Explicit Configuration**:
   ```env
   AI_MODEL_NAME=mistral
   AI_MAX_CONTEXT_TOKENS=512
   ```

2. **Check Model Path**:
   - Verify `MODEL_PATH` points to correct file
   - File must exist in `AI/` folder

### Switching Models

1. **Update .env**:
   ```env
   AI_MODEL_NAME=llama
   AI_MAX_CONTEXT_TOKENS=2048
   MODEL_PATH=./AI/Llama-3.2-1B-Instruct-IQ4_XS.gguf
   ```

2. **Restart Python Server**:
   - Stop current server (Ctrl+C)
   - Start again: `python server/main.py`
   - Server will load new model

3. **Restart Next.js**:
   - Restart dev server to pick up new env vars

### Enabling GPU Acceleration

1. **Check CUDA Availability**:
   ```bash
   # Check if CUDA is available (requires PyTorch or CUDA toolkit)
   python -c "import torch; print(torch.cuda.is_available())"
   ```

2. **Enable in .env**:
   ```env
   USE_CUDA=true
   GPU_LAYERS=  # Leave empty to use all layers, or specify a number
   ```

3. **Restart Python Server**:
   - The server will detect CUDA and load model with GPU acceleration
   - Look for log: "CUDA is available and enabled. Loading model with GPU acceleration..."
   - If CUDA is not available, it will automatically fall back to CPU

4. **Optional: Specify GPU Layers**:
   ```env
   USE_CUDA=true
   GPU_LAYERS=35  # Use 35 layers on GPU, rest on CPU
   ```
   - Useful if you have limited GPU memory
   - Experiment with different values based on your GPU memory

---

*Configuration Guide - 2025-01-17*
