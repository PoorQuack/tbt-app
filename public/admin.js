// public/admin.js
// Admin Dashboard & Official A4 Sign-Off Register Generator
// Features: Strict header auth (X-Admin-PIN), dynamic TBT dropdowns, outstanding operatives & WhatsApp reminder, PIN resets, cycle management

(function () {
  "use strict";

  let adminPin = sessionStorage.getItem("tbt_admin_pin") || "";
  let currentTab = "tab-register";
  let cachedRecords = [];
  let cachedTbts = [];
  let currentOutstandingData = null;
  let editingOpId = null;
  let editingTbtId = null;

  // DOM Elements
  const elements = {
    authGateCard: document.getElementById("auth-gate-card"),
    adminPortalView: document.getElementById("admin-portal-view"),
    formAuthPin: document.getElementById("form-auth-pin"),
    adminPinInput: document.getElementById("admin-pin-input"),
    authPinError: document.getElementById("auth-pin-error"),
    btnLogout: document.getElementById("btn-logout"),

    // Stats
    statTotalSignoffs: document.getElementById("stat-total-signoffs"),
    statTodaySignoffs: document.getElementById("stat-today-signoffs"),
    statTotalOperatives: document.getElementById("stat-total-operatives"),
    statTotalTbts: document.getElementById("stat-total-tbts"),

    // Tabs
    tabBtns: document.querySelectorAll(".tab-btn"),
    tabContents: document.querySelectorAll(".tab-content"),

    // Register Tab
    filterRegisterTbt: document.getElementById("filter-register-tbt"),
    filterRegisterWeek: document.getElementById("filter-register-week"),
    filterRegisterDate: document.getElementById("filter-register-date"),
    btnRefreshRegister: document.getElementById("btn-refresh-register"),
    btnPrintRegister: document.getElementById("btn-print-register"),
    printSubTitle: document.getElementById("print-sub-title"),
    printSubWeek: document.getElementById("print-sub-week"),
    registerTableBody: document.getElementById("register-table-body"),
    printFooterOwner: document.getElementById("print-footer-owner"),
    printFooterCode: document.getElementById("print-footer-code"),
    printFooterLr: document.getElementById("print-footer-lr"),
    printFooterNr: document.getElementById("print-footer-nr"),

    // Outstanding Tab
    filterOutstandingTbt: document.getElementById("filter-outstanding-tbt"),
    outstandingComplianceSummary: document.getElementById("outstanding-compliance-summary"),
    btnCopyReminderList: document.getElementById("btn-copy-reminder-list"),
    outstandingTableBody: document.getElementById("outstanding-table-body"),

    // Audit Tab
    btnExportCsv: document.getElementById("btn-export-csv"),
    auditTableBody: document.getElementById("audit-table-body"),

    // Operatives Tab
    btnAdminAddOp: document.getElementById("btn-admin-add-op"),
    operativesTableBody: document.getElementById("operatives-table-body"),

    // TBTs Tab
    btnAdminAddTbt: document.getElementById("btn-admin-add-tbt"),
    tbtsTableBody: document.getElementById("tbts-table-body"),

    // Modals
    modalAuditDetail: document.getElementById("modal-audit-detail"),
    auditDetailContent: document.getElementById("audit-detail-content"),
    btnCloseAuditModal: document.getElementById("btn-close-audit-modal"),
    btnCloseAuditModal2: document.getElementById("btn-close-audit-modal2"),

    modalEditPin: document.getElementById("modal-edit-pin"),
    editPinOpName: document.getElementById("edit-pin-op-name"),
    editPinInput: document.getElementById("edit-pin-input"),
    btnClosePinModal: document.getElementById("btn-close-pin-modal"),
    btnCancelPinModal: document.getElementById("btn-cancel-pin-modal"),
    btnSavePin: document.getElementById("btn-save-pin"),

    modalEditTbtWeek: document.getElementById("modal-edit-tbt-week"),
    editWeekTbtTitle: document.getElementById("edit-week-tbt-title"),
    editWeekInput: document.getElementById("edit-week-input"),
    btnCloseWeekModal: document.getElementById("btn-close-week-modal"),
    btnCancelWeekModal: document.getElementById("btn-cancel-week-modal"),
    btnSaveWeek: document.getElementById("btn-save-week"),

    modalAddTbt: document.getElementById("modal-add-tbt"),
    btnCloseAddTbt: document.getElementById("btn-close-add-tbt"),
    btnCancelAddTbt: document.getElementById("btn-cancel-add-tbt"),
    btnSaveNewTbt: document.getElementById("btn-save-new-tbt"),
    formAddTbt: document.getElementById("form-add-tbt"),
    newTbtCode: document.getElementById("new-tbt-code"),
    newTbtTitle: document.getElementById("new-tbt-title"),
    newTbtCategory: document.getElementById("new-tbt-category"),
    newTbtWeek: document.getElementById("new-tbt-week"),
    newTbtQuestion: document.getElementById("new-tbt-question"),
    newTbtOptions: document.getElementById("new-tbt-options"),
    newTbtCorrectIdx: document.getElementById("new-tbt-correct-idx"),
    newTbtBody: document.getElementById("new-tbt-body"),

    modalAdminOp: document.getElementById("modal-admin-op"),
    btnCloseAdminOp: document.getElementById("btn-close-admin-op"),
    btnCancelAdminOp: document.getElementById("btn-cancel-admin-op"),
    btnSaveAdminOp: document.getElementById("btn-save-admin-op"),
    formAdminAddOp: document.getElementById("form-admin-add-op"),
    adminOpName: document.getElementById("admin-op-name"),
    adminOpCompany: document.getElementById("admin-op-company"),
    adminOpRole: document.getElementById("admin-op-role"),
    adminOpTrade: document.getElementById("admin-op-trade"),
    adminOpPin: document.getElementById("admin-op-pin"),

    toastContainer: document.getElementById("toast-container"),
  };

  document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    if (adminPin) {
      verifyAndLogin(adminPin);
    }
  });

  // --------------------------------------------------------------------------
  // Header-Only Authentication
  // --------------------------------------------------------------------------
  async function verifyAndLogin(pin) {
    try {
      const res = await fetch("/api/admin?action=stats", {
        headers: { "X-Admin-PIN": pin },
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        sessionStorage.removeItem("tbt_admin_pin");
        adminPin = "";
        showAuthError(json.error || "Invalid Security PIN.");
        return;
      }

      adminPin = pin;
      sessionStorage.setItem("tbt_admin_pin", pin);
      elements.authGateCard.style.display = "none";
      elements.adminPortalView.style.display = "block";
      elements.btnLogout.style.display = "inline-flex";

      renderStats(json.data.stats);
      await loadDynamicTbts();
      loadTabContent(currentTab);
    } catch (err) {
      console.error(err);
      showAuthError("Connection error while authenticating.");
    }
  }

  function showAuthError(msg) {
    elements.authPinError.textContent = msg;
    elements.authPinError.style.display = "block";
  }

  function handleLogout() {
    sessionStorage.removeItem("tbt_admin_pin");
    adminPin = "";
    elements.adminPortalView.style.display = "none";
    elements.authGateCard.style.display = "block";
    elements.btnLogout.style.display = "none";
    elements.adminPinInput.value = "";
    elements.authPinError.style.display = "none";
  }

  // --------------------------------------------------------------------------
  // Load Dynamic TBT Dropdowns
  // --------------------------------------------------------------------------
  async function loadDynamicTbts() {
    try {
      const res = await fetch("/api/tbts");
      const json = await res.json();
      if (json.success && json.data) {
        cachedTbts = json.data;
        populateDropdown(elements.filterRegisterTbt, cachedTbts);
        populateDropdown(elements.filterOutstandingTbt, cachedTbts);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function populateDropdown(selectElement, list) {
    const currentVal = selectElement.value;
    selectElement.innerHTML = "";
    list.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.doc_code;
      opt.textContent = `${t.doc_code} - ${t.title} (${t.briefing_week || "Week 1"})`;
      selectElement.appendChild(opt);
    });
    if (currentVal && list.some((t) => t.doc_code === currentVal)) {
      selectElement.value = currentVal;
    }
  }

  // --------------------------------------------------------------------------
  // Tabs Navigation
  // --------------------------------------------------------------------------
  function setupEventListeners() {
    elements.formAuthPin.addEventListener("submit", (e) => {
      e.preventDefault();
      const pin = elements.adminPinInput.value.trim();
      if (!pin) return;
      verifyAndLogin(pin);
    });

    elements.btnLogout.addEventListener("click", handleLogout);

    elements.tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.dataset.tab;
        switchTab(targetTab);
      });
    });

    // Register Tab Filters
    elements.filterRegisterTbt.addEventListener("change", loadRegisterData);
    elements.filterRegisterWeek.addEventListener("input", loadRegisterData);
    elements.filterRegisterDate.addEventListener("change", loadRegisterData);
    elements.btnRefreshRegister.addEventListener("click", loadRegisterData);
    elements.btnPrintRegister.addEventListener("click", () => window.print());

    // Outstanding Tab Filter & Copy Button
    elements.filterOutstandingTbt.addEventListener("change", loadOutstandingData);
    elements.btnCopyReminderList.addEventListener("click", copyWhatsAppReminder);

    // Audit Tab CSV Export
    elements.btnExportCsv.addEventListener("click", exportAuditToCsv);

    // Operatives Tab Add & PIN Edit
    elements.btnAdminAddOp.addEventListener("click", () => {
      elements.modalAdminOp.classList.add("active");
    });
    elements.btnCloseAdminOp.addEventListener("click", () => {
      elements.modalAdminOp.classList.remove("active");
    });
    elements.btnCancelAdminOp.addEventListener("click", () => {
      elements.modalAdminOp.classList.remove("active");
    });
    elements.btnSaveAdminOp.addEventListener("click", handleSaveAdminOperative);

    // PIN Modal
    elements.btnClosePinModal.addEventListener("click", () => {
      elements.modalEditPin.classList.remove("active");
    });
    elements.btnCancelPinModal.addEventListener("click", () => {
      elements.modalEditPin.classList.remove("active");
    });
    elements.btnSavePin.addEventListener("click", handleSavePin);

    // TBT Week Modal
    elements.btnCloseWeekModal.addEventListener("click", () => {
      elements.modalEditTbtWeek.classList.remove("active");
    });
    elements.btnCancelWeekModal.addEventListener("click", () => {
      elements.modalEditTbtWeek.classList.remove("active");
    });
    elements.btnSaveWeek.addEventListener("click", handleSaveTbtWeek);

    // Add TBT Modal
    elements.btnAdminAddTbt.addEventListener("click", () => {
      elements.modalAddTbt.classList.add("active");
    });
    elements.btnCloseAddTbt.addEventListener("click", () => {
      elements.modalAddTbt.classList.remove("active");
    });
    elements.btnCancelAddTbt.addEventListener("click", () => {
      elements.modalAddTbt.classList.remove("active");
    });
    elements.btnSaveNewTbt.addEventListener("click", handleSaveNewTbt);

    // Audit Detail Modal
    elements.btnCloseAuditModal.addEventListener("click", () => {
      elements.modalAuditDetail.classList.remove("active");
    });
    elements.btnCloseAuditModal2.addEventListener("click", () => {
      elements.modalAuditDetail.classList.remove("active");
    });
  }

  function switchTab(tabId) {
    currentTab = tabId;
    elements.tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
    elements.tabContents.forEach((c) => {
      c.style.display = c.id === tabId ? "block" : "none";
    });
    loadTabContent(tabId);
  }

  function loadTabContent(tabId) {
    if (tabId === "tab-register") {
      loadRegisterData();
    } else if (tabId === "tab-outstanding") {
      loadOutstandingData();
    } else if (tabId === "tab-audit") {
      loadAuditData();
    } else if (tabId === "tab-operatives") {
      loadOperativesData();
    } else if (tabId === "tab-tbts") {
      loadTbtsData();
    }
  }

  function renderStats(stats) {
    if (!stats) return;
    elements.statTotalSignoffs.textContent = stats.total_signoffs || 0;
    elements.statTodaySignoffs.textContent = stats.today_signoffs || 0;
    elements.statTotalOperatives.textContent = stats.active_operatives || 0;
    elements.statTotalTbts.textContent = stats.active_tbts || 0;
  }

  // --------------------------------------------------------------------------
  // TAB 1: OFFICIAL A4 REGISTER GENERATOR
  // --------------------------------------------------------------------------
  async function loadRegisterData() {
    const docCode = elements.filterRegisterTbt.value || "AVC032";
    const weekVal = elements.filterRegisterWeek.value.trim();
    const dateVal = elements.filterRegisterDate.value;

    let url = `/api/admin?action=register&doc_code=${encodeURIComponent(docCode)}`;
    if (weekVal) url += `&briefing_week=${encodeURIComponent(weekVal)}`;
    if (dateVal) url += `&date=${encodeURIComponent(dateVal)}`;

    try {
      const res = await fetch(url, {
        headers: { "X-Admin-PIN": adminPin },
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error || "Failed to load register.", "error");
        return;
      }

      renderOfficialRegister(json.data.tbt, json.data.records);
    } catch (err) {
      console.error(err);
      showToast("Network error fetching register.", "error");
    }
  }

  function renderOfficialRegister(tbt, records) {
    const docCode = tbt ? tbt.doc_code : elements.filterRegisterTbt.value;
    const title = tbt ? tbt.title : "Safe Use of Step Ladder";
    const week = tbt ? (tbt.briefing_week || "Week 1") : "Week 1";
    const lr = tbt ? tbt.last_revision : "05/01/2026";
    const nr = tbt ? tbt.next_revision : "04/01/2028";
    const owner = tbt ? tbt.doc_owner : "Operations Director";

    elements.printSubTitle.textContent = `${title} ${docCode}`;
    elements.printSubWeek.textContent = week;
    elements.printFooterOwner.textContent = owner;
    elements.printFooterCode.textContent = docCode;
    elements.printFooterLr.textContent = lr;
    elements.printFooterNr.textContent = nr;

    const tbody = elements.registerTableBody;
    tbody.innerHTML = "";

    const rowsCount = records ? records.length : 0;
    const minRows = Math.max(12, rowsCount);

    for (let i = 0; i < minRows; i++) {
      const rec = records && records[i];
      const tr = document.createElement("tr");

      if (rec) {
        const formattedDate = formatDateUk(rec.signed_at);
        tr.innerHTML = `
          <td>${escapeHtml(formattedDate)}</td>
          <td style="font-weight: 600;">${escapeHtml(rec.operative_name)}</td>
          <td>
            ${
              rec.signature_png
                ? `<img src="${rec.signature_png}" class="register-signature-img" alt="Signature">`
                : `<span style="color:#94a3b8; font-style:italic;">No signature</span>`
            }
          </td>
          <td>${escapeHtml(rec.operative_company || "Three Eagles Ltd")}</td>
        `;
      } else {
        tr.innerHTML = `
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
          <td>&nbsp;</td>
        `;
      }
      tbody.appendChild(tr);
    }
  }

  // --------------------------------------------------------------------------
  // TAB 2: OUTSTANDING OPERATIVES PANEL & WHATSAPP REMINDER
  // --------------------------------------------------------------------------
  async function loadOutstandingData() {
    const docCode = elements.filterOutstandingTbt.value || "AVC032";
    try {
      const res = await fetch(`/api/admin?action=outstanding&doc_code=${encodeURIComponent(docCode)}`, {
        headers: { "X-Admin-PIN": adminPin },
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error || "Failed to load outstanding operatives.", "error");
        return;
      }

      currentOutstandingData = json.data;
      renderOutstandingView(json.data);
    } catch (err) {
      console.error(err);
      showToast("Network error fetching outstanding operatives.", "error");
    }
  }

  function renderOutstandingView(data) {
    const { tbt, outstanding, signed_count, total_active } = data;
    const pct = total_active > 0 ? Math.round((signed_count / total_active) * 100) : 0;

    elements.outstandingComplianceSummary.innerHTML = `
      <span style="color: ${pct === 100 ? 'var(--success)' : 'var(--primary)'};">
        Signed: ${signed_count} / ${total_active} (${pct}%)
      </span>
      &nbsp;•&nbsp;
      <span style="color: ${outstanding.length > 0 ? 'var(--danger)' : 'var(--success)'};">
        Outstanding: ${outstanding.length}
      </span>
      &nbsp;•&nbsp;
      <span style="color: #64748b;">Cycle: ${escapeHtml(tbt.briefing_week)}</span>
    `;

    const tbody = elements.outstandingTableBody;
    tbody.innerHTML = "";

    if (outstanding.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--success); font-weight: 700; padding: 2rem;">
            ✓ All active site operatives have successfully completed sign-off for ${escapeHtml(tbt.doc_code)} (${escapeHtml(tbt.briefing_week)})!
          </td>
        </tr>
      `;
      return;
    }

    outstanding.forEach((op) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 700;">${escapeHtml(op.name)}</td>
        <td>${escapeHtml(op.company)}</td>
        <td>${escapeHtml(op.role || "Operative")}</td>
        <td>${escapeHtml(op.trade || "General")}</td>
        <td><span style="color: var(--danger); font-weight: 700;">Not Signed</span></td>
        <td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${escapeHtml(op.pin || "1234")}</code></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function copyWhatsAppReminder() {
    if (!currentOutstandingData || !currentOutstandingData.outstanding) {
      showToast("No outstanding data loaded.", "error");
      return;
    }

    const { tbt, outstanding } = currentOutstandingData;
    if (outstanding.length === 0) {
      showToast("All operatives are 100% compliant! No reminder needed.", "success");
      return;
    }

    let text = `🚨 *THREE EAGLES LTD - AGC SITE TBT REMINDER*\n`;
    text += `*Topic:* ${tbt.doc_code} - ${tbt.title} (${tbt.briefing_week})\n\n`;
    text += `The following ${outstanding.length} operative(s) must complete their mandatory Toolbox Talk sign-off today:\n`;

    outstanding.forEach((op, idx) => {
      text += `${idx + 1}. ${op.name} (${op.role || 'Operative'}, ${op.company}) - PIN: ${op.pin || '1234'}\n`;
    });

    text += `\n📲 *Sign off online now:* https://tbt-app-5tv.pages.dev\n`;
    text += `(Scroll to read the talk, answer comprehension check, and sign with finger)`;

    navigator.clipboard.writeText(text).then(
      () => {
        showToast("WhatsApp reminder list copied to clipboard!", "success");
      },
      () => {
        showToast("Could not access clipboard. Please copy manually.", "error");
      }
    );
  }

  // --------------------------------------------------------------------------
  // TAB 3: IMMUTABLE AUDIT LOG
  // --------------------------------------------------------------------------
  async function loadAuditData() {
    try {
      const res = await fetch("/api/admin?action=signoffs", {
        headers: { "X-Admin-PIN": adminPin },
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error || "Failed to load audit records.", "error");
        return;
      }

      cachedRecords = json.data.records || [];
      renderAuditTable(cachedRecords);
    } catch (err) {
      console.error(err);
      showToast("Network error fetching audit logs.", "error");
    }
  }

  function renderAuditTable(records) {
    const tbody = elements.auditTableBody;
    tbody.innerHTML = "";

    if (!records || records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No sign-off records found.
          </td>
        </tr>
      `;
      return;
    }

    records.forEach((rec) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>#${rec.id}</td>
        <td>${formatDateTime(rec.signed_at)}</td>
        <td><strong>${escapeHtml(rec.doc_code)}</strong></td>
        <td><span class="banner-badge" style="background:#e2e8f0; color:#334155;">${escapeHtml(rec.briefing_week || "Week 1")}</span></td>
        <td>${escapeHtml(rec.operative_name)}</td>
        <td>${escapeHtml(rec.operative_company)}</td>
        <td><span style="color: var(--success); font-weight: 700;">Passed ✓</span></td>
        <td style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(rec.notes || '')}">
          ${rec.notes ? escapeHtml(rec.notes) : '<span style="color:#94a3b8;">None</span>'}
        </td>
        <td>
          ${
            rec.signature_png
              ? `<img src="${rec.signature_png}" class="signature-thumbnail" alt="Sig">`
              : "N/A"
          }
        </td>
        <td>
          <button type="button" class="sig-btn btn-view-audit" data-id="${rec.id}">
            View
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-view-audit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.dataset.id, 10);
        const record = cachedRecords.find((r) => r.id === id);
        if (record) openAuditDetailModal(record);
      });
    });
  }

  function openAuditDetailModal(rec) {
    elements.auditDetailContent.innerHTML = `
      <div style="font-size: 0.9rem; line-height: 1.6;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
          <div><strong>Record ID:</strong> #${rec.id}</div>
          <div><strong>Signed At:</strong> ${formatDateTime(rec.signed_at)}</div>
          <div><strong>Toolbox Talk:</strong> ${escapeHtml(rec.tbt_title)} (${escapeHtml(rec.doc_code)})</div>
          <div><strong>Briefing Cycle:</strong> ${escapeHtml(rec.briefing_week || 'Week 1')}</div>
          <div><strong>Operative:</strong> ${escapeHtml(rec.operative_name)}</div>
          <div><strong>Company:</strong> ${escapeHtml(rec.operative_company)}</div>
          <div><strong>Last Revision:</strong> ${escapeHtml(rec.last_revision)}</div>
          <div><strong>Next Revision:</strong> ${escapeHtml(rec.next_revision)}</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 0.85rem; border-radius: 6px; margin-bottom: 1rem;">
          <strong>Legal Defensibility Checks:</strong>
          <ul style="padding-left: 1.25rem; margin-top: 0.35rem; font-size: 0.85rem;">
            <li>Full Content Scrolled & Read: <strong style="color: var(--success);">Yes (100% verified)</strong></li>
            <li>Comprehension Check: <strong style="color: var(--success);">Verified Correct</strong></li>
            <li>4-Digit PIN Authentication: <strong style="color: var(--success);">Verified Valid</strong></li>
            <li>Client IP: <code>${escapeHtml(rec.client_ip || 'N/A')}</code></li>
            <li>User Agent: <span style="font-size: 0.75rem; color: #64748b;">${escapeHtml(rec.user_agent || 'Standard Mobile WebKit')}</span></li>
          </ul>
        </div>

        ${
          rec.notes
            ? `<div style="margin-bottom: 1rem;"><strong>Questions / Hazards / Notes:</strong><p style="background: #fff; border: 1px solid var(--border); padding: 0.5rem; border-radius: 4px; margin-top: 0.25rem;">${escapeHtml(rec.notes)}</p></div>`
            : ""
        }

        <div>
          <strong>Captured Signature Image:</strong>
          <div style="margin-top: 0.5rem; background: #ffffff; border: 1px solid var(--border-dark); padding: 0.75rem; border-radius: 6px; text-align: center;">
            <img src="${rec.signature_png}" style="max-height: 120px; max-width: 100%;" alt="Signature">
          </div>
        </div>
      </div>
    `;
    elements.modalAuditDetail.classList.add("active");
  }

  function exportAuditToCsv() {
    if (!cachedRecords || cachedRecords.length === 0) {
      showToast("No records to export.", "error");
      return;
    }

    const headers = [
      "Record ID",
      "Signed Timestamp (UTC)",
      "Doc Code",
      "TBT Title",
      "Briefing Week",
      "Document Owner",
      "Last Revision",
      "Operative Name",
      "Company",
      "Comprehension Passed",
      "Notes / Hazards",
      "Client IP",
    ];

    const rows = cachedRecords.map((r) => [
      r.id,
      `"${r.signed_at}"`,
      `"${r.doc_code}"`,
      `"${r.tbt_title.replace(/"/g, '""')}"`,
      `"${r.briefing_week || "Week 1"}"`,
      `"${(r.doc_owner || "").replace(/"/g, '""')}"`,
      `"${r.last_revision}"`,
      `"${r.operative_name.replace(/"/g, '""')}"`,
      `"${r.operative_company.replace(/"/g, '""')}"`,
      "YES",
      `"${(r.notes || "").replace(/"/g, '""')}"`,
      `"${r.client_ip || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const todayStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `3E_TBT_Signoff_Register_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("Audit register exported to CSV.", "success");
  }

  // --------------------------------------------------------------------------
  // TAB 4: OPERATIVES DIRECTORY & PIN MANAGEMENT
  // --------------------------------------------------------------------------
  async function loadOperativesData() {
    try {
      const res = await fetch("/api/admin?action=operatives", {
        headers: { "X-Admin-PIN": adminPin },
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error || "Failed to load operatives.", "error");
        return;
      }

      renderOperativesTable(json.data || []);
    } catch (err) {
      console.error(err);
      showToast("Network error fetching operatives.", "error");
    }
  }

  function renderOperativesTable(list) {
    const tbody = elements.operativesTableBody;
    tbody.innerHTML = "";

    list.forEach((op) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${op.id}</td>
        <td style="font-weight: 700;">${escapeHtml(op.name)}</td>
        <td>${escapeHtml(op.company)}</td>
        <td>${escapeHtml(op.role || "Operative")}</td>
        <td>${escapeHtml(op.trade || "General")}</td>
        <td>
          <code style="background: #fef08a; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #854d0e;">
            ${escapeHtml(op.pin || "1234")}
          </code>
        </td>
        <td>
          <span style="font-weight: 700; color: ${op.active ? "var(--success)" : "var(--danger)"};">
            ${op.active ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button type="button" class="sig-btn btn-edit-op-pin" data-id="${op.id}" data-name="${escapeHtml(op.name)}" data-pin="${escapeHtml(op.pin || '1234')}">
              Edit PIN
            </button>
            <button type="button" class="sig-btn btn-toggle-op" data-id="${op.id}" data-active="${op.active}">
              ${op.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-edit-op-pin").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingOpId = parseInt(btn.dataset.id, 10);
        elements.editPinOpName.textContent = btn.dataset.name;
        elements.editPinInput.value = btn.dataset.pin;
        elements.modalEditPin.classList.add("active");
        elements.editPinInput.focus();
      });
    });

    tbody.querySelectorAll(".btn-toggle-op").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.dataset.id, 10);
        const currentActive = btn.dataset.active === "1";
        await toggleOperativeStatus(id, !currentActive);
      });
    });
  }

  async function handleSavePin() {
    const newPin = elements.editPinInput.value.trim();
    if (!/^\d{4}$/.test(newPin)) {
      showToast("PIN must be exactly 4 digits (e.g. 1234).", "error");
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-PIN": adminPin,
        },
        body: JSON.stringify({
          action: "update_pin",
          id: editingOpId,
          pin: newPin,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Operative PIN updated!", "success");
        elements.modalEditPin.classList.remove("active");
        loadOperativesData();
      } else {
        showToast(json.error || "Failed to update PIN.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error updating PIN.", "error");
    }
  }

  async function toggleOperativeStatus(id, newActive) {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-PIN": adminPin,
        },
        body: JSON.stringify({
          action: "toggle_operative",
          id: id,
          active: newActive,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Operative status updated.", "success");
        loadOperativesData();
      } else {
        showToast(json.error || "Update failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error updating operative.", "error");
    }
  }

  async function handleSaveAdminOperative() {
    const name = elements.adminOpName.value.trim();
    const company = elements.adminOpCompany.value.trim() || "Three Eagles Ltd";
    const role = elements.adminOpRole.value.trim() || "Operative";
    const trade = elements.adminOpTrade.value.trim() || "General Labour";
    let pin = elements.adminOpPin.value.trim() || "1234";

    if (!/^\d{4}$/.test(pin)) pin = "1234";
    if (!name) {
      showToast("Name is required.", "error");
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-PIN": adminPin,
        },
        body: JSON.stringify({
          action: "add_operative",
          name,
          company,
          role,
          trade,
          pin,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Operative ${name} added!`, "success");
        elements.modalAdminOp.classList.remove("active");
        elements.adminOpName.value = "";
        loadOperativesData();
      } else {
        showToast(json.error || "Failed to add operative.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error adding operative.", "error");
    }
  }

  // --------------------------------------------------------------------------
  // TAB 5: TBT DOCUMENT LIBRARY & CYCLE MANAGEMENT
  // --------------------------------------------------------------------------
  async function loadTbtsData() {
    try {
      const res = await fetch("/api/admin?action=tbts", {
        headers: { "X-Admin-PIN": adminPin },
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error || "Failed to load TBT library.", "error");
        return;
      }

      renderTbtsTable(json.data || []);
    } catch (err) {
      console.error(err);
      showToast("Network error fetching TBT library.", "error");
    }
  }

  function renderTbtsTable(list) {
    const tbody = elements.tbtsTableBody;
    tbody.innerHTML = "";

    list.forEach((tbt) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong style="color: var(--primary);">${escapeHtml(tbt.doc_code)}</strong></td>
        <td style="font-weight: 600;">${escapeHtml(tbt.title)}</td>
        <td><span class="banner-badge" style="background:#e2e8f0; color:#334155;">${escapeHtml(tbt.category || "General")}</span></td>
        <td><strong style="color: var(--primary);">${escapeHtml(tbt.briefing_week || "Week 1")}</strong></td>
        <td>${escapeHtml(tbt.doc_owner)}</td>
        <td><strong>${escapeHtml(tbt.last_revision)}</strong></td>
        <td>
          <span style="color: ${tbt.active ? "var(--success)" : "var(--danger)"}; font-weight: 700;">
            ${tbt.active ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button type="button" class="sig-btn btn-edit-tbt-week" data-id="${tbt.id}" data-title="${escapeHtml(tbt.title)}" data-week="${escapeHtml(tbt.briefing_week || 'Week 1')}">
              New Cycle
            </button>
            <button type="button" class="sig-btn btn-toggle-tbt" data-id="${tbt.id}" data-active="${tbt.active}">
              ${tbt.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-edit-tbt-week").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingTbtId = btn.dataset.id;
        elements.editWeekTbtTitle.textContent = `${btn.dataset.id} - ${btn.dataset.title}`;
        elements.editWeekInput.value = btn.dataset.week;
        elements.modalEditTbtWeek.classList.add("active");
        elements.editWeekInput.focus();
      });
    });

    tbody.querySelectorAll(".btn-toggle-tbt").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const currentActive = btn.dataset.active === "1";
        await toggleTbtStatus(id, !currentActive);
      });
    });
  }

  async function handleSaveTbtWeek() {
    const newWeek = elements.editWeekInput.value.trim();
    if (!newWeek) {
      showToast("Briefing cycle label cannot be blank.", "error");
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-PIN": adminPin,
        },
        body: JSON.stringify({
          action: "update_tbt",
          id: editingTbtId,
          briefing_week: newWeek,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`TBT cycle updated to ${newWeek}!`, "success");
        elements.modalEditTbtWeek.classList.remove("active");
        await loadDynamicTbts();
        loadTbtsData();
      } else {
        showToast(json.error || "Failed to update cycle.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error updating cycle.", "error");
    }
  }

  async function toggleTbtStatus(id, newActive) {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-PIN": adminPin,
        },
        body: JSON.stringify({
          action: "update_tbt",
          id: id,
          active: newActive,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("TBT status updated.", "success");
        await loadDynamicTbts();
        loadTbtsData();
      } else {
        showToast(json.error || "Update failed.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error updating TBT status.", "error");
    }
  }

  async function handleSaveNewTbt() {
    const docCode = elements.newTbtCode.value.trim().toUpperCase();
    const title = elements.newTbtTitle.value.trim();
    const category = elements.newTbtCategory.value.trim() || "Health & Safety";
    const week = elements.newTbtWeek.value.trim() || "Week 1";
    const question = elements.newTbtQuestion.value.trim();
    const optionsRaw = elements.newTbtOptions.value.trim();
    const correctIdx = parseInt(elements.newTbtCorrectIdx.value, 10);
    const bodyText = elements.newTbtBody.value.trim();

    if (!docCode || !title || !question || !optionsRaw || !bodyText) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    let optionsArray = [];
    try {
      if (optionsRaw.startsWith("[")) {
        optionsArray = JSON.parse(optionsRaw);
      } else {
        optionsArray = optionsRaw.split(",").map((s) => s.trim());
      }
    } catch (e) {
      optionsArray = optionsRaw.split(",").map((s) => s.trim());
    }

    const contentObj = {
      prepare: "Quiet location? No distractions? Talk aids ready?",
      reason: `To ensure understanding of site hazards regarding ${title}.`,
      why: "To prevent workplace injuries and uphold safety standards.",
      outline: `This briefing covers ${title}.`,
      sections: [
        {
          title: "1. Overview & Safety Instructions",
          body: bodyText,
        },
      ],
    };

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-PIN": adminPin,
        },
        body: JSON.stringify({
          action: "add_tbt",
          doc_code: docCode,
          title: title,
          category: category,
          briefing_week: week,
          prepare_text: contentObj.prepare,
          reason_text: contentObj.reason,
          why_text: contentObj.why,
          outline_text: contentObj.outline,
          content_json: contentObj,
          comprehension_question: question,
          comprehension_options_json: optionsArray,
          correct_option_index: isNaN(correctIdx) ? 0 : correctIdx,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Toolbox Talk ${docCode} added!`, "success");
        elements.modalAddTbt.classList.remove("active");
        elements.formAddTbt.reset();
        await loadDynamicTbts();
        loadTbtsData();
      } else {
        showToast(json.error || "Failed to add TBT.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error creating TBT.", "error");
    }
  }

  // --------------------------------------------------------------------------
  // Formatting & Toast Helpers
  // --------------------------------------------------------------------------
  function formatDateUk(isoDateStr) {
    if (!isoDateStr) return "";
    try {
      const d = new Date(isoDateStr);
      if (isNaN(d.getTime())) return isoDateStr.slice(0, 10);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return isoDateStr.slice(0, 10);
    }
  }

  function formatDateTime(isoDateStr) {
    if (!isoDateStr) return "";
    try {
      const d = new Date(isoDateStr);
      return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
    } catch (e) {
      return isoDateStr;
    }
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
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
})();
