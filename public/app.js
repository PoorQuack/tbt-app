// public/app.js
// Client-side Application Logic for TBT Digital Sign-Off
// Features: Dynamic TBT loading, scroll lock, comprehension quiz gate, mobile signature pad

(function () {
  "use strict";

  // Application State
  const state = {
    currentTbt: null,
    operatives: [],
    scrolledToBottom: false,
    comprehensionPassed: false,
    selectedAnswerIndex: null,
    hasSignature: false,
    isSubmitting: false,
  };

  // DOM Elements
  const elements = {
    tbtSelect: document.getElementById("tbt-select"),
    docTitleText: document.getElementById("doc-title-text"),
    docCategoryBadge: document.getElementById("doc-category-badge"),
    docOwnerText: document.getElementById("doc-owner-text"),
    docCodeText: document.getElementById("doc-code-text"),
    docLrText: document.getElementById("doc-lr-text"),
    docNrText: document.getElementById("doc-nr-text"),
    summaryPrepare: document.getElementById("summary-prepare"),
    summaryReason: document.getElementById("summary-reason"),
    summaryWhy: document.getElementById("summary-why"),
    summaryOutline: document.getElementById("summary-outline"),
    declarationDocCode: document.getElementById("declaration-doc-code"),

    // Scroll & Content
    readingProgressBar: document.getElementById("reading-progress-bar"),
    scrollStatusBadge: document.getElementById("scroll-status-badge"),
    scrollStatusText: document.getElementById("scroll-status-text"),
    tbtContentContainer: document.getElementById("tbt-content-container"),

    // Step 1: Comprehension
    stepComprehension: document.getElementById("step-comprehension"),
    comprehensionLockWarning: document.getElementById("comprehension-lock-warning"),
    comprehensionBox: document.getElementById("comprehension-box"),
    comprehensionQuestionText: document.getElementById("comprehension-question-text"),
    comprehensionOptionsContainer: document.getElementById("comprehension-options-container"),
    comprehensionFeedback: document.getElementById("comprehension-feedback"),

    // Step 2: Operative
    stepOperative: document.getElementById("step-operative"),
    operativeSelect: document.getElementById("operative-select"),
    operativeCompany: document.getElementById("operative-company"),
    btnQuickAddOperative: document.getElementById("btn-quick-add-operative"),

    // Step 3: Notes
    stepNotes: document.getElementById("step-notes"),
    tbtNotes: document.getElementById("tbt-notes"),

    // Step 4: Signature
    stepSignature: document.getElementById("step-signature"),
    signatureCanvas: document.getElementById("signature-canvas"),
    signatureHint: document.getElementById("signature-hint"),
    btnClearSig: document.getElementById("btn-clear-sig"),
    sigStatus: document.getElementById("sig-status"),

    // Step 5: Submission
    btnSubmitSignoff: document.getElementById("btn-submit-signoff"),

    // Modals
    modalAddOperative: document.getElementById("modal-add-operative"),
    btnCloseModalAdd: document.getElementById("btn-close-modal-add"),
    btnCancelAddOp: document.getElementById("btn-cancel-add-op"),
    btnSaveNewOp: document.getElementById("btn-save-new-op"),
    newOpName: document.getElementById("new-op-name"),
    newOpCompany: document.getElementById("new-op-company"),
    newOpRole: document.getElementById("new-op-role"),
    newOpTrade: document.getElementById("new-op-trade"),

    modalSuccessReceipt: document.getElementById("modal-success-receipt"),
    receiptOpName: document.getElementById("receipt-op-name"),
    receiptTbtCode: document.getElementById("receipt-tbt-code"),
    receiptRecordId: document.getElementById("receipt-record-id"),
    receiptTimestamp: document.getElementById("receipt-timestamp"),
    receiptCompany: document.getElementById("receipt-company"),
    btnDoneNextOp: document.getElementById("btn-done-next-op"),

    toastContainer: document.getElementById("toast-container"),
  };

  // Canvas context & drawing state
  let ctx = null;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Initialize
  async function init() {
    setupCanvas();
    setupEventListeners();
    await loadOperatives();
    await loadTbt(elements.tbtSelect.value || "AVC032");
  }

  // --------------------------------------------------------------------------
  // Canvas Setup & Pointer Drawing (Mobile & Desktop)
  // --------------------------------------------------------------------------
  function setupCanvas() {
    const canvas = elements.signatureCanvas;
    ctx = canvas.getContext("2d");

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Store current drawing before resizing
      let prevImg = null;
      if (state.hasSignature && canvas.width > 0) {
        prevImg = canvas.toDataURL();
      }

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (prevImg) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = prevImg;
      }
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Pointer events for touch, stylus, and mouse
    function getPointerPos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    canvas.addEventListener("pointerdown", (e) => {
      if (!state.comprehensionPassed) return;
      canvas.setPointerCapture(e.pointerId);
      isDrawing = true;
      const pos = getPointerPos(e);
      lastX = pos.x;
      lastY = pos.y;
      elements.signatureHint.style.display = "none";
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!isDrawing) return;
      const pos = getPointerPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      lastX = pos.x;
      lastY = pos.y;
      state.hasSignature = true;
      elements.sigStatus.textContent = "Signature captured ✓";
      elements.sigStatus.style.color = "var(--success)";
      updateSubmitButtonState();
    });

    const endDrawing = (e) => {
      if (isDrawing) {
        isDrawing = false;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    };

    canvas.addEventListener("pointerup", endDrawing);
    canvas.addEventListener("pointercancel", endDrawing);

    // Clear signature
    elements.btnClearSig.addEventListener("click", clearSignature);
  }

  function clearSignature() {
    const canvas = elements.signatureCanvas;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    state.hasSignature = false;
    elements.signatureHint.style.display = "block";
    elements.sigStatus.textContent = "Awaiting signature";
    elements.sigStatus.style.color = "var(--text-muted)";
    updateSubmitButtonState();
  }

  // --------------------------------------------------------------------------
  // TBT Loading & Rendering
  // --------------------------------------------------------------------------
  async function loadTbt(docCode) {
    elements.tbtContentContainer.innerHTML = `
      <div class="tbt-loading-state" style="text-align: center; padding: 2rem; color: #64748b;">
        Loading Toolbox Talk material (${docCode})...
      </div>
    `;

    // Reset interaction state
    resetSignoffForm();

    try {
      const res = await fetch(`/api/tbts?code=${encodeURIComponent(docCode)}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        showToast(json.error || "Failed to load Toolbox Talk", "error");
        return;
      }

      state.currentTbt = json.data;
      renderTbtDetails(json.data);
    } catch (err) {
      console.error("Error loading TBT:", err);
      showToast("Network error loading Toolbox Talk.", "error");
    }
  }

  function renderTbtDetails(tbt) {
    elements.docTitleText.textContent = `${tbt.title} ${tbt.doc_code}`;
    elements.docCategoryBadge.textContent = tbt.category || "Health & Safety";
    elements.docOwnerText.textContent = tbt.doc_owner || "Operations Director";
    elements.docCodeText.textContent = tbt.doc_code;
    elements.docLrText.textContent = tbt.last_revision || "05/01/2026";
    elements.docNrText.textContent = tbt.next_revision || "04/01/2028";
    elements.declarationDocCode.textContent = tbt.doc_code;

    elements.summaryPrepare.textContent = tbt.prepare_text || "Quiet location? No distractions? Talk aids ready?";
    elements.summaryReason.textContent = tbt.reason_text || "To ensure safe working practice.";
    elements.summaryWhy.textContent = tbt.why_text || "To prevent workplace injuries.";
    elements.summaryOutline.textContent = tbt.outline_text || `Safe work instructions for ${tbt.title}.`;

    // Render HTML Sections into Scrollable Container
    const content = tbt.content;
    let html = "";

    if (content && content.sections && Array.isArray(content.sections)) {
      content.sections.forEach((sec) => {
        html += `<div class="tbt-section">`;
        if (sec.title) {
          html += `<h3>${escapeHtml(sec.title)}</h3>`;
        }
        if (sec.callout) {
          html += `
            <div class="callout-box">
              <span class="callout-badge">Safety Rule</span>
              <div>${escapeHtml(sec.callout)}</div>
            </div>
          `;
        }
        if (sec.subtitle) {
          html += `<p style="font-weight: 600; color: #1e293b;">${escapeHtml(sec.subtitle)}</p>`;
        }
        if (sec.body) {
          html += `<p>${escapeHtml(sec.body)}</p>`;
        }
        if (sec.subsections && Array.isArray(sec.subsections)) {
          sec.subsections.forEach((sub) => {
            html += `<h4>${escapeHtml(sub.heading)}</h4>`;
            if (sub.points && Array.isArray(sub.points)) {
              html += `<ul class="tbt-points-list">`;
              sub.points.forEach((pt) => {
                html += `<li>${escapeHtml(pt)}</li>`;
              });
              html += `</ul>`;
            }
          });
        }
        if (sec.points && Array.isArray(sec.points)) {
          html += `<ul class="tbt-points-list">`;
          sec.points.forEach((pt) => {
            html += `<li>${escapeHtml(pt)}</li>`;
          });
          html += `</ul>`;
        }
        html += `</div>`;
      });
    } else if (content && content.raw) {
      html = `<div class="tbt-section"><p>${escapeHtml(content.raw)}</p></div>`;
    }

    // Official "Do you have any questions for me?" note & Bottom Sentinel
    html += `
      <div style="margin-top: 1.5rem; padding: 1rem; background-color: #f8fafc; border-radius: 6px; border-left: 3px solid var(--secondary);">
        <p style="font-weight: 700; color: var(--secondary); margin-bottom: 0.25rem;">Do you have any questions for me?</p>
        <p style="font-size: 0.85rem; color: #64748b;">If any aspect of this talk is unclear, please raise it with your supervisor immediately before signing.</p>
      </div>
      <div id="reading-sentinel" class="bottom-sentinel"></div>
    `;

    elements.tbtContentContainer.innerHTML = html;
    elements.tbtContentContainer.scrollTop = 0;
    elements.readingProgressBar.style.width = "0%";

    // Render Comprehension Question & Options
    elements.comprehensionQuestionText.textContent = `Q: ${tbt.comprehension_question}`;
    let optsHtml = "";
    if (tbt.comprehension_options && Array.isArray(tbt.comprehension_options)) {
      tbt.comprehension_options.forEach((opt, idx) => {
        optsHtml += `
          <label class="option-item" data-index="${idx}">
            <input type="radio" name="comprehension-option" value="${idx}">
            <span class="option-text">${escapeHtml(opt)}</span>
          </label>
        `;
      });
    }
    elements.comprehensionOptionsContainer.innerHTML = optsHtml;

    setupScrollObserver();
  }

  // --------------------------------------------------------------------------
  // UK Defensibility Scroll Monitoring (IntersectionObserver + Scroll event)
  // --------------------------------------------------------------------------
  function setupScrollObserver() {
    const container = elements.tbtContentContainer;
    const sentinel = document.getElementById("reading-sentinel");

    // Scroll event for reading progress bar
    container.onscroll = () => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll > 0) {
        const pct = Math.min(100, Math.round((container.scrollTop / maxScroll) * 100));
        elements.readingProgressBar.style.width = pct + "%";

        // If operative scrolled to within 25px of the absolute bottom
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 25) {
          triggerScrollUnlocked();
        }
      } else {
        // Very short content, unlocked immediately
        triggerScrollUnlocked();
      }
    };

    // IntersectionObserver as secondary reliable trigger
    if (sentinel && window.IntersectionObserver) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              triggerScrollUnlocked();
            }
          });
        },
        { root: container, threshold: 0.8 }
      );
      observer.observe(sentinel);
    }
  }

  function triggerScrollUnlocked() {
    if (state.scrolledToBottom) return;
    state.scrolledToBottom = true;

    // Update status badge to green
    elements.scrollStatusBadge.classList.remove("pending");
    elements.scrollStatusBadge.classList.add("completed");
    elements.scrollStatusBadge.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Full material reviewed ✓</span>
    `;

    // Unlock Step 1: Comprehension Question
    elements.stepComprehension.classList.remove("step-locked");
    elements.comprehensionLockWarning.style.display = "none";
    elements.comprehensionBox.style.display = "block";

    showToast("Toolbox Talk reviewed. Please answer the comprehension question below.", "success");
  }

  // --------------------------------------------------------------------------
  // Operatives Loading & Management
  // --------------------------------------------------------------------------
  async function loadOperatives() {
    try {
      const res = await fetch("/api/operatives");
      const json = await res.json();
      if (json.success && json.data) {
        state.operatives = json.data;
        renderOperativesDropdown(json.data);
      }
    } catch (err) {
      console.error("Error loading operatives:", err);
    }
  }

  function renderOperativesDropdown(list) {
    const sel = elements.operativeSelect;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- Choose Operative --</option>';

    list.forEach((op) => {
      const opt = document.createElement("option");
      opt.value = op.id;
      opt.textContent = `${op.name} (${op.role || "Operative"})`;
      opt.dataset.company = op.company || "Three Eagles Ltd";
      sel.appendChild(opt);
    });

    if (currentVal) sel.value = currentVal;
  }

  // --------------------------------------------------------------------------
  // Event Listeners & Step Logic
  // --------------------------------------------------------------------------
  function setupEventListeners() {
    // TBT dropdown switch
    elements.tbtSelect.addEventListener("change", (e) => {
      loadTbt(e.target.value);
    });

    // Comprehension radio click
    elements.comprehensionOptionsContainer.addEventListener("change", (e) => {
      if (e.target.name === "comprehension-option") {
        handleOptionSelected(parseInt(e.target.value, 10));
      }
    });

    // Operative select change
    elements.operativeSelect.addEventListener("change", (e) => {
      const selected = elements.operativeSelect.options[elements.operativeSelect.selectedIndex];
      if (selected && selected.dataset.company) {
        elements.operativeCompany.value = selected.dataset.company;
      }
      updateSubmitButtonState();
    });

    // Quick add modal buttons
    elements.btnQuickAddOperative.addEventListener("click", () => {
      elements.modalAddOperative.classList.add("active");
    });
    elements.btnCloseModalAdd.addEventListener("click", () => {
      elements.modalAddOperative.classList.remove("active");
    });
    elements.btnCancelAddOp.addEventListener("click", () => {
      elements.modalAddOperative.classList.remove("active");
    });

    // Save new operative
    elements.btnSaveNewOp.addEventListener("click", handleSaveNewOperative);

    // Submit sign-off button
    elements.btnSubmitSignoff.addEventListener("click", handleSubmitSignoff);

    // Next operative after success
    elements.btnDoneNextOp.addEventListener("click", () => {
      elements.modalSuccessReceipt.classList.remove("active");
      resetForNextOperative();
    });
  }

  // --------------------------------------------------------------------------
  // Comprehension Verification Logic
  // --------------------------------------------------------------------------
  function handleOptionSelected(answerIndex) {
    state.selectedAnswerIndex = answerIndex;

    // Highlight selected card
    const items = elements.comprehensionOptionsContainer.querySelectorAll(".option-item");
    items.forEach((item) => {
      if (parseInt(item.dataset.index, 10) === answerIndex) {
        item.classList.add("selected");
      } else {
        item.classList.remove("selected");
      }
    });

    const isCorrect =
      state.currentTbt && answerIndex === state.currentTbt.correct_option_index;

    if (isCorrect) {
      state.comprehensionPassed = true;
      elements.comprehensionFeedback.className = "comprehension-feedback success";
      elements.comprehensionFeedback.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Correct! Comprehension verified. You may now complete operative details and sign below.</span>
      `;

      // Unlock Steps 2, 3, and 4
      elements.stepOperative.classList.remove("step-locked");
      elements.operativeSelect.disabled = false;
      elements.stepNotes.classList.remove("step-locked");
      elements.tbtNotes.disabled = false;
      elements.stepSignature.classList.remove("step-locked");

      updateSubmitButtonState();
    } else {
      state.comprehensionPassed = false;
      elements.comprehensionFeedback.className = "comprehension-feedback error";
      elements.comprehensionFeedback.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>Incorrect answer. Please re-read the material above and select the correct answer to unlock signature.</span>
      `;

      // Keep subsequent steps locked
      elements.stepOperative.classList.add("step-locked");
      elements.operativeSelect.disabled = true;
      elements.stepNotes.classList.add("step-locked");
      elements.tbtNotes.disabled = true;
      elements.stepSignature.classList.add("step-locked");

      updateSubmitButtonState();
    }
  }

  // --------------------------------------------------------------------------
  // Submit State Validation
  // --------------------------------------------------------------------------
  function updateSubmitButtonState() {
    const hasOperative = Boolean(elements.operativeSelect.value);
    const canSubmit =
      state.scrolledToBottom &&
      state.comprehensionPassed &&
      hasOperative &&
      state.hasSignature &&
      !state.isSubmitting;

    elements.btnSubmitSignoff.disabled = !canSubmit;
  }

  // --------------------------------------------------------------------------
  // Save New Operative
  // --------------------------------------------------------------------------
  async function handleSaveNewOperative() {
    const name = elements.newOpName.value.trim();
    const company = elements.newOpCompany.value.trim() || "Three Eagles Ltd";
    const role = elements.newOpRole.value.trim() || "Operative";
    const trade = elements.newOpTrade.value.trim() || "General Labour";

    if (!name) {
      showToast("Please enter operative full name.", "error");
      elements.newOpName.focus();
      return;
    }

    elements.btnSaveNewOp.disabled = true;
    elements.btnSaveNewOp.textContent = "Saving...";

    try {
      const res = await fetch("/api/operatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, role, trade }),
      });
      const json = await res.json();

      if (!json.success) {
        showToast(json.error || "Failed to register operative.", "error");
        return;
      }

      showToast(`Registered ${name} successfully!`, "success");
      elements.modalAddOperative.classList.remove("active");
      elements.newOpName.value = "";
      elements.newOpRole.value = "";
      elements.newOpTrade.value = "";

      // Refresh operatives list and auto-select
      await loadOperatives();
      if (json.data && json.data.id) {
        elements.operativeSelect.value = json.data.id;
        elements.operativeCompany.value = company;
      }
      updateSubmitButtonState();
    } catch (err) {
      console.error(err);
      showToast("Network error creating operative.", "error");
    } finally {
      elements.btnSaveNewOp.disabled = false;
      elements.btnSaveNewOp.textContent = "Save & Select";
    }
  }

  // --------------------------------------------------------------------------
  // Submit Sign-Off (UK Defensible Snapshot)
  // --------------------------------------------------------------------------
  async function handleSubmitSignoff() {
    if (elements.btnSubmitSignoff.disabled) return;

    const operativeId = elements.operativeSelect.value;
    const docCode = state.currentTbt.doc_code;
    const notes = elements.tbtNotes.value.trim();
    const signaturePng = elements.signatureCanvas.toDataURL("image/png");

    state.isSubmitting = true;
    elements.btnSubmitSignoff.disabled = true;
    elements.btnSubmitSignoff.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
      </svg>
      <span>Logging Immutable Record...</span>
    `;

    try {
      const res = await fetch("/api/signoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_code: docCode,
          operative_id: parseInt(operativeId, 10),
          scrolled_to_bottom: true,
          answer_index: state.selectedAnswerIndex,
          notes: notes,
          signature_png: signaturePng,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        showToast(json.error || "Submission failed.", "error");
        return;
      }

      // Display official receipt modal
      elements.receiptOpName.textContent = json.data.operative_name;
      elements.receiptTbtCode.textContent = json.data.doc_code;
      elements.receiptRecordId.textContent = json.data.record_id || "OK";
      elements.receiptTimestamp.textContent = new Date(json.data.signed_at).toUTCString();
      elements.receiptCompany.textContent = json.data.operative_company;

      elements.modalSuccessReceipt.classList.add("active");
    } catch (err) {
      console.error(err);
      showToast("Error recording sign-off.", "error");
    } finally {
      state.isSubmitting = false;
      elements.btnSubmitSignoff.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Submit Digital Sign-Off</span>
      `;
      updateSubmitButtonState();
    }
  }

  // --------------------------------------------------------------------------
  // Reset Functions
  // --------------------------------------------------------------------------
  function resetSignoffForm() {
    state.scrolledToBottom = false;
    state.comprehensionPassed = false;
    state.selectedAnswerIndex = null;
    state.hasSignature = false;

    // Reset status pill
    elements.scrollStatusBadge.className = "scroll-status-pill pending";
    elements.scrollStatusBadge.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>Scroll to bottom to unlock sign-off</span>
    `;

    // Lock Step 1
    elements.stepComprehension.classList.add("step-locked");
    elements.comprehensionLockWarning.style.display = "flex";
    elements.comprehensionBox.style.display = "none";
    elements.comprehensionFeedback.style.display = "none";

    // Lock Step 2, 3, 4
    elements.stepOperative.classList.add("step-locked");
    elements.operativeSelect.value = "";
    elements.operativeSelect.disabled = true;

    elements.stepNotes.classList.add("step-locked");
    elements.tbtNotes.value = "";
    elements.tbtNotes.disabled = true;

    elements.stepSignature.classList.add("step-locked");
    clearSignature();

    updateSubmitButtonState();
  }

  function resetForNextOperative() {
    // Keep TBT read and comprehension passed if same site supervisor is passing phone around
    elements.operativeSelect.value = "";
    elements.tbtNotes.value = "";
    clearSignature();
    elements.operativeSelect.focus();
    updateSubmitButtonState();
  }

  // --------------------------------------------------------------------------
  // Utilities & Toast Notifications
  // --------------------------------------------------------------------------
  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${escapeHtml(message)}</span>
    `;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(100%)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Start on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
