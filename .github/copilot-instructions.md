<!-- .github/copilot-instructions.md -->

# Copilot / AI Assistant Instructions — AI Auto Bot

**Version**: 2.0 (Updated Nov 2025)  
**Purpose**: Comprehensive guidance for AI coding agents working on this Electron-based social media automation and AI content generation app.

---

## 🏗️ ARCHITECTURE OVERVIEW

### Core Technology Stack
- **Electron 39.0.0**: Desktop app framework (Chromium 142, Node 22.20.0)
- **Python 3.13+**: Local AI video generation backend
- **PyTorch 2.6.0+cu124**: GPU-accelerated AI models (CUDA 13.0)
- **Jest**: Testing framework (219 tests, 14 suites)
- **ESLint**: Code quality enforcement (zero-tolerance policy)

### Three-Tier Architecture
**CRITICAL**: This app uses Electron's secure architecture with strict process isolation.

1. **Main Process** (`main.cjs` - 1,361 lines)
   - Node.js + Electron backend
   - File system operations
   - OAuth server (Express on port 3000)
   - Background scheduler (60s polling)
   - Python subprocess management
   - IPC handler registration

2. **Preload Script** (`preload.js` - 68 lines)
   - **ONLY** way renderer communicates with main
   - Exposes `window.api` with whitelisted methods
   - Security bridge (contextIsolation enabled)
   - No direct Node.js access from renderer

3. **Renderer Process** (`renderer.js` - 6,586 lines)
   - Browser-based UI
   - All user interactions
   - Calls `window.api.*` for privileged operations
   - No direct file/network access (security)

### Key Entry Points
- **Main**: `main.cjs` (NOT `main.js`)
- **Preload**: `preload.js`
- **Renderer**: `renderer.js`
- **HTML**: `index.html` (1,216 lines)
- **Styles**: `styles.css`
- **Python Bridge**: `scripts/local_video_generator.py` (314 lines)

- **Python Bridge**: `scripts/local_video_generator.py` (314 lines)

---

## 📂 DATA PERSISTENCE

### JSON Storage (All in `data/` directory)
**Created automatically by `main.cjs` on first run**

| File | Purpose | Validated | Encrypted Fields |
|------|---------|-----------|------------------|
| `settings.json` | App config, provider credentials | ✅ Yes | `providers[*].clientSecret` |
| `tokens.json` | OAuth access/refresh tokens | ✅ Yes | All tokens |
| `library.json` | Generated content catalog | ✅ Yes | None |
| `scheduledPosts.json` | Queued social posts | ✅ Yes | None |
| `savedConfigs.json` | User-saved configurations | ✅ Yes | API keys |
| `activity_log.json` | Audit trail | ⚠️ No | None |

**Validation**: `main.cjs` uses `getValidatorForFile()` mapping to `utils/validators.js` schemas. ALL writes go through validation - never bypass!

### Encryption Requirements
**AES-256-CBC encryption** via `utils/encrypt.js`:
- **Key Storage**: `.env` file (`ENCRYPTION_KEY`) or fallback to `data/.encryption_key`
- **Sensitive Fields**:
  - API keys (OpenAI, Runway, Luma)
  - OAuth tokens (Instagram, TikTok, YouTube, Twitter)
  - Client secrets (OAuth credentials)

**Encryption Pattern** (renderer → main):
```javascript
// Renderer side
const encrypted = await window.api.encrypt(sensitiveValue);
await window.api.writeFile('data/settings.json', JSON.stringify({...data, apiKey: encrypted}));

// Main side (automatic)
// Decryption happens in getValidatorForFile validation
```

### Generated Content Storage
- **Videos**: `data/generated/videos/` (MP4 files from local AI)
- **Images**: Stored as URLs in `library.json` (not local files)
- **Model Cache**: `C:\Users\{USER}\.cache\huggingface\hub\` (3.5GB for Zeroscope)

---

## 🔒 SECURITY PATTERNS (CRITICAL)

### 1. IPC Communication Security
**ALL** renderer ↔ main communication goes through `preload.js` whitelist.

**Available IPC Methods** (`window.api.*`):
```javascript
// File Operations
readFile(path)                    // Read JSON from data/
writeFile(path, content)          // Write + validate JSON
deleteFile(path)                  // Delete file

// Encryption
encrypt(data)                     // AES-256-CBC encryption
decrypt(encryptedData)            // AES-256-CBC decryption

// OAuth
startOAuth(platform)              // Instagram/TikTok/YouTube/Twitter
disconnect(platform)              // Revoke OAuth token
resetConnections(options)         // Clear tokens/configs

// Video Generation
generateLocalVideo(params)        // Python subprocess for AI video
onLocalVideoProgress(callback)    // Real-time progress updates

// Events
onScheduledPost(callback)         // Background scheduler events
onOAuthToken(callback)            // OAuth completion events
onResetDone(callback)             // Reset completion events
onSettingsUpdated(callback)       // Settings change notifications
```

**IPC Channel Constants** (`utils/ipc.js`):
```javascript
READ_FILE = 'read-file'
WRITE_FILE = 'write-file'
ENCRYPT_DATA = 'encrypt-data'
DECRYPT_DATA = 'decrypt-data'
// ... always use constants, never hardcode strings
```

### 2. Input Sanitization (`utils/sanitize.js`)
**ALWAYS sanitize user input before processing**:

```javascript
const { sanitizeString, sanitizeUrl, sanitizeObject } = require('./utils/sanitize');

