# Local AI Video Storage & Cleanup Guide

## 📊 **What Takes Up Space?**

### **1. AI Model Files (Large!)**
- **Location:** `C:\Users\[YourName]\.cache\huggingface\hub\`
- **Size:** 3.5 GB for Zeroscope V2 model
- **Purpose:** Downloaded once, reused forever
- **Downloaded When:** First time you generate a video with Zeroscope

**Your Current Storage:**
- Zeroscope V2 Model: **3.5 GB**
- Total HuggingFace Cache: **3.42 GB**

### **2. Generated Videos (Small)**
- **Location:** `G:\ElectronFiddle\ASB\data\generated\videos\`
- **Size:** ~2-10 MB per video (depends on duration)
- **Current Status:** Empty (no completed videos yet)
- **File Naming:** `zeroscope_[timestamp]_[hash].mp4`

### **3. Incomplete/Failed Generations**
- **Status:** NOT stored - if generation fails, nothing is saved
- **Temp Files:** Automatically cleaned up by Python

---

## 🗑️ **How to Delete & Free Space**

### **Option 1: Delete Only Generated Videos**
Keeps the model for future use, removes only your generated content:

```powershell
# Windows PowerShell
Remove-Item "G:\ElectronFiddle\ASB\data\generated\videos\*" -Recurse -Force
```

**Frees:** 0-500 MB (depending on how many videos you made)

### **Option 2: Delete Model Cache (Frees 3.5 GB)**
Removes downloaded AI models - will re-download on next use:

```powershell
# Windows PowerShell
Remove-Item "C:\Users\$env:USERNAME\.cache\huggingface\hub\models--cerspense--zeroscope_v2_576w" -Recurse -Force
```

**Frees:** 3.5 GB
**Note:** Model will re-download (5-10 min) next time you use Zeroscope

### **Option 3: Nuclear Option - Delete Everything**
Removes all HuggingFace models and cache:

```powershell
# Windows PowerShell
Remove-Item "C:\Users\$env:USERNAME\.cache\huggingface" -Recurse -Force
```

**Frees:** 3.42 GB
**Warning:** All AI models will need to re-download

---

## 📚 **Content Library Integration**

### **Current Status:**
- Generated videos are **NOT automatically added** to content library
- They are stored locally but isolated from your main content

### **To Add Videos to Library:**
After generation completes, you need to manually:
1. Find video in `data/generated/videos/`
2. Import it via the Library tab
3. Or implement auto-import (see TODO below)

### **TODO: Automatic Library Integration**
See `todoList` - "Add local video storage integration" task pending:
- Auto-import to `library.json`
- Show in Content Library tab
- Allow editing/scheduling from library

---

## ⚡ **GPU + CPU Hybrid Processing**

### **Can You Use Both GPU and CPU Together?**
**No, not in this app.** Here's why:

**Technical Limitation:**
- PyTorch chooses ONE device per model: `device = "cuda"` OR `device = "cpu"`
- Models cannot be split between GPU and CPU in diffusers library
- The entire neural network runs on the selected device

**Why Hybrid Doesn't Help:**
- Video generation is a **sequential process** (frame 1 → frame 2 → frame 3...)
- Can't parallelize across devices for one video
- GPU is 70x faster than CPU - using CPU would slow down the GPU parts

**What DOES Happen:**
- **GPU:** Runs the AI model (heavy computation)
- **CPU:** Handles overhead (loading, saving, encoding video file)
- **System RAM:** Temporarily stores frames before writing to disk

**Advanced Option (Not Recommended):**
- You could generate multiple videos simultaneously (one on GPU, one on CPU)
- But this would:
  - Slow down BOTH processes (resource contention)
  - Use tons of RAM (2 models loaded at once = 7 GB)
  - Overheat your system
  - Not actually be faster overall

---

## 🔍 **Quick Storage Check Commands**

### Check Generated Videos:
```powershell
Get-ChildItem "G:\ElectronFiddle\ASB\data\generated\videos" | Measure-Object -Property Length -Sum
```

### Check Model Cache Size:
```powershell
Get-ChildItem "C:\Users\$env:USERNAME\.cache\huggingface\hub\models--cerspense--zeroscope_v2_576w" -Recurse -File | Measure-Object -Property Length -Sum
```

### List All Downloaded Models:
```powershell
Get-ChildItem "C:\Users\$env:USERNAME\.cache\huggingface\hub" -Directory | Where-Object Name -like "models--*"
```

---

## 💡 **Storage Best Practices**

1. **Keep the Model Cache**
   - 3.5 GB one-time download
   - Reused for all future generations
   - Only delete if you won't use local AI anymore

2. **Clean Generated Videos Regularly**
   - Export good ones to your main content library
   - Delete test/failed generations
   - Set up auto-cleanup after 30 days (future feature)

3. **Monitor Space Before Generation**
   - Ensure 1 GB free space for video output
   - Generation fails if disk full

4. **Use Paid APIs for Production**
   - Luma/Runway don't use local storage
   - Faster and more reliable
   - No cleanup needed

---

## 🎯 **Summary**

**Current Space Usage:**
- ✅ Models: 3.5 GB (C:\Users\...\huggingface)
- ✅ Generated Videos: 0 MB (none completed yet)
- ✅ Total: 3.5 GB

**Space Freed by Deletion:**
- Models: 3.5 GB (must re-download)
- Videos: 0-500 MB (safe to delete anytime)

**Content Library:**
- Videos NOT auto-added yet
- Manual import required
- Auto-integration pending (TODO)

**GPU+CPU Hybrid:**
- Not possible in this architecture
- GPU-only is optimal
- 70x faster than CPU

