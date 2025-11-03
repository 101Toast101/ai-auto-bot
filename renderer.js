// renderer.js - Complete Frontend Logic
/* global JSZip GIF */
/* exported handleImportSettings reuseLibraryItem deleteLibraryItem handleVideoGeneration handleMemeSelection handleVideoModeChange addDownloadButton */
(function () {
  const $ = (id) => document.getElementById(id);

  let allTemplates = [];
  let bulkGeneratedContent = [];
  let selectedMemesForSlideshow = [];
  let videoBlob = null;

  // Helper functions for UI notifications and progress
  function showNotification(message, type = "info") {
    // Use modern toast if available, fallback to legacy
    if (window.Toast) {
      window.Toast.show(message, type, 5000);
      return;
    }

    // Legacy fallback
    const errorContainer = $("errorContainer");
    if (errorContainer) {
      errorContainer.textContent = message;
      errorContainer.className = `error-container ${type}`;
      errorContainer.style.display = "block";
      errorContainer.style.color =
        type === "error"
          ? "red"
          : type === "success"
            ? "green"
            : type === "warning"
              ? "orange"
              : "blue";

      // Auto-hide after 5 seconds
      setTimeout(() => {
        errorContainer.style.display = "none";
      }, 5000);
    }
  }

  // Helper to display errors consistently
  function displayError(err) {
    const message = err?.message || String(err);
    console.error(message);
    showNotification(message, "error");
  }

  function showProgress(message) {
    let overlay = $("progressOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "progressOverlay";
      overlay.className = "progress-overlay";
      overlay.innerHTML = `
        <div class="progress-content">
          <div class="progress-title"></div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: 0%"></div>
            <div class="progress-text">0%</div>
          </div>
          <div class="progress-details"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    const title = overlay.querySelector(".progress-title");
    if (title) {
      title.textContent = message;
    }

    // Reset progress bar
    const bar = overlay.querySelector(".progress-bar");
    if (bar) {
      bar.style.width = "0%";
    }

    const text = overlay.querySelector(".progress-text");
    if (text) {
      text.textContent = "0%";
    }

    overlay.classList.add("show");
  }

  function hideProgress() {
    const overlay = $("progressOverlay");
    if (overlay) {
      overlay.classList.remove("show");
    }
  }

  function updateProgress(percent, details = "") {
    const bar = document.querySelector(".progress-bar");
    if (bar) {
      bar.style.width = `${percent}%`;
    }

    const text = document.querySelector(".progress-text");
    if (text) {
      text.textContent = `${Math.round(percent)}%`;
    }

    const detailsEl = document.querySelector(".progress-details");
    if (detailsEl && details) {
      detailsEl.textContent = details;
    }
  }

  // Load meme templates
  async function loadMemeTemplates() {
    try {
      const response = await fetch("https://api.memegen.link/templates/");
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      const templates = await response.json();
      allTemplates = templates.map((t) => ({
        id: t.id,
        name: t.name,
      }));
      const select = $("bulkSingleTemplate");
      if (select) {
        select.innerHTML =
          '<option value="">Select Template</option>' +
          allTemplates
            .map((t) => `<option value="${t.id}">${t.name}</option>`)
            .join("");
        allTemplates.forEach((t) => {
          const option = document.createElement("option");
          option.value = t.id;
          option.textContent = t.name;
          select.appendChild(option);
        });
      }
    } catch (e) {
      console.error("Failed to load meme templates:", e);
      addLogEntry("Failed to load meme templates: " + e.message, "error");
    }
  }

  // Call on startup
  loadMemeTemplates();

  // Initialize video features
  async function initializeVideoFeatures() {
    // Use event delegation for dynamically created library items
    document.addEventListener("click", async function (e) {
      // Handle video conversion button
      if (e.target.closest(".convert-to-video-btn")) {
        e.preventDefault();
        const btn = e.target.closest(".convert-to-video-btn");
        const item = btn.closest(".library-item");
        if (item && item.dataset.itemId) {
          await handleVideoConversion(item.dataset.itemId);
        }
      }

      // Handle GIF conversion button
      if (e.target.closest(".convert-to-gif-btn")) {
        e.preventDefault();
        const btn = e.target.closest(".convert-to-gif-btn");
        const item = btn.closest(".library-item");
        if (item && item.dataset.itemId) {
          await handleGifConversion(item.dataset.itemId);
        }
      }

      // Handle add to slideshow button
      if (e.target.closest(".add-to-slideshow-btn")) {
        e.preventDefault();
        const btn = e.target.closest(".add-to-slideshow-btn");
        const item = btn.closest(".library-item");
        if (item && item.dataset.itemId) {
          if (selectedMemesForSlideshow.includes(item.dataset.itemId)) {
            selectedMemesForSlideshow = selectedMemesForSlideshow.filter(
              (id) => id !== item.dataset.itemId,
            );
          } else {
            selectedMemesForSlideshow.push(item.dataset.itemId);
          }
          updateSlideshowUI();
        }
      }
    });

    // Listen for video progress updates
    if (window.api && window.api.onVideoProgress) {
      window.api.onVideoProgress((progress) => {
        if (progress.progress !== undefined) {
          updateProgress(progress.progress);
        }
      });
    }
  }

  // Handle video conversion
  async function handleVideoConversion(itemId) {
    try {
      const library = await loadLibraryItem(itemId);
      if (!library || !library.url) {
        throw new Error("Invalid library item - missing URL");
      }

      // Show progress indicator
      showProgress("Converting to video...");

      const result = await window.api.generateVideo({
        imagePath: library.url,
        duration: 10,
        resolution: "1080x1080",
        fps: 30,
      });

      if (result && result.success) {
        // Update library with new video
        await updateLibraryWithVideo(itemId, result.path);
        showNotification("Video conversion complete!", "success");
      } else {
        throw new Error(result?.error || "Video conversion failed");
      }
    } catch (error) {
      console.error("Video conversion error:", error);
      showNotification("Failed to convert to video: " + error.message, "error");
    } finally {
      hideProgress();
    }
  }

  // Handle slideshow creation
  async function handleSlideshowCreation() {
    try {
      if (selectedMemesForSlideshow.length < 2) {
        showNotification(
          "Please select at least 2 images for slideshow",
          "warning",
        );
        return;
      }

      showProgress("Creating slideshow...");

      // Get the actual image paths/URLs from the selected IDs
      const libRes = await readFileAsync(PATHS.LIBRARY);
      if (!libRes.success) {
        throw new Error("Failed to load library");
      }

      const library = safeParse(libRes.content, []);
      const imagePaths = selectedMemesForSlideshow
        .map((id) => {
          const item = library.find((libItem) => libItem.id === id);
          return item ? item.url : null;
        })
        .filter((url) => url !== null);

      if (imagePaths.length < 2) {
        throw new Error("Could not find selected images");
      }

      const result = await window.api.generateSlideshow({
        imagePaths: imagePaths,
        duration: 3,
        resolution: "1080x1080",
        transition: "fade",
        fps: 30,
      });

      if (result.success) {
        // Add to library
        await addToLibrary({
          type: "video",
          url: result.path,
          caption: "Generated Slideshow",
          created: new Date().toISOString(),
        });
        showNotification("Slideshow created successfully!", "success");
      } else {
        throw new Error(result.error || "Slideshow creation failed");
      }
    } catch (error) {
      console.error("Slideshow creation error:", error);
      showNotification("Failed to create slideshow: " + error.message, "error");
    } finally {
      hideProgress();
      selectedMemesForSlideshow = [];
      updateSlideshowUI();
    }
  }

  // Handle GIF conversion
  async function handleGifConversion(itemId) {
    try {
      const library = await loadLibraryItem(itemId);
      if (!library || !library.url) {
        throw new Error("Invalid library item");
      }

      showProgress("Converting to GIF...");

      const result = await window.api.generateGif({
        imagePath: library.url,
        width: 480,
        height: 480,
        duration: 3,
        fps: 15,
      });

      if (result.success) {
        // Add to library
        await addToLibrary({
          type: "image",
          url: result.path,
          caption: "Converted GIF",
          created: new Date().toISOString(),
        });
        showNotification("GIF conversion complete!", "success");
      } else {
        throw new Error(result.error || "GIF conversion failed");
      }
    } catch (error) {
      console.error("GIF conversion error:", error);
      showNotification("Failed to convert to GIF: " + error.message, "error");
    } finally {
      hideProgress();
    }
  }

  // Helper function to load a library item by ID
  async function loadLibraryItem(itemId) {
    const libRes = await readFileAsync(PATHS.LIBRARY);
    if (!libRes.success) {
      return null;
    }

    const library = safeParse(libRes.content, []);
    return library.find((item) => item.id === itemId);
  }

  // Update the library with a new video
  async function updateLibraryWithVideo(itemId, videoUrl) {
    const libRes = await readFileAsync(PATHS.LIBRARY);
    if (!libRes.success) {
      return false;
    }

    const library = safeParse(libRes.content, []);
    const index = library.findIndex((item) => item.id === itemId);

    if (index === -1) {
      return false;
    }

    library[index] = {
      ...library[index],
      url: videoUrl,
      type: "video",
      modified: new Date().toISOString(),
    };

    await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
    await displayLibraryContent(); // Refresh display
    return true;
  }

  // Update UI to reflect selected items for slideshow
  function updateSlideshowUI() {
    document.querySelectorAll(".library-item").forEach((item) => {
      const isSelected = selectedMemesForSlideshow.includes(
        item.dataset.itemId,
      );
      item.classList.toggle("selected-for-slideshow", isSelected);
    });

    // Update the create slideshow button state
    const slideshowBtn = $("createSlideshowBtn");
    const slideshowCount = $("slideshowCount");

    if (slideshowBtn) {
      if (selectedMemesForSlideshow.length >= 2) {
        slideshowBtn.style.display = "";
        slideshowBtn.disabled = false;
      } else {
        slideshowBtn.style.display = "none";
      }
    }

    if (slideshowCount) {
      slideshowCount.textContent = selectedMemesForSlideshow.length;
    }
  }

  // IPC WRAPPERS
  async function readFileAsync(filePath) {
    try {
      if (!window.api) {
        console.error("API not available for readFileAsync");
        return { success: false, error: { message: "API not available" } };
      }
      const result = await window.api.readFile(filePath);
      console.warn(
        `Read file ${filePath}:`,
        result.success ? "success" : "failed",
      );
      return result;
    } catch (e) {
      console.error(`Error reading file ${filePath}:`, e);
      return { success: false, error: { message: e.message } };
    }
  }

  async function writeFileAsync(filePath, content) {
    try {
      if (!window.api) {
        console.error("API not available for writeFileAsync");
        return { success: false, error: { message: "API not available" } };
      }

      // If a recent RESET occurred, avoid immediately overwriting settings.json.
      // Use two protections:
      // 1) A short renderer-side timer lock (settingsWriteLockUntil) to delay very-quick writes.
      // 2) A reset marker file created by main at data/.recent_reset. If present, wait until it's removed.
      if (filePath === PATHS.SETTINGS) {
        if (typeof settingsWriteLockUntil !== "undefined") {
          const now = Date.now();
          if (now < settingsWriteLockUntil) {
            const waitMs = settingsWriteLockUntil - now;
            await new Promise((res) => setTimeout(res, waitMs));
          }
        }

        // Check for reset marker file and wait until main removes it
        try {
          let tries = 0;
          while (tries < 20) {
            // small wait between checks
            const marker = await window.api.readFile("data/.recent_reset");
            if (!marker || !marker.success) {break;} // not present
            // if present, wait a bit and retry
            const waitMs = 250;
            await new Promise((res) => setTimeout(res, waitMs));
            tries += 1;
          }
        } catch {
          // fallback - if something goes wrong just proceed
        }
      }

      const result = await window.api.writeFile(filePath, content);
      return result;
    } catch (e) {
      console.error(`Error writing file ${filePath}:`, e);
      return { success: false, error: { message: e.message } };
    }
  }

  // IPC Channel constants (must match main process)
  // Legacy IPC channel constants kept for reference (not used directly in renderer)

  // File paths
  const PATHS = {
    SETTINGS: "data/settings.json",
    SAVED_CONFIGS: "data/savedConfigs.json",
    SCHEDULED_POSTS: "data/scheduledPosts.json",
    ACTIVITY_LOG: "data/activity_log.json",
    LIBRARY: "data/library.json",
  };

  // Sensitive fields that should be encrypted
  const SENSITIVE_FIELDS = [
    "apiKey", // Legacy - keep for backwards compatibility
    "openaiApiKey",
    "runwayApiKey",
    "instagramToken",
    "tiktokToken",
    "youtubeToken",
    "twitterToken",
  ];

  // Lock window writes to settings for a short time after a reset to avoid races
  let settingsWriteLockUntil = 0;

  // Encrypt sensitive fields in an object
  async function encryptSensitiveFields(obj) {
    const encrypted = { ...obj };
    for (const field of SENSITIVE_FIELDS) {
      if (encrypted[field] && typeof encrypted[field] === "string") {
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
      if (decrypted[field] && typeof decrypted[field] === "string") {
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
      addLogEntry("Failed to load content library", "error");
      return;
    }

    let library = safeParse(libRes.content, []);
    const container = $("libraryGrid");
    const searchInput = $("librarySearch");
    const filterSelect = $("libraryFilter");

    if (!container) {
      console.error("Library grid container not found");
      return;
    }

    // Apply search if any
    if (searchInput && searchInput.value.trim()) {
      const searchVal = searchInput.value.trim().toLowerCase();
      library = library.filter(
        (item) =>
          (item.caption || "").toLowerCase().includes(searchVal) ||
          (item.hashtags || "").toLowerCase().includes(searchVal) ||
          (item.type || "").toLowerCase().includes(searchVal),
      );
    }

    // Apply filter if any
    if (filterSelect && filterSelect.value !== "all") {
      const filterVal = filterSelect.value;
      library = library.filter(
        (item) =>
          filterVal === item.type ||
          (filterVal === "posted" && item.posted) ||
          (filterVal === "draft" && !item.posted),
      );
    }

    // Clear existing content
    container.innerHTML = "";

    if (library.length === 0) {
      container.innerHTML =
        '<p style="text-align: center; color: #718096; padding: 40px;">No content yet</p>';
      return;
    }

    // Add each library item
    library.forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "library-item";
      itemDiv.dataset.itemId = item.id;

      // Add click handler to select/deselect for scheduling
      itemDiv.addEventListener("click", (e) => {
        // Don't select if clicking a button
        if (e.target.tagName === "BUTTON" || e.target.closest("button")) {
          return;
        }

        const isCurrentlySelected = itemDiv.classList.contains(
          "selected-for-scheduling",
        );

        if (isCurrentlySelected) {
          // Deselect if clicking the same card again
          itemDiv.classList.remove("selected-for-scheduling");
          window.selectedContentForScheduling = null;

          // Hide preview
          const preview = $("selectedContentPreview");
          if (preview) {
            preview.style.display = "none";
          }

          addLogEntry(`❌ Deselected content`, "info");
        } else {
          // Select new card
          document
            .querySelectorAll(".library-item")
            .forEach((el) => el.classList.remove("selected-for-scheduling"));
          itemDiv.classList.add("selected-for-scheduling");

          // Store selected content ID globally
          window.selectedContentForScheduling = item.id;

          // Show preview in scheduling section
          const preview = $("selectedContentPreview");
          const previewImg = $("selectedContentImg");
          const previewInfo = $("selectedContentInfo");

          if (preview && previewImg && previewInfo) {
            preview.style.display = "block";
            previewImg.src = item.url;
            previewInfo.textContent = `${item.type.toUpperCase()} • Created ${new Date(item.createdAt).toLocaleString()}`;
          }

          addLogEntry(
            `📌 Selected content for scheduling: ${item.type}`,
            "success",
          );
        }
      }); // REMOVED inline styles to let CSS handle dark mode
      // itemDiv.style.cssText = 'border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: var(--glass-bg);';

      // Media preview
      const mediaContainer = document.createElement("div");
      mediaContainer.style.cssText =
        "width: 100%; height: 150px; display: flex; align-items: center; justify-content: center; background: #000; position: relative;";

      if (item.url) {
        if (item.type === "video" || item.contentType === "video") {
          const video = document.createElement("video");
          video.src = item.url;
          video.style.cssText =
            "max-width: 100%; max-height: 100%; object-fit: contain;";
          video.controls = true;
          video.preload = "metadata";
          video.muted = true; // Auto-play requires muted

          // Add play icon overlay
          const playIcon = document.createElement("div");
          playIcon.innerHTML = "▶";
          playIcon.style.cssText =
            "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 48px; color: white; opacity: 0.8; pointer-events: none;";
          mediaContainer.appendChild(playIcon);

          // Remove play icon when video is playing
          video.addEventListener(
            "play",
            () => (playIcon.style.display = "none"),
          );
          video.addEventListener(
            "pause",
            () => (playIcon.style.display = "block"),
          );

          // Handle video load errors
          video.addEventListener("error", (e) => {
            console.error("Video load error:", e, "URL:", item.url);
            // Show fallback
            const errorText = document.createElement("div");
            errorText.textContent = "📹 Video";
            errorText.style.cssText =
              "color: white; font-size: 16px; text-align: center;";
            mediaContainer.innerHTML = "";
            mediaContainer.appendChild(errorText);
          });

          mediaContainer.appendChild(video);
        } else {
          const img = document.createElement("img");
          img.src = item.url;
          img.style.cssText =
            "max-width: 100%; max-height: 100%; object-fit: contain;";
          img.onerror = () => {
            img.src =
              "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzQ4NWU2OCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE2IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4=";
          };
          mediaContainer.appendChild(img);
        }
      }

      itemDiv.appendChild(mediaContainer);

      // Add video control buttons
      const controlsDiv = document.createElement("div");
      controlsDiv.className = "video-controls";

      // Convert to Video button
      if (item.type === "image") {
        const videoBtn = document.createElement("button");
        videoBtn.className = "toolbar-btn convert-to-video-btn";
        videoBtn.title = "Convert to Video";
        videoBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"/>
            <path d="M10 8l6 4-6 4V8z" fill="currentColor"/>
          </svg>
        `;
        controlsDiv.appendChild(videoBtn);
      }

      // Convert to GIF button
      if (item.type === "video") {
        const gifBtn = document.createElement("button");
        gifBtn.className = "toolbar-btn convert-to-gif-btn";
        gifBtn.title = "Convert to GIF";
        gifBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
            <text x="6" y="16" font-size="10" fill="currentColor">GIF</text>
          </svg>
        `;
        controlsDiv.appendChild(gifBtn);
      }

      // Add to Slideshow button
      if (item.type === "image") {
        const slideshowBtn = document.createElement("button");
        slideshowBtn.className = "toolbar-btn add-to-slideshow-btn";
        slideshowBtn.title = "Add to Slideshow";
        slideshowBtn.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="4" y="4" width="12" height="12" stroke-width="2"/>
            <rect x="8" y="8" width="12" height="12" stroke-width="2"/>
          </svg>
        `;
        controlsDiv.appendChild(slideshowBtn);
      }

      itemDiv.appendChild(controlsDiv);

      // Info section - increased bottom padding for buttons
      const info = document.createElement("div");
      info.style.cssText = "padding: 12px 12px 16px 12px;";

      // Type badge
      const typeBadge = document.createElement("span");
      typeBadge.textContent = item.type.toUpperCase();
      typeBadge.style.cssText =
        "display: inline-block; padding: 4px 8px; background: #4a5568; color: white; border-radius: 4px; font-size: 0.8em; margin-bottom: 8px;";
      info.appendChild(typeBadge);

      // Creation date
      const date = document.createElement("p");
      date.textContent = new Date(item.createdAt).toLocaleString();
      date.style.cssText = "color: #718096; font-size: 0.9em; margin: 4px 0;";
      info.appendChild(date);

      // Hashtags if any
      if (item.hashtags) {
        const hashtags = document.createElement("p");
        hashtags.textContent = item.hashtags;
        hashtags.style.cssText =
          "color: #4299e1; font-size: 0.9em; margin: 4px 0; word-break: break-word;";
        info.appendChild(hashtags);
      }

      // Action buttons - made more visible and compact
      const actions = document.createElement("div");
      actions.style.cssText =
        "display: flex; gap: 6px; margin-top: 10px; width: 100%;";

      // Reuse button - loads content back into main form
      const reuseBtn = document.createElement("button");
      reuseBtn.textContent = "Reuse";
      reuseBtn.style.cssText =
        "flex: 1; min-width: 60px; padding: 8px 4px; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap;";
      reuseBtn.onclick = () => reuseFromLibrary(item.id);

      const scheduleBtn = document.createElement("button");
      scheduleBtn.textContent = "Schedule";
      scheduleBtn.style.cssText =
        "flex: 1; min-width: 60px; padding: 8px 4px; background: #48bb78; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap;";
      scheduleBtn.onclick = () => schedulePost(item.id);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.style.cssText =
        "flex: 1; min-width: 60px; padding: 8px 4px; background: #e53e3e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap;";
      deleteBtn.onclick = () => deleteFromLibrary(item.id);

      actions.appendChild(reuseBtn);
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
        throw new Error("Content must have a URL and type");
      }

      // Set required fields
      const libraryItem = {
        ...item,
        id:
          "content_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substr(2, 9),
        createdAt: item.createdAt || new Date().toISOString(),
      };

      // Load existing library
      const libRes = await readFileAsync(PATHS.LIBRARY);
      const library = libRes.success ? safeParse(libRes.content, []) : [];

      // Add new item
      library.unshift(libraryItem); // Add to start of array

      // Save back to file
      const result = await writeFileAsync(
        PATHS.LIBRARY,
        JSON.stringify(library, null, 2),
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to save to library");
      }

      // Update display
      await displayLibraryContent();
      addLogEntry("Content added to library", "success");

      return libraryItem;
    } catch (e) {
      addLogEntry("Failed to add to library: " + e.message, "error");
      throw e;
    }
  }

  // Delete an item from the library
  async function deleteFromLibrary(itemId) {
    try {
      const libRes = await readFileAsync(PATHS.LIBRARY);
      if (!libRes.success) {
        throw new Error("Failed to load library");
      }

      const library = safeParse(libRes.content, []);
      const index = library.findIndex((item) => item.id === itemId);

      if (index === -1) {
        throw new Error("Item not found in library");
      }

      library.splice(index, 1);
      const result = await writeFileAsync(
        PATHS.LIBRARY,
        JSON.stringify(library, null, 2),
      );

      if (result.success) {
        addLogEntry("Item deleted from library", "success");
        await displayLibraryContent(); // Refresh display
      } else {
        throw new Error(result.error?.message || "Failed to save library");
      }
    } catch (e) {
      addLogEntry("Failed to delete item: " + e.message, "error");
    }
  }

  // Schedule a post from library
  async function schedulePost(contentId) {
    try {
      // STEP 1: Load the content from library
      const libRes = await readFileAsync(PATHS.LIBRARY);
      if (!libRes.success) {
        throw new Error("Failed to load library");
      }
      const library = safeParse(libRes.content, []);
      const content = library.find((item) => item.id === contentId);
      if (!content) {
        throw new Error("Content not found in library");
      }

      // STEP 2: Validate scheduling parameters
      const scheduleDateTime = $("scheduleDateTime")?.value;
      if (!scheduleDateTime) {
        addLogEntry(
          "⚠️ Please set a schedule date/time in the Scheduling section",
          "warning",
        );
        $("scheduleDateTime")?.focus();
        return;
      }

      // Check if scheduled time is in the future
      const scheduledTime = new Date(scheduleDateTime);
      if (scheduledTime <= new Date()) {
        addLogEntry("⚠️ Schedule time must be in the future", "warning");
        $("scheduleDateTime")?.focus();
        return;
      }

      // STEP 3: Validate platform selection
      const selectedPlatforms = [];
      if ($("instagram")?.checked) {
        selectedPlatforms.push("instagram");
      }
      if ($("tiktok")?.checked) {
        selectedPlatforms.push("tiktok");
      }
      if ($("youtube")?.checked) {
        selectedPlatforms.push("youtube");
      }
      if ($("twitter")?.checked) {
        selectedPlatforms.push("twitter");
      }

      if (selectedPlatforms.length === 0) {
        addLogEntry(
          "⚠️ Please select at least one platform in the Platforms section",
          "warning",
        );
        return;
      }

      // STEP 4: Load settings to check for social media tokens and API keys
      const settingsRes = await readFileAsync(PATHS.SETTINGS);
      let settings = settingsRes.success
        ? safeParse(settingsRes.content, {})
        : {};
      settings = await decryptSensitiveFields(settings);

      // Check social media authentication for selected platforms (using decrypted tokens)
      const missingAuth = [];
      const warningMessages = [];

      if (selectedPlatforms.includes("instagram") && !settings.instagramToken) {
        missingAuth.push("Instagram");
      }
      if (selectedPlatforms.includes("tiktok") && !settings.tiktokToken) {
        missingAuth.push("TikTok");
      }
      if (selectedPlatforms.includes("youtube") && !settings.youtubeToken) {
        missingAuth.push("YouTube");
      }
      if (selectedPlatforms.includes("twitter") && !settings.twitterToken) {
        missingAuth.push("Twitter");
      }

      if (missingAuth.length > 0) {
        addLogEntry(
          `⚠️ Missing social media authentication for: ${missingAuth.join(", ")}. Please connect in the Platforms section.`,
          "warning",
        );
        warningMessages.push(`Social media: ${missingAuth.join(", ")}`);
      }

      // STEP 5: Check AI provider API keys (if content was AI-generated)
      if (
        content.metadata?.generatedBy?.includes("ai") ||
        content.metadata?.provider
      ) {
        const aiProvider = content.metadata?.provider || "openai";

        if (aiProvider === "openai" && !settings.apiKey) {
          addLogEntry(
            "⚠️ Missing OpenAI API key. Please set in AI Provider section.",
            "warning",
          );
          warningMessages.push("AI Provider: OpenAI");
        }

        if (aiProvider === "runway" && !settings.runwayApiKey) {
          addLogEntry(
            "⚠️ Missing Runway ML API key. Please set in AI Provider section.",
            "warning",
          );
          warningMessages.push("AI Provider: Runway ML");
        }
      }

      // STEP 6: Show summary of missing requirements
      if (warningMessages.length > 0) {
        const continueAnyway = confirm(
          `⚠️ Missing required credentials:\n\n${warningMessages.join("\n")}\n\n` +
            `The post will be scheduled, but may fail when attempting to post.\n\n` +
            `Do you want to schedule anyway?`,
        );

        if (!continueAnyway) {
          addLogEntry(
            "❌ Scheduling cancelled. Please set up credentials first.",
            "warning",
          );
          return;
        }
      }

      // STEP 7: All validations passed (or user chose to continue) - create the post
      const id =
        "post_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

      const post = {
        id,
        contentId: contentId,
        content: content.url,
        caption: content.caption || "",
        hashtags: content.hashtags || "",
        type: content.type,
        scheduleTime: scheduledTime.toISOString(),
        platforms: selectedPlatforms,
        recurrence: $("recurrenceSelect")?.value || "none",
        createdAt: new Date().toISOString(),
        status: "pending",
        posted: false,
        metadata: {
          ...content.metadata,
          validationWarnings:
            warningMessages.length > 0 ? warningMessages : undefined,
        },
      };

      // STEP 8: Save scheduled post
      const scheduledRes = await readFileAsync(PATHS.SCHEDULED_POSTS);
      const scheduled = scheduledRes.success
        ? safeParse(scheduledRes.content, { posts: [] })
        : { posts: [] };

      scheduled.posts.push(post);

      const result = await writeFileAsync(
        PATHS.SCHEDULED_POSTS,
        JSON.stringify(scheduled, null, 2),
      );
      if (result.success) {
        addLogEntry(
          `✅ Post scheduled for ${scheduledTime.toLocaleString()} on ${selectedPlatforms.join(", ")}` +
            (warningMessages.length > 0 ? " (with warnings)" : ""),
          "success",
        );
        await populateScheduledPosts();
      } else {
        throw new Error(
          result.error?.message || "Failed to save scheduled post",
        );
      }
    } catch (e) {
      console.error("Schedule post error:", e);
      addLogEntry("❌ Failed to schedule post: " + e.message, "error");
    }
  }

  // Reuse content from library - loads it back into the main form
  async function reuseFromLibrary(contentId) {
    try {
      const libRes = await readFileAsync(PATHS.LIBRARY);
      if (!libRes.success) {
        throw new Error("Failed to load library");
      }

      const library = safeParse(libRes.content, []);
      const item = library.find((i) => i.id === contentId);

      if (!item) {
        throw new Error("Content not found in library");
      }

      // Load based on content type
      if (item.type === "meme" && item.metadata) {
        // Switch to meme mode
        $("contentType").value = "meme";
        $("contentType").dispatchEvent(new Event("change"));

        // Set meme fields if available
        if (item.metadata.template) {
          $("memeMode").value = "template";
          $("memeMode").dispatchEvent(new Event("change"));
          $("memeTemplate").value = item.metadata.template;
        }
        if (item.metadata.topText) {
          $("memeTopText").value = item.metadata.topText;
        }
        if (item.metadata.bottomText) {
          $("memeBottomText").value = item.metadata.bottomText;
        }

        // Update preview
        updateMemePreview();
      } else if (item.type === "video") {
        // Switch to video mode
        $("contentType").value = "video";
        $("contentType").dispatchEvent(new Event("change"));
      }

      // Load caption and hashtags
      if (item.caption) {
        // Caption field doesn't exist in current UI, but hashtags do
        console.warn("Caption:", item.caption);
      }
      if (item.hashtags) {
        $("hashtags").value = item.hashtags;
      }

      // Parse and select platforms
      if (item.platform) {
        const platforms = item.platform
          .toLowerCase()
          .split(",")
          .map((p) => p.trim());
        $("postInstagram").checked = platforms.includes("instagram");
        $("postTikTok").checked = platforms.includes("tiktok");
        $("postYouTube").checked = platforms.includes("youtube");
        $("postTwitter").checked = platforms.includes("twitter");
      }

      addLogEntry(`✅ Loaded content from library: ${item.type}`, "success");
    } catch (e) {
      console.error("Reuse from library error:", e);
      addLogEntry("Failed to reuse content: " + e.message, "error");
    }
  }

  // UTILITIES
  // PHASE 3: ERROR HANDLING
  function displayValidationError(error, context) {
    const errorContainer = $("errorContainer");
    if (!errorContainer) {
      return;
    }

    let message = `Failed to save ${context}`;
    if (error && error.message) {
      if (error.message.includes("Validation failed") && error.details) {
        message += `:\n\nValidation Error:\n${error.details}`;
      } else {
        message += `: ${error.message}`;
      }
    }
    errorContainer.textContent = message;
    errorContainer.style.display = "block";
    addLogEntry(`${context} save failed: ${error?.message || "unknown"}`);
  }

  function clearError() {
    const errorContainer = $("errorContainer");
    if (errorContainer) {
      errorContainer.textContent = "";
      errorContainer.style.display = "none";
    }
  }

  function addLogEntry(text) {
    const container = $("logContainer");
    if (container) {
      const entry = document.createElement("div");
      entry.className = "log-entry";
      entry.textContent = `${new Date().toISOString()} — ${text}`;
      container.prepend(entry);
    }

    (async () => {
      const r = await readFileAsync(PATHS.ACTIVITY_LOG);
      let data = r.success ? safeParse(r.content, { logs: [] }) : { logs: [] };
      if (Array.isArray(data)) {
        data = { logs: data };
      }
      data.logs.unshift({ ts: new Date().toISOString(), text });
      await writeFileAsync(PATHS.ACTIVITY_LOG, JSON.stringify(data, null, 2));
    })();
  }

  function safeParse(content, fallback) {
    try {
      return JSON.parse(content);
    } catch {
      return fallback;
    }
  }

  function toDateTimeLocal(iso) {
    if (!iso) {
      return "";
    }
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      return "";
    }
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, "0");
    const D = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${Y}-${M}-${D}T${h}:${m}`;
  }

  function dedupeSavedConfigs(arr = []) {
    const seen = new Map();
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      const key = it?.createdAt
        ? String(it.createdAt)
        : it?.name
          ? `name:${String(it.name)}`
          : JSON.stringify(it);
      if (!seen.has(key)) {
        seen.set(key, it);
      }
    }
    return Array.from(seen.values()).reverse();
  }

  function dedupeScheduledPosts(arr = []) {
    const seen = new Set();
    const out = [];
    for (const it of arr) {
      const key = [
        it.createdAt,
        it.scheduleTime,
        JSON.stringify(it.source),
      ].join("|");
      if (!seen.has(key)) {
        seen.add(key);
        out.push(it);
      }
    }
    return out;
  }

  function formatMemeText(text) {
    return encodeURIComponent((text || "").trim() || "_").replace(/%20/g, "_");
  }

  // LOADING SPINNER
  function showSpinner(message = "Loading...") {
    hideSpinner(); // Remove any existing spinner
    const spinner = document.createElement("div");
    spinner.id = "globalSpinner";
    spinner.className = "spinner-overlay";
    spinner.innerHTML = `
      <div class="spinner-content">
        <div class="spinner"></div>
        <div class="spinner-text">${message}</div>
      </div>
    `;
    document.body.appendChild(spinner);
  }

  function hideSpinner() {
    const spinner = document.getElementById("globalSpinner");
    if (spinner) {
      spinner.remove();
    }
  }

  function updateSpinnerMessage(message) {
    const spinnerText = document.querySelector(".spinner-text");
    if (spinnerText) {
      spinnerText.textContent = message;
    }
  }

  // BULK GENERATION
  function openBulkModal() {
    $("bulkModal").style.display = "block";
    $("bulkProgress").style.display = "none";
    $("bulkComplete").style.display = "none";
    bulkGeneratedContent = [];
    addLogEntry("Opened bulk generation modal");
  }

  function closeBulkModal() {
    $("bulkModal").style.display = "none";
  }

  function handleBulkContentTypeChange() {
    const contentType = $("bulkContentType")?.value;
    const isVideo = contentType === "video";

    // Show/hide video-specific options
    const videoModeLabel = $("bulkVideoModeLabel");
    const videoDurationLabel = $("bulkVideoDurationLabel");
    if (videoModeLabel) {
      videoModeLabel.style.display = isVideo ? "" : "none";
    }
    if (videoDurationLabel) {
      videoDurationLabel.style.display = isVideo ? "" : "none";
    }

    // Keep template and text mode visible for meme-to-video mode
    // Only show/hide based on video mode selection
    if (!isVideo) {
      // Meme mode - show all meme options
      const templateStrategyLabel = $("bulkTemplateStrategyLabel");
      const textModeLabel = $("bulkTextModeLabel");
      if (templateStrategyLabel) {
        templateStrategyLabel.style.display = "";
      }
      if (textModeLabel) {
        textModeLabel.style.display = "";
      }
      handleBulkTemplateStrategyChange();
      handleBulkTextModeChange();
    }
    // For video mode, we still need template/text options for meme-to-video
    // So we DON'T hide them anymore
  }

  function handleBulkTemplateStrategyChange() {
    const strategy = $("bulkTemplateStrategy")?.value;
    const singleLabel = $("bulkSingleTemplateLabel");
    if (singleLabel) {
      singleLabel.style.display = strategy === "single" ? "" : "none";
    }
  }

  function handleBulkTextModeChange() {
    const mode = $("bulkTextMode")?.value;
    const aiLabel = $("bulkAiPromptLabel");
    const manualLabel = $("bulkManualTextLabel");

    if (aiLabel) {
      aiLabel.style.display = mode === "ai" ? "" : "none";
    }
    if (manualLabel) {
      manualLabel.style.display = mode === "manual" ? "" : "none";
    }
  }

  function handleBulkHashtagModeChange() {
    const mode = $("bulkHashtagMode")?.value;
    const manualLabel = $("bulkManualHashtagsLabel");
    if (manualLabel) {
      manualLabel.style.display = mode === "manual" ? "" : "none";
    }
  }

  async function startBulkGeneration() {
    try {
      const contentType = $("bulkContentType")?.value || "meme";

      // Route to appropriate generator based on content type
      if (contentType === "video") {
        await startBulkVideoGeneration();
      } else {
        await startBulkMemeGeneration();
      }
    } catch (error) {
      hideSpinner();
      $("bulkProgressText").textContent = `Error: ${error.message}`;
      addLogEntry(`Bulk generation failed: ${error.message}`);
    }
  }

  async function startBulkMemeGeneration() {
    try {
      const quantity = parseInt($("bulkQuantity")?.value || "10");
      const textMode = $("bulkTextMode")?.value || "manual";

      bulkGeneratedContent = [];
      $("bulkProgress").style.display = "block";
      $("bulkComplete").style.display = "none";
      $("bulkPreviewGrid").innerHTML = "";
      $("bulkProgressBar").style.width = "0%";

      showSpinner("Generating text variations...");
      const textVariations = await generateBulkTextVariations(
        quantity,
        textMode,
      );
      hideSpinner();

      const platforms = [];
      if ($("bulkInstagram")?.checked) {
        platforms.push({ name: "instagram", width: 1080, height: 1080 });
      }
      if ($("bulkTikTok")?.checked) {
        platforms.push({ name: "tiktok", width: 1080, height: 1920 });
      }
      if ($("bulkYouTube")?.checked) {
        platforms.push({ name: "youtube", width: 1280, height: 720 });
      }
      if ($("bulkTwitter")?.checked) {
        platforms.push({ name: "twitter", width: 1200, height: 675 });
      }

      if (platforms.length === 0) {
        platforms.push({ name: "instagram", width: 1080, height: 1080 });
      }

      const strategy = $("bulkTemplateStrategy")?.value || "random";
      let templateToUse = null;
      if (strategy === "single") {
        templateToUse = $("bulkSingleTemplate")?.value || "tenguy";
      }

      for (let i = 0; i < quantity; i++) {
        const variation = textVariations[i];
        const template =
          templateToUse ||
          allTemplates[Math.floor(Math.random() * allTemplates.length)]?.id ||
          "tenguy";

        for (const dims of platforms) {
          const memeUrl = `https://api.memegen.link/images/${template}/${formatMemeText(variation.top)}/${formatMemeText(variation.bottom)}.png`;

          await addToLibrary({
            url: memeUrl,
            type: "meme",
            platform: dims.name,
            caption: `${variation.top} ${variation.bottom}`,
            hashtags:
              $("bulkHashtagMode")?.value === "manual"
                ? $("bulkManualHashtags")?.value || ""
                : "#meme #funny #viral",
            metadata: {
              dimensions: dims,
              template,
              variation,
            },
            contentType: "meme",
            status: "draft",
          });

          const preview = document.createElement("div");
          preview.style.cssText =
            "border: 2px solid #4299e1; border-radius: 8px; overflow: hidden; background: var(--card-bg, #ffffff);";
          preview.innerHTML = `
            <img src="${memeUrl}" style="width: 100%; height: 120px; object-fit: cover;" />
            <div style="padding: 5px; font-size: 11px; background: var(--card-bg, #f7fafc); color: var(--text-color, #000);">
              ${dims.name}
            </div>
          `;
          $("bulkPreviewGrid").appendChild(preview);
        }

        const progress = ((i + 1) / quantity) * 100;
        $("bulkProgressBar").style.width = `${progress}%`;
        $("bulkProgressText").textContent =
          `Generated ${i + 1}/${quantity} (${bulkGeneratedContent.length} total files)`;

        // Also update global progress overlay if shown
        updateProgress(progress, `Generated ${i + 1}/${quantity} items`);

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      $("bulkProgressText").textContent =
        `Complete! Generated ${bulkGeneratedContent.length} images`;
      $("bulkComplete").style.display = "block";

      // Track bulk image generation if using AI
      if (textMode === 'ai') {
        const aiGeneratedCount = bulkGeneratedContent.length;
        const stats = getCostStats();
        stats.imagesGenerated = (stats.imagesGenerated || 0) + aiGeneratedCount;
        saveCostStats(stats);
        addLogEntry(`💰 Cost tracker updated: +${aiGeneratedCount} images ($${(aiGeneratedCount * 0.04).toFixed(2)})`);
      }

      const libRes = await readFileAsync(PATHS.LIBRARY);
      let library = libRes.success ? safeParse(libRes.content, []) : [];
      library = bulkGeneratedContent.concat(library);
      await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
      await displayLibraryContent();

      addLogEntry(`Bulk generated ${bulkGeneratedContent.length} memes`);
    } catch (error) {
      hideSpinner();
      $("bulkProgressText").textContent = `Error: ${error.message}`;
      addLogEntry(`Bulk meme generation failed: ${error.message}`);
      throw error;
    }
  }

  async function startBulkVideoGeneration() {
    try {
      const quantity = parseInt($("bulkQuantity")?.value || "10");
      const videoMode = $("bulkVideoMode")?.value || "meme-to-video";
      const duration = parseInt($("bulkVideoDuration")?.value || "10");
      const textMode = $("bulkTextMode")?.value || "manual";

      // Validation
      if (quantity < 1 || quantity > 100) {
        throw new Error("Quantity must be between 1 and 100");
      }
      if (duration < 3 || duration > 30) {
        throw new Error("Duration must be between 3 and 30 seconds");
      }

      console.warn(
        `[Bulk Video] Starting generation: ${quantity} videos, ${duration}s each, mode: ${videoMode}`,
      );

      bulkGeneratedContent = [];
      $("bulkProgress").style.display = "block";
      $("bulkComplete").style.display = "none";
      $("bulkPreviewGrid").innerHTML = "";
      $("bulkProgressBar").style.width = "0%";

      const platforms = [];
      if ($("bulkInstagram")?.checked) {
        platforms.push({ name: "instagram", width: 1080, height: 1080 });
      }
      if ($("bulkTikTok")?.checked) {
        platforms.push({ name: "tiktok", width: 1080, height: 1920 });
      }
      if ($("bulkYouTube")?.checked) {
        platforms.push({ name: "youtube", width: 1280, height: 720 });
      }
      if ($("bulkTwitter")?.checked) {
        platforms.push({ name: "twitter", width: 1200, height: 675 });
      }

      if (platforms.length === 0) {
        platforms.push({ name: "instagram", width: 1080, height: 1080 });
      }

      if (videoMode === "text-to-video") {
        // AI text-to-video generation using OpenAI/Runway
        await generateBulkAIVideos(quantity, platforms, duration, textMode);
      } else {
        // Mode: meme-to-video - Generate memes first, then convert to videos
        showSpinner("Generating meme variations...");
        const textVariations = await generateBulkTextVariations(
          quantity,
          textMode,
        );
        hideSpinner();

        const strategy = $("bulkTemplateStrategy")?.value || "random";
        let templateToUse = null;
        if (strategy === "single") {
          templateToUse = $("bulkSingleTemplate")?.value || "tenguy";
        }

        for (let i = 0; i < quantity; i++) {
          const variation = textVariations[i];
          const template =
            templateToUse ||
            allTemplates[Math.floor(Math.random() * allTemplates.length)]?.id ||
            "tenguy";

          for (const dims of platforms) {
            const memeUrl = `https://api.memegen.link/images/${template}/${formatMemeText(variation.top)}/${formatMemeText(variation.bottom)}.png`;

            showSpinner(
              `Converting to video ${i * platforms.length + platforms.indexOf(dims) + 1}/${quantity * platforms.length}...`,
            );

            try {
              // Convert meme to video using the correct IPC handler
              console.warn(`[Bulk Video] Calling generateVideo API...`);
              const videoResult = await window.api.generateVideo({
                imagePath: memeUrl, // Correct parameter name
                duration: duration,
                resolution: `${dims.width}x${dims.height}`,
                fps: 30,
              });

              console.warn(`[Bulk Video] Video result:`, videoResult);

              if (videoResult.success) {
                // Format path correctly for file:// protocol (Windows compatibility)
                const videoPath = videoResult.path.replace(/\\/g, "/");
                const videoUrl = videoPath.startsWith("/")
                  ? `file://${videoPath}`
                  : `file:///${videoPath}`;

                await addToLibrary({
                  url: videoUrl,
                  type: "video",
                  platform: dims.name,
                  caption: `${variation.top} ${variation.bottom}`,
                  hashtags:
                    $("bulkHashtagMode")?.value === "manual"
                      ? $("bulkManualHashtags")?.value || ""
                      : "#video #meme #viral",
                  metadata: {
                    dimensions: dims,
                    template,
                    variation,
                    duration,
                    originalMemeUrl: memeUrl,
                    videoPath: videoResult.path,
                  },
                  contentType: "video",
                  status: "draft",
                });

                const preview = document.createElement("div");
                preview.style.cssText =
                  "border: 2px solid #9f7aea; border-radius: 8px; overflow: hidden; background: var(--card-bg, #ffffff);";
                preview.innerHTML = `
                  <video src="${videoUrl}" style="width: 100%; height: 120px; object-fit: cover;" muted></video>
                  <div style="padding: 5px; font-size: 11px; background: var(--card-bg, #f7fafc); color: var(--text-color, #000);">
                    📹 ${dims.name} (${duration}s)
                  </div>
                `;
                $("bulkPreviewGrid").appendChild(preview);
              } else {
                throw new Error(videoResult.error || "Video generation failed");
              }
            } catch (videoError) {
              console.error("Video conversion error:", videoError);
              addLogEntry(
                `Failed to convert video ${i + 1}: ${videoError.message}`,
              );
              // Continue with next video instead of stopping
            }

            hideSpinner();
          }

          const progress = ((i + 1) / quantity) * 100;
          $("bulkProgressBar").style.width = `${progress}%`;
          $("bulkProgressText").textContent =
            `Generated ${i + 1}/${quantity} (${bulkGeneratedContent.length} total videos)`;

          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        $("bulkProgressText").textContent =
          `Complete! Generated ${bulkGeneratedContent.length} videos`;
        $("bulkComplete").style.display = "block";

        const libRes = await readFileAsync(PATHS.LIBRARY);
        let library = libRes.success ? safeParse(libRes.content, []) : [];
        library = bulkGeneratedContent.concat(library);
        await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
        await displayLibraryContent();

        addLogEntry(
          `Bulk generated ${bulkGeneratedContent.length} videos from memes`,
        );
      }
    } catch (error) {
      hideSpinner();
      $("bulkProgressText").textContent = `Error: ${error.message}`;
      addLogEntry(`Bulk video generation failed: ${error.message}`);
      throw error;
    }
  }

  async function generateBulkAIVideos(quantity, platforms, duration, textMode) {
    // Check for API key
    const settingsResult = await readFileAsync(PATHS.SETTINGS);
    if (!settingsResult.success) {
      throw new Error("Failed to load settings");
    }

    const settings = safeParse(settingsResult.content, {});
    const provider = settings.aiProvider || "openai";
    const encryptedKey = settings[`${provider}ApiKey`];

    if (!encryptedKey) {
      throw new Error(
        `No API key found for ${provider}. Please connect ${provider} first in settings.`,
      );
    }

    // Decrypt the API key
    const decryptedKey = await window.api.decrypt(encryptedKey);
    if (!decryptedKey) {
      throw new Error("Failed to decrypt API key");
    }

    console.warn(
      "[Bulk AI Video] Starting generation with provider:",
      provider,
    );
    showSpinner("Generating AI video prompts...");

    // Generate text variations for video prompts
    const textVariations = await generateBulkTextVariations(quantity, textMode);
    console.warn(`[Bulk AI Video] Generated ${textVariations.length} prompts`);
    hideSpinner();

    for (let i = 0; i < quantity; i++) {
      const variation = textVariations[i];
      const prompt = `${variation.top} ${variation.bottom}`.trim();

      for (const dims of platforms) {
        showSpinner(
          `Generating AI video ${i * platforms.length + platforms.indexOf(dims) + 1}/${quantity * platforms.length}...`,
        );
        console.warn(
          `[Bulk AI Video] Processing ${i + 1}/${quantity} - ${dims.name}: "${prompt}"`,
        );

        try {
          let videoResult;

          if (provider === "openai") {
            // OpenAI doesn't have direct text-to-video yet, so we'll use DALL-E + video conversion
            console.warn(
              "[Bulk AI Video] Using OpenAI DALL-E + video conversion workflow",
            );

            // Generate image with DALL-E
            const imageResponse = await fetch(
              "https://api.openai.com/v1/images/generations",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${decryptedKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  prompt: prompt,
                  n: 1,
                  size:
                    dims.width === dims.height
                      ? "1024x1024"
                      : dims.width > dims.height
                        ? "1792x1024"
                        : "1024x1792",
                }),
              },
            );

            if (!imageResponse.ok) {
              const errorData = await imageResponse.json();
              throw new Error(
                errorData.error?.message ||
                  `OpenAI API error: ${imageResponse.status}`,
              );
            }

            const imageData = await imageResponse.json();
            const imageUrl = imageData.data[0]?.url;

            if (!imageUrl) {
              throw new Error("No image URL returned from OpenAI");
            }

            console.warn(
              "[Bulk AI Video] Image generated, converting to video...",
            );

            // Convert image to video
            videoResult = await window.api.generateVideo({
              imagePath: imageUrl,
              duration: duration,
              resolution: `${dims.width}x${dims.height}`,
              fps: 30,
            });
          } else if (provider === "runway") {
            // Runway Gen-2 API (placeholder - update with real API when available)
            console.warn("[Bulk AI Video] Using Runway ML API");
            throw new Error(
              "Runway ML integration coming soon! Use OpenAI for now.",
            );
          } else {
            throw new Error(`Unknown provider: ${provider}`);
          }

          console.warn(`[Bulk AI Video] Video result:`, videoResult);

          if (videoResult.success) {
            // Format path correctly for file:// protocol (Windows compatibility)
            const videoPath = videoResult.path.replace(/\\/g, "/");
            const videoUrl = videoPath.startsWith("/")
              ? `file://${videoPath}`
              : `file:///${videoPath}`;

            await addToLibrary({
              url: videoUrl,
              type: "video",
              platform: dims.name,
              caption: prompt,
              hashtags:
                $("bulkHashtagMode")?.value === "manual"
                  ? $("bulkManualHashtags")?.value || ""
                  : "#ai #video #generated",
              metadata: {
                dimensions: dims,
                prompt: prompt,
                duration,
                provider,
                videoPath: videoResult.path,
                generatedBy: "ai-text-to-video",
              },
              contentType: "video",
              status: "draft",
            });

            const preview = document.createElement("div");
            preview.style.cssText =
              "border: 2px solid #805ad5; border-radius: 8px; overflow: hidden; background: var(--card-bg, #ffffff);";
            preview.innerHTML = `
              <video src="${videoUrl}" style="width: 100%; height: 120px; object-fit: cover;" muted></video>
              <div style="padding: 5px; font-size: 11px; background: var(--card-bg, #f7fafc); color: var(--text-color, #000);">
                🤖 AI ${dims.name} (${duration}s)
              </div>
            `;
            $("bulkPreviewGrid").appendChild(preview);
          } else {
            throw new Error(videoResult.error || "Video generation failed");
          }
        } catch (videoError) {
          console.error("AI video generation error:", videoError);
          addLogEntry(
            `Failed to generate AI video ${i + 1}: ${videoError.message}`,
          );
          // Continue with next video instead of stopping
        }

        hideSpinner();
      }

      const progress = ((i + 1) / quantity) * 100;
      $("bulkProgressBar").style.width = `${progress}%`;
      $("bulkProgressText").textContent =
        `Generated ${i + 1}/${quantity} (${bulkGeneratedContent.length} total AI videos)`;

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s between API calls
    }

    $("bulkProgressText").textContent =
      `Complete! Generated ${bulkGeneratedContent.length} AI videos`;
    $("bulkComplete").style.display = "block";

    const libRes = await readFileAsync(PATHS.LIBRARY);
    let library = libRes.success ? safeParse(libRes.content, []) : [];
    library = bulkGeneratedContent.concat(library);
    await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
    await displayLibraryContent();

    addLogEntry(
      `Bulk generated ${bulkGeneratedContent.length} AI videos using ${provider}`,
    );
  }

  async function generateBulkTextVariations(quantity, mode) {
    const variations = [];

    if (mode === "manual") {
      const text = $("bulkManualText")?.value || "";
      const lines = text.split("\n").filter((l) => l.trim());

      for (let i = 0; i < quantity; i++) {
        const line = lines[i % lines.length] || "Sample|Text";
        const parts = line.split("|");
        variations.push({
          top: parts[0]?.trim() || "Top Text",
          bottom: parts[1]?.trim() || "Bottom Text",
        });
      }
    } else {
      // AI mode - Generate varied text combinations
      const prompt = $("bulkAiPrompt")?.value || "funny memes";

      // Simple text variation generator (replace with actual AI API later)
      const templates = [
        { top: "When you", bottom: "But then you realize" },
        { top: "Nobody:", bottom: "Absolutely nobody:" },
        { top: "Me trying to", bottom: "Also me:" },
        { top: "Expectation:", bottom: "Reality:" },
        { top: "Before:", bottom: "After:" },
        { top: "That moment when", bottom: "And you're like" },
        { top: "POV:", bottom: "Meanwhile" },
        { top: "Everyone else:", bottom: "Me:" },
      ];

      for (let i = 0; i < quantity; i++) {
        const template = templates[i % templates.length];
        variations.push({
          top: `${template.top} ${prompt}`,
          bottom: template.bottom,
        });
      }

      addLogEntry(
        "Using template variations - integrate AI API for custom generation",
      );
    }

    return variations;
  }

  function generateCSV() {
    const csv = ["filename,platform,caption,hashtags,scheduled_time"];

    bulkGeneratedContent.forEach((item) => {
      const row = [
        item.filename,
        item.platform,
        `"${item.caption.replace(/"/g, '""')}"`,
        `"${item.hashtags}"`,
        item.timestamp,
      ].join(",");
      csv.push(row);
    });

    return csv.join("\n");
  }

  async function downloadBulkCSV() {
    const csv = generateCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk_memes_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLogEntry("Downloaded metadata CSV");
  }

  async function downloadBulkZip() {
    if (!window.JSZip) {
      addLogEntry("JSZip not loaded - downloading CSV instead");
      await downloadBulkCSV();
      return;
    }

    addLogEntry("Creating ZIP archive...");
    const zip = new JSZip();

    const byPlatform = {};
    bulkGeneratedContent.forEach((item) => {
      if (!byPlatform[item.platform]) {
        byPlatform[item.platform] = [];
      }
      byPlatform[item.platform].push(item);
    });

    const csv = generateCSV();
    zip.file("metadata.csv", csv);
    zip.file(
      "README.txt",
      `AI Auto Bot - Bulk Generated Content
Generated: ${new Date().toISOString()}
Total Files: ${bulkGeneratedContent.length}

Platform folders contain optimized images.
Use metadata.csv for scheduling tools (Buffer, Hootsuite, Later).`,
    );

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
          $("bulkProgressText").textContent =
            `Packaging ${completed}/${bulkGeneratedContent.length}...`;
          $("bulkProgressBar").style.width = `${progress}%`;
        } catch (error) {
          console.error(`Failed to package ${item.filename}:`, error);
        }
      }
    }

    $("bulkProgressText").textContent = "Finalizing ZIP...";
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai_autobot_bulk_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLogEntry(
      `ZIP downloaded with ${Object.keys(byPlatform).length} platform folders`,
    );
    $("bulkProgressText").textContent = "Download complete!";
  }

  // MEME FUNCTIONS
  function updateMemePreview() {
    const template = $("memeTemplate")?.value;
    const topText = formatMemeText($("memeTopText")?.value);
    const bottomText = formatMemeText($("memeBottomText")?.value);
    const preview = $("memePreview");

    if (preview && template && template !== "ai-generator") {
      preview.src = `https://api.memegen.link/images/${template}/${topText}/${bottomText}.png`;
      preview.style.display = "block";
    } else if (template === "ai-generator") {
      preview.src =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200"%3E%3Crect fill="%23f0f0f0" width="300" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%234a5568" font-size="14"%3EClick Generate to create%3C/text%3E%3C/svg%3E';
      preview.style.display = "block";
    }
  }

  // Save current meme preview to library
  async function saveMemeToLibrary() {
    try {
      const template = $("memeTemplate")?.value;
      const topText = $("memeTopText")?.value || "";
      const bottomText = $("memeBottomText")?.value || "";
      const preview = $("memePreview");

      // Validate
      if (!template || template === "ai-generator") {
        addLogEntry("Please select a meme template first", "warning");
        return;
      }

      if (
        !preview ||
        !preview.src ||
        preview.src.includes("data:image/svg+xml")
      ) {
        addLogEntry(
          "No meme to save. Please generate a meme first.",
          "warning",
        );
        return;
      }

      showSpinner("Saving meme to library...");

      // Get selected platforms to determine caption format
      const platforms = [];
      if ($("postInstagram")?.checked) {
        platforms.push("Instagram");
      }
      if ($("postTikTok")?.checked) {
        platforms.push("TikTok");
      }
      if ($("postYouTube")?.checked) {
        platforms.push("YouTube");
      }
      if ($("postTwitter")?.checked) {
        platforms.push("Twitter");
      }

      const caption =
        topText && bottomText
          ? `${topText} / ${bottomText}`
          : topText || bottomText || "Meme";

      // Save to library
      await addToLibrary({
        url: preview.src,
        type: "meme", // Changed from 'image' to 'meme' to match filter
        caption: caption,
        hashtags: $("hashtags")?.value || "#meme #funny",
        platform: platforms.length > 0 ? platforms.join(", ") : "All",
        metadata: {
          template: template,
          topText: topText,
          bottomText: bottomText,
          generatedBy: "meme-template",
        },
        contentType: "meme", // Changed from 'image' to 'meme'
        status: "draft",
      });

      hideSpinner();
      addLogEntry("✅ Meme saved to library successfully!");

      // Visual feedback on button
      const btn = $("saveMemeToLibrary");
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = "✅ Saved!";
        btn.style.background =
          "linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)";
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.style.background =
            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        }, 2000);
      }

      // Refresh library display
      if ($("libraryTab")?.classList.contains("active")) {
        displayLibraryContent();
      }
    } catch (error) {
      console.error("Save meme error:", error);
      hideSpinner();
      addLogEntry(`Failed to save meme: ${error.message}`, "error");
    }
  }

  async function fetchMemeTemplates() {
    const sel = $("memeTemplate");
    if (!sel) {
      return;
    }

    try {
      const resp = await fetch("https://api.memegen.link/templates/");
      if (!resp.ok) {
        throw new Error(`Status ${resp.status}`);
      }

      const data = await resp.json();
      allTemplates = Array.isArray(data)
        ? data
        : Object.keys(data).map((k) => ({ id: k, name: data[k].name || k }));

      let html =
        '<option value="ai-generator">🤖 AI Generator (Prompt/URL)</option>';
      html += allTemplates
        .map((t) => `<option value="${t.id}">${t.name || t.id}</option>`)
        .join("");

      sel.innerHTML = html;

      const bulkSel = $("bulkSingleTemplate");
      if (bulkSel) {
        bulkSel.innerHTML = allTemplates
          .map((t) => `<option value="${t.id}">${t.name || t.id}</option>`)
          .join("");
      }

      addLogEntry("Meme templates loaded");
    } catch (error) {
      addLogEntry(`Template fetch failed: ${error.message}`);
    }
  }

  // CONFIG HANDLERS
  async function handleSaveConfig() {
    clearError();

    // Note: You can save configs without AI providers or social media connected
    // The config will save all current form values, connections are optional
    const name = $("configNameInput")?.value?.trim();
    if (!name) {
      displayValidationError({ message: "Config name is required" }, "config");
      return;
    }

    // Get form data
    const form = $("settingsForm");
    const data = {};

    // Save dark mode state from the checkbox itself
    const darkModeToggle = $("darkModeToggle");
    if (darkModeToggle) {
      data.isDarkMode = darkModeToggle.checked;
    }

    // Save all social media and AI API keys/tokens from UI fields
    for (const field of SENSITIVE_FIELDS) {
      const input = $(`${field}`);
      if (input) {
        // Support multiple tokens per platform (comma-separated)
        if (input.value && input.value.includes(",")) {
          data[field] = input.value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        } else {
          data[field] = input.value;
        }
      }
    }

    if (form) {
      const inputs = form.querySelectorAll("input,select,textarea");
      inputs.forEach((el) => {
        if (!el.id) {
          return;
        }
        if (el.type === "checkbox") {
          data[el.id] = el.checked;
        } else {
          data[el.id] = el.value;
        }
      });
    }

    // Save card layout positions
    const fieldsets = Array.from(form.querySelectorAll("fieldset"));
    const layout = {};
    fieldsets.forEach((fs, index) => {
      const id =
        fs.id ||
        fs.querySelector("legend")?.textContent?.trim() ||
        `fieldset-${index}`;
      layout[id] = {
        gridColumn: fs.style.gridColumn || "",
        gridRow: fs.style.gridRow || "",
      };
    });
    data.fieldsetLayout = layout;

    const encryptedData = await encryptSensitiveFields(data);

    const res = await readFileAsync(PATHS.SAVED_CONFIGS);
    let configs = res.success
      ? safeParse(res.content, { configs: [] })
      : { configs: [] };

    if (Array.isArray(configs)) {
      configs = { configs: configs };
    }
    if (!configs.configs || !Array.isArray(configs.configs)) {
      configs = { configs: [] };
    }

    const index = configs.configs.findIndex((c) => c.name === name);
    const record = {
      name,
      createdAt: new Date().toISOString(),
      settings: encryptedData,
    };

    if (index >= 0) {
      configs.configs[index] = record;
    } else {
      configs.configs.unshift(record);
    }

    const w = await writeFileAsync(
      PATHS.SAVED_CONFIGS,
      JSON.stringify(configs, null, 2),
    );
    if (w.success) {
      clearError();
      addLogEntry(`Config saved: ${name} (encrypted, with layout)`);
      await populateSavedConfigs();
      $("configNameInput").value = "";
    } else {
      displayValidationError(w.error, "config");
    }
  }

  async function handleImportSettings() {
    const res = await readFileAsync(PATHS.SETTINGS);
    if (!res.success) {
      displayValidationError(res.error, "settings import");
      return;
    }

    const obj = safeParse(res.content, {});
    const decryptedObj = await decryptSensitiveFields(obj);
    populateFormFromObject(decryptedObj);
    addLogEntry("Settings imported and decrypted from data/settings.json");
    clearError();
  }
  window.handleImportSettings = handleImportSettings;

  function populateFormFromObject(obj) {
    if (!obj) {
      return;
    }

    // Handle dark mode first if it exists
    if (typeof obj.isDarkMode === "boolean") {
      const darkModeToggle = $("darkModeToggle");
      if (darkModeToggle) {
        darkModeToggle.checked = obj.isDarkMode;
        handleDarkModeToggle({ target: darkModeToggle });
      }
    }

    // Restore card layout if saved
    if (obj.fieldsetLayout && typeof obj.fieldsetLayout === "object") {
      const form = $("settingsForm");
      if (form) {
        const fieldsets = Array.from(form.querySelectorAll("fieldset"));
        fieldsets.forEach((fs, index) => {
          const id =
            fs.id ||
            fs.querySelector("legend")?.textContent?.trim() ||
            `fieldset-${index}`;
          if (obj.fieldsetLayout[id]) {
            if (obj.fieldsetLayout[id].gridColumn) {
              fs.style.gridColumn = obj.fieldsetLayout[id].gridColumn;
            }
            if (obj.fieldsetLayout[id].gridRow) {
              fs.style.gridRow = obj.fieldsetLayout[id].gridRow;
            }
          }
        });
        addLogEntry("📍 Card layout restored from config");
      }
    }

    // Set content type first
    const contentType = $("contentType");
    if (contentType) {
      contentType.value = obj.contentType || "meme";
      contentType.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // If it's a meme, set the template and text
    if (obj.contentType === "meme" || !obj.contentType) {
      // Try to get template from metadata first, then fallback to direct properties
      const template =
        obj.metadata?.template || obj.template || obj.memeTemplate || "";
      const topText =
        obj.metadata?.variation?.top ||
        obj.topText ||
        obj.caption?.split("\n")[0] ||
        "";
      const bottomText =
        obj.metadata?.variation?.bottom ||
        obj.bottomText ||
        obj.caption?.split("\n")[1] ||
        "";

      if ($("memeTemplate")) {
        $("memeTemplate").value = template;
      }
      if ($("memeTopText")) {
        $("memeTopText").value = topText;
      }
      if ($("memeBottomText")) {
        $("memeBottomText").value = bottomText;
      }

      // Always update preview when setting meme content
      updateMemePreview();
    }

    // Set caption and hashtags
    if ($("caption")) {
      $("caption").value = obj.caption || "";
    }
    if ($("hashtags")) {
      $("hashtags").value = obj.hashtags || "";
    }

    // Handle form fields
    Object.keys(obj).forEach((key) => {
      const el = $(key);
      if (!el) {
        return;
      }

      if (el.type === "checkbox") {
        el.checked = !!obj[key];
      } else if (el.type === "datetime-local" || key === "scheduleDateTime") {
        el.value = toDateTimeLocal(obj[key]);
      } else {
        el.value = obj[key] ?? "";
      }

      // Don't trigger change event for template/text fields as they're already handled
      if (!["memeTemplate", "memeTopText", "memeBottomText"].includes(key)) {
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  function renderSavedConfigs(configs) {
    const ul = $("savedConfigsList");
    if (!ul) {
      return;
    }

    ul.innerHTML = "";
    configs.forEach((c, idx) => {
      const li = document.createElement("li");
      li.className = "saved-config-item";

      const nameText = document.createElement("span");
      nameText.textContent = c.name || `config-${idx}`;
      nameText.style.marginRight = "8px";

      const loadBtn = document.createElement("button");
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", async () => {
        const decryptedSettings = await decryptSensitiveFields(c.settings);
        populateFormFromObject(decryptedSettings);
        addLogEntry(`Loaded config: ${c.name} (decrypted)`);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        const r = await readFileAsync(PATHS.SAVED_CONFIGS);
        let data = r.success
          ? safeParse(r.content, { configs: [] })
          : { configs: [] };

        // Handle legacy flat array format
        if (Array.isArray(data)) {
          data = { configs: data };
        }
        if (!data.configs || !Array.isArray(data.configs)) {
          data = { configs: [] };
        }

        let removeIdx = -1;
        if (c.createdAt) {
          removeIdx = data.configs.findIndex(
            (x) => x && x.createdAt === c.createdAt,
          );
        }
        if (removeIdx === -1 && c.name) {
          removeIdx = data.configs.findIndex((x) => x && x.name === c.name);
        }

        if (removeIdx >= 0) {
          data.configs.splice(removeIdx, 1);
        }

        const w = await writeFileAsync(
          PATHS.SAVED_CONFIGS,
          JSON.stringify(data, null, 2),
        );
        if (w.success) {
          renderSavedConfigs(data.configs);
          addLogEntry(`Deleted config: ${c.name || "unnamed"}`);
        } else {
          addLogEntry(
            `Failed to delete config: ${w.error?.message || "unknown"}`,
          );
        }
      });

      li.appendChild(nameText);
      li.appendChild(loadBtn);
      li.appendChild(document.createTextNode(" "));
      li.appendChild(delBtn);
      ul.appendChild(li);
    });
  }

  async function populateSavedConfigs() {
    const res = await readFileAsync(PATHS.SAVED_CONFIGS);
    let configs = res.success
      ? safeParse(res.content, { configs: [] })
      : { configs: [] };

    if (Array.isArray(configs)) {
      configs = { configs: configs };
    }
    if (!configs.configs || !Array.isArray(configs.configs)) {
      configs = { configs: [] };
    }

    const cleaned = dedupeSavedConfigs(configs.configs);

    if (cleaned.length !== configs.configs.length) {
      await writeFileAsync(
        PATHS.SAVED_CONFIGS,
        JSON.stringify({ configs: cleaned }, null, 2),
      );
    }

    renderSavedConfigs(cleaned);
  }

  // SCHEDULED POSTS
  function renderScheduledPosts(posts) {
    const ul = $("scheduledPostsList");
    if (!ul) {
      return;
    }

    ul.innerHTML = "";
    posts.forEach((p, idx) => {
      const li = document.createElement("li");
      li.className = "scheduled-post-item";
      li.textContent = `${p.scheduleTime || "N/A"} — ${p.status || "scheduled"}`;

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.className = "action-btn delete";
      delBtn.addEventListener("click", async () => {
        const r = await readFileAsync(PATHS.SCHEDULED_POSTS);
        let data = r.success
          ? safeParse(r.content, { posts: [] })
          : { posts: [] };

        // Handle legacy flat array format
        if (Array.isArray(data)) {
          data = { posts: data };
        }
        if (!data.posts || !Array.isArray(data.posts)) {
          data = { posts: [] };
        }

        data.posts.splice(idx, 1);

        const w = await writeFileAsync(
          PATHS.SCHEDULED_POSTS,
          JSON.stringify(data, null, 2),
        );
        if (w.success) {
          renderScheduledPosts(data.posts);
          addLogEntry("Scheduled post deleted");
        }
      });

      li.appendChild(document.createTextNode(" "));
      li.appendChild(delBtn);
      ul.appendChild(li);
    });
  }

  async function populateScheduledPosts() {
    const r = await readFileAsync(PATHS.SCHEDULED_POSTS);
    let data = r.success ? safeParse(r.content, { posts: [] }) : { posts: [] };

    // Handle legacy flat array format
    if (Array.isArray(data)) {
      data = { posts: data };
    }
    if (!data.posts || !Array.isArray(data.posts)) {
      data = { posts: [] };
    }

    const cleaned = dedupeScheduledPosts(data.posts);

    if (cleaned.length !== data.posts.length) {
      await writeFileAsync(
        PATHS.SCHEDULED_POSTS,
        JSON.stringify({ posts: cleaned }, null, 2),
      );
    }

    renderScheduledPosts(cleaned);
  }

  async function populateTimezones() {
    const tzSelect = $("timezoneSelect");
    if (!tzSelect) {
      return;
    }

    let zones = [];
    try {
      if (typeof Intl.supportedValuesOf === "function") {
        zones = Intl.supportedValuesOf("timeZone");
      }
    } catch {
      zones = [];
    }

    if (!zones || zones.length === 0) {
      zones = [
        "UTC",
        "America/New_York",
        "America/Los_Angeles",
        "America/Chicago",
        "Europe/London",
        "Asia/Tokyo",
      ];
    }

    tzSelect.innerHTML = zones
      .map((z) => `<option value="${z}">${z}</option>`)
      .join("");
  }

  // CONTENT LIBRARY
  // Note: renderLibrary() function removed - replaced with displayLibraryContent()
  // All calls updated to use the new function which includes Schedule buttons and proper dark mode support

  async function reuseLibraryItem(id) {
    const r = await readFileAsync(PATHS.LIBRARY);
    const library = r.success ? safeParse(r.content, []) : [];
    const item = library.find((i) => i.id === id);

    if (item) {
      populateFormFromObject(item);
      addLogEntry("Loaded content from library");
    }
  }
  window.reuseLibraryItem = reuseLibraryItem;

  async function deleteLibraryItem(id) {
    const r = await readFileAsync(PATHS.LIBRARY);
    let library = r.success ? safeParse(r.content, []) : [];

    library = library.filter((item) => item.id !== id);
    await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));

    await displayLibraryContent();
    addLogEntry("Deleted from library");
  }
  window.deleteLibraryItem = deleteLibraryItem;

  // EVENT HANDLERS
  async function handleDarkModeToggle(ev) {
    const on = ev.target.checked;
    document.documentElement.classList.toggle("dark", on);
    document.body.classList.toggle("dark", on);

    const container = document.querySelector(".container");
    if (container) {
      container.classList.toggle("dark", on);
    }

    // NEW: Refresh library cards immediately
    await displayLibraryContent();

    addLogEntry(`Dark mode ${on ? "enabled" : "disabled"}`);
  }

  function handleContentTypeChange(ev) {
    const val = ev.target.value;
    const memeFields = $("memeFields");
    const videoFields = $("videoFields");

    if (memeFields) {
      memeFields.style.display = val === "meme" ? "" : "none";
    }
    if (videoFields) {
      videoFields.style.display = val === "video" ? "" : "none";
    }

    // Trigger meme mode change if switching to meme
    if (val === "meme") {
      $("memeMode")?.dispatchEvent(new Event("change"));
    }

    // Trigger video mode change if switching to video
    if (val === "video") {
      $("videoMode")?.dispatchEvent(new Event("change"));
    }

    addLogEntry(`Content type set to ${val}`);
  }

  // VIDEO GENERATION FUNCTIONS
  function handleVideoModeChange(ev) {
    const mode = ev?.target?.value || $("videoMode")?.value;

    // Update visible options based on mode
    const sections = {
      text: ["videoPromptLabel", "generateVideoBtn"],
      memes: ["selectMemesLabel", "selectedMemesContainer"],
      gif: ["sourceImageLabel", "createVariationsBtn"],
    };

    // Hide all sections first
    Object.values(sections)
      .flat()
      .forEach((id) => {
        if ($(id)) {
          $(id).style.display = "none";
        }
      });

    // Show relevant sections
    if (sections[mode]) {
      sections[mode].forEach((id) => {
        if ($(id)) {
          $(id).style.display = "";
        }
      });
    }

    // Update action button text
    const actionBtn = $("generateVideoBtn");
    if (actionBtn) {
      actionBtn.textContent = mode === "gif" ? "Create GIF" : "Generate Video";
    }

    addLogEntry(`Video mode set to ${mode}`);
  }

  // Handle video generation
  async function handleVideoGeneration() {
    const mode = $("videoMode")?.value;
    const resolution =
      $("aspectRatio")?.value === "1:1"
        ? "1080x1080"
        : $("aspectRatio")?.value === "16:9"
          ? "1920x1080"
          : "1080x1920";

    try {
      let result;

      // Show progress indicator
      const progressBar = document.createElement("div");
      progressBar.className = "progress-bar";
      $("videoFields").appendChild(progressBar);

      // Listen for progress updates
      window.api.onVideoProgress((progress) => {
        progressBar.style.width = `${progress.progress}%`;
        if (progress.status === "complete") {
          progressBar.remove();
        }
      });

      switch (mode) {
        case "text": {
          // AI Video generation will be implemented in phase 4
          break;
        }

        case "memes": {
          // Get selected memes from the container
          const selectedMemes = Array.from($("selectedMemesList").children)
            .map((el) => el.dataset.path)
            .filter(Boolean);

          if (selectedMemes.length === 0) {
            throw new Error("Please select at least one meme");
          }

          result = await window.api.generateSlideshow({
            imagePaths: selectedMemes,
            duration: parseInt($("videoDuration")?.value || "3"),
            resolution,
            fps: parseInt($("frameRate")?.value || "30"),
            transition: "fade",
          });
          break;
        }

        case "gif": {
          const sourceImage = $("sourceImage")?.files[0];
          if (!sourceImage) {
            throw new Error("Please select a source image");
          }

          result = await window.api.generateGif({
            imagePath: sourceImage.path,
            width: resolution.split("x")[0],
            height: resolution.split("x")[1],
            duration: parseInt($("videoDuration")?.value || "3"),
            fps: 15,
          });
          break;
        }
      }

      if (result?.success) {
        // Add to library
        const libraryItem = {
          id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: mode === "gif" ? "gif" : "video",
          url: result.path,
          caption: $("caption")?.value || "",
          hashtags: $("hashtags")?.value || "",
          contentType: "video",
          createdAt: new Date().toISOString(),
        };

        await addToLibrary(libraryItem);
        addLogEntry(
          `${mode === "gif" ? "GIF" : "Video"} generated successfully`,
        );
      } else {
        throw new Error(result?.error || "Generation failed");
      }
    } catch (error) {
      displayError(error);
    }
  }
  window.handleVideoGeneration = handleVideoGeneration;

  // Handle meme selection for video compilation
  function handleMemeSelection() {
    const selectedMemesList = $("selectedMemesList");
    const libraryGrid = $("libraryGrid");

    // Create selection mode UI
    libraryGrid.classList.add("selection-mode");
    const selectionHeader = document.createElement("div");
    selectionHeader.innerHTML = `
      <div style="padding: 10px; background: var(--glass-bg); position: sticky; top: 0; z-index: 10;">
        <h3>Select memes for your compilation</h3>
        <button id="doneSelectingBtn" style="margin-top: 10px;">Done Selecting</button>
      </div>
    `;
    libraryGrid.prepend(selectionHeader);

    // Add selection functionality to library items
    libraryGrid.querySelectorAll(".library-item").forEach((item) => {
      item.onclick = () => {
        if (item.classList.toggle("selected")) {
          // Add to selected list
          const preview = document.createElement("div");
          preview.className = "selected-meme-preview";
          preview.dataset.path = item.dataset.path;
          preview.innerHTML = `
            <img src="${item.querySelector("img").src}" style="width: 100px; height: 100px; object-fit: cover;">
            <button class="remove-selected">×</button>
          `;
          preview.querySelector(".remove-selected").onclick = () => {
            preview.remove();
            item.classList.remove("selected");
          };
          selectedMemesList.appendChild(preview);
        } else {
          // Remove from selected list
          selectedMemesList
            .querySelector(`[data-path="${item.dataset.path}"]`)
            ?.remove();
        }
      };
    });

    // Handle done selecting
    $("doneSelectingBtn").onclick = () => {
      libraryGrid.classList.remove("selection-mode");
      selectionHeader.remove();
      libraryGrid.querySelectorAll(".library-item").forEach((item) => {
        item.onclick = null;
        item.classList.remove("selected");
      });
    };
  }
  window.handleMemeSelection = handleMemeSelection;

  // The event-based `handleVideoModeChange(ev)` above handles video mode changes

  async function handleGenerateVideo() {
    const mode = $("videoMode")?.value;

    console.warn("[Generate Video] Mode selected:", mode);

    if (mode === "text") {
      // Text to Video using AI
      await generateAIVideo();
    } else if (mode === "memes") {
      // Meme compilation/slideshow
      await generateSlideshow();
    } else if (mode === "meme-to-video") {
      await generateMemeToVideo();
    } else if (mode === "slideshow") {
      await generateSlideshow();
    } else if (mode === "gif") {
      await generateAnimatedGIF();
    } else if (mode === "ai-video") {
      await generateAIVideo();
    } else {
      console.warn("[Generate Video] Unknown mode:", mode);
      $("errorContainer").textContent = "Please select a video mode";
      $("errorContainer").style.display = "block";
    }
  }

  async function generateMemeToVideo() {
    const memeUrl = $("memePreview")?.src;
    if (!memeUrl || memeUrl.includes("svg")) {
      $("errorContainer").textContent =
        "Please generate or select a meme first!";
      $("errorContainer").style.display = "block";
      return;
    }

    showSpinner("Creating video from meme...");

    try {
      const duration = parseInt($("videoDuration")?.value || "5");
      const aspectRatio = $("aspectRatio")?.value || "16:9";
      const fps = parseInt($("frameRate")?.value || "30");
      const animationStyle = $("animationStyle")?.value || "zoom-in";
      const textAnimation = $("textAnimation")?.value || "none";

      // Get dimensions based on aspect ratio
      const dimensions = getVideoDimensions(aspectRatio);

      // Load image
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = memeUrl;
      });

      // Setup canvas
      const canvas = $("videoCanvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const ctx = canvas.getContext("2d");

      // Record video
      const stream = canvas.captureStream(fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 8000000,
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = () => {
        videoBlob = new Blob(chunks, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(videoBlob);

        const preview = $("videoPreview");
        if (preview) {
          preview.src = videoUrl;
          $("videoPreviewContainer").style.display = "block";
        }

        hideSpinner();
        addLogEntry("Video created successfully!");
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
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply animation
        ctx.save();
        applyAnimation(
          ctx,
          animationStyle,
          progress,
          canvas.width,
          canvas.height,
          img,
        );
        ctx.restore();

        // Apply text animation if needed
        if (textAnimation !== "none") {
          applyTextAnimation(
            ctx,
            textAnimation,
            progress,
            canvas.width,
            canvas.height,
          );
        }

        currentFrame++;
        requestAnimationFrame(animate);
      };

      animate();
    } catch (error) {
      hideSpinner();
      $("errorContainer").textContent =
        `Video generation failed: ${error.message}`;
      $("errorContainer").style.display = "block";
      addLogEntry(`Video error: ${error.message}`);
    }
  }

  function applyAnimation(ctx, style, progress, width, height, img) {
    switch (style) {
      case "zoom-in": {
        const zoomInScale = 1 + progress * 0.5;
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoomInScale, zoomInScale);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img, 0, 0, width, height);
        break;
      }

      case "zoom-out": {
        const zoomOutScale = 1.5 - progress * 0.5;
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoomOutScale, zoomOutScale);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img, 0, 0, width, height);
        break;
      }

      case "pan-left": {
        const panLeftX = -(progress * width * 0.3);
        ctx.drawImage(img, panLeftX, 0, width * 1.3, height);
        break;
      }

      case "pan-right": {
        const panRightX = progress * width * 0.3;
        ctx.drawImage(img, panRightX, 0, width * 1.3, height);
        break;
      }

      case "slide-up": {
        const slideUpY = height - progress * height;
        ctx.drawImage(img, 0, slideUpY, width, height);
        break;
      }

      case "slide-down": {
        const slideDownY = -(height - progress * height);
        ctx.drawImage(img, 0, slideDownY, width, height);
        break;
      }

      case "fade": {
        ctx.globalAlpha = progress < 0.5 ? progress * 2 : 2 - progress * 2;
        ctx.drawImage(img, 0, 0, width, height);
        ctx.globalAlpha = 1;
        break;
      }

      case "bounce": {
        const bounceY = Math.abs(Math.sin(progress * Math.PI * 4)) * 50;
        ctx.drawImage(img, 0, bounceY, width, height);
        break;
      }

      default:
        ctx.drawImage(img, 0, 0, width, height);
    }
  }

  function applyTextAnimation(ctx, animation, progress, width, height) {
    const topText = $("memeTopText")?.value || "";
    const bottomText = $("memeBottomText")?.value || "";

    ctx.font = "bold 48px Impact";
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    ctx.textAlign = "center";

    if (animation === "fade-in") {
      ctx.globalAlpha = progress;
    } else if (animation === "slide-in") {
      ctx.save();
      ctx.translate(width * (1 - progress), 0);
    } else if (animation === "typewriter") {
      const topChars = Math.floor(topText.length * progress);
      const bottomChars = Math.floor(bottomText.length * progress);
      ctx.strokeText(topText.substring(0, topChars), width / 2, 60);
      ctx.fillText(topText.substring(0, topChars), width / 2, 60);
      ctx.strokeText(
        bottomText.substring(0, bottomChars),
        width / 2,
        height - 20,
      );
      ctx.fillText(
        bottomText.substring(0, bottomChars),
        width / 2,
        height - 20,
      );
      ctx.globalAlpha = 1;
      return;
    }

    ctx.strokeText(topText, width / 2, 60);
    ctx.fillText(topText, width / 2, 60);
    ctx.strokeText(bottomText, width / 2, height - 20);
    ctx.fillText(bottomText, width / 2, height - 20);

    ctx.globalAlpha = 1;
    if (animation === "slide-in") {
      ctx.restore();
    }
  }

  async function generateSlideshow() {
    if (selectedMemesForSlideshow.length === 0) {
      $("errorContainer").textContent =
        "Please select memes from your library first!";
      $("errorContainer").style.display = "block";
      return;
    }

    showSpinner(
      `Creating slideshow with ${selectedMemesForSlideshow.length} memes...`,
    );

    try {
      const slideDuration = parseInt($("slideDuration")?.value || "3");
      const transition = $("transitionEffect")?.value || "fade";
      const aspectRatio = $("aspectRatio")?.value || "16:9";
      const fps = parseInt($("frameRate")?.value || "30");

      const dimensions = getVideoDimensions(aspectRatio);

      const canvas = $("videoCanvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const ctx = canvas.getContext("2d");

      // Load all images
      const images = await Promise.all(
        selectedMemesForSlideshow.map((meme) => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = meme.url;
          });
        }),
      );

      // Record video
      const stream = canvas.captureStream(fps);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 8000000,
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = () => {
        videoBlob = new Blob(chunks, { type: "video/webm" });
        const videoUrl = URL.createObjectURL(videoBlob);

        const preview = $("videoPreview");
        if (preview) {
          preview.src = videoUrl;
          $("videoPreviewContainer").style.display = "block";
        }

        hideSpinner();
        addLogEntry("Slideshow created successfully!");
      };

      mediaRecorder.start();

      const framesPerSlide = slideDuration * fps;
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

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (isTransitioning && currentSlide < images.length - 1) {
          const transitionProgress = (slideProgress - 0.85) / 0.15;
          applyTransition(
            ctx,
            images[currentSlide],
            images[currentSlide + 1],
            transition,
            transitionProgress,
            canvas.width,
            canvas.height,
          );
        } else {
          ctx.drawImage(
            images[currentSlide],
            0,
            0,
            canvas.width,
            canvas.height,
          );
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
      $("errorContainer").textContent =
        `Slideshow generation failed: ${error.message}`;
      $("errorContainer").style.display = "block";
      addLogEntry(`Slideshow error: ${error.message}`);
    }
  }

  function applyTransition(ctx, img1, img2, type, progress, width, height) {
    switch (type) {
      case "fade": {
        ctx.globalAlpha = 1 - progress;
        ctx.drawImage(img1, 0, 0, width, height);
        ctx.globalAlpha = progress;
        ctx.drawImage(img2, 0, 0, width, height);
        ctx.globalAlpha = 1;
        break;
      }

      case "slide": {
        const slideOffset = progress * width;
        ctx.drawImage(img1, -slideOffset, 0, width, height);
        ctx.drawImage(img2, width - slideOffset, 0, width, height);
        break;
      }

      case "zoom": {
        const zoomOut = 1 - progress * 0.5;
        const zoomIn = 0.5 + progress * 0.5;

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
      }

      case "wipe": {
        ctx.drawImage(img1, 0, 0, width, height);
        ctx.drawImage(
          img2,
          0,
          0,
          width * progress,
          height,
          0,
          0,
          width * progress,
          height,
        );
        break;
      }
    }
  }

  async function generateAnimatedGIF() {
    const memeUrl = $("memePreview")?.src;
    if (!memeUrl || memeUrl.includes("svg")) {
      $("errorContainer").textContent =
        "Please generate or select a meme first!";
      $("errorContainer").style.display = "block";
      return;
    }

    showSpinner("Creating animated GIF...");

    try {
      const effect = $("gifEffect")?.value || "shake";
      const speed = $("loopSpeed")?.value || "medium";
      const frameCount = speed === "slow" ? 5 : speed === "medium" ? 10 : 20;
      const delay = speed === "slow" ? 1000 : speed === "medium" ? 200 : 100;

      // Load image
      const img = new Image();
      img.crossOrigin = "anonymous";
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
        height: img.height,
      });

      const canvas = $("videoCanvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      // Generate frames
      for (let i = 0; i < frameCount; i++) {
        const progress = i / frameCount;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        applyGIFEffect(ctx, effect, progress, canvas.width, canvas.height, img);

        ctx.restore();

        gif.addFrame(canvas, { delay: delay, copy: true });
      }

      gif.on("finished", (blob) => {
        const gifUrl = URL.createObjectURL(blob);

        // Display as video preview (GIFs can play in video element)
        const preview = $("videoPreview");
        if (preview) {
          preview.src = gifUrl;
          preview.loop = true;
          $("videoPreviewContainer").style.display = "block";
        }

        videoBlob = blob;

        hideSpinner();
        addLogEntry("Animated GIF created successfully!");
      });

      gif.render();
    } catch (error) {
      hideSpinner();
      $("errorContainer").textContent =
        `GIF generation failed: ${error.message}`;
      $("errorContainer").style.display = "block";
      addLogEntry(`GIF error: ${error.message}`);
    }
  }

  function applyGIFEffect(ctx, effect, progress, width, height, img) {
    switch (effect) {
      case "shake": {
        const shakeX = Math.sin(progress * Math.PI * 8) * 10;
        const shakeY = Math.cos(progress * Math.PI * 8) * 10;
        ctx.drawImage(img, shakeX, shakeY, width, height);
        break;
      }

      case "bounce": {
        const bounceY = Math.abs(Math.sin(progress * Math.PI * 2)) * 30;
        ctx.drawImage(img, 0, bounceY, width, height);
        break;
      }

      case "flash": {
        ctx.globalAlpha = progress < 0.5 ? 1 : 0.5;
        ctx.drawImage(img, 0, 0, width, height);
        break;
      }

      case "spin": {
        ctx.translate(width / 2, height / 2);
        ctx.rotate(progress * Math.PI * 2);
        ctx.translate(-width / 2, -height / 2);
        ctx.drawImage(img, 0, 0, width, height);
        break;
      }

      case "wave": {
        for (let y = 0; y < height; y++) {
          const waveX = Math.sin((y + progress * height) * 0.05) * 20;
          ctx.drawImage(img, 0, y, width, 1, waveX, y, width, 1);
        }
        break;
      }
    }
  }

  async function generateAIVideo() {
    // Get selected AI provider from video form
    const provider = $("videoAiProvider")?.value || "runway";
    const prompt = $("videoPrompt")?.value?.trim();

    if (!prompt) {
      $("errorContainer").textContent = "Please enter a video prompt!";
      $("errorContainer").style.display = "block";
      addLogEntry("Please enter a video prompt");
      return;
    }

    // Check if provider is a local model (no API key needed)
    const localModels = ['zeroscope', 'modelscope', 'stable-video'];
    const isLocalModel = localModels.includes(provider);

    let apiKey = null;

    // Only check for API key if NOT a local model
    if (!isLocalModel) {
      // Get API key from settings (encrypted)
      const settingsResult = await readFileAsync(PATHS.SETTINGS);
      if (!settingsResult.success) {
        $("errorContainer").textContent = "Failed to load settings!";
        $("errorContainer").style.display = "block";
        return;
      }

      const settings = safeParse(settingsResult.content, {});
      const encryptedKey = settings[`${provider}ApiKey`];

      if (!encryptedKey) {
        const providerNames = {
          openai: "OpenAI",
          runway: "Runway ML",
          luma: "Luma AI"
        };
        $("errorContainer").textContent =
          `⚠️ ${providerNames[provider] || provider.toUpperCase()} not connected! Please connect it in the "Connect AI Providers" section below.`;
        $("errorContainer").style.display = "block";
        addLogEntry(
          `AI video generation failed — no ${provider} API key configured`,
        );
        return;
      }

      // Decrypt the API key
      const apiKeyResult = await window.api.decrypt(encryptedKey);
      if (!apiKeyResult || !apiKeyResult.success) {
        $("errorContainer").textContent = "Failed to decrypt API key!";
        $("errorContainer").style.display = "block";
        return;
      }

      apiKey = apiKeyResult.data || apiKeyResult;
    }

    // Import video provider utilities
    const { createVideoProvider } = await import('./utils/video-providers.js');

    try {
      // Create provider instance
      const videoProvider = createVideoProvider(provider, apiKey);
      const capabilities = videoProvider.getCapabilities();

      console.warn("[AI Video] Generating with provider:", provider);
      addLogEntry(`🎬 Generating AI video using ${provider.toUpperCase()}...`);
      showSpinner(`Generating with ${provider}... (est. ${Math.floor(capabilities.estimatedTime / 60)} min)`);

      // Prepare generation options
      const duration = parseInt($("videoDuration")?.value || "5");
      const aspectRatio = $("aspectRatio")?.value || "16:9";
      const dimensions =
        aspectRatio === "1:1"
          ? { width: 1024, height: 1024 }
          : aspectRatio === "16:9"
            ? { width: 1792, height: 1024 }
            : { width: 1024, height: 1792 };

      // Start generation
      const result = await videoProvider.generate({
        prompt: prompt,
        duration: duration,
        aspectRatio: aspectRatio,
        dimensions: dimensions,
      });

      // Poll for completion
      updateSpinnerMessage(`${provider} is generating your video...`);
      const videoUrl = await pollForVideoCompletion(
        videoProvider,
        result.taskId,
        result.pollInterval || 5000,
        result.metadata
      );

      if (!videoUrl) {
        throw new Error("No video URL returned from provider");
      }

      // Download video blob
      const videoResponse = await fetch(videoUrl);
      videoBlob = await videoResponse.blob();

      // Display video preview
      const localVideoUrl = URL.createObjectURL(videoBlob);
      const preview = $("videoPreview");
      if (preview) {
        preview.src = localVideoUrl;
        $("videoPreviewContainer").style.display = "block";
      }

      // Track video generation cost
      trackVideoGeneration(duration);

      hideSpinner();
      addLogEntry(`✅ AI video generated successfully using ${provider.toUpperCase()}!`);

    } catch (error) {
      hideSpinner();

      // Check if this is a Python setup error
      const isPythonError = error.message.includes('Python is not installed') ||
                           error.message.includes('Missing Python package') ||
                           error.message.includes('pip install');

      if (isPythonError) {
        // Show setup guide for local models
        const errorHtml = `
          <div style="text-align: left;">
            <strong>⚠️ Python Setup Required</strong>
            <p>${error.message.replace(/\n/g, '<br>')}</p>
            <div style="margin-top: 15px; padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 6px;">
              <strong>Quick Setup:</strong><br>
              1. Install Python from <a href="https://www.python.org/downloads/" target="_blank" style="color: #60a5fa;">python.org</a><br>
              2. Run: <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px;">pip install torch diffusers transformers accelerate</code><br>
              3. Try generating again!
            </div>
            <p style="margin-top: 10px; font-size: 0.9em; color: #9ca3af;">
              💡 <strong>Alternative:</strong> Use paid APIs (Runway/Luma) for instant generation without setup.
            </p>
          </div>
        `;
        $("errorContainer").innerHTML = errorHtml;
      } else {
        $("errorContainer").textContent = `AI video generation failed: ${error.message}`;
      }

      $("errorContainer").style.display = "block";
      addLogEntry(`AI video error: ${error.message}`);
      console.error("[AI Video] Error:", error);
    }
  }

  /**
   * Poll video provider for completion status
   */
  async function pollForVideoCompletion(provider, taskId, pollInterval, metadata) {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;

      const status = await provider.checkStatus(taskId, metadata);

      if (status.status === 'completed') {
        return status.videoUrl;
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Video generation failed');
      }

      // Update progress
      if (status.progress) {
        updateSpinnerMessage(
          `Generating video... ${Math.round(status.progress * 100)}%`
        );
      }
    }

    throw new Error('Video generation timed out after 5 minutes');
  }

  /**
   * Update UI with provider capabilities
   */
  async function updateProviderCapabilities(providerName) {
    try {
      const { createVideoProvider } = await import('./utils/video-providers.js');

      // Create dummy provider to get capabilities (no API key needed for this)
      const dummyProvider = createVideoProvider(providerName, 'dummy-key-for-capabilities');
      const caps = dummyProvider.getCapabilities();

      // Update UI elements
      const qualityEl = $('providerQuality');
      const timeEl = $('providerTime');
      const costEl = $('providerCost');

      if (qualityEl) {
        qualityEl.textContent = `Quality: ${caps.quality}`;
      }

      if (timeEl) {
        const minutes = Math.floor(caps.estimatedTime / 60);
        const seconds = caps.estimatedTime % 60;
        timeEl.textContent = seconds > 0
          ? `Est. Time: ${minutes} min ${seconds}s`
          : `Est. Time: ${minutes} min`;
      }

      if (costEl) {
        costEl.textContent = `Cost: $${caps.costPer10s}/10s`;
      }

      // Update duration max based on provider capability
      const durationInput = $('videoDuration');
      if (durationInput) {
        durationInput.max = caps.maxDuration;
        if (parseInt(durationInput.value) > caps.maxDuration) {
          durationInput.value = caps.maxDuration;
        }
      }

      // Show note if available
      if (caps.note) {
        console.log(`[Provider Info] ${providerName}: ${caps.note}`);
      }
    } catch (error) {
      console.error('Failed to update provider capabilities:', error);
    }
  }

  function getVideoDimensions(aspectRatio) {
    const quality = $("videoQuality")?.value || "1080p";
    const baseHeight =
      quality === "4k" ? 2160 : quality === "1080p" ? 1080 : 720;

    switch (aspectRatio) {
      case "16:9":
        return { width: Math.round((baseHeight * 16) / 9), height: baseHeight };
      case "9:16":
        return { width: Math.round((baseHeight * 9) / 16), height: baseHeight };
      case "1:1":
        return { width: baseHeight, height: baseHeight };
      case "4:5":
        return { width: Math.round((baseHeight * 4) / 5), height: baseHeight };
      default:
        return { width: 1920, height: 1080 };
    }
  }

  function handleSelectMemes() {
    // Open modal to select memes from library
    const modal = document.createElement("div");
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; overflow-y: auto; padding: 20px;";

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
      const memeLibrary = library.filter((item) => item.contentType === "meme");

      const grid = document.getElementById("memeSelectionGrid");
      grid.innerHTML = memeLibrary
        .map(
          (meme, idx) => `
        <div class="selectable-meme" data-index="${idx}" style="border: 3px solid ${selectedMemesForSlideshow.some((m) => m.id === meme.id) ? "#4299e1" : "transparent"}; border-radius: 8px; overflow: hidden; cursor: pointer;">
          <img src="${meme.url}" style="width: 100%; height: 120px; object-fit: cover;" />
        </div>
      `,
        )
        .join("");

      // Add click handlers
      document.querySelectorAll(".selectable-meme").forEach((el, _idx) => {
        el.addEventListener("click", () => {
          const meme = memeLibrary[_idx];
          const existingIndex = selectedMemesForSlideshow.findIndex(
            (m) => m.id === meme.id,
          );

          if (existingIndex >= 0) {
            selectedMemesForSlideshow.splice(existingIndex, 1);
            el.style.border = "3px solid transparent";
          } else {
            selectedMemesForSlideshow.push(meme);
            el.style.border = "3px solid #4299e1";
          }
        });
      });
    })();

    document
      .getElementById("closeMemeSelector")
      .addEventListener("click", () => {
        document.body.removeChild(modal);
      });

    document
      .getElementById("confirmMemeSelection")
      .addEventListener("click", () => {
        updateSelectedMemesPreview();
        document.body.removeChild(modal);
        addLogEntry(
          `Selected ${selectedMemesForSlideshow.length} memes for slideshow`,
        );
      });
  }

  function updateSelectedMemesPreview() {
    const preview = $("selectedMemesPreview");
    if (!preview) {
      return;
    }

    preview.innerHTML = selectedMemesForSlideshow
      .map(
        (meme) => `
      <img src="${meme.url}" style="width: 100%; height: 60px; object-fit: cover; border-radius: 4px;" />
    `,
      )
      .join("");
  }

  function handleDownloadVideo() {
    if (!videoBlob) {
      addLogEntry("No video to download");
      return;
    }

    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement("a");
    a.href = url;

    const mode = $("videoMode")?.value;
    const extension = mode === "gif" ? ".gif" : ".webm";
    a.download = `video_${Date.now()}${extension}`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLogEntry("Video downloaded");
  }

  async function handleAddVideoToLibrary() {
    if (!videoBlob) {
      addLogEntry("No video to add to library");
      return;
    }

    const videoUrl = URL.createObjectURL(videoBlob);

    const libRes = await readFileAsync(PATHS.LIBRARY);
    const library = libRes.success ? safeParse(libRes.content, []) : [];

    library.unshift({
      url: videoUrl,
      caption: $("videoPrompt")?.value || "Generated video",
      hashtags: "#video #ai",
      platform: "all",
      status: "draft",
      timestamp: new Date().toISOString(),
      id: "video_" + Date.now(),
      contentType: "video",
      videoMode: $("videoMode")?.value,
    });

    await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
    await displayLibraryContent();

    addLogEntry("Video added to library");
  }

  function handleMemeModeChange(ev) {
    const val = ev.target.value;

    const templateLabel = $("memeTemplate")?.parentElement;
    const topTextLabel = $("memeTopText")?.parentElement;
    const bottomTextLabel = $("memeBottomText")?.parentElement;
    const promptLabel = $("promptLabel");
    const actionBtn = $("actionBtn");
    const sourceImageLabel = $("sourceImageLabel");
    const maskImageLabel = $("maskImageLabel");
    const createVarBtn = $("createVariationsBtn");
    const varResults = $("variationResults");

    // Hide all optional fields first
    if (promptLabel) {
      promptLabel.style.display = "none";
    }
    if (actionBtn) {
      actionBtn.style.display = "none";
    }
    if (sourceImageLabel) {
      sourceImageLabel.style.display = "none";
    }
    if (maskImageLabel) {
      maskImageLabel.style.display = "none";
    }
    if (createVarBtn) {
      createVarBtn.style.display = "none";
    }
    if (varResults) {
      varResults.style.display = "none";
    }

    // Show/hide based on mode
    if (val === "template") {
      if (templateLabel) {
        templateLabel.style.display = "";
      }
      if (topTextLabel) {
        topTextLabel.style.display = "";
      }
      if (bottomTextLabel) {
        bottomTextLabel.style.display = "";
      }
    } else if (val === "generate") {
      if (promptLabel) {
        promptLabel.style.display = "";
      }
      if (actionBtn) {
        actionBtn.style.display = "";
      }
      if (actionBtn) {
        actionBtn.textContent = "Generate";
      }
    } else if (val === "edit") {
      if (promptLabel) {
        promptLabel.style.display = "";
      }
      if (sourceImageLabel) {
        sourceImageLabel.style.display = "";
      }
      if (maskImageLabel) {
        maskImageLabel.style.display = "";
      }
      if (actionBtn) {
        actionBtn.style.display = "";
      }
      if (actionBtn) {
        actionBtn.textContent = "Edit Image";
      }
    } else if (val === "variations") {
      if (sourceImageLabel) {
        sourceImageLabel.style.display = "";
      }
      if (createVarBtn) {
        createVarBtn.style.display = "";
      }
      if (varResults) {
        varResults.style.display = "";
      }
    }

    addLogEntry(`Meme mode: ${val}`);
  }

  function handleHashtagModeChange(ev) {
    const val = ev.target.value;
    const manual = $("manualHashtagLabel");
    if (manual) {
      manual.style.display = val === "manual" ? "" : "none";
    }
    addLogEntry(`Hashtag mode: ${val}`);
  }

  async function handleMemeActionClick() {
    const provider = $("aiProvider")?.value || "openai";
    const encryptedKey = $(`${provider}ApiKey`)?.value;

    if (!encryptedKey) {
      $("errorContainer").textContent =
        `Please connect to ${provider === "openai" ? "OpenAI" : "Runway ML"} first!`;
      $("errorContainer").style.display = "block";
      addLogEntry(`AI generation failed — ${provider} not connected`);
      return;
    }

    // Decrypt the API key
    try {
      const decryptResult = await window.api.decrypt(encryptedKey);
      if (!decryptResult.success) {
        throw new Error("Failed to decrypt API key");
      }

      const apiKey = decryptResult.data;
      $("errorContainer").textContent = "";
      $("errorContainer").style.display = "none";

      const mode = $("memeMode")?.value;

      if (mode === "generate") {
        await generateAIImage(apiKey);
      } else if (mode === "edit") {
        await editAIImage(apiKey, provider);
      }
    } catch (error) {
      $("errorContainer").textContent =
        "Failed to access API key: " + error.message;
      $("errorContainer").style.display = "block";
      addLogEntry(`API key access failed: ${error.message}`);
    }
  }

  async function generateAIImage(apiKey) {
    const prompt = $("aiPrompt")?.value?.trim();
    if (!prompt) {
      addLogEntry("Please enter a prompt for AI generation");
      return;
    }

    showSpinner("Generating AI image...");

    try {
      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error?.message || `API error: ${response.status}`,
        );
      }

      const data = await response.json();
      const imageUrl = data.data[0].url;

      // Display in preview
      const preview = $("memePreview");
      if (preview) {
        preview.src = imageUrl;
        preview.style.display = "block";
      }

      // Save to library
      const libRes = await readFileAsync(PATHS.LIBRARY);
      const library = libRes.success ? safeParse(libRes.content, []) : [];
      library.unshift({
        url: imageUrl,
        caption: prompt,
        hashtags: "#ai #generated",
        platform: "all",
        status: "draft",
        timestamp: new Date().toISOString(),
        id: "ai_" + Date.now(),
        contentType: "meme",
      });
      await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
      await displayLibraryContent();

      trackImageGeneration(); // Track cost
      addLogEntry("AI image generated successfully!");
      hideSpinner();
    } catch (error) {
      hideSpinner();
      $("errorContainer").textContent =
        `AI generation failed: ${error.message}`;
      $("errorContainer").style.display = "block";
      addLogEntry(`AI generation error: ${error.message}`);
    }
  }

  async function editAIImage(apiKey) {
    const prompt = $("aiPrompt")?.value?.trim();
    const sourceImageFile = $("sourceImage")?.files[0];

    if (!prompt || !sourceImageFile) {
      addLogEntry("Please provide both an image and edit prompt");
      return;
    }

    showSpinner("Editing image with AI...");

    try {
      // Convert image to PNG and resize if needed (result not used directly)
      await fileToBase64(sourceImageFile);

      const formData = new FormData();
      formData.append("image", sourceImageFile);
      formData.append("prompt", prompt);
      formData.append("n", "1");
      formData.append("size", "1024x1024");

      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error?.message || `API error: ${response.status}`,
        );
      }

      const data = await response.json();
      const imageUrl = data.data[0].url;

      const preview = $("memePreview");
      if (preview) {
        preview.src = imageUrl;
        preview.style.display = "block";
      }

      addLogEntry("AI image edited successfully!");
      hideSpinner();
    } catch (error) {
      hideSpinner();
      $("errorContainer").textContent = `AI editing failed: ${error.message}`;
      $("errorContainer").style.display = "block";
      addLogEntry(`AI editing error: ${error.message}`);
    }
  }

  async function handleCreateVariationsClick() {
    const apiKey = $("apiKey")?.value;
    if (!apiKey) {
      $("errorContainer").textContent =
        "API Key required for creating variations!";
      $("errorContainer").style.display = "block";
      addLogEntry("Variation creation failed — missing API Key");
      return;
    }

    const sourceImageFile = $("sourceImage")?.files[0];
    if (!sourceImageFile) {
      addLogEntry("Please select a source image for variations");
      return;
    }

    $("errorContainer").textContent = "";
    $("errorContainer").style.display = "none";

    showSpinner("Creating variations...");

    try {
      const formData = new FormData();
      formData.append("image", sourceImageFile);
      formData.append("n", "4"); // Create 4 variations
      formData.append("size", "1024x1024");

      const response = await fetch(
        "https://api.openai.com/v1/images/variations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error?.message || `API error: ${response.status}`,
        );
      }

      const data = await response.json();

      // Display variations
      const resultsDiv = $("variationResults");
      if (resultsDiv) {
        const grid = resultsDiv.querySelector("div");
        if (grid) {
          grid.innerHTML = data.data
            .map(
              (img, _idx) => `
            <div style="border: 2px solid #4a90e2; border-radius: 8px; overflow: hidden;">
              <img src="${img.url}" style="width: 100%; height: auto;" />
              <button onclick="window.useVariation('${img.url}')" style="width: 100%; padding: 8px; background: #4a90e2; color: white; border: none; cursor: pointer;">
                Use This
              </button>
            </div>
          `,
            )
            .join("");
        }
      }

      addLogEntry("Created 4 variations successfully!");
      hideSpinner();
    } catch (error) {
      hideSpinner();
      $("errorContainer").textContent =
        `Variation creation failed: ${error.message}`;
      $("errorContainer").style.display = "block";
      addLogEntry(`Variation error: ${error.message}`);
    }
  }

  window.useVariation = function (url) {
    const preview = $("memePreview");
    if (preview) {
      preview.src = url;
      preview.style.display = "block";
    }
    addLogEntry("Variation selected");
  };

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function handlePreviewPost() {
    // Get current meme/content
    const memeUrl = $("memePreview")?.src;
    if (!memeUrl || memeUrl.includes("svg")) {
      showNotification("Please generate or select content to preview first!", "warning");
      return;
    }

    // Get caption
    const topText = $("topText")?.value || "";
    const bottomText = $("bottomText")?.value || "";
    const caption = topText && bottomText ? `${topText} ${bottomText}` : topText || bottomText || "";

    // Show preview modal
    showPreview({
      imageUrl: memeUrl,
      caption: caption
    });
  }

  function handlePostNow() {
    const hasInstagram = $("instagramToken")?.value;
    const hasTiktok = $("tiktokToken")?.value;
    const hasYoutube = $("youtubeToken")?.value;
    const hasTwitter = $("twitterToken")?.value;

    if (!hasInstagram && !hasTiktok && !hasYoutube && !hasTwitter) {
      $("errorContainer").textContent =
        "Please provide at least one social media token before posting!";
      $("errorContainer").style.display = "block";
      addLogEntry("Post Now failed — missing social media token");
      return;
    }
    $("errorContainer").textContent = "";
    $("errorContainer").style.display = "none";

    executePost();
  }

  async function executePost() {
    const memeUrl = $("memePreview")?.src;
    if (!memeUrl || memeUrl.includes("svg")) {
      $("errorContainer").textContent =
        "Please generate or select content to post first!";
      $("errorContainer").style.display = "block";
      return;
    }

    const caption =
      `${$("memeTopText")?.value || ""} ${$("memeBottomText")?.value || ""}`.trim();
    const hashtagMode = $("hashtagMode")?.value;
    const hashtags =
      hashtagMode === "manual"
        ? $("manualHashtags")?.value || ""
        : "#meme #funny #viral";

    const fullCaption = `${caption}\n\n${hashtags}`.trim();

    showSpinner("Preparing to post...");
    let successCount = 0;
    let failCount = 0;

    // Post to selected platforms
    if ($("instagram")?.checked && $("instagramToken")?.value) {
      updateSpinnerMessage("Posting to Instagram...");
      const result = await postToInstagram(
        memeUrl,
        fullCaption,
        $("instagramToken").value,
      );
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    if ($("tiktok")?.checked && $("tiktokToken")?.value) {
      updateSpinnerMessage("Posting to TikTok...");
      const result = await postToTikTok(
        memeUrl,
        fullCaption,
        $("tiktokToken").value,
      );
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    if ($("youtube")?.checked && $("youtubeToken")?.value) {
      updateSpinnerMessage("Posting to YouTube...");
      const result = await postToYouTube(
        memeUrl,
        fullCaption,
        $("youtubeToken").value,
      );
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    if ($("twitter")?.checked && $("twitterToken")?.value) {
      updateSpinnerMessage("Posting to Twitter...");
      const result = await postToTwitter(
        memeUrl,
        fullCaption,
        $("twitterToken").value,
      );
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    hideSpinner();

    // OAuth login triggers
    document
      .getElementById("connectInstagramBtn")
      ?.addEventListener("click", () => {
        window.open("https://your-oauth-server.com/auth/instagram", "_blank");
      });

    document
      .getElementById("connectTikTokBtn")
      ?.addEventListener("click", () => {
        window.open("https://your-oauth-server.com/auth/tiktok", "_blank");
      });

    document
      .getElementById("connectYouTubeBtn")
      ?.addEventListener("click", () => {
        window.open("https://your-oauth-server.com/auth/youtube", "_blank");
      });

    document
      .getElementById("connectTwitterBtn")
      ?.addEventListener("click", () => {
        window.open("https://your-oauth-server.com/auth/twitter", "_blank");
      });

    // Save to library with posted status
    if (successCount > 0) {
      const libRes = await readFileAsync(PATHS.LIBRARY);
      const library = libRes.success ? safeParse(libRes.content, []) : [];
      library.unshift({
        url: memeUrl,
        caption: caption,
        hashtags: hashtags,
        platform: "multi",
        status: "posted",
        postedAt: new Date().toISOString(),
        id: "post_" + Date.now(),
        contentType: "meme",
        successCount: successCount,
        failCount: failCount,
      });
      await writeFileAsync(PATHS.LIBRARY, JSON.stringify(library, null, 2));
      await displayLibraryContent();
    }

    const message = `Posted successfully to ${successCount} platform(s)${failCount > 0 ? `, ${failCount} failed` : ""}`;
    addLogEntry(message);

    if (window.Toast) {
      if (failCount > 0) {
        window.Toast.warning(message);
      } else {
        window.Toast.success(message);
      }
    } else {
      alert(message);
    }
  }

  async function postToInstagram(imageUrl, caption, token) {
    try {
      // (No local image blob needed) Ensure URL is accessible before posting

      // Step 1: Create media container
      const formData = new FormData();
      formData.append("image_url", imageUrl);
      formData.append("caption", caption);
      formData.append("access_token", token);

      const containerResponse = await fetch(
        "https://graph.facebook.com/v18.0/me/media",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!containerResponse.ok) {
        const error = await containerResponse.json();
        throw new Error(error.error?.message || "Instagram API error");
      }

      const containerData = await containerResponse.json();

      // Step 2: Publish the media
      const publishResponse = await fetch(
        "https://graph.facebook.com/v18.0/me/media_publish",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: containerData.id,
            access_token: token,
          }),
        },
      );

      if (!publishResponse.ok) {
        const error = await publishResponse.json();
        throw new Error(error.error?.message || "Instagram publish error");
      }

      addLogEntry("✅ Posted to Instagram successfully");
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
      const response = await fetch(
        "https://open.tiktokapis.com/v2/post/publish/content/init/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            post_info: {
              title: caption,
              privacy_level: "SELF_ONLY", // or PUBLIC_TO_EVERYONE
              disable_duet: false,
              disable_comment: false,
              disable_stitch: false,
              video_cover_timestamp_ms: 1000,
            },
            source_info: {
              source: "FILE_UPLOAD",
              video_url: imageUrl,
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "TikTok API error");
      }

      addLogEntry("✅ Posted to TikTok successfully");
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
        "https://www.googleapis.com/youtube/v3/activities?part=snippet",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            snippet: {
              description: caption,
              type: "upload",
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "YouTube API error");
      }

      addLogEntry("✅ Posted to YouTube successfully");
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
      const imageBlob = await fetch(imageUrl).then((r) => r.blob());
      const imageBuffer = await imageBlob.arrayBuffer();
      const base64Image = btoa(
        String.fromCharCode(...new Uint8Array(imageBuffer)),
      );

      // Step 2: Upload media
      const uploadResponse = await fetch(
        "https://upload.twitter.com/1.1/media/upload.json",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `media_data=${encodeURIComponent(base64Image)}`,
        },
      );

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(
          error.errors?.[0]?.message || "Twitter media upload error",
        );
      }

      const mediaData = await uploadResponse.json();

      // Step 3: Create tweet with media
      const tweetResponse = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: caption,
          media: {
            media_ids: [mediaData.media_id_string],
          },
        }),
      });

      if (!tweetResponse.ok) {
        const error = await tweetResponse.json();
        throw new Error(error.errors?.[0]?.message || "Twitter post error");
      }

      addLogEntry("✅ Posted to Twitter successfully");
      return { success: true };
    } catch (error) {
      addLogEntry(`❌ Twitter posting failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  function addDownloadButton() {
    const preview = $("memePreview");
    if (!preview || !preview.parentElement) {
      return;
    }

    const existing = $("downloadMemeBtn");
    if (existing) {
      return;
    }

    const btn = document.createElement("button");
    btn.id = "downloadMemeBtn";
    btn.textContent = "Download Meme";
    btn.style.cssText =
      "margin-top: 10px; padding: 8px 16px; background: var(--blue-gradient); color: white; border: none; border-radius: 8px; cursor: pointer;";

    btn.addEventListener("click", async () => {
      if (!preview.src || preview.src.includes("svg")) {
        return;
      }

      try {
        const response = await fetch(preview.src);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `meme_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        addLogEntry("Meme downloaded");
      } catch (error) {
        addLogEntry(`Download failed: ${error.message}`);
      }
    });

    preview.parentElement.appendChild(btn);
  }
  window.addDownloadButton = addDownloadButton;

  // UI BINDING
  function bindUi() {
    console.warn("Binding UI event handlers...");

    // Core buttons
    const buttonBindings = {
      saveConfigBtn: handleSaveConfig,
      previewPostBtn: handlePreviewPost,
      postNowBtn: handlePostNow,
      bulkGenerateBtn: openBulkModal,
      closeBulkModal: closeBulkModal,
      startBulkGeneration: startBulkGeneration,
      saveMemeToLibrary: saveMemeToLibrary, // Save meme to library button
    };

    // Bind each button and log result
    Object.entries(buttonBindings).forEach(([id, handler]) => {
      const element = $(id);
      if (element) {
        element.addEventListener("click", handler);
        console.warn(`Bound handler to ${id}`);
      } else {
        console.warn(`Element not found: ${id}`);
      }
    });

    // Bind dark mode toggle separately since it's a change event
    const darkModeToggle = $("darkModeToggle");
    if (darkModeToggle) {
      darkModeToggle.addEventListener("change", handleDarkModeToggle);
      console.warn("Bound dark mode toggle handler");
    }

    $("downloadBulkZip")?.addEventListener("click", downloadBulkZip);
    $("downloadBulkCSV")?.addEventListener("click", downloadBulkCSV);

    $("bulkContentType")?.addEventListener(
      "change",
      handleBulkContentTypeChange,
    );
    $("bulkTemplateStrategy")?.addEventListener(
      "change",
      handleBulkTemplateStrategyChange,
    );
    $("bulkTextMode")?.addEventListener("change", handleBulkTextModeChange);
    $("bulkHashtagMode")?.addEventListener(
      "change",
      handleBulkHashtagModeChange,
    );

    // FIXED: Single, clean schedulePostBtn handler
    $("schedulePostBtn")?.addEventListener("click", async (e) => {
      clearError();
      e.preventDefault();

      // Check if user selected content from library
      if (!window.selectedContentForScheduling) {
        displayValidationError(
          {
            message:
              "Please select content from the library by clicking on a content card",
          },
          "scheduled post",
        );
        addLogEntry(
          "⚠️ No content selected: Click on a content card in the Library to select it for scheduling",
          "warning",
        );
        return;
      }

      // Load the selected content
      const libRes = await readFileAsync(PATHS.LIBRARY);
      if (!libRes.success) {
        displayValidationError(
          { message: "Failed to load library" },
          "scheduled post",
        );
        return;
      }

      const library = safeParse(libRes.content, []);
      const selectedContent = library.find(
        (item) => item.id === window.selectedContentForScheduling,
      );

      if (!selectedContent) {
        displayValidationError(
          { message: "Selected content not found in library" },
          "scheduled post",
        );
        return;
      }

      const dt = $("scheduleDateTime")?.value;
      if (!dt) {
        displayValidationError(
          { message: "Schedule date/time is required" },
          "scheduled post",
        );
        return;
      }

      // Check if at least one platform is selected
      const selectedPlatforms = [];
      if ($("instagram")?.checked) {
        selectedPlatforms.push("instagram");
      }
      if ($("tiktok")?.checked) {
        selectedPlatforms.push("tiktok");
      }
      if ($("youtube")?.checked) {
        selectedPlatforms.push("youtube");
      }
      if ($("twitter")?.checked) {
        selectedPlatforms.push("twitter");
      }

      if (selectedPlatforms.length === 0) {
        displayValidationError(
          { message: "Please select at least one platform" },
          "scheduled post",
        );
        addLogEntry(
          "⚠️ No platforms selected. Check at least one platform checkbox.",
          "warning",
        );
        return;
      }

      const form = $("settingsForm");

      // Use content from library, optionally override caption/hashtags
      const caption = $("captionText")?.value || selectedContent.caption || "";
      const hashtags =
        $("hashtagsText")?.value || selectedContent.hashtags || "";

      const post = {
        id:
          "post_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        contentId: selectedContent.id,
        createdAt: new Date().toISOString(),
        scheduleTime: dt,
        status: "pending",
        posted: false,
        platforms: selectedPlatforms,
        recurrence: $("recurrenceSelect")?.value || "none",
        timezone: $("timezoneSelect")?.value || "UTC",
        content: selectedContent.url,
        caption: caption,
        hashtags: hashtags,
        type: selectedContent.type,
        metadata: selectedContent.metadata,
        source: {},
      };
      if (form) {
        const inputs = form.querySelectorAll("input,select,textarea");
        inputs.forEach((el) => {
          if (!el.id) {
            return;
          }
          if (el.type === "checkbox") {
            post.source[el.id] = el.checked;
          } else {
            post.source[el.id] = el.value;
          }
        });
      }

      const r = await readFileAsync(PATHS.SCHEDULED_POSTS);
      let data = r.success
        ? safeParse(r.content, { posts: [] })
        : { posts: [] };

      // Handle legacy flat array format
      if (Array.isArray(data)) {
        data = { posts: data };
      }
      if (!data.posts || !Array.isArray(data.posts)) {
        data = { posts: [] };
      }

      data.posts.unshift(post);

      const w = await writeFileAsync(
        PATHS.SCHEDULED_POSTS,
        JSON.stringify(data, null, 2),
      );
      if (w.success) {
        clearError();
        const scheduledDate = new Date(dt).toLocaleString();
        addLogEntry(
          `✅ Post scheduled for ${scheduledDate} on ${selectedPlatforms.join(", ")}`,
          "success",
        );
        await populateScheduledPosts();
      } else {
        displayValidationError(w.error, "scheduled post");
      }
    });

    $("darkModeToggle")?.addEventListener("change", handleDarkModeToggle);
    $("contentType")?.addEventListener("change", handleContentTypeChange);
    $("memeMode")?.addEventListener("change", handleMemeModeChange);
    $("videoMode")?.addEventListener("change", handleVideoModeChange);
    $("hashtagMode")?.addEventListener("change", handleHashtagModeChange);

    const actionBtn = $("actionBtn");
    if (actionBtn) {
      actionBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleMemeActionClick();
      });
    }

    const createVarBtn = $("createVariationsBtn");
    if (createVarBtn) {
      createVarBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleCreateVariationsClick();
      });
    }

    // Video generation buttons
    $("generateVideoBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      handleGenerateVideo();
    });

    $("selectMemesBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      handleSelectMemes();
    });

    $("downloadVideoBtn")?.addEventListener("click", handleDownloadVideo);
    $("addVideoToLibraryBtn")?.addEventListener(
      "click",
      handleAddVideoToLibrary,
    );

    // Meme search handler
    $("memeSearch")?.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const select = $("memeTemplate");
      if (!select) {
        return;
      }

      const filtered = allTemplates.filter((t) =>
        (t.name || t.id).toLowerCase().includes(searchTerm),
      );

      let html = '<option value="ai-generator">🤖 AI Generator</option>';
      html += filtered
        .map((t) => `<option value="${t.id}">${t.name || t.id}</option>`)
        .join("");
      select.innerHTML = html;
    });

    ["memeTemplate", "memeTopText", "memeBottomText"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener("input", updateMemePreview);
        el.addEventListener("change", updateMemePreview);
      }
    });

    $("contentType")?.dispatchEvent(new Event("change"));
    $("memeMode")?.dispatchEvent(new Event("change"));
    $("videoMode")?.dispatchEvent(new Event("change"));
    $("hashtagMode")?.dispatchEvent(new Event("change"));

    // No diagnostic toggles in normal mode

    $("librarySearch")?.addEventListener("input", displayLibraryContent);
    $("libraryFilter")?.addEventListener("change", displayLibraryContent);

    // Setup AI Provider connection buttons
    $("connectOpenAIBtn")?.addEventListener("click", () =>
      openAiKeyModal("openai"),
    );
    $("connectRunwayMLBtn")?.addEventListener("click", () =>
      openAiKeyModal("runway"),
    );

    // AI Key Modal controls
    $("closeAiKeyModal")?.addEventListener("click", closeAiKeyModal);
    $("testAiConnection")?.addEventListener("click", testAiConnection);
    $("saveAiKey")?.addEventListener("click", saveAiKey);
    $("toggleAiKeyVisibility")?.addEventListener(
      "click",
      toggleAiKeyVisibility,
    );

    // Close modal when clicking outside
    $("aiKeyModal")?.addEventListener("click", (e) => {
      if (e.target.id === "aiKeyModal") {
        closeAiKeyModal();
      }
    });

    // Setup OAuth button triggers
    const socialPlatforms = ["Instagram", "TikTok", "YouTube", "Twitter"];
    socialPlatforms.forEach((platform) => {
      const btn = $(`connect${platform}Btn`);
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          (async () => {
            try {
              if (!window.api?.startOAuth) {
                throw new Error("OAuth API not available");
              }

              // Disable button and show connecting state (spinner + pending badge)
              btn.disabled = true;
              const originalText = btn.getAttribute('data-original-text') || btn.textContent;
              btn.setAttribute('data-original-text', originalText);
              setProviderConnecting(platform.toLowerCase());

              // Try to start OAuth. If main indicates credentials are missing, open the provider config modal.
              const res = await window.api.startOAuth(platform.toLowerCase());

              if (res && res.success === false) {
                // Handle structured failures: credentials missing or user-cancel
                const msg = res.error?.message || "OAuth failed";
                if (res.reason === "canceled") {
                  // User closed the OAuth window — benign cancel
                  showNotification("OAuth flow canceled by user", "warning");
                  btn.disabled = false;
                  setProviderDisconnected(platform.toLowerCase());
                  return;
                }
                // If message mentions credentials not configured, open modal
                if (msg.toLowerCase().includes("credentials not configured")) {
                  openProviderConfigModal(platform.toLowerCase());
                } else {
                  displayError(new Error(msg));
                }
                btn.disabled = false;
                setProviderDisconnected(platform.toLowerCase());
                return;
              }

              addLogEntry(`Started OAuth flow for ${platform}`);
              // Do not re-enable here; button will be updated when oauth-token event arrives
            } catch (err) {
              displayError(err);
              btn.disabled = false;
              setProviderDisconnected(platform.toLowerCase());
            }
          })();
        });
      }

      // Setup disconnect button for each platform
      const disc = $(`disconnect${platform}Btn`);
      if (disc) {
        disc.addEventListener("click", async (e) => {
          e.preventDefault();
          try {
            // Show pending badge while disconnecting
            setProviderPending(platform.toLowerCase());
            const res = await window.api.disconnect(platform.toLowerCase());
            if (res && res.success) {
              addLogEntry(`${platform} disconnected`, "info");
              // Toggle UI: hide disconnect, reset connect button
              setProviderDisconnected(platform.toLowerCase());
              disc.style.display = "none";
            } else {
              setProviderDisconnected(platform.toLowerCase());
              throw new Error(res?.error?.message || "Disconnect failed");
            }
          } catch (err) {
            displayError(err);
          }
        });
      }
    });

    // Listen for reset completion events from main process
    if (window.api && window.api.onResetDone) {
      window.api.onResetDone((data) => {
        try {
          if (data && data.full) {
            showNotification("Factory reset completed — provider configs and API keys removed", "success");
            addLogEntry("🧨 Factory reset completed", "info");
          } else {
            showNotification("Connections reset and activity log cleared", "success");
            addLogEntry("✅ Connections reset and activity log cleared", "info");
          }
          // Ensure UI state is fully reset so modals and inputs are usable without restarting
          try {
            ["instagram", "tiktok", "youtube", "twitter"].forEach(setProviderDisconnected);
            // Close provider config modal if open and clear inputs
            if (typeof providerModal !== "undefined" && providerModal) {
              providerModal.style.display = "none";
            }

            // Clear and enable the provider modal inputs if present
            try {
              const inputs = ["providerClientId", "providerClientSecret", "providerRedirectUri"];
              inputs.forEach((id) => {
                const el = $(id);
                if (el) {
                  el.disabled = false;
                  el.readOnly = false;
                  // Only clear visible values when factory reset (full)
                  if (data && data.full) {el.value = "";}
                }
              });

              // Also clear and enable AI provider fields on full reset
              if (data && data.full) {
                ["openaiApiKey", "runwayApiKey", "aiProvider"].forEach((id) => {
                  const el = $(id);
                  if (el) {
                    el.value = "";
                    el.disabled = false;
                    el.readOnly = false;
                  }
                });
              }
            } catch (inner) {
              console.warn("Failed to clear/enable provider modal inputs:", inner);
            }

            // Ensure progress overlay is hidden
            hideProgress();
            // Prevent renderer from immediately overwriting settings.json for a short window
            try {
              settingsWriteLockUntil = Date.now() + 3000; // 3 seconds
            } catch (lockErr) {
              console.warn('Failed to set settings write lock:', lockErr);
            }
          } catch (uiErr) {
            console.warn("Error while normalizing UI after reset:", uiErr);
          }
        } catch (e) {
          console.warn("onResetDone handler error:", e);
        }
      });
    }

    // Listen for settings updates from main and refresh UI/cache accordingly
    if (window.api && window.api.onSettingsUpdated) {
      window.api.onSettingsUpdated(async (newSettings) => {
        try {
          // Normalize and decrypt any sensitive fields
          const settings = newSettings || {};

          // Check if this is a recent reset
          const lastReset = settings.__last_reset ? new Date(settings.__last_reset).getTime() : 0;
          const isRecentReset = (Date.now() - lastReset) < 5000;

          // Update provider modal inputs if open
          if (typeof providerModal !== "undefined" && providerModal && providerModal.style.display === "flex") {
            // Attempt to pre-fill using the new settings.providers entry
            const prov = (settings.providers && settings.providers[_activeProviderForConfig]) || {};
            if (providerClientIdInput) {
              providerClientIdInput.value = isRecentReset ? "" : (prov.clientId || "");
              providerClientIdInput.disabled = false;
              providerClientIdInput.readOnly = false;
            }
            if (providerClientSecretInput) {
              providerClientSecretInput.value = ""; // never pre-fill secret
              providerClientSecretInput.disabled = false;
              providerClientSecretInput.readOnly = false;
            }
            if (providerRedirectInput) {
              providerRedirectInput.value = isRecentReset ? "http://localhost:3000/oauth/callback" : (prov.redirectUri || providerRedirectInput.value || "http://localhost:3000/oauth/callback");
              providerRedirectInput.disabled = false;
              providerRedirectInput.readOnly = false;
            }
          }

          // If settings were cleared (factory reset), ensure provider badges are updated
          if (!settings.providers || Object.keys(settings.providers).length === 0) {
            ["instagram", "tiktok", "youtube", "twitter"].forEach(setProviderDisconnected);
          }
        } catch (err) {
          console.warn("onSettingsUpdated handler error:", err);
        }
      });
    }

    // Single Reset button - performs a full factory reset (clear tokens, provider configs, AI keys, logs)
    const resetAllBtn = $("resetAllBtn");
    if (resetAllBtn) {
      resetAllBtn.addEventListener("click", async () => {
        const ok = confirm(
          "RESET: This will remove ALL saved provider configurations, API keys, tokens, and clear all connections and logs. This cannot be undone. Proceed?"
        );
        if (!ok) {return;}
        try {
          // Preemptively lock settings writes in renderer to avoid races
          try {
            settingsWriteLockUntil = Date.now() + 3000;
          } catch {
            // ignore
          }
          showProgress("Performing reset...");
          const res = await window.api.resetConnections({ full: true });
          hideProgress();
          if (res && res.success) {
            addLogEntry("🧨 Reset performed", "info");
            showNotification("Reset complete. Restarting app...", "success");
            // Close and reopen the app for cleanest reset
            setTimeout(() => {
              if (window.api && window.api.restartApp) {
                window.api.restartApp();
              } else {
                // Fallback: force hard reload by changing href
                const currentUrl = window.location.href;
                window.location.href = currentUrl + '#reset';
                window.location.reload();
              }
            }, 2500);
          } else {
            throw new Error(res?.error?.message || "Reset failed");
          }
        } catch (err) {
          hideProgress();
          displayError(err);
        }
      });
    }

    // Initialize connect/disconnect button states based on tokens.json
    (async function initSocialButtonStates() {
      try {
        const t = await window.api.readFile('data/tokens.json');
        const tokens = t.success ? JSON.parse(t.content || '{}') : {};
        socialPlatforms.forEach((platform) => {
          const p = platform.toLowerCase();
          const connectBtn = $(`connect${platform}Btn`);
          const discBtn = $(`disconnect${platform}Btn`);
            if (tokens[p]) {
              if (connectBtn) {
                setProviderConnected(p);
              }
              if (discBtn) {discBtn.style.display = '';}
            } else {
              if (connectBtn) {
                setProviderDisconnected(p);
              }
              if (discBtn) {discBtn.style.display = 'none';}
            }
        });
      } catch {
        // tokens.json may not exist yet - that's fine
      }
    })();
  }

  // Provider Config Modal logic
  const providerModal = $("providerConfigModal");
  const providerTitle = $("providerConfigTitle");
  const providerClientIdInput = $("providerClientId");
  const providerClientSecretInput = $("providerClientSecret");
  const providerRedirectInput = $("providerRedirectUri");
  const saveProviderConfigBtn = $("saveProviderConfig");
  const cancelProviderConfigBtn = $("cancelProviderConfig");
  const closeProviderConfigBtn = $("closeProviderConfig");

  let _activeProviderForConfig = null;

  function openProviderConfigModal(provider) {
    _activeProviderForConfig = provider;
    providerTitle.textContent = `Configure ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;

    // Set developer portal link based on provider
    const portalLinks = {
      instagram: "https://developers.facebook.com/apps/",
      tiktok: "https://developers.tiktok.com/",
      youtube: "https://console.cloud.google.com/",
      twitter: "https://developer.twitter.com/en/portal/dashboard"
    };
    const providerPortalLink = document.getElementById("providerPortalLink");
    if (providerPortalLink) {
      providerPortalLink.href = portalLinks[provider] || "#";
    }

    // Try to pre-fill from settings
    // Read settings and pre-fill BEFORE showing the modal to avoid stale values
    (async () => {
      try {
        // Always read fresh from disk to avoid cached values after reset
        const s = await window.api.readFile(PATHS.SETTINGS);
        const settings = s.success ? JSON.parse(s.content || "{}") : {};
        const prov = (settings.providers && settings.providers[provider]) || {};

        // Check if settings were recently reset (within last 5 seconds)
        const lastReset = settings.__last_reset ? new Date(settings.__last_reset).getTime() : 0;
        const isRecentReset = (Date.now() - lastReset) < 5000;

        if (providerClientIdInput) {
          // If reset recently, always use blank value
          providerClientIdInput.value = isRecentReset ? "" : (prov.clientId || "");
          providerClientIdInput.disabled = false;
          providerClientIdInput.readOnly = false;
        }
        // Do not pre-fill secret (decryption would be server-side); show blank for security
        if (providerClientSecretInput) {
          providerClientSecretInput.value = "";
          providerClientSecretInput.disabled = false;
          providerClientSecretInput.readOnly = false;
        }
        if (providerRedirectInput) {
          providerRedirectInput.value = isRecentReset ? (PATHS.REDIRECT_URI || "http://localhost:3000/oauth/callback") : (prov.redirectUri || providerRedirectInput.value || PATHS.REDIRECT_URI || "http://localhost:3000/oauth/callback");
          providerRedirectInput.disabled = false;
          providerRedirectInput.readOnly = false;
        }
      } catch {
        if (providerClientIdInput) {
          providerClientIdInput.value = "";
          providerClientIdInput.disabled = false;
          providerClientIdInput.readOnly = false;
        }
        if (providerClientSecretInput) {
          providerClientSecretInput.value = "";
          providerClientSecretInput.disabled = false;
          providerClientSecretInput.readOnly = false;
        }
        if (providerRedirectInput) {
          providerRedirectInput.value = "";
          providerRedirectInput.disabled = false;
          providerRedirectInput.readOnly = false;
        }
      } finally {
        // Show modal after pre-fill completes
        if (providerModal) {providerModal.style.display = "flex";}

        // CRITICAL: Force fields to be editable after modal is shown
        // This ensures no other code can leave them disabled
        setTimeout(() => {
          if (providerClientIdInput) {
            providerClientIdInput.disabled = false;
            providerClientIdInput.readOnly = false;
            providerClientIdInput.removeAttribute('disabled');
            providerClientIdInput.removeAttribute('readonly');
          }
          if (providerClientSecretInput) {
            providerClientSecretInput.disabled = false;
            providerClientSecretInput.readOnly = false;
            providerClientSecretInput.removeAttribute('disabled');
            providerClientSecretInput.removeAttribute('readonly');
          }
          if (providerRedirectInput) {
            providerRedirectInput.disabled = false;
            providerRedirectInput.readOnly = false;
            providerRedirectInput.removeAttribute('disabled');
            providerRedirectInput.removeAttribute('readonly');
          }
        }, 100);
      }
    })();
  }

  function closeProviderConfigModal() {
    _activeProviderForConfig = null;
    if (providerModal) {providerModal.style.display = "none";}
  }

  // UI helpers for provider status badges and spinner
  function _badgeIdFor(provider) {
    return `status-${provider}`;
  }
  function _spinnerIdFor(provider) {
    return `spinner-${provider}`;
  }

  function setProviderConnecting(provider) {
    const badge = $(_badgeIdFor(provider));
    const spinner = $(_spinnerIdFor(provider));
    const btn = $(`connect${provider.charAt(0).toUpperCase() + provider.slice(1)}Btn`);
    if (badge) {
      badge.textContent = 'Pending';
      badge.classList.remove('missing', 'connected');
      badge.classList.add('pending');
    }
    if (spinner) {spinner.classList.add('visible');}
    if (btn) {btn.disabled = true;}
  }

  function setProviderPending(provider) {
    // alias for clarity when disconnecting
    setProviderConnecting(provider);
  }

  function setProviderConnected(provider) {
    const badge = $(_badgeIdFor(provider));
    const spinner = $(_spinnerIdFor(provider));
    const btn = $(`connect${provider.charAt(0).toUpperCase() + provider.slice(1)}Btn`);
    if (badge) {
      badge.textContent = 'Connected';
      badge.classList.remove('missing', 'pending');
      badge.classList.add('connected');
    }
    if (spinner) {spinner.classList.remove('visible');}
    if (btn) {
      btn.disabled = false;
      btn.classList.add('connected');
      // update only the leading text node so we don't remove badge elements
      for (const node of Array.from(btn.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.nodeValue = `🔗 Connect ${provider.charAt(0).toUpperCase() + provider.slice(1)} `;
          break;
        }
      }
    }
  }

  function setProviderDisconnected(provider) {
    const badge = $(_badgeIdFor(provider));
    const spinner = $(_spinnerIdFor(provider));
    const btn = $(`connect${provider.charAt(0).toUpperCase() + provider.slice(1)}Btn`);
    if (badge) {
      badge.textContent = 'Missing';
      badge.classList.remove('connected', 'pending');
      badge.classList.add('missing');
    }
    if (spinner) {spinner.classList.remove('visible');}
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('connected');
      const label = provider.charAt(0).toUpperCase() + provider.slice(1);
      // update only the leading text node so we don't remove badge elements
      for (const node of Array.from(btn.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.nodeValue = `🔗 Connect ${label} `;
          break;
        }
      }
    }
  }

  if (cancelProviderConfigBtn) {cancelProviderConfigBtn.addEventListener("click", closeProviderConfigModal);}
  if (closeProviderConfigBtn) {closeProviderConfigBtn.addEventListener("click", closeProviderConfigModal);}

  if (saveProviderConfigBtn) {
    saveProviderConfigBtn.addEventListener("click", async () => {
      if (!_activeProviderForConfig) {return;}
      const provider = _activeProviderForConfig;
      const clientId = providerClientIdInput.value.trim();
      const clientSecret = providerClientSecretInput.value;
      const redirectUri = providerRedirectInput.value.trim() || PATHS.REDIRECT_URI || "http://localhost:3000/oauth/callback";

      if (!clientId) {
        displayError(new Error("Client ID is required"));
        return;
      }

      try {
        // Encrypt clientSecret using the main encrypt helper via preload
        const encRes = clientSecret ? await window.api.encrypt(clientSecret) : { success: true, data: "" };
        if (!encRes.success) {
          throw new Error(encRes.error?.message || "Encryption failed");
        }

        // Read settings, update providers, and save
        const settingsRes = await window.api.readFile(PATHS.SETTINGS);
        const settings = settingsRes.success ? JSON.parse(settingsRes.content || "{}") : {};
        settings.providers = settings.providers || {};
        settings.providers[provider] = {
          clientId: clientId,
          clientSecret: encRes.data || "",
          redirectUri: redirectUri,
        };

        const writeRes = await writeFileAsync(PATHS.SETTINGS, JSON.stringify(settings, null, 2));
        if (!writeRes.success) {
          throw new Error(writeRes.error?.message || "Failed to save settings");
        }

        addLogEntry(`Saved ${provider} configuration`, "success");

        closeProviderConfigModal();

        // Start OAuth immediately after saving
        const startRes = await window.api.startOAuth(provider);
        if (startRes && startRes.success === false) {
          displayError(new Error(startRes.error?.message || "Failed to start OAuth"));
          return;
        }
      } catch (err) {
        displayError(err);
      }
    });
  }

  // AI PROVIDER AUTHENTICATION SYSTEM
  let currentAiProvider = null;
  const aiProviderInfo = {
    openai: {
      name: "OpenAI",
      helpText: `
        <p><strong>Where to get your API key:</strong></p>
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #4a90e2;">platform.openai.com/api-keys</a></li>
          <li>Click "Create new secret key"</li>
          <li>Copy the key (starts with "sk-")</li>
          <li>Paste it here</li>
        </ol>
        <p style="margin-top: 10px; font-size: 0.8rem;"><strong>Note:</strong> You'll need billing enabled on your OpenAI account.</p>
      `,
      testEndpoint: "https://api.openai.com/v1/models",
      keyPattern: /^sk-/,
    },
    runway: {
      name: "Runway ML",
      helpText: `
        <p><strong>Where to get your API key:</strong></p>
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Go to <a href="https://app.runwayml.com/account" target="_blank" style="color: #4a90e2;">app.runwayml.com/account</a></li>
          <li>Navigate to API Keys section</li>
          <li>Create a new API key</li>
          <li>Paste it here</li>
        </ol>
        <p style="margin-top: 10px; font-size: 0.8rem;"><strong>Note:</strong> Runway requires a paid subscription for API access.</p>
      `,
    },
    luma: {
      name: "Luma AI",
      helpText: `
        <p><strong>Where to get your API key:</strong></p>
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Go to <a href="https://lumalabs.ai/dream-machine/api" target="_blank" style="color: #4a90e2;">lumalabs.ai/dream-machine/api</a></li>
          <li>Sign up or log in to your Luma account</li>
          <li>Navigate to API settings</li>
          <li>Generate a new API key</li>
          <li>Paste it here</li>
        </ol>
        <p style="margin-top: 10px; font-size: 0.8rem;"><strong>Note:</strong> Luma offers fast, affordable AI video generation.</p>
      `,
    },
  };

  function openAiKeyModal(provider) {
    currentAiProvider = provider;
    const modal = $("aiKeyModal");
    const info = aiProviderInfo[provider];

    if (!modal || !info) {
      return;
    }

    // Update modal content
    $("aiModalTitle").textContent = `Connect to ${info.name}`;
    $("aiModalLegend").textContent = `${info.name} API Key`;
    $("aiKeyHelp").innerHTML = info.helpText;
    $("aiKeyInput").value = "";
    $("aiKeyInput").type = "password";
    $("toggleAiKeyVisibility").textContent = "Show API Key";
    $("aiKeyStatus").style.display = "none";

    // Check if already connected
    const existingKey = $(`${provider}ApiKey`)?.value;
    if (existingKey) {
      $("aiKeyInput").placeholder = "••••••••••••••••••••";
    }

    // Show modal
    modal.classList.add("show");
    modal.style.display = "flex";
  }

  function closeAiKeyModal() {
    const modal = $("aiKeyModal");
    if (modal) {
      modal.classList.remove("show");
      modal.style.display = "none";
    }
    currentAiProvider = null;
  }

  function showAiKeyStatus(message, type) {
    const status = $("aiKeyStatus");
    if (status) {
      status.textContent = message;
      status.className = type; // 'success' or 'error'
      status.style.display = "block";
    }
  }

  async function testAiConnection() {
    const apiKey = $("aiKeyInput")?.value?.trim();
    if (!apiKey) {
      showAiKeyStatus("Please enter an API key", "error");
      return;
    }

    const info = aiProviderInfo[currentAiProvider];
    if (!info) {
      return;
    }

    // Validate key format for OpenAI
    if (
      currentAiProvider === "openai" &&
      info.keyPattern &&
      !info.keyPattern.test(apiKey)
    ) {
      showAiKeyStatus(
        'Invalid API key format. OpenAI keys start with "sk-"',
        "error",
      );
      return;
    }

    showAiKeyStatus("Testing connection...", "info");

    try {
      if (currentAiProvider === "openai") {
        // Test OpenAI connection
        const response = await fetch(info.testEndpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (response.ok) {
          showAiKeyStatus("✓ Connection successful!", "success");
        } else if (response.status === 401) {
          showAiKeyStatus("✗ Invalid API key", "error");
        } else {
          showAiKeyStatus(`✗ Connection failed (${response.status})`, "error");
        }
      } else {
        // For Runway and other providers, just save (they don't have easy test endpoints)
        showAiKeyStatus("⚠ API key will be validated on first use", "success");
      }
    } catch (error) {
      showAiKeyStatus("✗ Connection test failed: " + error.message, "error");
    }
  }

  async function saveAiKey() {
    const apiKey = $("aiKeyInput")?.value?.trim();
    if (!apiKey) {
      showAiKeyStatus("Please enter an API key", "error");
      return;
    }

    const info = aiProviderInfo[currentAiProvider];
    if (!info) {
      return;
    }

    // Validate key format
    if (
      currentAiProvider === "openai" &&
      info.keyPattern &&
      !info.keyPattern.test(apiKey)
    ) {
      showAiKeyStatus("Invalid API key format", "error");
      return;
    }

    try {
      // Encrypt the API key
      const encryptResult = await window.api.encrypt(apiKey);
      if (!encryptResult.success) {
        throw new Error("Failed to encrypt API key");
      }

      // Store encrypted key
      const keyField = $(`${currentAiProvider}ApiKey`);
      if (keyField) {
        keyField.value = encryptResult.data;
      }

      // Set as active provider
      const providerField = $("aiProvider");
      if (providerField) {
        providerField.value = currentAiProvider;
      }

      // Update button visual state
      const btn = $(`connect${info.name.replace(" ", "")}Btn`);
      if (btn) {
        btn.classList.add("connected");
      }

      // Save to settings file
      const settingsResult = await readFileAsync(PATHS.SETTINGS);
      const settings = settingsResult.success
        ? safeParse(settingsResult.content, {})
        : {};
      settings[`${currentAiProvider}ApiKey`] = encryptResult.data;
      settings.aiProvider = currentAiProvider;

      await writeFileAsync(PATHS.SETTINGS, JSON.stringify(settings, null, 2));

      addLogEntry(`Connected to ${info.name} successfully`);
      showAiKeyStatus(`✓ Connected to ${info.name}!`, "success");

      // Close modal after 1.5 seconds
      setTimeout(() => {
        closeAiKeyModal();
      }, 1500);
    } catch (error) {
      showAiKeyStatus("Failed to save API key: " + error.message, "error");
      addLogEntry(`Failed to connect to ${info.name}: ${error.message}`);
    }
  }

  function toggleAiKeyVisibility() {
    const input = $("aiKeyInput");
    const btn = $("toggleAiKeyVisibility");
    if (input && btn) {
      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "Hide API Key";
      } else {
        input.type = "password";
        btn.textContent = "Show API Key";
      }
    }
  }

  async function checkAiProviderConnections() {
    // Check which providers are connected and update button states
    const settingsResult = await readFileAsync(PATHS.SETTINGS);
    if (!settingsResult.success) {
      return;
    }

    const settings = safeParse(settingsResult.content, {});

    Object.keys(aiProviderInfo).forEach((provider) => {
      const keyField = $(`${provider}ApiKey`);
      const encryptedKey = settings[`${provider}ApiKey`];

      if (encryptedKey) {
        // Key exists - mark as connected
        if (keyField) {
          keyField.value = encryptedKey;
        }

        const info = aiProviderInfo[provider];
        const btn = $(`connect${info.name.replace(" ", "")}Btn`);
        if (btn) {
          btn.classList.add("connected");
        }
      }
    });

    // Set active provider
    if (settings.aiProvider) {
      const providerField = $("aiProvider");
      if (providerField) {
        providerField.value = settings.aiProvider;
      }
    }
  }

  // Handle OAuth callback
  if (window.api?.onOAuthToken) {
    window.api.onOAuthToken(async (data) => {
      if (data.token && data.provider) {
        addLogEntry(
          `✅ ${data.provider.charAt(0).toUpperCase() + data.provider.slice(1)} connected successfully!`,
          "success",
        );

        // Load current settings
        const settingsRes = await readFileAsync(PATHS.SETTINGS);
        const settings = settingsRes.success
          ? safeParse(settingsRes.content, {})
          : {};

        // Save token to settings
        const tokenField = `${data.provider}Token`;
        settings[tokenField] = data.token;

        // Encrypt and save settings
        const encrypted = await window.api.encrypt(data.token);
        if (encrypted.success) {
          settings[tokenField] = encrypted.data;
        }

        await writeFileAsync(PATHS.SETTINGS, JSON.stringify(settings, null, 2));

        // Update hidden token field immediately so app knows connection is active
        const tokenInput = $(`${data.provider}Token`);
        if (tokenInput) {
          tokenInput.value = encrypted.success ? encrypted.data : data.token;
        }

        // Update button to show connected status
        // Use the shared UI helper so we don't overwrite badge/spinner elements
        try {
          setProviderConnected(data.provider);
        } catch {
          // Fallback in case helper isn't available for some reason
          const btnId = `connect${data.provider.charAt(0).toUpperCase() + data.provider.slice(1)}Btn`;
          const btn = $(btnId);
          if (btn) {
            btn.classList.add("connected");
            btn.disabled = false;
          }
        }

        clearError();
      }
    });
  }

  // Check OAuth connection status
  async function checkOAuthStatus() {
    const settingsRes = await readFileAsync(PATHS.SETTINGS);
    if (!settingsRes.success) {
      return;
    }
    let settings = safeParse(settingsRes.content, {});
    settings = await decryptSensitiveFields(settings);
    const platforms = [
      { name: "instagram", token: settings.instagramToken },
      { name: "tiktok", token: settings.tiktokToken },
      { name: "youtube", token: settings.youtubeToken },
      { name: "twitter", token: settings.twitterToken },
    ];

    for (const platform of platforms) {
      // Support multiple tokens per platform (array)
      let tokens = platform.token;
      if (Array.isArray(tokens)) {
        tokens = tokens.filter(Boolean);
      } else if (tokens) {
        tokens = [tokens];
      } else {
        tokens = [];
      }

      if (tokens.length > 0) {
        // Mark as connected via badge helpers so we don't overwrite inner HTML (badges)
        setProviderConnected(platform.name);
      } else {
        setProviderDisconnected(platform.name);
      }

      // Populate hidden token field with first token (for legacy compatibility)
      const tokenInput = $(`${platform.name}Token`);
      if (tokenInput) {
        tokenInput.value = tokens[0] || "";
      }
    }
  }

  // INITIALIZATION
  async function init() {
    console.warn("Initializing renderer...");

    if (!window.api) {
      console.error("window.api is not available");
      const errorContainer = $("errorContainer");
      if (errorContainer) {
        errorContainer.textContent =
          "Error: IPC bridge not initialized. The app may not function correctly.";
        errorContainer.style.display = "block";
      }
      return;
    }

    // Initialize video functionality
    await initializeVideoFeatures();

    // Set up video provider capability display
    const videoProviderSelect = $("videoAiProvider");
    if (videoProviderSelect) {
      // Update capabilities when provider changes
      videoProviderSelect.addEventListener("change", async (e) => {
        await updateProviderCapabilities(e.target.value);
      });

      // Set initial capabilities display
      await updateProviderCapabilities(videoProviderSelect.value || "runway");
    }

    // Reset all social media connections and AI provider UI on reload
    const socialPlatforms = ["instagram", "tiktok", "youtube", "twitter"];
    for (const name of socialPlatforms) {
      const tokenInput = $(`${name}Token`);
      if (tokenInput) {
        tokenInput.value = "";
      }
      const btnId = `connect${name.charAt(0).toUpperCase() + name.slice(1)}Btn`;
      const btn = $(btnId);
      if (btn) {
        // reset using helper to preserve badge/spinner children
        setProviderDisconnected(name);
      }
    }
    // Reset AI provider fields/buttons
    if ($("aiKeyInput")) {
      $("aiKeyInput").value = "";
    }
    Object.keys(aiProviderInfo).forEach((provider) => {
      const btn = $(
        `connect${aiProviderInfo[provider].name.replace(" ", "")}Btn`,
      );
      if (btn) {
        btn.classList.remove("connected");
      }
    });
    if ($("aiProvider")) {
      $("aiProvider").value = "";
    }

    // Check OAuth connection status and update buttons
    await checkOAuthStatus();

    // Set up event listeners for library display and filters
    displayLibraryContent();
    const searchInput = $("librarySearch");
    const filterSelect = $("libraryFilter");

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        displayLibraryContent();
      });
    }

    if (filterSelect) {
      filterSelect.addEventListener("change", () => {
        displayLibraryContent();
      });
    }

    // Set up create slideshow button
    const createSlideshowBtn = $("createSlideshowBtn");
    if (createSlideshowBtn) {
      createSlideshowBtn.addEventListener("click", async () => {
        await handleSlideshowCreation();
      });
    }

    try {
      console.warn("Starting initialization sequence...");

      // Initialize UI first
      console.warn("Binding UI elements...");
      bindUi();

      // Load initial data
      console.warn("Loading initial data...");
      addLogEntry("AI Auto Bot initializing...");

      await Promise.all([
        populateTimezones(),
        populateSavedConfigs(),
        populateScheduledPosts(),
        displayLibraryContent(),
        fetchMemeTemplates(),
        checkAiProviderConnections(), // Check which AI providers are connected
      ]);

      // Load settings last
      console.warn("Loading settings...");
      const r = await readFileAsync(PATHS.SETTINGS);

      if (r.success) {
        const obj = safeParse(r.content, {});
        const decryptedObj = await decryptSensitiveFields(obj);
        populateFormFromObject(decryptedObj);
        addLogEntry("Settings loaded successfully");
      }

      console.warn("Initialization complete!");
    } catch (error) {
      console.error("Initialization error:", error);
      addLogEntry("Initialization failed: " + error.message, "error");
    }

    // Initialize drag & drop for file uploads
    if (window.DragDrop) {
      window.DragDrop.init('sourceImageDropZone', 'sourceImage', (file) => {
        console.log('Source image uploaded:', file.name);
      });

      window.DragDrop.init('maskImageDropZone', 'maskImage', (file) => {
        console.log('Mask image uploaded:', file.name);
      });
    }

    // Listen for scheduled posts from main process
    if (window.api && window.api.onScheduledPost) {
      window.api.onScheduledPost(async (post) => {
        addLogEntry(
          `⏰ Auto-executing scheduled post from ${post.scheduleTime}`,
        );

        // Load post settings
        if (post.source) {
          const decryptedSource = await decryptSensitiveFields(post.source);
          populateFormFromObject(decryptedSource);
        }

        // Wait a moment for form to populate, then post
        setTimeout(() => {
          handlePostNow();
        }, 1000);
      });
    }

    // Listen for OAuth tokens from main process
    if (window.api && window.api.onOAuthToken) {
      window.api.onOAuthToken(async (data) => {
        const provider = data.provider; // 'instagram'|'tiktok'|'youtube'|'twitter'
        const token = data.token;
        if (!provider || !token) {
          return;
        }

        // Fill hidden input so the UI and post flow see it
        const input = $(`${provider}Token`);
        if (input) {
          input.value = token;
        }

        // Persist token into settings
        const r = await readFileAsync(PATHS.SETTINGS);
        const settings = r.success ? safeParse(r.content, {}) : {};
        settings[`${provider}Token`] = token;

        const encrypted = await encryptSensitiveFields(settings);
        const w = await writeFileAsync(
          PATHS.SETTINGS,
          JSON.stringify(encrypted, null, 2),
        );
        if (w.success) {
          addLogEntry(`Saved ${provider} token (encrypted)`);
        } else {
          addLogEntry(
            `Failed to save ${provider} token: ${w.error?.message || "unknown"}`,
          );
        }
        // Update connect button state right away
        const btnId = `connect${provider.charAt(0).toUpperCase() + provider.slice(1)}Btn`;
        const btn = $(btnId);
        if (btn) {
          setProviderConnected(provider);
        }
      });
    }

      // Listen for oauth-token-removed events (disconnects)
      if (window.api && window.api.onOAuthTokenRemoved) {
        window.api.onOAuthTokenRemoved((data) => {
          const provider = data.provider;
          if (!provider) {return;}
          const btnId = `connect${provider.charAt(0).toUpperCase() + provider.slice(1)}Btn`;
          const discId = `disconnect${provider.charAt(0).toUpperCase() + provider.slice(1)}Btn`;
          const btn = $(btnId);
          const disc = $(discId);
          if (btn) {
            setProviderDisconnected(provider);
          }
          if (disc) {disc.style.display = "none";}
        });
      }

    // Listen for token removal (disconnect)
    if (window.api && window.api.onOAuthToken) {
      window.api.onOAuthToken && window.api.onOAuthToken(() => {}); // noop to ensure API available
    }
    // Custom listener for oauth-token-removed (emitted from main)
    if (window.api && window.api.onOAuthToken && window.api.onScheduledPost) {
      // Use the global ipc subscription if available via preload
      // Preload doesn't expose oauth-token-removed helper, so attach to ipcRenderer via existing handlers when main sends message
      // We use a simple polling via readFile in init to update button states after disconnect; main also sends oauth-token-removed which is handled below via window.api.onOAuthToken when it carries removed flag.
    }

    addLogEntry("AI Auto Bot ready - All functions operational");
    addLogEntry("📅 Auto-scheduler is active - checking every minute");

    // Initialize drag-and-drop for fieldset reordering
    initDragAndDrop();
  }

  // Drag-and-drop functionality for rearranging fieldsets
  function initDragAndDrop() {
    const form = $("settingsForm");
    if (!form) {
      return;
    }

    const fieldsets = Array.from(form.querySelectorAll("fieldset"));
    let draggedElement = null;
    let dropPreview = null;

    // Create drop preview element
    function createDropPreview() {
      const preview = document.createElement("div");
      preview.className = "grid-drop-preview";
      preview.innerHTML = '<div class="grid-position-label"></div>';
      document.body.appendChild(preview);
      return preview;
    }

    // Update drop preview position
    function updateDropPreview(e) {
      if (!draggedElement || !dropPreview) {
        return;
      }

      const rect = form.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate column (1-3)
      const colWidth = rect.width / 3;
      const col = Math.max(1, Math.min(3, Math.ceil(x / colWidth)));

      // Calculate row (1-3) based on grid thirds
      const rowHeight = rect.height / 3;
      const row = Math.max(1, Math.min(3, Math.ceil(y / rowHeight)));

      // Calculate preview position
      const previewLeft = rect.left + (col - 1) * colWidth;
      const previewTop = rect.top + (row - 1) * rowHeight;
      const previewWidth = colWidth - 2; // account for gap
      const previewHeight = rowHeight - 2;

      dropPreview.style.left = `${previewLeft}px`;
      dropPreview.style.top = `${previewTop}px`;
      dropPreview.style.width = `${previewWidth}px`;
      dropPreview.style.height = `${previewHeight}px`;

      // Update label
      const label = dropPreview.querySelector(".grid-position-label");
      if (label) {
        label.textContent = `Column ${col}, Row ${row}`;
      }
    }

    // Load saved layout
    loadLayout();

    fieldsets.forEach((fieldset, _index) => {
      // Make fieldset draggable
      fieldset.setAttribute("draggable", "true");
      fieldset.style.cursor = "move";

      // Add drag handle visual indicator to legend
      const legend = fieldset.querySelector("legend");
      if (legend && !legend.querySelector(".drag-handle")) {
        const handle = document.createElement("span");
        handle.className = "drag-handle";
        handle.innerHTML = "⋮⋮";
        handle.title = "Drag to place anywhere";
        legend.insertBefore(handle, legend.firstChild);
      }

      fieldset.addEventListener("dragstart", (e) => {
        draggedElement = fieldset;
        fieldset.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";

        // Create drop preview
        dropPreview = createDropPreview();
      });

      fieldset.addEventListener("drag", (e) => {
        if (e.clientX === 0 && e.clientY === 0) {
          return; // Ignore final drag event
        }
        updateDropPreview(e);
      });

      fieldset.addEventListener("dragend", (e) => {
        fieldset.classList.remove("dragging");

        // Remove drop preview
        if (dropPreview) {
          dropPreview.remove();
          dropPreview = null;
        }

        // Calculate which grid cell was dropped on
        const rect = form.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Calculate column (1-3)
        const colWidth = rect.width / 3;
        const col = Math.max(1, Math.min(3, Math.ceil(x / colWidth)));

        // Calculate row (1-3) based on grid thirds
        const rowHeight = rect.height / 3;
        const row = Math.max(1, Math.min(3, Math.ceil(y / rowHeight)));

        // Set explicit grid position
        fieldset.style.gridColumn = col;
        fieldset.style.gridRow = row;

        draggedElement = null;

        // Save new layout
        saveLayout();
        addLogEntry(`Placed card at column ${col}, row ${row}`);
      });
    });

    // Add reset layout button handler
    const resetBtn = $("resetLayoutBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        // Remove all custom grid positions
        fieldsets.forEach((fs) => {
          fs.style.gridColumn = "";
          fs.style.gridRow = "";
        });

        // Clear saved layout
        saveLayout();
        addLogEntry("🔄 Layout reset to default");
      });
    }

    addLogEntry("🎯 Drag-and-drop enabled - Drag cards to any grid position!");
  }

  async function saveLayout() {
    const form = $("settingsForm");
    if (!form) {
      return;
    }

    const fieldsets = Array.from(form.querySelectorAll("fieldset"));
    const layout = {};

    fieldsets.forEach((fs, index) => {
      // Get a unique identifier for each fieldset
      const id =
        fs.id ||
        fs.querySelector("legend")?.textContent?.trim() ||
        `fieldset-${index}`;
      layout[id] = {
        gridColumn: fs.style.gridColumn || "",
        gridRow: fs.style.gridRow || "",
      };
    });

    // No special synchronization for meme/video - save literal styles

    console.warn("Saving layout:", layout);

    try {
      const r = await readFileAsync(PATHS.SETTINGS);
      const settings = r.success ? safeParse(r.content, {}) : {};
      settings.fieldsetLayout = layout;

      const encrypted = await encryptSensitiveFields(settings);
      await writeFileAsync(PATHS.SETTINGS, JSON.stringify(encrypted, null, 2));
      addLogEntry("💾 Layout saved");
    } catch (err) {
      console.error("Failed to save layout:", err);
    }
  }

  async function loadLayout() {
    const form = $("settingsForm");
    if (!form) {
      return;
    }

    try {
      const r = await readFileAsync(PATHS.SETTINGS);
      if (!r.success) {
        return;
      }

      const settings = safeParse(r.content, {});
      const decrypted = await decryptSensitiveFields(settings);
      const layout = decrypted.fieldsetLayout;

      console.warn("Loading layout:", layout);

      if (!layout || typeof layout !== "object") {
        return;
      }

      const fieldsets = Array.from(form.querySelectorAll("fieldset"));

      fieldsets.forEach((fs, index) => {
        const id =
          fs.id ||
          fs.querySelector("legend")?.textContent?.trim() ||
          `fieldset-${index}`;
        if (layout[id]) {
          if (layout[id].gridColumn) {
            fs.style.gridColumn = layout[id].gridColumn;
          }
          if (layout[id].gridRow) {
            fs.style.gridRow = layout[id].gridRow;
          }
        }
      });

      addLogEntry("📍 Layout restored");
    } catch (err) {
      console.error("Failed to load layout:", err);
    }
  }

  // ===== Content Preview Functions =====
  function showPreview(content) {
    const modal = $("previewModal");
    if (!modal) return;

    // Set image for all platforms
    const platforms = ['instagram', 'tiktok', 'youtube', 'twitter'];
    platforms.forEach(platform => {
      const img = $(`previewImage${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
      const caption = $(`previewCaption${platform.charAt(0).toUpperCase() + platform.slice(1)}`);

      if (img && content.imageUrl) {
        img.src = content.imageUrl;
      }

      if (caption) {
        caption.textContent = content.caption || '';
      }
    });

    modal.classList.add('show');
  }

  function closePreview() {
    const modal = $("previewModal");
    if (modal) {
      modal.classList.remove('show');
    }
  }

  function initPreviewModal() {
    // Platform tab switching
    const tabs = document.querySelectorAll('.preview-platform-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const platform = tab.dataset.platform;

        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update active content
        const contents = document.querySelectorAll('.preview-platform-content');
        contents.forEach(c => c.classList.remove('active'));
        const activeContent = document.querySelector(`.preview-platform-content[data-platform="${platform}"]`);
        if (activeContent) {
          activeContent.classList.add('active');
        }
      });
    });

    // Close button
    const closeBtn = $("closePreviewModal");
    if (closeBtn) {
      closeBtn.addEventListener('click', closePreview);
    }

    // Cancel button
    const cancelBtn = $("cancelPreviewModal");
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closePreview);
    }

    // Confirm and post button
    const confirmBtn = $("previewConfirmPost");
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        closePreview();
        handlePostNow(); // Execute the actual post
      });
    }

    // Click outside to close
    const modal = $("previewModal");
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closePreview();
        }
      });
    }
  }

  // Run initialization when the window loads
  window.addEventListener("DOMContentLoaded", () => {
    init();
    initPreviewModal();
    initCostTracker();
    initSetupWizard();
    initSidebarNavigation();
  });

  // ============================================
  // SIDEBAR NAVIGATION
  // ============================================

  function initSidebarNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    // Load saved section or default to 'generate'
    const savedSection = localStorage.getItem('activeSection') || 'generate';
    showSection(savedSection);

    // Add click handlers
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const sectionId = item.dataset.section;
        showSection(sectionId);
        localStorage.setItem('activeSection', sectionId);
      });
    });

    function showSection(sectionId) {
      // Update nav items
      navItems.forEach(item => {
        if (item.dataset.section === sectionId) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      // Update sections
      sections.forEach(section => {
        if (section.id === `section-${sectionId}`) {
          section.classList.add('active');
        } else {
          section.classList.remove('active');
        }
      });

      // Scroll to top of main content
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollTop = 0;
      }

      addLogEntry(`📂 Navigated to ${sectionId} section`);
    }

    // Mobile sidebar toggle (for responsive)
    const createMobileToggle = () => {
      if (window.innerWidth <= 768) {
        let toggle = document.getElementById('sidebarToggle');
        if (!toggle) {
          toggle = document.createElement('button');
          toggle.id = 'sidebarToggle';
          toggle.innerHTML = '☰';
          toggle.style.cssText = 'position: fixed; top: 15px; left: 15px; z-index: 101; padding: 10px 15px; background: var(--blue-gradient); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 20px;';
          document.body.appendChild(toggle);

          toggle.addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('open');
          });
        }
      } else {
        const toggle = document.getElementById('sidebarToggle');
        if (toggle) toggle.remove();
      }
    };

    createMobileToggle();
    window.addEventListener('resize', createMobileToggle);
  }

  // ============================================
  // SETUP WIZARD
  // ============================================

  function initSetupWizard() {
    // Check if this is first run
    const hasSeenWizard = localStorage.getItem('hasSeenSetupWizard');

    if (!hasSeenWizard) {
      // Show wizard after a brief delay so UI loads first
      setTimeout(() => {
        showSetupWizard();
      }, 1000);
    }

    // Setup button handlers
    const closeBtn = document.getElementById('closeSetupWizard');
    const continueBtn = document.getElementById('continueWithoutSetup');
    const openSettingsBtn = document.getElementById('openSettingsFromWizard');
    const reopenBtn = document.getElementById('reopenSetupWizard');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        closeSetupWizard();
      });
    }

    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        closeSetupWizard();
      });
    }

    if (openSettingsBtn) {
      openSettingsBtn.addEventListener('click', () => {
        closeSetupWizard();
        // Scroll to settings fieldset
        const settingsFieldset = document.querySelector('fieldset legend');
        if (settingsFieldset && settingsFieldset.textContent.includes('Settings')) {
          settingsFieldset.closest('fieldset').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    if (reopenBtn) {
      reopenBtn.addEventListener('click', () => {
        showSetupWizard();
      });
    }
  }

  function showSetupWizard() {
    const modal = document.getElementById('setupWizardModal');
    if (modal) {
      modal.style.display = 'block';
      addLogEntry('🎬 Welcome! Setup wizard opened for first-time configuration');
    }
  }

  function closeSetupWizard() {
    const modal = document.getElementById('setupWizardModal');
    if (modal) {
      modal.style.display = 'none';
      localStorage.setItem('hasSeenSetupWizard', 'true');
      addLogEntry('Setup wizard closed');
    }
  }

  // Expose function to reopen wizard from settings
  window.showSetupWizard = showSetupWizard;

  // ============================================
  // COST TRACKER
  // ============================================

  function initCostTracker() {
    loadCostStats();

    const resetBtn = document.getElementById('resetCostsBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset cost tracker? This will clear all usage statistics.')) {
          resetCostStats();
        }
      });
    }
  }

  function loadCostStats() {
    const stats = getCostStats();
    updateCostDisplay(stats);
  }

  function getCostStats() {
    const stored = localStorage.getItem('costStats');
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      imagesGenerated: 0,
      videosGenerated: 0,
      videoSecondsGenerated: 0
    };
  }

  function saveCostStats(stats) {
    localStorage.setItem('costStats', JSON.stringify(stats));
    updateCostDisplay(stats);
  }

  function updateCostDisplay(stats) {
    const imagesEl = document.getElementById('imagesGenerated');
    const openaiCostEl = document.getElementById('openaiCost');
    const videosEl = document.getElementById('videosGenerated');
    const runwayCostEl = document.getElementById('runwayCost');
    const totalCostEl = document.getElementById('totalCost');

    if (imagesEl) imagesEl.textContent = stats.imagesGenerated || 0;

    // OpenAI DALL-E 3: $0.04 per image
    const openaiCost = (stats.imagesGenerated || 0) * 0.04;
    if (openaiCostEl) openaiCostEl.textContent = `$${openaiCost.toFixed(2)}`;

    if (videosEl) videosEl.textContent = stats.videosGenerated || 0;

    // Runway Gen-3: ~$0.25 per second (mid-range estimate)
    const runwayCost = (stats.videoSecondsGenerated || 0) * 0.25;
    if (runwayCostEl) runwayCostEl.textContent = `$${runwayCost.toFixed(2)}`;

    const totalCost = openaiCost + runwayCost;
    if (totalCostEl) totalCostEl.textContent = `$${totalCost.toFixed(2)}`;
  }

  function trackImageGeneration() {
    const stats = getCostStats();
    stats.imagesGenerated = (stats.imagesGenerated || 0) + 1;
    saveCostStats(stats);
    addLogEntry(`💰 Cost tracker updated: ${stats.imagesGenerated} images ($${(stats.imagesGenerated * 0.04).toFixed(2)})`);
  }

  function trackVideoGeneration(durationSeconds = 10) {
    const stats = getCostStats();
    stats.videosGenerated = (stats.videosGenerated || 0) + 1;
    stats.videoSecondsGenerated = (stats.videoSecondsGenerated || 0) + durationSeconds;
    saveCostStats(stats);
    addLogEntry(`💰 Cost tracker updated: ${stats.videosGenerated} videos ($${(stats.videoSecondsGenerated * 0.25).toFixed(2)})`);
  }

  function resetCostStats() {
    const stats = {
      imagesGenerated: 0,
      videosGenerated: 0,
      videoSecondsGenerated: 0
    };
    saveCostStats(stats);
    addLogEntry('💰 Cost tracker reset');
    showToast('Cost tracker reset successfully', 'success');
  }
})();