// XSS Prevention
const safe = sanitizeString(userInput);  // Strips <script>, javascript:, etc.

// URL Validation
const safeUrl = sanitizeUrl(url);  // Blocks javascript:, data:, vbscript:

// Prototype Pollution Prevention
const safeObj = sanitizeObject(obj);  // Blocks __proto__, constructor, prototype
```

**Protected Against**:
- XSS (Cross-Site Scripting)
- SQL Injection
- Path Traversal (`../` attacks)
- Prototype Pollution
- Command Injection

### 3. Rate Limiting (`utils/rate-limiter.js`)
**Prevents IPC flood attacks**:
```javascript
const { rateLimitedHandler } = require('./utils/rate-limiter');

// In main.cjs
ipcMain.handle('some-channel', rateLimitedHandler(async (event, data) => {
  // Handler logic - automatically rate limited
  // Default: 10 requests per 1000ms per sender
}));
```

### 4. OAuth Security
**Current Implementation** (as of Nov 2025):
- Provider configs stored in `settings.json` under `providers` key
- OAuth handled by `start-oauth` IPC handler in `main.cjs` (lines 800-950)
- Validates CLIENT_ID/SECRET before starting flow
- Opens provider auth URL in external browser
- Local server listens on `http://localhost:3000/oauth/callback`
- Tokens encrypted and stored in `tokens.json`

**Provider Configuration Modal** (`renderer.js`):
- User inputs CLIENT_ID, CLIENT_SECRET, REDIRECT_URI
- Saved to `settings.json.providers[platform]`
- CLIENT_SECRET encrypted before save

---

## 🎥 VIDEO GENERATION SYSTEM (Major Feature)

### Architecture
**Two-Process Model**: Node.js (main) ↔ Python (subprocess)

### Video Providers (`utils/video-providers.js` - 628 lines)

**Paid API Providers**:
1. **RunwayProvider**: Gen-3 Alpha Turbo ($0.50/10s, 2 min generation)
2. **LumaProvider**: Dream Machine ($0.30/10s, 1 min generation)
3. **OpenAIProvider**: DALL-E + FFmpeg ($0.15/10s)

**FREE Local AI Providers** (require Python + GPU):
4. **ZeroscopeProvider**: 576x320 max, HuggingFace model (PRIMARY)
5. **ModelScopeProvider**: 256x256, Alibaba damo-vilab
6. **StableVideoDiffusionProvider**: 1024x576, Stability AI

### Quality Presets (Local AI)
| Preset | Steps | Time (RTX 2060) | Use Case |
|--------|-------|-----------------|----------|
| Potato | 2 | ~2 min | Testing only |
| Ultra Low | 5 | ~5 min | Quick previews |
| Low | 10 | ~10 min | Acceptable quality |
| **Fast** | **20** | **~20 min** | **Recommended** |
| Medium | 30 | ~30 min | High quality |
| High | 50 | ~50 min | Maximum quality |
| Custom | 2-100 | Variable | Full control |

### Python Bridge (`scripts/local_video_generator.py`)

**GPU Detection**:
```python
def get_gpu_settings():
    if torch.cuda.is_available():
        vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        # Auto-select steps based on VRAM: 12GB→50, 8GB→30, 6GB→20
        return {'device': 'cuda', 'dtype': torch.float16, 'steps': 20, 'vram_gb': vram_gb}
    else:
        return {'device': 'cpu', 'dtype': torch.float32, 'steps': 15}
```

**Memory Optimizations**:
```python
pipe.enable_attention_slicing()  # Reduces VRAM by ~30%
pipe.enable_vae_slicing()        # Reduces VRAM by ~20%
```

**Export Strategy** (Robust Fallback):
```python
try:
    export_to_video(video_frames[0], output_path, fps=8)  # imageio
    print("Video saved successfully!")
except Exception as export_error:
    # OpenCV fallback with RGB→BGR conversion
    # Uses cv2.VideoWriter
    print("Video saved successfully using OpenCV!")
```

### IPC Communication Pattern

**Invoke (Renderer → Main)**:
```javascript
const result = await window.api.generateLocalVideo({
  provider: 'zeroscope',
  prompt: 'a cat walking in a garden',
  duration: 2,
  quality: 'low',           // Optional: preset name
  customSteps: 15,          // Optional: override steps
  dimensions: { width: 1792, height: 1024 }
});
```

**Progress Events (Main → Renderer)**:
```javascript
window.api.onLocalVideoProgress((progress) => {
  console.log(progress.stage);    // 'download' | 'generate' | 'export'
  console.log(progress.percent);  // 0-100
  console.log(progress.message);  // Human-readable status
});
```

**Python Subprocess** (`main.cjs` lines 1084-1260):
```javascript
const childProcess = spawn(pythonCmd, args);  // NO shell:true (security)

childProcess.stderr.on('data', (data) => {
  const output = data.toString().trim();
  
  // Extract progress: /(\d+)%\|/ for downloads, /Progress:\s*(\d+)%/ for generation
  const downloadMatch = output.match(/(\d+)%\|/);
  const stepMatch = output.match(/Progress:\s*(\d+)%/);
  
  if (downloadMatch) {
    safeSend(mainWindow, 'local-video-progress', {
      stage: 'download',
      percent: parseInt(downloadMatch[1]),
      message: 'Downloading model...'
    });
  }
});
```

