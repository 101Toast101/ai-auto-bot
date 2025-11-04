// utils/drag-drop.js - Drag and drop file upload handler

/**
 * Initialize drag and drop for a file input
 * @param {string} dropZoneId - ID of the drop zone element
 * @param {string} inputId - ID of the file input element
 * @param {Function} onFileSelect - Callback when file is selected
 */
function initDragDrop(dropZoneId, inputId, onFileSelect) {
  const dropZone = document.getElementById(dropZoneId);
  const fileInput = document.getElementById(inputId);

  if (!dropZone || !fileInput) {
    console.warn(`Drag drop elements not found: ${dropZoneId}, ${inputId}`);
    return;
  }

  // Click to browse
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // Handle file input change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0], dropZone, onFileSelect);
    }
  });

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop zone when item is dragged over
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('drag-over');
    }, false);
  });

  // Handle dropped files
  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files && files[0]) {
      // Set file to input
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(files[0]);
      fileInput.files = dataTransfer.files;

      handleFile(files[0], dropZone, onFileSelect);
    }
  }, false);
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleFile(file, dropZone, onFileSelect) {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    if (window.Toast) {
      window.Toast.error('Please upload an image file');
    } else {
      alert('Please upload an image file');
    }
    return;
  }

  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    if (window.Toast) {
      window.Toast.error('File size must be less than 10MB');
    } else {
      alert('File size must be less than 10MB');
    }
    return;
  }

  // Update drop zone text
  const textEl = dropZone.querySelector('.drop-zone-text');
  if (textEl) {
    textEl.textContent = `✓ ${file.name}`;
  }

  // Call callback
  if (onFileSelect) {
    onFileSelect(file);
  }

  // Show success toast
  if (window.Toast) {
    window.Toast.success(`File uploaded: ${file.name}`);
  }
}

/**
 * Reset a drop zone to initial state
 */
function resetDropZone(dropZoneId, placeholderText = 'Drag & Drop Image Here') {
  const dropZone = document.getElementById(dropZoneId);
  if (!dropZone) {
    return;
  }

  const textEl = dropZone.querySelector('.drop-zone-text');
  if (textEl) {
    textEl.textContent = placeholderText;
  }

  dropZone.classList.remove('drag-over');
}

// Export for use in renderer
if (typeof window !== 'undefined') {
  window.DragDrop = {
    init: initDragDrop,
    reset: resetDropZone
  };
}
