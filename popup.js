document.addEventListener("DOMContentLoaded", () => {
  const shortcutKey = document.getElementById("shortcutKey");
  const shortcutValue = document.getElementById("shortcutValue");
  const shortcutCategory = document.getElementById("shortcutCategory");
  const addBtn = document.getElementById("addShortcut");
  const list = document.getElementById("shortcutList");
  const preview = document.getElementById("preview");
  const searchInput = document.getElementById("searchInput");
  const exportBtn = document.getElementById("exportShortcuts");
  const importBtn = document.getElementById("importShortcuts");
  const importFile = document.getElementById("importFile");

  function loadShortcuts(cb) {
    chrome.storage.sync.get(['shortcuts'], res => {
      const shortcuts = (res && res.shortcuts && typeof res.shortcuts === 'object') ? res.shortcuts : {};
      cb(shortcuts);
    });
  }

  function updatePreview() {
    try {
      const html = (shortcutValue.value || "").trim();
      preview.innerHTML = html || "<em>Nothing to preview...</em>";
    } catch (err) {
      preview.textContent = "Error rendering preview";
    }
  }

  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[m]);
  }

  function renderShortcuts(filter = "") {
    loadShortcuts((shortcuts) => {
      list.innerHTML = "";
      const keys = Object.keys(shortcuts || {});
      if (keys.length === 0) {
        list.innerHTML = '<li class="empty">No shortcuts found.</li>';
        return;
      }

      keys
        .filter(k => k.toLowerCase().includes((filter||'').toLowerCase()))
        .sort((a,b)=>a.localeCompare(b))
        .forEach(key => {
          const item = shortcuts[key];
          let value = "";
          let category = "";
          if (typeof item === "string") value = item;
          else if (item && typeof item === "object") {
            value = item.value || "";
            category = item.category || "";
          }

          const li = document.createElement("li");
          li.className = "shortcut-item";
          li.innerHTML = `
            <div class="shortcut-content">
              <div><span class="shortcut-key">${escapeHtml(key)}</span><span class="shortcut-category">[${escapeHtml(category || 'General')}]</span></div>
              <div class="shortcut-value">${value}</div>
            </div>
            <div class="shortcut-actions">
              <button class="editBtn" data-key="${escapeHtml(key)}">🖉</button>
              <button class="deleteBtn" data-key="${escapeHtml(key)}">🗑</button>
            </div>
          `;
          list.appendChild(li);
        });

      // attach listeners
      list.querySelectorAll(".editBtn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const key = e.currentTarget.dataset.key;
          loadShortcuts((shortcutsInner) => {
            const item = shortcutsInner[key];
            if (!item) return;
            if (typeof item === "string") {
              shortcutKey.value = key;
              shortcutValue.value = item;
              shortcutCategory.value = "";
            } else {
              shortcutKey.value = key;
              shortcutValue.value = item.value || "";
              shortcutCategory.value = item.category || "";
            }
            updatePreview();
          });
        });
      });

      list.querySelectorAll(".deleteBtn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const key = e.currentTarget.dataset.key;
          loadShortcuts((shortcutsInner) => {
            if (shortcutsInner.hasOwnProperty(key)) {
              delete shortcutsInner[key];
              chrome.storage.sync.set({shortcuts: shortcutsInner}, () => renderShortcuts(searchInput.value));
            }
          });
        });
      });
    });
  }

  addBtn.addEventListener("click", () => {
    const key = (shortcutKey.value || "").trim();
    const value = (shortcutValue.value || "").trim();
    const category = (shortcutCategory.value || "").trim();

    if (!key || !value) {
      alert("Please enter both shortcut key and value.");
      return;
    }

    loadShortcuts((shortcuts) => {
      // store always as object {value, category}
      shortcuts[key] = { value, category };
      chrome.storage.sync.set({shortcuts}, () => {
        shortcutKey.value = "";
        shortcutValue.value = "";
        shortcutCategory.value = "";
        updatePreview();
        renderShortcuts(searchInput.value);
      });
    });
  });

  searchInput.addEventListener("input", () => renderShortcuts(searchInput.value));
  shortcutValue.addEventListener("input", updatePreview);

  // export
  exportBtn.addEventListener("click", () => {
    loadShortcuts((shortcuts) => {
      const blob = new Blob([JSON.stringify(shortcuts, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'act_shortcuts.json'; a.click();
      URL.revokeObjectURL(url);
    });
  });

  // import
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON');
        chrome.storage.sync.set({shortcuts: parsed}, () => {
          alert('Imported successfully');
          renderShortcuts();
        });
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(f);
  });

  // initial
  renderShortcuts();
  updatePreview();
});