### Adding New Video Provider

1. **Create Provider Class** (`utils/video-providers.js`):
```javascript
class NewProvider extends VideoProvider {
  constructor(apiKey) {
    super(apiKey);
    this.baseUrl = 'https://api.newprovider.com/v1';
  }

  async generate(options) {
    // Implementation
    return { taskId, status: 'pending', pollInterval: 5000 };
  }

  async checkStatus(taskId) {
    // Implementation
    return { status: 'completed', videoUrl: '...' };
  }

  getCapabilities() {
    return {
      supportsQuality: true,
      supportsDuration: true,
      maxDuration: 10,
      // ...
    };
  }
}
```

2. **Register in Factory** (`createVideoProvider()`):
```javascript
case 'newprovider':
  return new NewProvider(apiKey);
```

3. **Update UI** (`index.html`):
```html
<option value="newprovider">New Provider</option>
```

---

## 🧪 TESTING STRATEGY

### Test Suite Structure (`tests/` - 14 suites, 219 tests)
```
tests/
├── encrypt.test.js           # AES encryption/decryption
├── sanitize.test.js          # XSS, SQLi, path traversal
├── validators.test.js        # JSON schema validation
├── rate-limiter.test.js      # IPC rate limiting
├── AuthManager.test.js       # OAuth token refresh
├── api-manager.test.js       # External API calls
├── tokenStore.test.js        # Token storage/retrieval
├── database.test.js          # File operations
├── ipc.test.js               # IPC communication
├── logger.test.js            # Logging utilities
├── error.test.js             # Error handling
└── ... (14 total)
```

### Running Tests
```bash
npm test                    # Run all 219 tests
npm test -- sanitize        # Run specific test file
npm test -- --coverage      # Generate coverage report
```

### Test Patterns

**Expected Errors** (intentional test behavior):
```javascript
// These ERROR logs are NORMAL during testing
test("throws error when no token found", async () => {
  await expect(AuthManager.refreshToken("instagram")).rejects.toThrow(
    "No token found for instagram"  // ← Logged as [ERROR] but test PASSES
  );
});
```

**Mocking File System**:
```javascript
jest.mock('fs');
fs.readFileSync.mockReturnValue('{"key": "value"}');
```

**Testing IPC**:
```javascript
const { ipcRenderer } = require('electron');
jest.mock('electron');

ipcRenderer.invoke.mockResolvedValue({ success: true });
```

---

## 📋 COMMON WORKFLOWS

### 1. Adding a New IPC Handler

**Step 1**: Define constant (`utils/ipc.js`):
```javascript
module.exports = {
  // ... existing
  NEW_FEATURE: 'new-feature'
};
```

**Step 2**: Add handler (`main.cjs`):
```javascript
const { NEW_FEATURE } = require('./utils/ipc');

ipcMain.handle(NEW_FEATURE, async (event, data) => {
  try {
    // Implementation
    return { success: true, result: '...' };
  } catch (error) {
    logError('new-feature error:', error);
    return { success: false, error: error.message };
  }
});
```

**Step 3**: Expose in preload (`preload.js`):
```javascript
contextBridge.exposeInMainWorld('api', {
  // ... existing
  newFeature: (params) => ipcRenderer.invoke('new-feature', params)
});
```

**Step 4**: Call from renderer (`renderer.js`):
```javascript
const result = await window.api.newFeature({ param: 'value' });
if (result.success) {
  // Handle success
} else {
  displayError(new Error(result.error));
}
```

### 2. Adding a New Data File

**Step 1**: Create validator (`utils/validators.js`):
```javascript
function validateNewData(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Data must be an object' };
  }
  if (!Array.isArray(data.items)) {
    return { valid: false, error: 'items must be an array' };
  }
  // ... validation logic
  return { valid: true };
}

module.exports = {
  // ... existing
  validateNewData
};
```

**Step 2**: Register validator (`main.cjs` - `getValidatorForFile()`):
```javascript
function getValidatorForFile(relativePath) {
  const validators = {
    // ... existing
    'data/newdata.json': validators.validateNewData
  };
  return validators[relativePath] || null;
}
```

**Step 3**: Create example file (`data/newdata.example.json`):
```json
{
  "items": [],
  "lastUpdated": "2025-11-03T00:00:00.000Z"
}
```

**Step 4**: Initialize in main (`main.cjs` - `ensureDataFiles()`):
```javascript
async function ensureDataFiles() {
  // ... existing files
  if (!fs.existsSync(path.join(dataDir, 'newdata.json'))) {
    fs.writeFileSync(
      path.join(dataDir, 'newdata.json'),
      JSON.stringify({ items: [], lastUpdated: new Date().toISOString() }, null, 2)
    );
  }
}
```

### 3. Handling Sensitive Data

**Encryption in Renderer**:
```javascript
async function saveApiKey(apiKey) {
  const encrypted = await window.api.encrypt(apiKey);
  const settings = await loadSettings();
  settings.apiKeyEncrypted = encrypted;
  await window.api.writeFile('data/settings.json', JSON.stringify(settings, null, 2));
}
```

