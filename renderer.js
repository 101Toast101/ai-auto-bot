// renderer.js - Complete Frontend Logic
(function () {
  const $ = (id) => document.getElementById(id);

  let allTemplates = [];
  let bulkGeneratedContent = [];
  let selectedMemesForSlideshow = [];
  let videoBlob = null;

  // Load meme templates
  async function loadMemeTemplates() {
    try {
      const response = await fetch('https://api.memegen.link/templates/');
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const templates = await response.json();
      allTemplates = templates.map(t => ({
        id: t.id,
        name: t.name
      }));
      const select = $('bulkSingleTemplate');
      if (select) {
        select.innerHTML = '<option value="">Select Template</option>' + 
          allTemplates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        allTemplates.forEach(t => {
          const option = document.createElement('option');
          option.value = t.id;
          option.textContent = t.name;
          select.appendChild(option);
        });
      }
    } catch (e) {
      console.error('Failed to load meme templates:', e);
      addLogEntry('Failed to load meme templates: ' + e.message, 'error');
    }
  }

  // Call on startup
  loadMemeTemplates();

  // IPC WRAPPERS
  async function readFileAsync(filePath) {
    try {
      if (!window.api) {
        console.error('API not available for readFileAsync');
        return { success: false, error: { message: 'API not available' } };
      }
      const result = await window.api.readFile(filePath);
      console.log(`Read file ${filePath}:`, result.success ? 'success' : 'failed');
      return result;
    } catch (e) {
      console.error(`Error reading file ${filePath}:`, e);
      return { success: false, error: { message: e.message } };
    }
  }

  async function writeFileAsync(filePath, content) {
    try {
      if (!window.api) {
        console.error('API not available for writeFileAsync');
        return { success: false, error: { message: 'API not available' } };
      }
      const result = await window.api.writeFile(filePath, content);
      console.log(`Write file ${filePath}:`, result.success ? 'success' : 'failed');
      return result;
    } catch (e) {
      console.error(`Error writing file ${filePath}:`, e);
      return { success: false, error: { message: e.message } };
    }
  }

    // IPC Channel constants (must match main process)
  const IPC = {
    READ_FILE: 'READ_FILE',
    WRITE_FILE: 'WRITE_FILE',
    ENCRYPT_DATA: 'ENCRYPT_DATA',
    DECRYPT_DATA: 'DECRYPT_DATA',
    START_OAUTH: 'start-oauth',
    EXECUTE_SCHEDULED_POST: 'EXECUTE_SCHEDULED_POST'
  };

  // File paths
  const PATHS = {
    SETTINGS: 'data/settings.json',
    SAVED_CONFIGS: 'data/savedConfigs.json',
    SCHEDULED_POSTS: 'data/scheduledPosts.json',
    ACTIVITY_LOG: 'data/activity_log.json',
    LIBRARY: 'data/library.json'
  };

  // Sensitive fields that should be encrypted
  const SENSITIVE_FIELDS = [
    'apiKey',
    'instagramToken',
    'tiktokToken',
    'youtubeToken',
    'twitterToken'
  ];

  // Encrypt sensitive fields in an object
  async function encryptSensitiveFields(obj) {
    const encrypted = { ...obj };
    for (const field of SENSITIVE_FIELDS) {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        const result = await window.api.encrypt(encrypted[field]);
        if (result.success) {
          encrypted[field] = result.data;
        }
      }
    }
    return encrypted;
  }

  // Decrypt sensitive fields in an object
  async function decryptSensitiveFields(obj) {
    const decrypted = { ...obj };
    for (const field of SENSITIVE_FIELDS) {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        const result = await window.api.decrypt(decrypted[field]);
        if (result.success) {
          decrypted[field] = result.data;
        }
      }
    }
    return decrypted;
  }

  // Display content library items
  async function displayLibraryContent() {
    const libRes = await readFileAsync(PATHS.LIBRARY);
    if (!libRes.success) {
      addLogEntry('Failed to load content library', 'error');
      return;
    }

    let library = safeParse(libRes.content, []);
    const container = $('libraryGrid');
    const searchInput = $('librarySearch');
    const filterSelect = $('libraryFilter');
    
    if (!container) {
      console.error('Library grid container not found');
      return;
    }

    // Apply search if any
    if (searchInput && searchInput.value.trim()) {
      const searchVal = searchInput.value.trim().toLowerCase();
      library = library.filter(item => 
        (item.caption || '').toLowerCase().includes(searchVal) ||
        (item.hashtags || '').toLowerCase().includes(searchVal) ||
        (item.type || '').toLowerCase().includes(searchVal)
      );
    }

    // Apply filter if any
    if (filterSelect && filterSelect.value !== 'all') {
      const filterVal = filterSelect.value;
      library = library.filter(item => 
        filterVal === item.type || 
        (filterVal === 'posted' && item.posted) ||
        (filterVal === 'draft' && !item.posted)
      );
    }
    
    // Clear existing content
    container.innerHTML = '';

    if (library.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #718096; padding: 40px;">No content yet</p>';
      return;
    }

    // Add each library item
    library.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'library-item';
      itemDiv.style.cssText = 'border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: var(--glass-bg);';
      
      // Media preview
      const mediaContainer = document.createElement('div');
      mediaContainer.style.cssText = 'width: 100%; height: 150px; display: flex; align-items: center; justify-content: center; background: #000;';
      
      if (item.url) {
        if (item.type === 'video') {
          const video = document.createElement('video');
          video.src = item.url;
          video.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
          video.controls = true;
          mediaContainer.appendChild(video);
        } else {
          const img = document.createElement('img');
          img.src = item.url;
          img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
          mediaContainer.appendChild(img);
        }
      }
      
      itemDiv.appendChild(mediaContainer);
      
      // Info section
      const info = document.createElement('div');
      info.style.cssText = 'padding: 12px;';
      
      // Type badge
      const typeBadge = document.createElement('span');
      typeBadge.textContent = item.type.toUpperCase();
      typeBadge.style.cssText = 'display: inline-block; padding: 4px 8px; background: #4a5568; color: white; border-radius: 4px; font-size: 0.8em; margin-bottom: 8px;';
      info.appendChild(typeBadge);
      
      // Creation date
      const date = document.createElement('p');
      date.textContent = new Date(item.createdAt).toLocaleString();
      date.style.cssText = 'color: #718096; font-size: 0.9em; margin: 4px 0;';
      info.appendChild(date);
      
      // Hashtags if any
      if (item.hashtags) {
        const hashtags = document.createElement('p');
        hashtags.textContent = item.hashtags;
        hashtags.style.cssText = 'color: #4299e1; font-size: 0.9em; margin: 4px 0; word-break: break-word;';
        info.appendChild(hashtags);
      }
      
      // Action buttons
      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';
      
      const scheduleBtn = document.createElement('button');
      scheduleBtn.textContent = 'Schedule';
      scheduleBtn.style.cssText = 'flex: 1; padding: 6px; background: #48bb78; color: white; border: none; border-radius: 4px; cursor: pointer;';
      scheduleBtn.onclick = () => schedulePost(item.id);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.style.cssText = 'flex: 1; padding: 6px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer;';
      deleteBtn.onclick = () => deleteFromLibrary(item.id);
      
      actions.appendChild(scheduleBtn);
      actions.appendChild(deleteBtn);
      
      info.appendChild(actions);
      itemDiv.appendChild(info);
      
      container.appendChild(itemDiv);
    });
  }

  // Add content to the library
  async function addToLibrary(item) {
    try {
      if (!item.url || !item.type) {
        throw new Error('Content must have a URL and type');
      }

      // Set required fields
      const libraryItem = {
        ...item,
        id: 'content_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        createdAt: item.createdAt || new Date().toISOString()
      };

      // Load existing library
      const libRes = await readFileAsync(PATHS.LIBRARY);
      let library = libRes.success ? safeParse(libRes.content, []) : [];

      // Add new item
      library.unshift(libraryItem); // Add to start of array

      // Save back to file
      const result = await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to save to library');
      }

      // Update display
      await displayLibraryContent();
      addLogEntry('Content added to library', 'success');

      return libraryItem;
    } catch (e) {
      addLogEntry('Failed to add to library: ' + e.message, 'error');
      throw e;
    }
  }

  // Delete an item from the library
  async function deleteFromLibrary(itemId) {
    try {
      const libRes = await readFileAsync(PATHS.LIBRARY);
      if (!libRes.success) {
        throw new Error('Failed to load library');
      }

      let library = safeParse(libRes.content, []);
      const index = library.findIndex(item => item.id === itemId);
      
      if (index === -1) {
        throw new Error('Item not found in library');
      }

      library.splice(index, 1);
      const result = await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
      
      if (result.success) {
        addLogEntry('Item deleted from library', 'success');
        await displayLibraryContent(); // Refresh display
      } else {
        throw new Error(result.error?.message || 'Failed to save library');
      }
    } catch (e) {
      addLogEntry('Failed to delete item: ' + e.message, 'error');
    }
  }

  // Call on startup and after content generation
  displayLibraryContent();

  // Schedule a post from library
  async function schedulePost(contentId) {
    try {
      // Load the content from library
      const libRes = await readFileAsync(PATHS.LIBRARY);
      if (!libRes.success) {
        throw new Error('Failed to load library');
      }
      const library = safeParse(libRes.content, []);
      const content = library.find(item => item.id === contentId);
      if (!content) {
        throw new Error('Content not found in library');
      }

      // Generate a unique ID for the scheduled post
      const id = 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      // Get scheduling time from UI
      const scheduleTime = $('scheduleTime')?.value;
      if (!scheduleTime) {
        throw new Error('Please select a schedule time');
      }

      // Create the post object
      const post = {
        id,
        content: content.content || content.url,  // Use content field if available, fall back to url
        type: content.type,
        scheduleTime: new Date(scheduleTime).toISOString(),  // Ensure proper ISO format
        platforms: Array.from($('platforms')?.selectedOptions || []).map(opt => opt.value),
        createdAt: new Date().toISOString(),
        status: 'pending',
        metadata: content.metadata || {}
      };

      // Load existing scheduled posts
      const scheduledRes = await readFileAsync(PATHS.SCHEDULED_POSTS);
      const scheduled = scheduledRes.success ? 
        safeParse(scheduledRes.content, { posts: [] }) : 
        { posts: [] };

      // Add new post
      scheduled.posts.push(post);

      // Save back
      const result = await writeFileAsync(PATHS.SCHEDULED_POSTS, JSON.stringify(scheduled, null, 2));
      if (result.success) {
        addLogEntry(`Scheduled post for ${scheduleTime}`, 'success');
      } else {
        throw new Error(result.error?.message || 'Failed to save scheduled post');
      }

      await displayScheduledPosts(); // Refresh the display
    } catch (e) {
      addLogEntry('Failed to schedule post: ' + e.message, 'error');
    }
  }

  // UTILITIES
  // PHASE 3: ERROR HANDLING
  function displayValidationError(error, context) {
    const errorContainer = $('errorContainer');
    if (!errorContainer) return;
    
    let message = `Failed to save ${context}`;
    if (error && error.message) {
      if (error.message.includes('Validation failed') && error.details) {
        message += `:\n\nValidation Error:\n${error.details}`;
      } else {
        message += `: ${error.message}`;
      }
    }
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    addLogEntry(`${context} save failed: ${error?.message || 'unknown'}`);
  }

  function clearError() {
    const errorContainer = $('errorContainer');
    if (errorContainer) {
      errorContainer.textContent = '';
      errorContainer.style.display = 'none';
    }
  }
  
  function addLogEntry(text) {
    const container = $('logContainer');
    if (container) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.textContent = `${new Date().toISOString()} — ${text}`;
      container.prepend(entry);
    }

    (async () => {
      const r = await readFileAsync(PATHS.ACTIVITY_LOG);
      let data = r.success ? safeParse(r.content, { logs: [] }) : { logs: [] };
      if (Array.isArray(data)) data = { logs: data };
      data.logs.unshift({ ts: new Date().toISOString(), text });
      await writeFileAsync(PATHS.ACTIVITY_LOG, JSON.stringify(data, null, 2));
    })();
  }

  function safeParse(content, fallback) {
    try { return JSON.parse(content); } catch { return fallback; }
  }

  function toDateTimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D}T${h}:${m}`;
  }

  function dedupeSavedConfigs(arr = []) {
    const seen = new Map();
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      const key = it?.createdAt ? String(it.createdAt) : (it?.name ? `name:${String(it.name)}` : JSON.stringify(it));
      if (!seen.has(key)) seen.set(key, it);
    }
    return Array.from(seen.values()).reverse();
  }

  function dedupeScheduledPosts(arr = []) {
    const seen = new Set();
    const out = [];
    for (const it of arr) {
      const key = [it.createdAt, it.scheduleTime, JSON.stringify(it.source)].join('|');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(it);
      }
    }
    return out;
  }

  function formatMemeText(text) {
    return encodeURIComponent((text || '').trim() || '_').replace(/%20/g, '_');
  }

  // LOADING SPINNER
  function showSpinner(message = 'Loading...') {
    hideSpinner(); // Remove any existing spinner
    const spinner = document.createElement('div');
    spinner.id = 'globalSpinner';
    spinner.className = 'spinner-overlay';
    spinner.innerHTML = `
      <div class="spinner-content">
        <div class="spinner"></div>
        <div class="spinner-text">${message}</div>
      </div>
    `;
    document.body.appendChild(spinner);
  }

  function hideSpinner() {
    const spinner = document.getElementById('globalSpinner');
    if (spinner) spinner.remove();
  }

  function updateSpinnerMessage(message) {
    const spinnerText = document.querySelector('.spinner-text');
    if (spinnerText) spinnerText.textContent = message;
  }

  // BULK GENERATION
  function openBulkModal() {
    $('bulkModal').style.display = 'block';
    $('bulkProgress').style.display = 'none';
    $('bulkComplete').style.display = 'none';
    bulkGeneratedContent = [];
    addLogEntry('Opened bulk generation modal');
  }

  function closeBulkModal() {
    $('bulkModal').style.display = 'none';
  }

  function handleBulkTemplateStrategyChange() {
    const strategy = $('bulkTemplateStrategy')?.value;
    const singleLabel = $('bulkSingleTemplateLabel');
    if (singleLabel) {
      singleLabel.style.display = strategy === 'single' ? '' : 'none';
    }
  }

  function handleBulkTextModeChange() {
    const mode = $('bulkTextMode')?.value;
    const aiLabel = $('bulkAiPromptLabel');
    const manualLabel = $('bulkManualTextLabel');
    
    if (aiLabel) aiLabel.style.display = mode === 'ai' ? '' : 'none';
    if (manualLabel) manualLabel.style.display = mode === 'manual' ? '' : 'none';
  }

  function handleBulkHashtagModeChange() {
    const mode = $('bulkHashtagMode')?.value;
    const manualLabel = $('bulkManualHashtagsLabel');
    if (manualLabel) {
      manualLabel.style.display = mode === 'manual' ? '' : 'none';
    }
  }

  async function startBulkGeneration() {
    try {
      const quantity = parseInt($('bulkQuantity')?.value || '10');
      const textMode = $('bulkTextMode')?.value || 'manual';
      
      bulkGeneratedContent = [];
      $('bulkProgress').style.display = 'block';
      $('bulkComplete').style.display = 'none';
      $('bulkPreviewGrid').innerHTML = '';
      $('bulkProgressBar').style.width = '0%';
      
      showSpinner('Generating text variations...');
      const textVariations = await generateBulkTextVariations(quantity, textMode);
      hideSpinner();
      
      const platforms = [];
      if ($('bulkInstagram')?.checked) platforms.push({ name: 'instagram', width: 1080, height: 1080 });
      if ($('bulkTikTok')?.checked) platforms.push({ name: 'tiktok', width: 1080, height: 1920 });
      if ($('bulkYouTube')?.checked) platforms.push({ name: 'youtube', width: 1280, height: 720 });
      if ($('bulkTwitter')?.checked) platforms.push({ name: 'twitter', width: 1200, height: 675 });
      
      if (platforms.length === 0) {
        platforms.push({ name: 'instagram', width: 1080, height: 1080 });
      }

      const strategy = $('bulkTemplateStrategy')?.value || 'random';
      let templateToUse = null;
      if (strategy === 'single') {
        templateToUse = $('bulkSingleTemplate')?.value || 'tenguy';
      }

      for (let i = 0; i < quantity; i++) {
        const variation = textVariations[i];
        const template = templateToUse || allTemplates[Math.floor(Math.random() * allTemplates.length)]?.id || 'tenguy';

        for (const dims of platforms) {
          const memeUrl = `https://api.memegen.link/images/${template}/${formatMemeText(variation.top)}/${formatMemeText(variation.bottom)}.png`;
          
          await addToLibrary({
            url: memeUrl,
            type: 'meme',
            platform: dims.name,
            caption: `${variation.top} ${variation.bottom}`,
            hashtags: $('bulkHashtagMode')?.value === 'manual' ? ($('bulkManualHashtags')?.value || '') : '#meme #funny #viral',
            metadata: {
              dimensions: dims,
              template,
              variation
            },
            contentType: 'meme',
            status: 'draft'
          });

          const preview = document.createElement('div');
          preview.style.cssText = 'border: 2px solid #4299e1; border-radius: 8px; overflow: hidden;';
          preview.innerHTML = `
            <img src="${memeUrl}" style="width: 100%; height: 120px; object-fit: cover;" />
            <div style="padding: 5px; font-size: 11px; background: rgba(0,0,0,0.7); color: white;">
              ${dims.name}
            </div>
          `;
          $('bulkPreviewGrid').appendChild(preview);
        }

        const progress = ((i + 1) / quantity) * 100;
        $('bulkProgressBar').style.width = `${progress}%`;
        $('bulkProgressText').textContent = `Generated ${i + 1}/${quantity} (${bulkGeneratedContent.length} total files)`;

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      $('bulkProgressText').textContent = `Complete! Generated ${bulkGeneratedContent.length} images`;
      $('bulkComplete').style.display = 'block';
      
      const libRes = await readFileAsync(PATHS.LIBRARY);
      let library = libRes.success ? safeParse(libRes.content, []) : [];
      library = bulkGeneratedContent.concat(library);
      await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
      await renderLibrary();

      addLogEntry(`Bulk generated ${bulkGeneratedContent.length} memes`);
    } catch (error) {
      hideSpinner();
      $('bulkProgressText').textContent = `Error: ${error.message}`;
      addLogEntry(`Bulk generation failed: ${error.message}`);
    }
  }

  async function generateBulkTextVariations(quantity, mode) {
    const variations = [];
    
    if (mode === 'manual') {
      const text = $('bulkManualText')?.value || '';
      const lines = text.split('\n').filter(l => l.trim());
      
      for (let i = 0; i < quantity; i++) {
        const line = lines[i % lines.length] || 'Sample|Text';
        const parts = line.split('|');
        variations.push({
          top: parts[0]?.trim() || 'Top Text',
          bottom: parts[1]?.trim() || 'Bottom Text'
        });
      }
    } else {
      // AI mode - Generate varied text combinations
      const prompt = $('bulkAiPrompt')?.value || 'funny memes';
      
      // Simple text variation generator (replace with actual AI API later)
      const templates = [
        { top: 'When you', bottom: 'But then you realize' },
        { top: 'Nobody:', bottom: 'Absolutely nobody:' },
        { top: 'Me trying to', bottom: 'Also me:' },
        { top: 'Expectation:', bottom: 'Reality:' },
        { top: 'Before:', bottom: 'After:' },
        { top: "That moment when", bottom: "And you're like" },
        { top: 'POV:', bottom: 'Meanwhile' },
        { top: 'Everyone else:', bottom: 'Me:' }
      ];
      
      for (let i = 0; i < quantity; i++) {
        const template = templates[i % templates.length];
        variations.push({
          top: `${template.top} ${prompt}`,
          bottom: template.bottom
        });
      }
      
      addLogEntry('Using template variations - integrate AI API for custom generation');
    }
    
    return variations;
  }

  function generateCSV() {
    const csv = ['filename,platform,caption,hashtags,scheduled_time'];
    
    bulkGeneratedContent.forEach(item => {
      const row = [
        item.filename,
        item.platform,
        `"${item.caption.replace(/"/g, '""')}"`,
        `"${item.hashtags}"`,
        item.timestamp
      ].join(',');
      csv.push(row);
    });
    
    return csv.join('\n');
  }

  async function downloadBulkCSV() {
    const csv = generateCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_memes_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLogEntry('Downloaded metadata CSV');
  }

  async function downloadBulkZip() {
    if (!window.JSZip) {
      addLogEntry('JSZip not loaded - downloading CSV instead');
      await downloadBulkCSV();
      return;
    }
    
    addLogEntry('Creating ZIP archive...');
    const zip = new JSZip();
    
    const byPlatform = {};
    bulkGeneratedContent.forEach(item => {
      if (!byPlatform[item.platform]) {
        byPlatform[item.platform] = [];
      }
      byPlatform[item.platform].push(item);
    });
    
    const csv = generateCSV();
    zip.file('metadata.csv', csv);
    zip.file('README.txt', `AI Auto Bot - Bulk Generated Content
Generated: ${new Date().toISOString()}
Total Files: ${bulkGeneratedContent.length}

Platform folders contain optimized images.
Use metadata.csv for scheduling tools (Buffer, Hootsuite, Later).`);
    
    let completed = 0;
    for (const [platform, items] of Object.entries(byPlatform)) {
      const folder = zip.folder(platform);
      
      for (const item of items) {
        try {
          const response = await fetch(item.url);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          folder.file(item.filename, arrayBuffer, { binary: true });
          
          completed++;
          const progress = (completed / bulkGeneratedContent.length) * 100;
          $('bulkProgressText').textContent = `Packaging ${completed}/${bulkGeneratedContent.length}...`;
          $('bulkProgressBar').style.width = `${progress}%`;
        } catch (error) {
          console.error(`Failed to package ${item.filename}:`, error);
        }
      }
    }
    
    $('bulkProgressText').textContent = 'Finalizing ZIP...';
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_autobot_bulk_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLogEntry(`ZIP downloaded with ${Object.keys(byPlatform).length} platform folders`);
    $('bulkProgressText').textContent = 'Download complete!';
  }

  // MEME FUNCTIONS
  function updateMemePreview() {
    const template = $('memeTemplate')?.value;
    const topText = formatMemeText($('memeTopText')?.value);
    const bottomText = formatMemeText($('memeBottomText')?.value);
    const preview = $('memePreview');
    
    if (preview && template && template !== 'ai-generator') {
      preview.src = `https://api.memegen.link/images/${template}/${topText}/${bottomText}.png`;
      preview.style.display = 'block';
    } else if (template === 'ai-generator') {
      preview.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23f0f0f0" width="300" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%234a5568" font-size="14"%3EClick Generate to create%3C/text%3E%3C/svg%3E';
      preview.style.display = 'block';
    }
  }

  async function fetchMemeTemplates() {
    const sel = $('memeTemplate');
    if (!sel) return;
    
    try {
      const resp = await fetch('https://api.memegen.link/templates/');
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      
      const data = await resp.json();
      allTemplates = Array.isArray(data) 
        ? data 
        : Object.keys(data).map(k => ({ id: k, name: data[k].name || k }));
      
      let html = '<option value="ai-generator">🤖 AI Generator (Prompt/URL)</option>';
      html += allTemplates
        .map(t => `<option value="${t.id}">${t.name || t.id}</option>`)
        .join('');
      
      sel.innerHTML = html;
      
      const bulkSel = $('bulkSingleTemplate');
      if (bulkSel) {
        bulkSel.innerHTML = allTemplates
          .map(t => `<option value="${t.id}">${t.name || t.id}</option>`)
          .join('');
      }
      
      addLogEntry('Meme templates loaded');
    } catch (error) {
      addLogEntry(`Template fetch failed: ${error.message}`);
    }
  }

  // CONFIG HANDLERS
  async function handleSaveConfig() {
    clearError();
    
    const name = $('configNameInput')?.value?.trim();
    if (!name) {
      displayValidationError({ message: 'Config name is required' }, 'config');
      return;
    }

    const form = $('settingsForm');
    const data = {};
    if (form) {
      const inputs = form.querySelectorAll('input,select,textarea');
      inputs.forEach((el) => {
        if (!el.id) return;
        if (el.type === 'checkbox') data[el.id] = el.checked;
        else data[el.id] = el.value;
      });
    }

    const encryptedData = await encryptSensitiveFields(data);

    const res = await readFileAsync(PATHS.SAVED_CONFIGS);
    let configs = res.success ? safeParse(res.content, { configs: [] }) : { configs: [] };
    
    if (Array.isArray(configs)) configs = { configs: configs };
    if (!configs.configs || !Array.isArray(configs.configs)) configs = { configs: [] };
    
    const index = configs.configs.findIndex((c) => c.name === name);
    const record = { name, createdAt: new Date().toISOString(), settings: encryptedData };
    
    if (index >= 0) configs.configs[index] = record;
    else configs.configs.unshift(record);

    const w = await writeFileAsync(PATHS.SAVED_CONFIGS, JSON.stringify(configs, null, 2));
    if (w.success) {
      clearError();
      addLogEntry(`Config saved: ${name} (encrypted)`);
      await populateSavedConfigs();
      $('configNameInput').value = '';
    } else {
      displayValidationError(w.error, 'config');
    }
  }

  async function handleImportSettings() {
    const res = await readFileAsync(PATHS.SETTINGS);
    if (!res.success) {
      displayValidationError(res.error, 'settings import');
      return;
    }
    
    const obj = safeParse(res.content, {});
    const decryptedObj = await decryptSensitiveFields(obj);
    populateFormFromObject(decryptedObj);
    addLogEntry('Settings imported and decrypted from data/settings.json');
    clearError();
  }

  function populateFormFromObject(obj) {
    if (!obj) return;
    Object.keys(obj).forEach((key) => {
      const el = $(key);
      if (!el) return;
      
      if (el.type === 'checkbox') {
        el.checked = !!obj[key];
      } else if (el.type === 'datetime-local' || key === 'scheduleDateTime') {
        el.value = toDateTimeLocal(obj[key]);
      } else {
        el.value = obj[key] ?? '';
      }
      
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function renderSavedConfigs(configs) {
    const ul = $('savedConfigsList');
    if (!ul) return;
    
    ul.innerHTML = '';
    configs.forEach((c, idx) => {
      const li = document.createElement('li');
      li.className = 'saved-config-item';

      const nameText = document.createElement('span');
      nameText.textContent = c.name || `config-${idx}`;
      nameText.style.marginRight = '8px';

      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Load';
      loadBtn.addEventListener('click', async () => {
        const decryptedSettings = await decryptSensitiveFields(c.settings);
        populateFormFromObject(decryptedSettings);
        addLogEntry(`Loaded config: ${c.name} (decrypted)`);
      });

      const delBtn = document.createElement('button');
      delBtn.type = "button";
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        const r = await readFileAsync(PATHS.SAVED_CONFIGS);
        let data = r.success ? safeParse(r.content, { configs: [] }) : { configs: [] };
        
        // Handle legacy flat array format
        if (Array.isArray(data)) data = { configs: data };
        if (!data.configs || !Array.isArray(data.configs)) data = { configs: [] };
        
        let removeIdx = -1;
        if (c.createdAt) {
          removeIdx = data.configs.findIndex(x => x && x.createdAt === c.createdAt);
        }
        if (removeIdx === -1 && c.name) {
          removeIdx = data.configs.findIndex(x => x && x.name === c.name);
        }
        
        if (removeIdx >= 0) data.configs.splice(removeIdx, 1);
        
        const w = await writeFileAsync(PATHS.SAVED_CONFIGS, JSON.stringify(data, null, 2));
        if (w.success) {
          renderSavedConfigs(data.configs);
          addLogEntry(`Deleted config: ${c.name || 'unnamed'}`);
        } else {
          addLogEntry(`Failed to delete config: ${w.error?.message || 'unknown'}`);
        }
      });

      li.appendChild(nameText);
      li.appendChild(loadBtn);
      li.appendChild(document.createTextNode(' '));
      li.appendChild(delBtn);
      ul.appendChild(li);
    });
  }

  async function populateSavedConfigs() {
    const res = await readFileAsync(PATHS.SAVED_CONFIGS);
    let configs = res.success ? safeParse(res.content, { configs: [] }) : { configs: [] };
    
    if (Array.isArray(configs)) configs = { configs: configs };
    if (!configs.configs || !Array.isArray(configs.configs)) configs = { configs: [] };
    
    const cleaned = dedupeSavedConfigs(configs.configs);
    
    if (cleaned.length !== configs.configs.length) {
      await writeFileAsync(PATHS.SAVED_CONFIGS, JSON.stringify({ configs: cleaned }, null, 2));
    }
    
    renderSavedConfigs(cleaned);
  }

  // SCHEDULED POSTS
  function renderScheduledPosts(posts) {
    const ul = $('scheduledPostsList');
    if (!ul) return;
    
    ul.innerHTML = '';
    posts.forEach((p, idx) => {
      const li = document.createElement('li');
      li.className = 'scheduled-post-item';
      li.textContent = `${p.scheduleTime || 'N/A'} — ${p.status || 'scheduled'}`;
      
      const delBtn = document.createElement('button');
      delBtn.type = "button";
      delBtn.textContent = 'Delete';
      delBtn.className = "action-btn delete";
      delBtn.addEventListener('click', async () => {
        const r = await readFileAsync(PATHS.SCHEDULED_POSTS);
        let data = r.success ? safeParse(r.content, { posts: [] }) : { posts: [] };
        
        // Handle legacy flat array format
        if (Array.isArray(data)) data = { posts: data };
        if (!data.posts || !Array.isArray(data.posts)) data = { posts: [] };
        
        data.posts.splice(idx, 1);
        
        const w = await writeFileAsync(PATHS.SCHEDULED_POSTS, JSON.stringify(data, null, 2));
        if (w.success) {
          renderScheduledPosts(data.posts);
          addLogEntry('Scheduled post deleted');
        }
      });
      
      li.appendChild(document.createTextNode(' '));
      li.appendChild(delBtn);
      ul.appendChild(li);
    });
  }

  async function populateScheduledPosts() {
    const r = await readFileAsync(PATHS.SCHEDULED_POSTS);
    let data = r.success ? safeParse(r.content, { posts: [] }) : { posts: [] };
    
    // Handle legacy flat array format
    if (Array.isArray(data)) data = { posts: data };
    if (!data.posts || !Array.isArray(data.posts)) data = { posts: [] };
    
    const cleaned = dedupeScheduledPosts(data.posts);
    
    if (cleaned.length !== data.posts.length) {
      await writeFileAsync(PATHS.SCHEDULED_POSTS, JSON.stringify({ posts: cleaned }, null, 2));
    }
    
    renderScheduledPosts(cleaned);
  }

  async function populateTimezones() {
    const tzSelect = $('timezoneSelect');
    if (!tzSelect) return;
    
    let zones = [];
    try {
      if (typeof Intl.supportedValuesOf === 'function') {
        zones = Intl.supportedValuesOf('timeZone');
      }
    } catch (e) {
      zones = [];
    }
    
    if (!zones || zones.length === 0) {
      zones = ['UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Asia/Tokyo'];
    }
    
    tzSelect.innerHTML = zones.map((z) => `<option value="${z}">${z}</option>`).join('');
  }

  // CONTENT LIBRARY
  async function renderLibrary() {
    const r = await readFileAsync(PATHS.LIBRARY);
    let library = r.success ? safeParse(r.content, []) : [];

    const searchVal = ($('librarySearch')?.value || '').toLowerCase();
    const filterVal = $('libraryFilter')?.value || 'all';

    if (searchVal) {
      library = library.filter(item =>
        (item.caption || '').toLowerCase().includes(searchVal) ||
        (item.hashtags || '').toLowerCase().includes(searchVal) ||
        (item.platform || '').toLowerCase().includes(searchVal)
      );
    }

    if (filterVal !== 'all') {
      library = library.filter(item => {
        if (filterVal === 'meme' || filterVal === 'video') {
          return item.contentType === filterVal;
        }
        return item.status === filterVal;
      });
    }

    const grid = $('libraryGrid');
    if (!grid) return;

    if (library.length === 0) {
      grid.innerHTML = '<p style="text-align: center; color: #718096; padding: 40px; grid-column: 1/-1;">No content found</p>';
      return;
    }

    grid.innerHTML = library.map(item => `
      <div class="library-item" data-id="${item.id}" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: white;">
        ${item.url ? `<img src="${item.url}" style="width: 100%; height: 150px; object-fit: cover;" />` : ''}
        <div style="padding: 10px;">
          <div style="font-size: 12px; color: #718096; margin-bottom: 5px;">
            ${item.platform || 'Unknown'} • ${item.status || 'draft'}
          </div>
          <div style="font-size: 13px; margin-bottom: 8px; max-height: 40px; overflow: hidden;">
            ${item.caption || 'No caption'}
          </div>
          <div style="display: flex; gap: 5px;">
            <button type="button" class="reuse-btn" style="flex: 1; padding: 6px; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Reuse</button>
            <button type="button" class="delete-btn" style="flex: 1; padding: 6px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete</button>
          </div>
        </div>
      </div>
    `).join('');

    // Event delegation for library buttons
    grid.querySelectorAll('.reuse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.closest('.library-item').dataset.id;
        reuseLibraryItem(id);
      });
    });
    grid.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.closest('.library-item').dataset.id;
        deleteLibraryItem(id);
      });
    });
  }

  async function reuseLibraryItem(id) {
    const r = await readFileAsync(PATHS.LIBRARY);
    const library = r.success ? safeParse(r.content, []) : [];
    const item = library.find(i => i.id === id);
    
    if (item) {
      populateFormFromObject(item);
      addLogEntry('Loaded content from library');
    }
  }

  async function deleteLibraryItem(id) {
    const r = await readFileAsync(PATHS.LIBRARY);
    let library = r.success ? safeParse(r.content, []) : [];
    
    library = library.filter(item => item.id !== id);
    await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
    
    await renderLibrary();
    addLogEntry('Deleted from library');
  }

  // EVENT HANDLERS
  function handleDarkModeToggle(ev) {
    const on = ev.target.checked;
    document.documentElement.classList.toggle('dark', on);
    document.body.classList.toggle('dark', on);
    addLogEntry(`Dark mode ${on ? 'enabled' : 'disabled'}`);
  }

  function handleContentTypeChange(ev) {
    const val = ev.target.value;
    const memeFields = $('memeFields');
    const videoFields = $('videoFields');
    
    if (memeFields) memeFields.style.display = val === 'meme' ? '' : 'none';
    if (videoFields) videoFields.style.display = val === 'video' ? '' : 'none';
    
    // Trigger meme mode change if switching to meme
    if (val === 'meme') {
      $('memeMode')?.dispatchEvent(new Event('change'));
    }
    
    // Trigger video mode change if switching to video
    if (val === 'video') {
      $('videoMode')?.dispatchEvent(new Event('change'));
    }
    
    addLogEntry(`Content type set to ${val}`);
  }

  // VIDEO GENERATION FUNCTIONS
  function handleVideoModeChange(ev) {
    const mode = ev?.target?.value || $('videoMode')?.value;
    
    const memeToVideoOptions = $('memeToVideoOptions');
    const slideshowOptions = $('slideshowOptions');
    const gifOptions = $('gifOptions');
    const aiVideoOptions = $('aiVideoOptions');
    
    // Hide all option sections
    if (memeToVideoOptions) memeToVideoOptions.style.display = 'none';
    if (slideshowOptions) slideshowOptions.style.display = 'none';
    if (gifOptions) gifOptions.style.display = 'none';
    if (aiVideoOptions) aiVideoOptions.style.display = 'none';
    
    // Show relevant section
    if (mode === 'meme-to-video' && memeToVideoOptions) {
      memeToVideoOptions.style.display = '';
    } else if (mode === 'slideshow' && slideshowOptions) {
      slideshowOptions.style.display = '';
    } else if (mode === 'gif' && gifOptions) {
      gifOptions.style.display = '';
    } else if (mode === 'ai-video' && aiVideoOptions) {
      aiVideoOptions.style.display = '';
    }
    
    addLogEntry(`Video mode: ${mode}`);
  }

  async function handleGenerateVideo() {
    const mode = $('videoMode')?.value;
    
    if (mode === 'meme-to-video') {
      await generateMemeToVideo();
    } else if (mode === 'slideshow') {
      await generateSlideshow();
    } else if (mode === 'gif') {
      await generateAnimatedGIF();
    } else if (mode === 'ai-video') {
      await generateAIVideo();
    }
  }

  async function generateMemeToVideo() {
    const memeUrl = $('memePreview')?.src;
    if (!memeUrl || memeUrl.includes('svg')) {
      $('errorContainer').textContent = 'Please generate or select a meme first!';
      $('errorContainer').style.display = 'block';
      return;
    }

    showSpinner('Creating video from meme...');
    
    try {
      const duration = parseInt($('videoDuration')?.value || '5');
      const aspectRatio = $('aspectRatio')?.value || '16:9';
      const fps = parseInt($('frameRate')?.value || '30');
      const animationStyle = $('animationStyle')?.value || 'zoom-in';
      const textAnimation = $('textAnimation')?.value || 'none';
      
      // Get dimensions based on aspect ratio
      const dimensions = getVideoDimensions(aspectRatio);
      
      // Load image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = memeUrl;
      });
      
      // Setup canvas
      const canvas = $('videoCanvas');
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const ctx = canvas.getContext('2d');
      
      // Record video
      const stream = canvas.captureStream(fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 8000000
      });
      
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      
      mediaRecorder.onstop = () => {
        videoBlob = new Blob(chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(videoBlob);
        
        const preview = $('videoPreview');
        if (preview) {
          preview.src = videoUrl;
          $('videoPreviewContainer').style.display = 'block';
        }
        
        hideSpinner();
        addLogEntry('Video created successfully!');
      };
      
      mediaRecorder.start();
      
      // Animate frames
      const totalFrames = duration * fps;
      let currentFrame = 0;
      
      const animate = () => {
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }
        
        const progress = currentFrame / totalFrames;
        
        // Clear canvas
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Apply animation
        ctx.save();
        applyAnimation(ctx, animationStyle, progress, canvas.width, canvas.height, img);
        ctx.restore();
        
        // Apply text animation if needed
        if (textAnimation !== 'none') {
          applyTextAnimation(ctx, textAnimation, progress, canvas.width, canvas.height);
        }
        
        currentFrame++;
        requestAnimationFrame(animate);
      };
      
      animate();
      
    } catch (error) {
      hideSpinner();
      $('errorContainer').textContent = `Video generation failed: ${error.message}`;
      $('errorContainer').style.display = 'block';
      addLogEntry(`Video error: ${error.message}`);
    }
  }

  function applyAnimation(ctx, style, progress, width, height, img) {
    switch (style) {
      case 'zoom-in':
        const zoomInScale = 1 + (progress * 0.5);
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoomInScale, zoomInScale);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img, 0, 0, width, height);
        break;
        
      case 'zoom-out':
        const zoomOutScale = 1.5 - (progress * 0.5);
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoomOutScale, zoomOutScale);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img, 0, 0, width, height);
        break;
        
      case 'pan-left':
        const panLeftX = -(progress * width * 0.3);
        ctx.drawImage(img, panLeftX, 0, width * 1.3, height);
        break;
        
      case 'pan-right':
        const panRightX = (progress * width * 0.3);
        ctx.drawImage(img, panRightX, 0, width * 1.3, height);
        break;
        
      case 'slide-up':
        const slideUpY = height - (progress * height);
        ctx.drawImage(img, 0, slideUpY, width, height);
        break;
        
      case 'slide-down':
        const slideDownY = -(height - (progress * height));
        ctx.drawImage(img, 0, slideDownY, width, height);
        break;
        
      case 'fade':
        ctx.globalAlpha = progress < 0.5 ? progress * 2 : 2 - (progress * 2);
        ctx.drawImage(img, 0, 0, width, height);
        ctx.globalAlpha = 1;
        break;
        
      case 'bounce':
        const bounceY = Math.abs(Math.sin(progress * Math.PI * 4)) * 50;
        ctx.drawImage(img, 0, bounceY, width, height);
        break;
        
      default:
        ctx.drawImage(img, 0, 0, width, height);
    }
  }

  function applyTextAnimation(ctx, animation, progress, width, height) {
    const topText = $('memeTopText')?.value || '';
    const bottomText = $('memeBottomText')?.value || '';
    
    ctx.font = 'bold 48px Impact';
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    
    if (animation === 'fade-in') {
      ctx.globalAlpha = progress;
    } else if (animation === 'slide-in') {
      ctx.save();
      ctx.translate(width * (1 - progress), 0);
    } else if (animation === 'typewriter') {
      const topChars = Math.floor(topText.length * progress);
      const bottomChars = Math.floor(bottomText.length * progress);
      ctx.strokeText(topText.substring(0, topChars), width / 2, 60);
      ctx.fillText(topText.substring(0, topChars), width / 2, 60);
      ctx.strokeText(bottomText.substring(0, bottomChars), width / 2, height - 20);
      ctx.fillText(bottomText.substring(0, bottomChars), width / 2, height - 20);
      ctx.globalAlpha = 1;
      return;
    }
    
    ctx.strokeText(topText, width / 2, 60);
    ctx.fillText(topText, width / 2, 60);
    ctx.strokeText(bottomText, width / 2, height - 20);
    ctx.fillText(bottomText, width / 2, height - 20);
    
    ctx.globalAlpha = 1;
    if (animation === 'slide-in') ctx.restore();
  }

  async function generateSlideshow() {
    if (selectedMemesForSlideshow.length === 0) {
      $('errorContainer').textContent = 'Please select memes from your library first!';
      $('errorContainer').style.display = 'block';
      return;
    }

    showSpinner(`Creating slideshow with ${selectedMemesForSlideshow.length} memes...`);
    
    try {
      const slideDuration = parseInt($('slideDuration')?.value || '3');
      const transition = $('transitionEffect')?.value || 'fade';
      const aspectRatio = $('aspectRatio')?.value || '16:9';
      const fps = parseInt($('frameRate')?.value || '30');
      
      const dimensions = getVideoDimensions(aspectRatio);
      
      const canvas = $('videoCanvas');
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const ctx = canvas.getContext('2d');
      
      // Load all images
      const images = await Promise.all(
        selectedMemesForSlideshow.map(meme => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = meme.url;
          });
        })
      );
      
      // Record video
      const stream = canvas.captureStream(fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 8000000
      });
      
      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      
      mediaRecorder.onstop = () => {
        videoBlob = new Blob(chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(videoBlob);
        
        const preview = $('videoPreview');
        if (preview) {
          preview.src = videoUrl;
          $('videoPreviewContainer').style.display = 'block';
        }
        
        hideSpinner();
        addLogEntry('Slideshow created successfully!');
      };
      
      mediaRecorder.start();
      
      const framesPerSlide = slideDuration * fps;
      const transitionFrames = Math.floor(fps * 0.5); // 0.5 second transition
      let currentFrame = 0;
      let currentSlide = 0;
      
      const animate = () => {
        const totalFrames = images.length * framesPerSlide;
        
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }
        
        const slideProgress = (currentFrame % framesPerSlide) / framesPerSlide;
        const isTransitioning = slideProgress > 0.85; // Last 15% of slide
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (isTransitioning && currentSlide < images.length - 1) {
          const transitionProgress = (slideProgress - 0.85) / 0.15;
          applyTransition(ctx, images[currentSlide], images[currentSlide + 1], transition, transitionProgress, canvas.width, canvas.height);
        } else {
          ctx.drawImage(images[currentSlide], 0, 0, canvas.width, canvas.height);
        }
        
        if (currentFrame % framesPerSlide === 0 && currentFrame > 0) {
          currentSlide++;
        }
        
        currentFrame++;
        requestAnimationFrame(animate);
      };
      
      animate();
      
    } catch (error) {
      hideSpinner();
      $('errorContainer').textContent = `Slideshow generation failed: ${error.message}`;
      $('errorContainer').style.display = 'block';
      addLogEntry(`Slideshow error: ${error.message}`);
    }
  }

  function applyTransition(ctx, img1, img2, type, progress, width, height) {
    switch (type) {
      case 'fade':
        ctx.globalAlpha = 1 - progress;
        ctx.drawImage(img1, 0, 0, width, height);
        ctx.globalAlpha = progress;
        ctx.drawImage(img2, 0, 0, width, height);
        ctx.globalAlpha = 1;
        break;
        
      case 'slide':
        const slideOffset = progress * width;
        ctx.drawImage(img1, -slideOffset, 0, width, height);
        ctx.drawImage(img2, width - slideOffset, 0, width, height);
        break;
        
      case 'zoom':
        const zoomOut = 1 - (progress * 0.5);
        const zoomIn = 0.5 + (progress * 0.5);
        
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoomOut, zoomOut);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img1, 0, 0, width, height);
        ctx.restore();
        
        ctx.save();
        ctx.globalAlpha = progress;
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoomIn, zoomIn);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img2, 0, 0, width, height);
        ctx.restore();
        break;
        
      case 'wipe':
        ctx.drawImage(img1, 0, 0, width, height);
        ctx.drawImage(img2, 0, 0, width * progress, height, 0, 0, width * progress, height);
        break;
    }
  }

  async function generateAnimatedGIF() {
    const memeUrl = $('memePreview')?.src;
    if (!memeUrl || memeUrl.includes('svg')) {
      $('errorContainer').textContent = 'Please generate or select a meme first!';
      $('errorContainer').style.display = 'block';
      return;
    }

    showSpinner('Creating animated GIF...');
    
    try {
      const effect = $('gifEffect')?.value || 'shake';
      const speed = $('loopSpeed')?.value || 'medium';
      const frameCount = speed === 'slow' ? 5 : speed === 'medium' ? 10 : 20;
      const delay = speed === 'slow' ? 1000 : speed === 'medium' ? 200 : 100;
      
      // Load image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = memeUrl;
      });
      
      // Create GIF
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: img.width,
        height: img.height
      });
      
      const canvas = $('videoCanvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      // Generate frames
      for (let i = 0; i < frameCount; i++) {
        const progress = i / frameCount;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        
        applyGIFEffect(ctx, effect, progress, canvas.width, canvas.height, img);
        
        ctx.restore();
        
        gif.addFrame(canvas, { delay: delay, copy: true });
      }
      
      gif.on('finished', (blob) => {
        const gifUrl = URL.createObjectURL(blob);
        
        // Display as video preview (GIFs can play in video element)
        const preview = $('videoPreview');
        if (preview) {
          preview.src = gifUrl;
          preview.loop = true;
          $('videoPreviewContainer').style.display = 'block';
        }
        
        videoBlob = blob;
        
        hideSpinner();
        addLogEntry('Animated GIF created successfully!');
      });
      
      gif.render();
      
    } catch (error) {
      hideSpinner();
      $('errorContainer').textContent = `GIF generation failed: ${error.message}`;
      $('errorContainer').style.display = 'block';
      addLogEntry(`GIF error: ${error.message}`);
    }
  }

  function applyGIFEffect(ctx, effect, progress, width, height, img) {
    switch (effect) {
      case 'shake':
        const shakeX = Math.sin(progress * Math.PI * 8) * 10;
        const shakeY = Math.cos(progress * Math.PI * 8) * 10;
        ctx.drawImage(img, shakeX, shakeY, width, height);
        break;
        
      case 'bounce':
        const bounceY = Math.abs(Math.sin(progress * Math.PI * 2)) * 30;
        ctx.drawImage(img, 0, bounceY, width, height);
        break;
        
      case 'flash':
        ctx.globalAlpha = progress < 0.5 ? 1 : 0.5;
        ctx.drawImage(img, 0, 0, width, height);
        break;
        
      case 'spin':
        ctx.translate(width / 2, height / 2);
        ctx.rotate(progress * Math.PI * 2);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img, 0, 0, width, height);
        break;
        
      case 'wave':
        for (let y = 0; y < height; y++) {
          const waveX = Math.sin((y + progress * height) * 0.05) * 20;
          ctx.drawImage(img, 0, y, width, 1, waveX, y, width, 1);
        }
        break;
    }
  }

  async function generateAIVideo() {
    const apiKey = $('apiKey')?.value;
    if (!apiKey) {
      $('errorContainer').textContent = 'API Key required for AI video generation!';
      $('errorContainer').style.display = 'block';
      addLogEntry('AI video generation failed — missing API Key');
      return;
    }

    const prompt = $('videoPrompt')?.value?.trim();
    if (!prompt) {
      addLogEntry('Please enter a video prompt');
      return;
    }

    showSpinner('Generating AI video (this may take 1-2 minutes)...');
    
    try {
      const duration = parseInt($('videoDuration')?.value || '5');
      const motion = $('motionAmount')?.value || 'medium';
      
      // Runway Gen-2 API
      const response = await fetch('https://api.runwayml.com/v1/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          duration: duration,
          motion_amount: motion === 'low' ? 0.3 : motion === 'medium' ? 0.6 : 0.9
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Poll for completion
      let videoUrl = null;
      const taskId = data.id;
      
      while (!videoUrl) {
        updateSpinnerMessage('AI video processing...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const statusResponse = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        const status = await statusResponse.json();
        
        if (status.status === 'completed') {
          videoUrl = status.video_url;
        } else if (status.status === 'failed') {
          throw new Error('Video generation failed');
        }
      }
      
      // Download and display
      const videoResponse = await fetch(videoUrl);
      videoBlob = await videoResponse.blob();
      const localVideoUrl = URL.createObjectURL(videoBlob);
      
      const preview = $('videoPreview');
      if (preview) {
        preview.src = localVideoUrl;
        $('videoPreviewContainer').style.display = 'block';
      }

      hideSpinner();
      addLogEntry('AI video generated successfully!');
      
    } catch (error) {
      hideSpinner();
      $('errorContainer').textContent = `AI video generation failed: ${error.message}`;
      $('errorContainer').style.display = 'block';
      addLogEntry(`AI video error: ${error.message}`);
    }
  }

  function getVideoDimensions(aspectRatio) {
    const quality = $('videoQuality')?.value || '1080p';
    const baseHeight = quality === '4k' ? 2160 : quality === '1080p' ? 1080 : 720;
    
    switch (aspectRatio) {
      case '16:9':
        return { width: Math.round(baseHeight * 16 / 9), height: baseHeight };
      case '9:16':
        return { width: Math.round(baseHeight * 9 / 16), height: baseHeight };
      case '1:1':
        return { width: baseHeight, height: baseHeight };
      case '4:5':
        return { width: Math.round(baseHeight * 4 / 5), height: baseHeight };
      default:
        return { width: 1920, height: 1080 };
    }
  }

  function handleSelectMemes() {
    // Open modal to select memes from library
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; overflow-y: auto; padding: 20px;';
    
    modal.innerHTML = `
      <div style="background: var(--glass-bg); max-width: 1000px; margin: 0 auto; padding: 30px; border-radius: 15px; position: relative;">
        <button id="closeMemeSelector" style="position: absolute; top: 15px; right: 15px; background: #e53e3e; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer;">Close</button>
        <h2>Select Memes for Slideshow</h2>
        <p>Click memes to add/remove (selected memes will have a blue border)</p>
        <div id="memeSelectionGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 20px;"></div>
        <button id="confirmMemeSelection" style="margin-top: 20px; width: 100%; padding: 12px; background: var(--blue-gradient); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Confirm Selection</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Populate with library memes
    (async () => {
      const r = await readFileAsync(PATHS.LIBRARY);
      const library = r.success ? safeParse(r.content, []) : [];
      const memeLibrary = library.filter(item => item.contentType === 'meme');
      
      const grid = document.getElementById('memeSelectionGrid');
      grid.innerHTML = memeLibrary.map((meme, idx) => `
        <div class="selectable-meme" data-index="${idx}" style="border: 3px solid ${selectedMemesForSlideshow.some(m => m.id === meme.id) ? '#4299e1' : 'transparent'}; border-radius: 8px; overflow: hidden; cursor: pointer;">
          <img src="${meme.url}" style="width: 100%; height: 120px; object-fit: cover;" />
        </div>
      `).join('');
      
      // Add click handlers
      document.querySelectorAll('.selectable-meme').forEach((el, idx) => {
        el.addEventListener('click', () => {
          const meme = memeLibrary[idx];
          const existingIndex = selectedMemesForSlideshow.findIndex(m => m.id === meme.id);
          
          if (existingIndex >= 0) {
            selectedMemesForSlideshow.splice(existingIndex, 1);
            el.style.border = '3px solid transparent';
          } else {
            selectedMemesForSlideshow.push(meme);
            el.style.border = '3px solid #4299e1';
          }
        });
      });
    })();
    
    document.getElementById('closeMemeSelector').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    document.getElementById('confirmMemeSelection').addEventListener('click', () => {
      updateSelectedMemesPreview();
      document.body.removeChild(modal);
      addLogEntry(`Selected ${selectedMemesForSlideshow.length} memes for slideshow`);
    });
  }

  function updateSelectedMemesPreview() {
    const preview = $('selectedMemesPreview');
    if (!preview) return;
    
    preview.innerHTML = selectedMemesForSlideshow.map(meme => `
      <img src="${meme.url}" style="width: 100%; height: 60px; object-fit: cover; border-radius: 4px;" />
    `).join('');
  }

  function handleDownloadVideo() {
    if (!videoBlob) {
      addLogEntry('No video to download');
      return;
    }
    
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    
    const mode = $('videoMode')?.value;
    const extension = mode === 'gif' ? '.gif' : '.webm';
    a.download = `video_${Date.now()}${extension}`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLogEntry('Video downloaded');
  }

  async function handleAddVideoToLibrary() {
    if (!videoBlob) {
      addLogEntry('No video to add to library');
      return;
    }
    
    const videoUrl = URL.createObjectURL(videoBlob);
    
    const libRes = await readFileAsync(PATHS.LIBRARY);
    let library = libRes.success ? safeParse(libRes.content, []) : [];
    
    library.unshift({
      url: videoUrl,
      caption: $('videoPrompt')?.value || 'Generated video',
      hashtags: '#video #ai',
      platform: 'all',
      status: 'draft',
      timestamp: new Date().toISOString(),
      id: 'video_' + Date.now(),
      contentType: 'video',
      videoMode: $('videoMode')?.value
    });
    
    await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
    await renderLibrary();
    
    addLogEntry('Video added to library');
  }

  function handleMemeModeChange(ev) {
    const val = ev.target.value;
    
    const templateLabel = $('memeTemplate')?.parentElement;
    const topTextLabel = $('memeTopText')?.parentElement;
    const bottomTextLabel = $('memeBottomText')?.parentElement;
    const promptLabel = $('promptLabel');
    const actionBtn = $('actionBtn');
    const sourceImageLabel = $('sourceImageLabel');
    const maskImageLabel = $('maskImageLabel');
    const createVarBtn = $('createVariationsBtn');
    const varResults = $('variationResults');
    
    // Hide all optional fields first
    if (promptLabel) promptLabel.style.display = 'none';
    if (actionBtn) actionBtn.style.display = 'none';
    if (sourceImageLabel) sourceImageLabel.style.display = 'none';
    if (maskImageLabel) maskImageLabel.style.display = 'none';
    if (createVarBtn) createVarBtn.style.display = 'none';
    if (varResults) varResults.style.display = 'none';
    
    // Show/hide based on mode
    if (val === 'template') {
      if (templateLabel) templateLabel.style.display = '';
      if (topTextLabel) topTextLabel.style.display = '';
      if (bottomTextLabel) bottomTextLabel.style.display = '';
    } else if (val === 'generate') {
      if (promptLabel) promptLabel.style.display = '';
      if (actionBtn) actionBtn.style.display = '';
      if (actionBtn) actionBtn.textContent = 'Generate';
    } else if (val === 'edit') {
      if (promptLabel) promptLabel.style.display = '';
      if (sourceImageLabel) sourceImageLabel.style.display = '';
      if (maskImageLabel) maskImageLabel.style.display = '';
      if (actionBtn) actionBtn.style.display = '';
      if (actionBtn) actionBtn.textContent = 'Edit Image';
    } else if (val === 'variations') {
      if (sourceImageLabel) sourceImageLabel.style.display = '';
      if (createVarBtn) createVarBtn.style.display = '';
      if (varResults) varResults.style.display = '';
    }
    
    addLogEntry(`Meme mode: ${val}`);
  }

  function handleHashtagModeChange(ev) {
    const val = ev.target.value;
    const manual = $('manualHashtagLabel');
    if (manual) manual.style.display = val === 'manual' ? '' : 'none';
    addLogEntry(`Hashtag mode: ${val}`);
  }

  function handleMemeActionClick() {
    const aiProvider = $('aiProvider')?.value;
    const apiKey = $('apiKey')?.value;
    if (!apiKey) {
      $('errorContainer').textContent = 'API Key required for AI generation!';
      $('errorContainer').style.display = 'block';
      addLogEntry('AI generation failed — missing API Key');
      return;
    }
    $('errorContainer').textContent = '';
    $('errorContainer').style.display = 'none';
    
    const mode = $('memeMode')?.value;
    
    if (mode === 'generate') {
      generateAIImage(apiKey);
    } else if (mode === 'edit') {
      editAIImage(apiKey);
    }
  }

  async function generateAIImage(apiKey) {
    const prompt = $('aiPrompt')?.value?.trim();
    if (!prompt) {
      addLogEntry('Please enter a prompt for AI generation');
      return;
    }

    showSpinner('Generating AI image...');
    
    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0].url;

      // Display in preview
      const preview = $('memePreview');
      if (preview) {
        preview.src = imageUrl;
        preview.style.display = 'block';
      }

      // Save to library
      const libRes = await readFileAsync(PATHS.LIBRARY);
      let library = libRes.success ? safeParse(libRes.content, []) : [];
      library.unshift({
        url: imageUrl,
        caption: prompt,
        hashtags: '#ai #generated',
        platform: 'all',
        status: 'draft',
        timestamp: new Date().toISOString(),
        id: 'ai_' + Date.now(),
        contentType: 'meme'
      });
      await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
      await renderLibrary();

      addLogEntry('AI image generated successfully!');
      hideSpinner();
    } catch (error) {
      hideSpinner();
      $('errorContainer').textContent = `AI generation failed: ${error.message}`;
      $('errorContainer').style.display = 'block';
      addLogEntry(`AI generation error: ${error.message}`);
    }
  }

  async function editAIImage(apiKey) {
    const prompt = $('aiPrompt')?.value?.trim();
    const sourceImageFile = $('sourceImage')?.files[0];
    
    if (!prompt || !sourceImageFile) {
      addLogEntry('Please provide both an image and edit prompt');
      return;
    }

    showSpinner('Editing image with AI...');

    try {
      // Convert image to PNG and resize if needed
      const imageBase64 = await fileToBase64(sourceImageFile);
      
      const formData = new FormData();
      formData.append('image', sourceImageFile);
      formData.append('prompt', prompt);
      formData.append('n', '1');
      formData.append('size', '1024x1024');

      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0].url;

      const preview = $('memePreview');
      if (preview) {
        preview.src = imageUrl;
        preview.style.display = 'block';
      }

      addLogEntry('AI image edited successfully!');
      hideSpinner();
    } catch (error) {
      hideSpinner();
      $('errorContainer').textContent = `AI editing failed: ${error.message}`;
      $('errorContainer').style.display = 'block';
      addLogEntry(`AI editing error: ${error.message}`);
    }
  }

  async function handleCreateVariationsClick() {
    const apiKey = $('apiKey')?.value;
    if (!apiKey) {
      $('errorContainer').textContent = 'API Key required for creating variations!';
      $('errorContainer').style.display = 'block';
      addLogEntry('Variation creation failed — missing API Key');
      return;
    }
    
    const sourceImageFile = $('sourceImage')?.files[0];
    if (!sourceImageFile) {
      addLogEntry('Please select a source image for variations');
      return;
    }

    $('errorContainer').textContent = '';
    $('errorContainer').style.display = 'none';
    
    showSpinner('Creating variations...');

    try {
      const formData = new FormData();
      formData.append('image', sourceImageFile);
      formData.append('n', '4'); // Create 4 variations
      formData.append('size', '1024x1024');

      const response = await fetch('https://api.openai.com/v1/images/variations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Display variations
      const resultsDiv = $('variationResults');
      if (resultsDiv) {
        const grid = resultsDiv.querySelector('div');
        if (grid) {
          grid.innerHTML = data.data.map((img, idx) => `
            <div style="border: 2px solid #4a90e2; border-radius: 8px; overflow: hidden;">
              <img src="${img.url}" style="width: 100%; height: auto;" />
              <button onclick="window.useVariation('${img.url}')" style="width: 100%; padding: 8px; background: #4a90e2; color: white; border: none; cursor: pointer;">
                Use This
              </button>
            </div>
          `).join('');
        }
      }

      addLogEntry('Created 4 variations successfully!');
      hideSpinner();
    } catch (error) {
      hideSpinner();
      $('errorContainer').textContent = `Variation creation failed: ${error.message}`;
      $('errorContainer').style.display = 'block';
      addLogEntry(`Variation error: ${error.message}`);
    }
  }

  window.useVariation = function(url) {
    const preview = $('memePreview');
    if (preview) {
      preview.src = url;
      preview.style.display = 'block';
    }
    addLogEntry('Variation selected');
  };

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handlePostNow() {
    const hasInstagram = $('instagramToken')?.value;
    const hasTiktok = $('tiktokToken')?.value;
    const hasYoutube = $('youtubeToken')?.value;
    const hasTwitter = $('twitterToken')?.value;

    if (!hasInstagram && !hasTiktok && !hasYoutube && !hasTwitter) {
      $('errorContainer').textContent = 'Please provide at least one social media token before posting!';
      $('errorContainer').style.display = 'block';
      addLogEntry('Post Now failed — missing social media token');
      return;
    }
    $('errorContainer').textContent = '';
    $('errorContainer').style.display = 'none';
    
    executePost();
  }

  async function executePost() {
    const memeUrl = $('memePreview')?.src;
    if (!memeUrl || memeUrl.includes('svg')) {
      $('errorContainer').textContent = 'Please generate or select content to post first!';
      $('errorContainer').style.display = 'block';
      return;
    }

    const caption = `${$('memeTopText')?.value || ''} ${$('memeBottomText')?.value || ''}`.trim();
    const hashtagMode = $('hashtagMode')?.value;
    const hashtags = hashtagMode === 'manual' 
      ? ($('manualHashtags')?.value || '') 
      : '#meme #funny #viral';

    const fullCaption = `${caption}\n\n${hashtags}`.trim();

    showSpinner('Preparing to post...');
    let successCount = 0;
    let failCount = 0;

    // Post to selected platforms
    if ($('instagram')?.checked && $('instagramToken')?.value) {
      updateSpinnerMessage('Posting to Instagram...');
      const result = await postToInstagram(memeUrl, fullCaption, $('instagramToken').value);
      if (result.success) successCount++;
      else failCount++;
    }

    if ($('tiktok')?.checked && $('tiktokToken')?.value) {
      updateSpinnerMessage('Posting to TikTok...');
      const result = await postToTikTok(memeUrl, fullCaption, $('tiktokToken').value);
      if (result.success) successCount++;
      else failCount++;
    }

    if ($('youtube')?.checked && $('youtubeToken')?.value) {
      updateSpinnerMessage('Posting to YouTube...');
      const result = await postToYouTube(memeUrl, fullCaption, $('youtubeToken').value);
      if (result.success) successCount++;
      else failCount++;
    }

    if ($('twitter')?.checked && $('twitterToken')?.value) {
      updateSpinnerMessage('Posting to Twitter...');
      const result = await postToTwitter(memeUrl, fullCaption, $('twitterToken').value);
      if (result.success) successCount++;
      else failCount++;
    }

    hideSpinner();
	
	// OAuth login triggers
	 document.getElementById('connectInstagramBtn')?.addEventListener('click', () => {
	   window.open('https://your-oauth-server.com/auth/instagram', '_blank');
	 });

	 document.getElementById('connectTikTokBtn')?.addEventListener('click', () => {
       window.open('https://your-oauth-server.com/auth/tiktok', '_blank');
	 });

	 document.getElementById('connectYouTubeBtn')?.addEventListener('click', () => {
	   window.open('https://your-oauth-server.com/auth/youtube', '_blank');
	 });

	 document.getElementById('connectTwitterBtn')?.addEventListener('click', () => {
	   window.open('https://your-oauth-server.com/auth/twitter', '_blank');
	 });
	
    // Save to library with posted status
    if (successCount > 0) {
      const libRes = await readFileAsync(PATHS.LIBRARY);
      let library = libRes.success ? safeParse(libRes.content, []) : [];
      library.unshift({
        url: memeUrl,
        caption: caption,
        hashtags: hashtags,
        platform: 'multi',
        status: 'posted',
        postedAt: new Date().toISOString(),
        id: 'post_' + Date.now(),
        contentType: 'meme',
        successCount: successCount,
        failCount: failCount
      });
      await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
      await renderLibrary();
    }

    const message = `Posted successfully to ${successCount} platform(s)${failCount > 0 ? `, ${failCount} failed` : ''}`;
    addLogEntry(message);
    alert(message);
  }

  async function postToInstagram(imageUrl, caption, token) {
    try {
      // Download image first
      const imageBlob = await fetch(imageUrl).then(r => r.blob());
      
      // Step 1: Create media container
      const formData = new FormData();
      formData.append('image_url', imageUrl);
      formData.append('caption', caption);
      formData.append('access_token', token);

      const containerResponse = await fetch(
        'https://graph.facebook.com/v18.0/me/media',
        {
          method: 'POST',
          body: formData
        }
      );

      if (!containerResponse.ok) {
        const error = await containerResponse.json();
        throw new Error(error.error?.message || 'Instagram API error');
      }

      const containerData = await containerResponse.json();

      // Step 2: Publish the media
      const publishResponse = await fetch(
        'https://graph.facebook.com/v18.0/me/media_publish',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: containerData.id,
            access_token: token
          })
        }
      );

      if (!publishResponse.ok) {
        const error = await publishResponse.json();
        throw new Error(error.error?.message || 'Instagram publish error');
      }

      addLogEntry('✅ Posted to Instagram successfully');
      return { success: true };
    } catch (error) {
      addLogEntry(`❌ Instagram posting failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async function postToTikTok(imageUrl, caption, token) {
    try {
      // TikTok Content Posting API
      // Note: TikTok primarily supports video, image posting may require special permissions
      const response = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          post_info: {
            title: caption,
            privacy_level: 'SELF_ONLY', // or PUBLIC_TO_EVERYONE
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_url: imageUrl
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'TikTok API error');
      }

      addLogEntry('✅ Posted to TikTok successfully');
      return { success: true };
    } catch (error) {
      addLogEntry(`❌ TikTok posting failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async function postToYouTube(imageUrl, caption, token) {
    try {
      // YouTube Data API v3 - Community posts
      const response = await fetch(
        'https://www.googleapis.com/youtube/v3/activities?part=snippet',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            snippet: {
              description: caption,
              type: 'upload'
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'YouTube API error');
      }

      addLogEntry('✅ Posted to YouTube successfully');
      return { success: true };
    } catch (error) {
      addLogEntry(`❌ YouTube posting failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async function postToTwitter(imageUrl, caption, token) {
    try {
      // Twitter API v2 - Media upload + Tweet creation
      
      // Step 1: Download image
      const imageBlob = await fetch(imageUrl).then(r => r.blob());
      const imageBuffer = await imageBlob.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

      // Step 2: Upload media
      const uploadResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `media_data=${encodeURIComponent(base64Image)}`
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.errors?.[0]?.message || 'Twitter media upload error');
      }

      const mediaData = await uploadResponse.json();

      // Step 3: Create tweet with media
      const tweetResponse = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: caption,
          media: {
            media_ids: [mediaData.media_id_string]
          }
        })
      });

      if (!tweetResponse.ok) {
        const error = await tweetResponse.json();
        throw new Error(error.errors?.[0]?.message || 'Twitter post error');
      }

      addLogEntry('✅ Posted to Twitter successfully');
      return { success: true };
    } catch (error) {
      addLogEntry(`❌ Twitter posting failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  function addDownloadButton() {
    const preview = $('memePreview');
    if (!preview || !preview.parentElement) return;
    
    const existing = $('downloadMemeBtn');
    if (existing) return;
    
    const btn = document.createElement('button');
    btn.id = 'downloadMemeBtn';
    btn.textContent = 'Download Meme';
    btn.style.cssText = 'margin-top: 10px; padding: 8px 16px; background: var(--blue-gradient); color: white; border: none; border-radius: 8px; cursor: pointer;';
    
    btn.addEventListener('click', async () => {
      if (!preview.src || preview.src.includes('svg')) return;
      
      try {
        const response = await fetch(preview.src);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `meme_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addLogEntry('Meme downloaded');
      } catch (error) {
        addLogEntry(`Download failed: ${error.message}`);
      }
    });
    
    preview.parentElement.appendChild(btn);
  }

  // UI BINDING
  function bindUi() {
    console.log('Binding UI event handlers...');
    
    // Core buttons
    const buttonBindings = {
      'saveConfigBtn': handleSaveConfig,

      'postNowBtn': handlePostNow,
      'bulkGenerateBtn': openBulkModal,
      'closeBulkModal': closeBulkModal,
      'startBulkGeneration': startBulkGeneration,
      'darkModeToggle': handleDarkModeToggle
    };

    // Bind each button and log result
    Object.entries(buttonBindings).forEach(([id, handler]) => {
      const element = $(id);
      if (element) {
        element.addEventListener('click', handler);
        console.log(`Bound handler to ${id}`);
      } else {
        console.warn(`Element not found: ${id}`);
      }
    });
    $('downloadBulkZip')?.addEventListener('click', downloadBulkZip);
    $('downloadBulkCSV')?.addEventListener('click', downloadBulkCSV);

    $('bulkTemplateStrategy')?.addEventListener('change', handleBulkTemplateStrategyChange);
    $('bulkTextMode')?.addEventListener('change', handleBulkTextModeChange);
    $('bulkHashtagMode')?.addEventListener('change', handleBulkHashtagModeChange);

    // FIXED: Single, clean schedulePostBtn handler
    $('schedulePostBtn')?.addEventListener('click', async (e) => {
      clearError();
      e.preventDefault();
      
      const dt = $('scheduleDateTime')?.value;
      if (!dt) {
        displayValidationError({ message: 'Schedule date/time is required' }, 'scheduled post');
        return;
      }
      
      const form = $('settingsForm');
      const post = {
        createdAt: new Date().toISOString(),
        scheduleTime: dt,
        status: 'scheduled',
        recurrence: $('recurrenceSelect')?.value || 'none',
        timezone: $('timezoneSelect')?.value || 'UTC',
        source: {}
      };
      
      if (form) {
        const inputs = form.querySelectorAll('input,select,textarea');
        inputs.forEach((el) => {
          if (!el.id) return;
          if (el.type === 'checkbox') post.source[el.id] = el.checked;
          else post.source[el.id] = el.value;
        });
      }
      
      const r = await readFileAsync(PATHS.SCHEDULED_POSTS);
      let data = r.success ? safeParse(r.content, { posts: [] }) : { posts: [] };
      
      // Handle legacy flat array format
      if (Array.isArray(data)) data = { posts: data };
      if (!data.posts || !Array.isArray(data.posts)) data = { posts: [] };
      
      data.posts.unshift(post);
      
      const w = await writeFileAsync(PATHS.SCHEDULED_POSTS, JSON.stringify(data, null, 2));
      if (w.success) {
        clearError();
        addLogEntry(`Post scheduled for ${dt}`);
        await populateScheduledPosts();
      } else {
        displayValidationError(w.error, 'scheduled post');
      }
    });

    $('darkModeToggle')?.addEventListener('change', handleDarkModeToggle);
    $('contentType')?.addEventListener('change', handleContentTypeChange);
    $('memeMode')?.addEventListener('change', handleMemeModeChange);
    $('videoMode')?.addEventListener('change', handleVideoModeChange);
    $('hashtagMode')?.addEventListener('change', handleHashtagModeChange);

    const actionBtn = $('actionBtn');
    if (actionBtn) {
      actionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleMemeActionClick();
      });
    }

    const createVarBtn = $('createVariationsBtn');
    if (createVarBtn) {
      createVarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleCreateVariationsClick();
      });
    }

    // Video generation buttons
    $('generateVideoBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      handleGenerateVideo();
    });

    $('selectMemesBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      handleSelectMemes();
    });

    $('downloadVideoBtn')?.addEventListener('click', handleDownloadVideo);
    $('addVideoToLibraryBtn')?.addEventListener('click', handleAddVideoToLibrary);

    // Meme search handler
    $('memeSearch')?.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const select = $('memeTemplate');
      if (!select) return;
      
      const filtered = allTemplates.filter(t => 
        (t.name || t.id).toLowerCase().includes(searchTerm)
      );
      
      let html = '<option value="ai-generator">🤖 AI Generator</option>';
      html += filtered.map(t => `<option value="${t.id}">${t.name || t.id}</option>`).join('');
      select.innerHTML = html;
    });

    ['memeTemplate', 'memeTopText', 'memeBottomText'].forEach(id => {
      const el = $(id);
      if (el) {
        el.addEventListener('input', updateMemePreview);
        el.addEventListener('change', updateMemePreview);
      }
    });

    $('contentType')?.dispatchEvent(new Event('change'));
    $('memeMode')?.dispatchEvent(new Event('change'));
    $('videoMode')?.dispatchEvent(new Event('change'));
    $('hashtagMode')?.dispatchEvent(new Event('change'));

    $('librarySearch')?.addEventListener('input', renderLibrary);
    $('libraryFilter')?.addEventListener('change', renderLibrary);
    // Setup OAuth button triggers
    const socialPlatforms = ['Instagram', 'TikTok', 'YouTube', 'Twitter'];
    socialPlatforms.forEach(platform => {
      const btn = $(`connect${platform}Btn`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (window.api?.startOAuth) {
            window.api.startOAuth(platform.toLowerCase());
            addLogEntry(`Started OAuth flow for ${platform}`);
          } else {
            displayValidationError({ message: 'OAuth API not available' }, platform);
          }
        });
      }
    });
  }

  // Handle OAuth callback
  if (window.api?.onOAuthToken) {
    window.api.onOAuthToken((data) => {
      if (data.token && data.provider) {
        const tokenField = $(`${data.provider}Token`);
        if (tokenField) {
          tokenField.value = data.token;
          addLogEntry(`Received OAuth token for ${data.provider}`);
          clearError();
        }
      }
    });
  }

  // INITIALIZATION
  async function init() {
    console.log('Initializing renderer...');
    
    if (!window.api) {
      console.error('window.api is not available');
      const errorContainer = $('errorContainer');
      if (errorContainer) {
        errorContainer.textContent = 'Error: IPC bridge not initialized. The app may not function correctly.';
        errorContainer.style.display = 'block';
      }
      return;
    }

    // Initialize library display and filters
    displayLibraryContent();
    const searchInput = $('librarySearch');
    const filterSelect = $('libraryFilter');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        displayLibraryContent();
      });
    }

    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        displayLibraryContent();
      });
    }

    try {
      console.log('Starting initialization sequence...');
      
      // Initialize UI first
      console.log('Binding UI elements...');
      bindUi();
      
      // Load initial data
      console.log('Loading initial data...');
      addLogEntry('AI Auto Bot initializing...');
      
      await Promise.all([
        populateTimezones(),
        populateSavedConfigs(),
        populateScheduledPosts(),
        renderLibrary()
      ]);

      // Load settings last
      console.log('Loading settings...');
      const r = await readFileAsync(PATHS.SETTINGS);

      if (r.success) {
        const obj = safeParse(r.content, {});
        const decryptedObj = await decryptSensitiveFields(obj);
        populateFormFromObject(decryptedObj);
        addLogEntry('Settings loaded successfully');
      }

      console.log('Initialization complete!');
      
      // Load settings from file
      const settingsResult = await window.api.readFile('data/settings.json');
      if (settingsResult.success) {
        const obj = safeParse(settingsResult.content, {});
        const decryptedObj = await decryptSensitiveFields(obj);
        populateFormFromObject(decryptedObj);
        addLogEntry('Loaded and decrypted settings from data/settings.json');
      } else {
        addLogEntry('No settings file loaded - starting fresh');
      }
    } catch (err) {
      console.error('Initialization error:', err);
      const errorContainer = $('errorContainer');
      if (errorContainer) {
        errorContainer.textContent = `Initialization failed: ${err.message}`;
        errorContainer.style.display = 'block';
      }
      addLogEntry(`Initialization error: ${err.message}`);
      return;
    }

    const sched = $('scheduleDateTime');
    if (sched && !sched.value) {
      sched.value = toDateTimeLocal(new Date().toISOString());
    }

    await fetchMemeTemplates();
    addDownloadButton();

    // Listen for scheduled posts from main process
    if (window.api && window.api.onScheduledPost) {
      window.api.onScheduledPost(async (post) => {
        addLogEntry(`⏰ Auto-executing scheduled post from ${post.scheduleTime}`);
        
        // Load post settings
        if (post.source) {
          const decryptedSource = await decryptSensitiveFields(post.source);
          populateFormFromObject(decryptedSource);
        }
        
        // Wait a moment for form to populate
        setTimeout(() => {
          handlePostNow();
        }, 1000);
      });
    }
	
    // Listen for tokens from main process and persist via existing helpers
	if (window.api?.onOAuthToken) {
	  window.api.onOAuthToken(async (data) => {
        const provider = data.provider; // 'instagram'|'tiktok'|'youtube'|'twitter'
        const token = data.token;
		if (!provider || !token) return;

		// Fill hidden input so the UI and post flow see it
        const input = document.getElementById(`${provider}Token`);
		if (input) input.value = token;

		// Persist token into settings using your encryptSensitiveFields/writeFileAsync helpers
        const r = await readFileAsync(PATHS.SETTINGS);
        const settings = r.success ? safeParse(r.content, {}) : {};
            settings[`${provider}Token`] = token;

        const encrypted = await encryptSensitiveFields(settings);
        const w = await writeFileAsync(PATHS.SETTINGS, JSON.stringify(encrypted, null, 2));
		if (w.success) {
		  addLogEntry(`Saved ${provider} token (encrypted)`);
		} else {
		  addLogEntry(`Failed to save ${provider} token: ${w.error?.message || 'unknown'}`);
        }
      });
  }
    addLogEntry('AI Auto Bot ready - All functions operational');
    addLogEntry('📅 Auto-scheduler is active - checking every minute');
  }

  // Ensure document is ready before initializing
  if (document.readyState === 'loading') {
    console.log('Document still loading, waiting for DOMContentLoaded...');
    window.addEventListener('DOMContentLoaded', () => {
      console.log('DOMContentLoaded fired, initializing...');
      init();
    });
  } else {
    console.log('Document already loaded, initializing immediately...');
    init();
  }

  // Log window load for debugging
  window.addEventListener('load', () => {
    console.log('Window load complete');
  });
})();