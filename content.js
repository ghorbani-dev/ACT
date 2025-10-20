// content.js
let SHORTCUTS = {};

function loadShortcuts() {
  chrome.storage.sync.get(['shortcuts'], res => {
    SHORTCUTS = (res && res.shortcuts && typeof res.shortcuts === 'object') ? res.shortcuts : {};
  });
}

// update when storage changes (in case popup modified shortcuts)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.shortcuts) {
    SHORTCUTS = changes.shortcuts.newValue || {};
  }
});

loadShortcuts();

// helper: set caret to end of element (for contenteditable)
function setCaretToEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// Replace last occurrence of key at end of text
function replaceInPlainText(value, key, replacement) {
  if (!value.endsWith(key)) return null;
  return value.slice(0, -key.length) + replacement;
}

function handleReplaceOnElement(active) {
  // decide text source
  let textValue = '';
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') {
    textValue = active.value || '';
  } else if (active.isContentEditable) {
    // use innerText to check trailing key, but replace using innerHTML for HTML support
    textValue = active.innerText || '';
  } else {
    return;
  }

  // iterate shortcuts (prefer checking keys length longest-first to avoid prefix collisions)
  const keys = Object.keys(SHORTCUTS).sort((a,b)=> b.length - a.length);
  for (const key of keys) {
    const item = SHORTCUTS[key];
    // support both string and object storage
    let replacement = '';
    if (typeof item === 'string') replacement = item;
    else if (item && typeof item === 'object') replacement = item.value || '';
    if (!replacement) continue;

    // if active is input/textarea -> replace with text-only (strip tags)
    if ((active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && textValue.endsWith(key)) {
      // strip tags from replacement for plain text fields
      const stripped = replacement.replace(/<[^>]*>/g, '');
      const newVal = replaceInPlainText(textValue, key, stripped);
      if (newVal !== null) {
        active.value = newVal;
        // fire input event so page notices change
        active.dispatchEvent(new Event('input', { bubbles: true }));
      }
      break;
    }

    // contentEditable
    if (active.isContentEditable && textValue.endsWith(key)) {
      // For contentEditable: replace last occurrence in innerText and replace same substring in innerHTML
      // A robust but simple approach: replace last occurrence in innerHTML by searching for key in innerText position.
      // We'll construct new innerHTML by replacing the last occurrence of key in innerText while preserving HTML where possible.
      // Simpler: replace the last occurrence of the key in innerHTML using a regex for the text at the end (may not be perfect but works in most editors).
      try {
        // create a plain-text ending match position
        const text = active.innerText || '';
        const idx = text.lastIndexOf(key);
        if (idx >= 0 && idx + key.length === text.length) {
          // Build new HTML by removing last key from end and appending replacement
          // Approach: remove trailing key from innerHTML by repeatedly removing trailing text nodes equal to trailing text chunk.
          // Simpler fallback: set innerHTML to innerText(without key) + replacement (loses original inline tags inside removed part)
          const newPlain = text.slice(0, -key.length);
          active.innerHTML = newPlain + replacement;
          setCaretToEnd(active);
        }
      } catch (err) {
        // fallback: no-op
        console.error('ACT replace contentEditable error', err);
      }
      break;
    }
  }
}

// listen for space/enter or when user types (input)
document.addEventListener('keydown', (e) => {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  const active = document.activeElement;
  try {
    handleReplaceOnElement(active);
  } catch (err) {
    console.error('ACT handleReplaceOnElement error', err);
  }
});

// also listen to paste/input (in case replacements should occur without space)
document.addEventListener('input', (e) => {
  const active = document.activeElement;
  // do not trigger too often; only attempt if endsWith any key
  handleReplaceOnElement(active);
});