**Decryption in Renderer**:
```javascript
async function getApiKey() {
  const settings = await loadSettings();
  if (settings.apiKeyEncrypted) {
    const decrypted = await window.api.decrypt(settings.apiKeyEncrypted);
    return decrypted.success ? decrypted.data : null;
  }
  return null;
}
```

---

## 🚨 CRITICAL GOTCHAS & PITFALLS

### 1. File Path References
**ALWAYS use relative paths** from project root:
```javascript
✅ CORRECT: 'data/settings.json'
❌ WRONG:   './data/settings.json'
❌ WRONG:   'G:\\ElectronFiddle\\ASB\\data\\settings.json'
```

### 2. JSON Validation Bypass
**NEVER write to data/ without validation**:
```javascript
❌ WRONG: fs.writeFileSync('data/settings.json', badData);
✅ CORRECT: await window.api.writeFile('data/settings.json', validData);
```

### 3. Shell Injection in Python Spawn
**NEVER use `shell: true`** with user input:
```javascript
❌ WRONG:   spawn('python', ['-c', userInput], { shell: true });
✅ CORRECT: spawn(pythonCmd, ['script.py', '--arg', userInput]);
```

### 4. Main.js vs Main.cjs
**The main file is `main.cjs`** (NOT `main.js`):
```javascript
✅ CORRECT: References to main.cjs
❌ WRONG:   Looking for main.js (doesn't exist)

✅ CORRECT: References to main.cjs
❌ WRONG:   Looking for main.js (doesn't exist)
```

### 5. Race Conditions in Scheduler
**Background scheduler runs every 60s** - avoid concurrent file writes:
```javascript
// Scheduler in main.cjs marks posts as executed
post.posted = true;
await writeJson('data/scheduledPosts.json', data);

// Don't write scheduledPosts.json from renderer during execution window
```

### 6. Optimistic UI Updates
**Renderer updates UI BEFORE persisting** - handle failures:
```javascript
// Update UI immediately
updateDisplay(newData);

// Persist (may fail)
const result = await window.api.writeFile('data/library.json', JSON.stringify(newData));
if (!result.success) {
  // Rollback UI
  updateDisplay(oldData);
  displayError(result.error);
}
```

### 7. Video Path Formats
**Local videos need `file://` protocol** for HTML5 video element:
```javascript
// Storage: Windows path
const storedPath = 'G:\\ElectronFiddle\\ASB\\data\\generated\\videos\\video.mp4';

// Display: file:// URL
const videoUrl = 'file:///' + storedPath.replace(/\\/g, '/');
video.src = videoUrl;
```

### 8. Python Detection on Windows
**Use 'py' launcher first** (Windows-specific):
```javascript
const pythonCommands = ['py', 'python', 'python3'];  // Order matters!
```

### 9. Encryption Key Handling
**NEVER log or expose encryption keys**:
```javascript
❌ WRONG: console.log('Key:', process.env.ENCRYPTION_KEY);
✅ CORRECT: console.log('Encryption configured:', !!process.env.ENCRYPTION_KEY);
```

### 10. GPU Memory Management
**Enable memory optimizations** for local AI:
```python
pipe.enable_attention_slicing()  # Required for 6GB VRAM
pipe.enable_vae_slicing()        # Prevents OOM errors
```

---

## 🛠️ UTILITY MODULES REFERENCE

### Core Utilities (`utils/`)

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| **encrypt.js** | AES-256-CBC encryption | `encrypt()`, `decrypt()`, `getEncryptionKey()` |
| **sanitize.js** | Input sanitization | `sanitizeString()`, `sanitizeUrl()`, `sanitizeObject()` |
| **validators.js** | JSON schema validation | `validateSettings()`, `validateLibrary()`, etc. |
| **rate-limiter.js** | IPC flood protection | `rateLimitedHandler()`, `checkLimit()` |
| **database.js** | File operations | `readJson()`, `writeJson()`, `appendActivityLog()` |
| **ipc.js** | IPC channel constants | `READ_FILE`, `WRITE_FILE`, etc. |
| **error.js** | Error standardization | `createError()`, `isNetworkError()` |
| **logger.cjs** | Logging utilities | `logInfo()`, `logError()`, `logWarn()`, `logSecurity()` |
| **AuthManager.js** | OAuth token refresh | `refreshToken()`, `refreshInstagramToken()` |
| **api-manager.js** | External API calls | Platform posting, image generation |
| **video-providers.js** | Video generation | 6 provider classes, factory function |
| **drag-drop.js** | File upload UX | `init()`, `resetDropZone()` |
| **keyboard-shortcuts.js** | Hotkey system | `register()`, `unregister()` |
| **performance-monitor.cjs** | Performance tracking | `startOperation()`, `endOperation()` |

### Usage Examples

**Logging with Context**:
```javascript
const { logInfo, logError, logWarn, logSecurity } = require('./utils/logger.cjs');

logInfo('User action', { userId: 123, action: 'post' });
logError('API failure', error);
logWarn('Rate limit approaching', { remaining: 5 });
logSecurity('Suspicious activity', { ip: '1.2.3.4' });
```

