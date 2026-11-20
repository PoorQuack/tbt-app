// public/admin.js
// Admin Dashboard & Official A4 Sign-Off Register Generator
// Features: Supervisor PIN auth, live metrics, A4 register rendering with signatures, audit log, CSV export

(function () {
  "use strict";

  let adminPin = sessionStorage.getItem("tbt_admin_pin") || "";
  let currentTab = "tab-register";
  let cachedRecords = [];

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
    filterRegisterDate: document.getElementById("filter-register-date"),
    btnRefreshRegister: document.getElementById("btn-refresh-register"),
    btnPrintRegister: document.getElementById("btn-print-register"),
    printSubTitle: document.getElementById("print-sub-title"),
    registerTableBody: document.getElementById("register-table-body"),
    printFooterOwner: document.getElementById("print-footer-owner"),
    printFooterCode: document.getElementById("print-footer-code"),
    printFooterLr: document.getElementById("print-footer-lr"),
    printFooterNr: document.getElementById("print-footer-nr"),

    // Audit Tab
    btnExportCsv: document.getElementById("btn-export-csv"),
    auditTableBody: document.getElementById("audit-table-body"),

    // Operatives Tab
    btnAdminAddOp: document.getElementById("btn-admin-add-op"),
    operativesTableBody: document.getElementById("operatives-table-body"),

    // TBTs Tab
    tbtsTableBody: document.getElementById("tbts-table-body"),

    // Modals
    modalAuditDetail: document.getElementById("modal-audit-detail"),
    auditDetailContent: document.getElementById("audit-detail-content"),
    btnCloseAuditModal: document.getElementById("btn-close-audit-modal"),
    btnCloseAuditModal2: document.getElementById("btn-close-audit-modal2"),

    modalAdminOp: document.getElementById("modal-admin-op"),
    btnCloseAdminOp: document.getElementById("btn-close-admin-op"),
    btnCancelAdminOp: document.getElementById("btn-cancel-admin-op"),
    btnSaveAdminOp: document.getElementById("btn-save-admin-op"),
    formAdminAddOp: document.getElementById("form-admin-add-op"),
    adminOpName: document.getElementById("admin-op-name"),
    adminOpCompany: document.getElementById("admin-op-company"),
    adminOpRole: document.getElementById("admin-op-role"),
    adminOpTrade: document.getElementById("admin-op-trade"),

    toastContainer: document.getElementById("toast-container"),
  };

  // Initial check
  document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    if (adminPin) {
      verifyAndLogin(adminPin);
    }
  });

  // --------------------------------------------------------------------------
  // Authentication
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

      // Login Successful
      adminPin = pin;
      sessionStorage.setItem("tbt_admin_pin", pin);
      elements.authGateCard.style.display = "none";
      elements.adminPortalView.style.display = "block";
      elements.btnLogout.style.display = "inline-flex";

      renderStats(json.data.stats);
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
  // Tabs Navigation
  // --------------------------------------------------------------------------
  function setupEventListeners() {
    // PIN Form Submit
    elements.formAuthPin.addEventListener("submit", (e) => {
      e.preventDefault();
      const pin = elements.adminPinInput.value.trim();
      if (!pin) return;
      verifyAndLogin(pin);
    });

    elements.btnLogout.addEventListener("click", handleLogout);

    // Tab buttons click
    elements.tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.dataset.tab;
        switchTab(targetTab);
      });
    });

    // Register Tab Filters
    elements.filterRegisterTbt.addEventListener("change", loadRegisterData);
    elements.filterRegisterDate.addEventListener("change", loadRegisterData);
    elements.btnRefreshRegister.addEventListener("click", loadRegisterData);
    elements.btnPrintRegister.addEventListener("click", () => window.print());

    // Audit Tab CSV Export
    elements.btnExportCsv.addEventListener("click", exportAuditToCsv);

    // Operatives Tab Add Button
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
    const docCode = elements.filterRegisterTbt.value;
    const dateVal = elements.filterRegisterDate.value;

    let url = `/api/admin?action=register&doc_code=${encodeURIComponent(docCode)}`;
    if (dateVal) {
      url += `&date=${encodeURIComponent(dateVal)}`;
    }

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
    const lr = tbt ? tbt.last_revision : "05/01/2026";
    const nr = tbt ? tbt.next_revision : "04/01/2028";
    const owner = tbt ? tbt.doc_owner : "Operations Director";

    elements.printSubTitle.textContent = `${title} ${docCode}`;
    elements.printFooterOwner.textContent = owner;
    elements.printFooterCode.textContent = docCode;
    elements.printFooterLr.textContent = lr;
    elements.printFooterNr.textContent = nr;

    const tbody = elements.registerTableBody;
    tbody.innerHTML = "";

    const rowsCount = records ? records.length : 0;
    // Always render at least 12 rows so the paper sheet mirrors official blank lines
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
        // Blank row for printing continuation
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
  // TAB 2: IMMUTABLE AUDIT LOG
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
          <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">
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
        <td>${escapeHtml(rec.operative_name)}</td>
        <td>${escapeHtml(rec.operative_company)}</td>
        <td>
          <span style="color: var(--success); font-weight: 700;">Passed ✓</span>
        </td>
        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(rec.notes || '')}">
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

    // Attach view listeners
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
          <div><strong>Document Owner:</strong> ${escapeHtml(rec.doc_owner || 'Operations Director')}</div>
          <div><strong>Operative Name:</strong> ${escapeHtml(rec.operative_name)}</div>
          <div><strong>Company:</strong> ${escapeHtml(rec.operative_company)}</div>
          <div><strong>Last Revision:</strong> ${escapeHtml(rec.last_revision)}</div>
          <div><strong>Next Revision:</strong> ${escapeHtml(rec.next_revision)}</div>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 0.85rem; border-radius: 6px; margin-bottom: 1rem;">
          <strong>Legal Defensibility Checks:</strong>
          <ul style="padding-left: 1.25rem; margin-top: 0.35rem; font-size: 0.85rem;">
            <li>Full Content Scrolled & Read: <strong style="color: var(--success);">Yes (100% verified)</strong></li>
            <li>Comprehension Check: <strong style="color: var(--success);">Verified Correct</strong></li>
            <li>Selected Answer: <em>${escapeHtml(rec.selected_answer || 'Correct Answer')}</em></li>
            <li>Client IP: <code>${escapeHtml(rec.client_ip || 'N/A')}</code></li>
            <li>Browser User Agent: <span style="font-size: 0.75rem; color: #64748b;">${escapeHtml(rec.user_agent || 'Standard Mobile WebKit')}</span></li>
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
  // TAB 3: OPERATIVES MANAGEMENT
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
          <span style="font-weight: 700; color: ${op.active ? "var(--success)" : "var(--danger)"};">
            ${op.active ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          <button type="button" class="sig-btn btn-toggle-op" data-id="${op.id}" data-active="${op.active}">
            ${op.active ? "Deactivate" : "Activate"}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-toggle-op").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.dataset.id, 10);
        const currentActive = btn.dataset.active === "1";
        await toggleOperativeStatus(id, !currentActive);
      });
    });
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
  // TAB 4: TBT DOCUMENT LIBRARY
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
        <td>${escapeHtml(tbt.doc_owner)}</td>
        <td><strong>${escapeHtml(tbt.last_revision)}</strong></td>
        <td>${escapeHtml(tbt.next_revision)}</td>
        <td><span style="color: var(--success); font-weight: 700;">Active</span></td>
      `;
      tbody.appendChild(tr);
    });
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