**Error Handling**:
```javascript
const { createError, isNetworkError } = require('./utils/error');

try {
  await apiCall();
} catch (error) {
  if (isNetworkError(error)) {
    // Retry logic
  } else {
    throw createError('API_FAILURE', 'Failed to complete request', { originalError: error });
  }
}
```

**Performance Monitoring**:
```javascript
const monitor = require('./utils/performance-monitor.cjs');

const opId = monitor.startOperation('video-generation');
await generateVideo();
const duration = monitor.endOperation(opId);
console.log(`Generation took ${duration}ms`);
```

---

## 📚 DOCUMENTATION REFERENCES

### Essential Reading
- **`docs/GPU_SAFETY_GUIDE.md`**: GPU usage guidelines, temperature monitoring, safety FAQs
- **`docs/LOCAL_AI_STORAGE.md`**: Storage locations, cleanup commands, model management
- **`TEST_REPORT.md`**: Comprehensive system validation, all 219 tests documented
- **`SECURITY_AUDIT_REPORT.md`**: Security posture, vulnerabilities addressed
- **`DEPLOYMENT.md`**: Build process, distribution, release procedures

### Quick Links
```
docs/
├── GPU_SAFETY_GUIDE.md          # 426 lines - GPU safety for video generation
├── LOCAL_AI_STORAGE.md          # 200 lines - Storage and cleanup
├── guides/
│   ├── QUICK_START.md
│   ├── TROUBLESHOOTING.md
│   └── API_INTEGRATION.md
├── deployment/
│   ├── WINDOWS.md
│   ├── MACOS.md
│   └── LINUX.md
└── api/
    ├── IPC_REFERENCE.md
    └── PROVIDER_API.md
```

---

## 🔍 CONTEXT GATHERING STRATEGY

### Step 1: Initial Workspace Understanding
**Use broad searches to map the codebase**:

```javascript
// Semantic search for high-level concepts
semantic_search("video generation workflow")
semantic_search("OAuth authentication flow")
semantic_search("data persistence patterns")

// File search for structural understanding
file_search("**/*.js")      // All JavaScript files
file_search("**/test*.js")  // All test files
file_search("data/*.json")  // Data files

// Grep search for specific patterns
grep_search("ipcMain.handle", isRegexp: false)  // All IPC handlers
grep_search("window\\.api\\.", isRegexp: true)  // All renderer API calls
```

### Step 2: Deep Dive into Related Files
**For multi-tier features, read ALL layers in parallel**:

```javascript
// Example: Adding OAuth for new platform
read_file("main.cjs", startLine: 800, endLine: 950)      // OAuth handler
read_file("renderer.js", startLine: 4900, endLine: 5150) // OAuth UI
read_file("preload.js", startLine: 1, endLine: 68)       // IPC bridge
read_file("utils/AuthManager.js", startLine: 1, endLine: 200)  // Token refresh
```

### Step 3: Dependency Chain Analysis
**Follow imports to understand relationships**:

```javascript
// Find all usages of a function
list_code_usages("startOAuth", filePaths: ["main.cjs"])

// Check IPC channel references
grep_search("generate-local-video", isRegexp: false)

// Verify data flow
grep_search("window\\.api\\.writeFile.*settings\\.json", isRegexp: true)
```

### Step 4: State Management Check
**Verify data persistence patterns**:

```javascript
// Check validator schemas
read_file("utils/validators.js", startLine: 1, endLine: 500)

// Review data file examples
read_file("data/settings.example.json")
read_file("data/tokens.json.example")

// Check file initialization
grep_search("ensureDataFiles", isRegexp: false)
```

### Step 5: Test Coverage Verification
**Ensure changes align with existing tests**:

```javascript
// Find relevant test files
file_search("tests/**/*.test.js")

// Read related tests
read_file("tests/AuthManager.test.js")
read_file("tests/validators.test.js")

// Check test patterns
grep_search("describe\\(.*OAuth", isRegexp: true)
```

---

## ✅ QUALITY GATES & STANDARDS

### Code Quality Requirements

1. **ESLint Compliance** (ZERO tolerance)
   - Configuration: `eslint.config.cjs` + `eslint.config.js`
   - Run: `npm run lint`
   - **All code must pass with zero warnings**

2. **Test Coverage** (Target: 80%, Current: ~60%)
   - Run: `npm test -- --coverage`
   - All new features require tests
   - Critical paths must have >90% coverage

3. **Security Audit** (Zero vulnerabilities)
   - Run: `npm audit`
   - Address all HIGH/CRITICAL findings
   - Update dependencies weekly

### Pre-Commit Checklist

```bash
# 1. Linting
npm run lint                  # Must pass with 0 issues

# 2. Tests
npm test                      # All 219 tests must pass

# 3. Security
npm audit                     # Zero HIGH/CRITICAL vulnerabilities

# 4. Type Safety (if using TypeScript)
npm run type-check            # No errors

# 5. Format Check
npm run format:check          # Code style consistent
```

### Commit Message Format

```
type(scope): Short description

Longer description if needed.

- Bullet points for details
- Reference issues: Fixes #123

BREAKING CHANGE: Description if applicable
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Performance Standards

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| App Startup | <2s | ~1.5s | ✅ |
| Main Thread Block | <16ms | ~8ms | ✅ |
| Memory Usage (Idle) | <200MB | ~150MB | ✅ |
| CPU Usage (Idle) | <15% | ~5% | ✅ |
| Video Generation (10 steps) | <15min | ~10min | ✅ |

---

## 🚀 DEVELOPMENT WORKFLOW

### Setup (First Time)
```bash
# Clone repo
git clone https://github.com/101Toast101/ai-auto-bot.git
cd ai-auto-bot

# Install Node dependencies
npm install

# Install Python dependencies (for local AI)
py -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
py -m pip install diffusers transformers accelerate imageio imageio-ffmpeg opencv-python

# Create .env file
cp .env.example .env
# Edit .env: Add ENCRYPTION_KEY=<64-char-hex>

# Run tests
npm test

# Start app
npm start
```

### Daily Development Loop
```bash
# 1. Pull latest
git pull origin main

# 2. Create feature branch
git checkout -b feature/my-feature

# 3. Make changes
# ... edit files ...

# 4. Run tests
npm test

# 5. Lint code
npm run lint

# 6. Commit
git add -A
git commit -m "feat(scope): description"

# 7. Push
git push origin feature/my-feature

# 8. Create PR on GitHub
```

### "Copilot Autopilot" Mode 🤖

**Trigger Phrase**: `"Run comprehensive health check"` or `"Full system audit"`

When user requests a comprehensive check, execute ALL of the following in sequence:

1. **Code Quality Scan**:
   ```bash
   npm run lint                    # Check ESLint compliance
   npm test                        # Run all 219 tests
   npm test -- --coverage          # Generate coverage report
   ```

2. **Security Audit**:
   ```bash
   npm audit                       # Check dependency vulnerabilities
   npm audit fix                   # Auto-fix if safe
   ```

3. **Data Integrity Check**:
   - Validate all JSON files in `data/` directory using validators
   - Check for:
     * `data/settings.json` → `validateSettings()`
     * `data/tokens.json` → `validateTokens()`
     * `data/library.json` → `validateLibrary()`
     * `data/scheduledPosts.json` → `validateScheduledPosts()`
     * `data/savedConfigs.json` → `validateSavedConfigs()`

4. **Python Environment Check**:
   ```bash
   py --version                    # Verify Python installed
   py -c "import torch; print(torch.cuda.is_available())"  # Check CUDA
   py -m py_compile scripts/local_video_generator.py       # Syntax check
   ```

5. **File System Validation**:
   - Verify critical files exist:
     * `main.cjs`, `renderer.js`, `preload.js`, `index.html`
     * All `utils/*.js` modules (14 files)
     * All `tests/*.test.js` files (14 suites)
   - Check data directories exist: `data/`, `data/generated/videos/`

6. **IPC Channel Verification**:
   - Search for all `ipcMain.handle()` calls in `main.cjs`
   - Verify matching `window.api.*` exposures in `preload.js`
   - Check for orphaned channels

7. **Git Status Check**:
   ```bash
   git status                      # Check for uncommitted changes
   git log -1                      # Show last commit
   git branch -v                   # Show current branch
   ```

8. **Performance Metrics** (if app is running):
   - Memory usage
   - CPU usage
   - IPC response times

9. **Documentation Sync Check**:
   - Verify `copilot-instructions.md` references correct files
   - Check if major features documented
   - Validate version numbers match `package.json`

10. **Generate Report**:
    - Create summary of all findings
    - List any errors/warnings found
    - Provide actionable recommendations
    - Estimate overall health score (0-100)

**Example Usage**:
```
User: "Run comprehensive health check"
AI: [Executes all 10 steps above]
AI: "Health Check Complete:
     ✅ Tests: 219/219 passing
     ✅ ESLint: 0 errors
     ✅ Security: 0 vulnerabilities
     ✅ Data: All JSON valid
     ✅ Python: 3.13.9 + CUDA available
     ⚠️  Git: 1 uncommitted file (copilot-instructions.md)
     
     Overall Health Score: 98/100
     Recommendation: Commit documentation changes, then deploy ready."
```

### Magic Command Reference 🪄

**Quick Commands** (user can say these naturally):

| User Says | AI Action |
|-----------|-----------|
| "Run all tests" | `npm test` |
| "Check for errors" or "Lint check" | `npm run lint` |
| "Security scan" or "Check vulnerabilities" | `npm audit` |
| "Validate data files" or "Check JSON" | Validate all data/*.json |
| "Python check" or "Check GPU" | `py --version`, check CUDA |
| "Full system audit" or "Health check" | **Complete 10-step audit above** |
| "What's uncommitted?" or "Git status" | `git status` |
| "Run coverage report" | `npm test -- --coverage` |
| "Check dependencies" | `npm list --depth=0` |
| "What's the last commit?" | `git log -1` |

**Deep Inspection Commands**:

| User Says | AI Action |
|-----------|-----------|
| "Audit all IPC handlers" | Search main.cjs for `ipcMain.handle()`, verify preload.js |
| "Check for hardcoded secrets" | Grep search for API_KEY, SECRET, PASSWORD patterns |
| "Find unused variables" | Run ESLint with unused-vars rule |
| "Check for TODO comments" | Grep search for `TODO`, `FIXME`, `HACK` |
| "Verify all imports work" | Check for missing dependencies, broken requires |
| "Find memory leaks" | Check for event listeners without cleanup |
| "Security review" | Run sanitization checks, validate input handling |

**Maintenance Commands**:

| User Says | AI Action |
|-----------|-----------|
| "Update dependencies" | `npm update`, check for breaking changes |
| "Clean build artifacts" | Remove `node_modules`, `coverage`, rebuild |
| "Reset to clean state" | Check git status, stash changes if needed |
| "Optimize bundle size" | Analyze dependencies, suggest removals |
| "Check for outdated docs" | Compare copilot-instructions.md to codebase |

### Debugging Tips

**Electron DevTools**:
- Main process: `F12` in app or `--inspect` flag
- Renderer process: `View > Toggle Developer Tools`

**Python Subprocess Debugging**:
```javascript
// In main.cjs, add verbose logging
childProcess.stderr.on('data', (data) => {
  console.log('[Python]', data.toString());  // See all Python output
});
```

**IPC Communication Debugging**:
```javascript
// In preload.js
console.log('IPC Call:', channel, data);

// In main.cjs
ipcMain.handle(channel, async (event, data) => {
  console.log('IPC Handler:', channel, data);
  // ...
});
```

**File Validation Debugging**:
```javascript
// In main.cjs getValidatorForFile()
const validator = validators[relativePath];
if (validator) {
  const result = validator(parsedData);
  console.log('Validation result:', result);  // See validation details
}
```

---

## 🔐 SECURITY CHECKLIST

### Before Committing Code

- [ ] No hardcoded API keys or secrets
- [ ] No `.env` file in commit
- [ ] All user input sanitized (`utils/sanitize.js`)
- [ ] All file writes go through validation
- [ ] Sensitive data encrypted before storage
- [ ] IPC handlers rate-limited if needed
- [ ] No `eval()` or `Function()` with user input
- [ ] No `shell: true` with user-controlled args
- [ ] SQL queries parameterized (if applicable)
- [ ] XSS prevention in renderer output

### Security Audit Commands

```bash
# Dependency vulnerabilities
npm audit

# Secret scanning (if gitleaks installed)
gitleaks detect --source . --verbose

# Manual review
grep -r "API_KEY\|SECRET\|PASSWORD" .
grep -r "eval\|Function\(" *.js
grep -r "shell: true" *.js
```

---

## 📖 DECISION TREES

### When to Use Which IPC Pattern?

```
Need to send data from Renderer to Main?
├─ One-time request with response?
│  └─ Use ipcRenderer.invoke() / ipcMain.handle()
│     Example: window.api.readFile()
│
├─ Fire-and-forget notification?
│  └─ Use ipcRenderer.send() / ipcMain.on()
│     Example: Log event (no response needed)
│
└─ Continuous stream of data?
   └─ Use multiple ipcRenderer.send() calls
      Example: Progress updates during video generation

Need to send data from Main to Renderer?
├─ Response to invoke?
│  └─ Return value from ipcMain.handle()
│
└─ Unsolicited event?
   └─ Use webContents.send()
      Example: Scheduled post execution notification
```

### When to Use Which Video Provider?

```
Need video generation?
├─ Budget available?
│  ├─ Yes, need fast (<2 min)?
│  │  ├─ Best quality?
│  │  │  └─ Use RunwayProvider ($0.50/10s, 2 min)
│  │  └─ Good quality, cheaper?
│  │     └─ Use LumaProvider ($0.30/10s, 1 min)
│  └─ No budget (FREE)?
│     ├─ GPU available?
│     │  ├─ Yes (6GB+ VRAM)?
│     │  │  └─ Use ZeroscopeProvider (10-20 steps, ~10-20 min)
│     │  └─ No or <6GB?
│     │     └─ Use lower quality presets (potato/ultra-low)
│     └─ CPU only?
│        └─ Use CPU mode (VERY slow, 1-2 hours per video)
│
└─ Need still images?
   └─ Use OpenAIProvider (DALL-E 3, ~5s per image)
```

### When to Encrypt Data?

```
Handling sensitive data?
├─ API keys?
│  └─ YES - Encrypt before storing
│
├─ OAuth tokens?
│  └─ YES - Encrypt before storing
│
├─ Client secrets?
│  └─ YES - Encrypt before storing
│
├─ User passwords?
│  └─ YES - Encrypt before storing
│
├─ Generated content URLs?
│  └─ NO - Public URLs, no encryption needed
│
├─ User preferences?
│  └─ NO - Non-sensitive, no encryption needed
│
└─ Activity logs?
   └─ NO - Audit trail, no encryption needed
```

---

## 🎯 QUICK REFERENCE CARDS

### IPC Methods Cheat Sheet

```javascript
// FILE OPERATIONS
await window.api.readFile('data/settings.json')
await window.api.writeFile('data/settings.json', jsonString)
await window.api.deleteFile('data/oldfile.json')

// ENCRYPTION
await window.api.encrypt(sensitiveString)
await window.api.decrypt(encryptedString)

// OAUTH
await window.api.startOAuth('instagram')
await window.api.disconnect('twitter')
await window.api.resetConnections({ full: true })

// VIDEO GENERATION
await window.api.generateLocalVideo({ provider, prompt, duration, quality })

// EVENT LISTENERS
window.api.onLocalVideoProgress((progress) => { /* ... */ })
window.api.onScheduledPost((post) => { /* ... */ })
window.api.onOAuthToken((data) => { /* ... */ })
window.api.onResetDone((data) => { /* ... */ })
window.api.onSettingsUpdated((settings) => { /* ... */ })
```

### Validation Cheat Sheet

```javascript
// ALWAYS validate before writing
const result = await window.api.writeFile(path, data);
if (!result.success) {
  displayValidationError(result.error, 'feature name');
  return;
}

// Check specific validators
const { validateSettings, validateLibrary, validateTokens } = require('./utils/validators');

const settingsResult = validateSettings(data);
if (!settingsResult.valid) {
  console.error(settingsResult.error);
}
```

### Security Cheat Sheet

```javascript
// SANITIZE USER INPUT
const { sanitizeString, sanitizeUrl, sanitizeObject } = require('./utils/sanitize');

const safe = sanitizeString(userInput);
const safeUrl = sanitizeUrl(url);
const safeObj = sanitizeObject(obj);

// ENCRYPT SENSITIVE DATA
const encrypted = await window.api.encrypt(apiKey);

// RATE LIMIT IPC
const { rateLimitedHandler } = require('./utils/rate-limiter');
ipcMain.handle('channel', rateLimitedHandler(async (event, data) => {
  // Handler logic
}));

// VALIDATE PATHS (prevent traversal)
if (filePath.includes('..')) {
  throw new Error('Invalid path');
}
```

---

## 🆘 TROUBLESHOOTING GUIDE

### Common Issues

**Issue**: "Python is not installed" error
```bash
# Solution: Install Python 3.13+
# Windows: https://www.python.org/downloads/
# Verify: py --version
```

**Issue**: "CUDA not available" error
```bash
# Solution: Install CUDA-enabled PyTorch
py -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

# Verify:
py -c "import torch; print(torch.cuda.is_available())"  # Should print True
```

**Issue**: "Out of memory" during video generation
```bash
# Solution: Use lower quality presets
# In UI: Select "Potato" or "Ultra Low"
# Or reduce custom steps to 5-10
```

**Issue**: "Validation failed" when saving data
```bash
# Solution: Check validator schema
# Read: utils/validators.js
# Ensure data structure matches schema exactly
```

**Issue**: Videos don't play in library
```bash
# Solution: Check file paths
# Videos must use file:// protocol
# Verify path conversion in renderer.js lines 625-632
```

**Issue**: OAuth flow fails
```bash
# Solution: Verify provider configuration
# Check: settings.json > providers > [platform]
# Ensure CLIENT_ID and REDIRECT_URI are correct
# CLIENT_SECRET must be encrypted
```

---

## 📞 SUPPORT & RESOURCES

### Internal Resources
- GitHub Repo: `https://github.com/101Toast101/ai-auto-bot`
- Issue Tracker: `https://github.com/101Toast101/ai-auto-bot/issues`
- Documentation: `docs/` directory

### External Dependencies
- Electron Docs: `https://www.electronjs.org/docs/latest`
- PyTorch Docs: `https://pytorch.org/docs/stable/index.html`
- HuggingFace Diffusers: `https://huggingface.co/docs/diffusers`
- Jest Testing: `https://jestjs.io/docs/getting-started`

### Community
- Electron Discord: `https://discord.gg/electron`
- PyTorch Forums: `https://discuss.pytorch.org/`
- Stack Overflow: Tag `electron`, `pytorch`, `jest`

---

## 📝 VERSION HISTORY

**v2.0 (Nov 2025)** - Major update
- Fixed all references from `main.js` → `main.cjs`
- Added comprehensive video generation system documentation
- Added security utilities section (sanitize, rate-limiter)
- Added Python bridge patterns
- Updated OAuth flow documentation
- Added IPC channel reference
- Added troubleshooting guide
- Added decision trees
- Added quick reference cards

**v1.0 (Oct 2025)** - Initial version
- Basic architecture overview
- IPC patterns
- Data persistence
- Testing guidelines

---

**Last Updated**: November 3, 2025  
**Maintainer**: AI Auto Bot Team  
**Next Review**: December 2025

---

## ⚡ TL;DR FOR QUICK STARTS

**New to the codebase?** Read these sections first:
1. Architecture Overview (understand the 3-tier model)
2. IPC Communication Security (learn window.api methods)
3. Common Workflows (see practical examples)
4. Critical Gotchas (avoid common mistakes)

**Adding a feature?** Follow this sequence:
1. Check Decision Trees (choose right pattern)
2. Read Common Workflows (find similar example)
3. Check Utility Modules Reference (use existing helpers)
4. Run Quality Gates (lint + test before commit)

**Debugging an issue?** Use these tools:
1. Troubleshooting Guide (common problems solved)
2. Debugging Tips (enable verbose logging)
3. Test Coverage Verification (check existing tests)
4. Security Checklist (ensure no vulnerabilities introduced)

**Need help?** Resources in priority order:
1. This document (comprehensive reference)
2. Code comments (inline documentation)
3. Test files (working examples)
4. External docs (Electron, PyTorch, Jest)
5. Community support (Discord, forums)

---

**END OF COPILOT INSTRUCTIONS v2.0**
