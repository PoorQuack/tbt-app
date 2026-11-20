// public/admin.js
// Cloudflare Pages Client Logic: Role-based Supervisor Portal & Delegated Company Coordinator Dashboard
// Features: Super Admin / Company Admin roles, company scoping, A4 Print Preview, A4 Register generator, client-side PDF.js parser

(function () {
  "use strict";

  // Configure Mozilla PDF.js Worker for zero-API client-side parsing
  if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  let adminPin = sessionStorage.getItem("tbt_admin_pin") || "";
  let currentUser = null; // { role: "super_admin" | "company_admin", account_name, company }
  let currentTab = "tab-register";
  let cachedRecords = [];
  let cachedTbts = [];
  let cachedCompanies = [];
  let currentOutstandingData = null;
  let editingTbtId = null;
  let editingOpId = null;

  // DOM Elements
  const elements = {
    authGateCard: document.getElementById("auth-gate-card"),
    formAuthPin: document.getElementById("form-auth-pin"),
    adminPinInput: document.getElementById("admin-pin-input"),
    btnTogglePin: document.getElementById("btn-toggle-pin"),
    btnSubmitPin: document.getElementById("btn-submit-pin"),
    authPinError: document.getElementById("auth-pin-error"),

    adminPortalView: document.getElementById("admin-portal-view"),
    adminAuthBadge: document.getElementById("admin-auth-badge"),
    siteHeaderSubtitle: document.getElementById("site-header-subtitle"),
    btnLogout: document.getElementById("btn-logout"),
    tabBtns: document.querySelectorAll(".tab-btn"),
    tabContents: document.querySelectorAll(".tab-content"),

    // Stats
    statTotalSignoffs: document.getElementById("stat-total-signoffs"),
    statTodaySignoffs: document.getElementById("stat-today-signoffs"),
    statTotalOperatives: document.getElementById("stat-total-operatives"),
    statTotalTbts: document.getElementById("stat-total-tbts"),

    // Tab 1: Register
    filterRegisterTbt: document.getElementById("filter-register-tbt"),
    filterRegisterCompany: document.getElementById("filter-register-company"),
    groupFilterRegisterCompany: document.getElementById("group-filter-register-company"),
    filterRegisterWeek: document.getElementById("filter-register-week"),
    filterRegisterDate: document.getElementById("filter-register-date"),
    btnRefreshRegister: document.getElementById("btn-refresh-register"),
    btnPreviewRegister: document.getElementById("btn-preview-register"),
    btnPrintRegister: document.getElementById("btn-print-register"),
    printableRegisterContainer: document.getElementById("printable-register-container"),
    printSubTitle: document.getElementById("print-sub-title"),
    printSiteName: document.getElementById("print-site-name"),
    printSubWeek: document.getElementById("print-sub-week"),
    registerTableBody: document.getElementById("register-table-body"),
    printFooterOwner: document.getElementById("print-footer-owner"),
    printFooterCode: document.getElementById("print-footer-code"),
    printFooterLr: document.getElementById("print-footer-lr"),
    printFooterNr: document.getElementById("print-footer-nr"),

    // Tab 2: Outstanding
    filterOutstandingTbt: document.getElementById("filter-outstanding-tbt"),
    filterOutstandingCompany: document.getElementById("filter-outstanding-company"),
    groupFilterOutstandingCompany: document.getElementById("group-filter-outstanding-company"),
    outstandingComplianceSummary: document.getElementById("outstanding-compliance-summary"),
    btnCopyReminderList: document.getElementById("btn-copy-reminder-list"),
    outstandingTableBody: document.getElementById("outstanding-table-body"),

    // Tab 3: Audit Log
    btnExportCsv: document.getElementById("btn-export-csv"),
    auditTableBody: document.getElementById("audit-table-body"),
    modalAuditDetail: document.getElementById("modal-audit-detail"),
    auditDetailContent: document.getElementById("audit-detail-content"),
    btnCloseAuditModal: document.getElementById("btn-close-audit-modal"),
    btnCloseAuditModal2: document.getElementById("btn-close-audit-modal2"),

    // Tab 4: Operatives Directory
    filterOperativesCompany: document.getElementById("filter-operatives-company"),
    groupFilterOperativesCompany: document.getElementById("group-filter-operatives-company"),
    operativesTableBody: document.getElementById("operatives-table-body"),
    btnAdminAddOp: document.getElementById("btn-admin-add-op"),

    // Tab 5: TBT Document Library
    tbtsTableBody: document.getElementById("tbts-table-body"),
    btnAdminAddTbt: document.getElementById("btn-admin-add-tbt"),

    // Tab 6: Companies & Accounts
    companiesTableBody: document.getElementById("companies-table-body"),
    accountsTableBody: document.getElementById("accounts-table-body"),
    btnAdminAddCompany: document.getElementById("btn-admin-add-company"),
    btnAdminAddAccount: document.getElementById("btn-admin-add-account"),

    // Modals
    modalPrintPreview: document.getElementById("modal-print-preview"),
    printPreviewContent: document.getElementById("print-preview-content"),
    btnPrintFromPreview: document.getElementById("btn-print-from-preview"),
    btnClosePrintPreview: document.getElementById("btn-close-print-preview"),

    modalEditOperative: document.getElementById("modal-edit-operative"),
    editOpName: document.getElementById("edit-op-name"),
    editOpCompany: document.getElementById("edit-op-company"),
    editOpRole: document.getElementById("edit-op-role"),
    editOpTrade: document.getElementById("edit-op-trade"),
    btnCloseEditOp: document.getElementById("btn-close-edit-op"),
    btnCancelEditOp: document.getElementById("btn-cancel-edit-op"),
    btnSaveEditOp: document.getElementById("btn-save-edit-op"),

    modalEditTbtWeek: document.getElementById("modal-edit-tbt-week"),
    editWeekTbtTitle: document.getElementById("edit-week-tbt-title"),
    editWeekInput: document.getElementById("edit-week-input"),
    btnCloseWeekModal: document.getElementById("btn-close-week-modal"),
    btnCancelWeekModal: document.getElementById("btn-cancel-week-modal"),
    btnSaveWeek: document.getElementById("btn-save-week"),

    modalAddTbt: document.getElementById("modal-add-tbt"),
    tbtPdfUpload: document.getElementById("tbt-pdf-upload"),
    btnTriggerPdfUpload: document.getElementById("btn-trigger-pdf-upload"),
    pdfUploadStatus: document.getElementById("pdf-upload-status"),
    btnCloseAddTbt: document.getElementById("btn-close-add-tbt"),
    btnCancelAddTbt: document.getElementById("btn-cancel-add-tbt"),
    btnSaveNewTbt: document.getElementById("btn-save-new-tbt"),
    formAddTbt: document.getElementById("form-add-tbt"),
    newTbtCode: document.getElementById("new-tbt-code"),
    tbtDuplicateWarning: document.getElementById("tbt-duplicate-warning"),
    tbtDuplicateInfo: document.getElementById("tbt-duplicate-info"),
    chkConfirmOverwriteTbt: document.getElementById("chk-confirm-overwrite-tbt"),
    newTbtTitle: document.getElementById("new-tbt-title"),
    newTbtOwner: document.getElementById("new-tbt-owner"),
    newTbtCategory: document.getElementById("new-tbt-category"),
    newTbtLr: document.getElementById("new-tbt-lr"),
    newTbtNr: document.getElementById("new-tbt-nr"),
    newTbtWeek: document.getElementById("new-tbt-week"),
    newTbtPrepare: document.getElementById("new-tbt-prepare"),
    newTbtReason: document.getElementById("new-tbt-reason"),
    newTbtWhy: document.getElementById("new-tbt-why"),
    newTbtOutline: document.getElementById("new-tbt-outline"),
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

    modalAddCompany: document.getElementById("modal-add-company"),
    btnCloseAddCompany: document.getElementById("btn-close-add-company"),
    btnCancelAddCompany: document.getElementById("btn-cancel-add-company"),
    btnSaveNewCompany: document.getElementById("btn-save-new-company"),
    formAddCompany: document.getElementById("form-add-company"),
    newCompanyName: document.getElementById("new-company-name"),
    newCompanyOrder: document.getElementById("new-company-order"),

    modalAddAccount: document.getElementById("modal-add-account"),
    btnCloseAddAccount: document.getElementById("btn-close-add-account"),
    btnCancelAddAccount: document.getElementById("btn-cancel-add-account"),
    btnSaveNewAccount: document.getElementById("btn-save-new-account"),
    formAddAccount: document.getElementById("form-add-account"),
    newAccName: document.getElementById("new-acc-name"),
    newAccCompany: document.getElementById("new-acc-company"),
    newAccPin: document.getElementById("new-acc-pin"),

    toastContainer: document.getElementById("toast-container"),
  };

  function getAdminHeaders(extra = {}) {
    return {
      "X-Admin-PIN": adminPin,
      "Authorization": `Bearer ${adminPin}`,
      ...extra,
    };
  }

  function init() {
    setupEventListeners();
    if (adminPin) {
      verifyAndLogin(adminPin);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // --------------------------------------------------------------------------
  // Header-Only Authentication & Role Adapting
  // --------------------------------------------------------------------------
  async function verifyAndLogin(pin) {
    const cleanPin = (pin || "").trim();
    if (!cleanPin) {
      showAuthError("Please enter your Access PIN.");
      return;
    }

    if (elements.btnSubmitPin) {
      elements.btnSubmitPin.disabled = true;
      elements.btnSubmitPin.textContent = "Verifying...";
    }
    if (elements.authPinError) {
      elements.authPinError.style.display = "none";
    }

    let json;
    try {
      const res = await fetch("/api/admin?action=stats", {
        headers: {
          "X-Admin-PIN": cleanPin,
          "Authorization": `Bearer ${cleanPin}`,
        },
      });
      json = await res.json();

      if (!res.ok || !json.success) {
        sessionStorage.removeItem("tbt_admin_pin");
        adminPin = "";
        showAuthError(
          json.error && !json.error.includes("Header authentication")
            ? json.error
            : "Incorrect PIN. Please verify and try again."
        );
        if (elements.btnSubmitPin) {
          elements.btnSubmitPin.disabled = false;
          elements.btnSubmitPin.textContent = "Authenticate & Access";
        }
        return;
      }
    } catch (netErr) {
      console.error("Network error during admin auth:", netErr);
      showAuthError("Connection error while authenticating. Check your network.");
      if (elements.btnSubmitPin) {
        elements.btnSubmitPin.disabled = false;
        elements.btnSubmitPin.textContent = "Authenticate & Access";
      }
      return;
    }

    // Success!
    adminPin = cleanPin;
    sessionStorage.setItem("tbt_admin_pin", cleanPin);
    currentUser = json.data.auth || { role: "super_admin", account_name: "Principal Site Admin", company: null };

    elements.authGateCard.style.display = "none";
    elements.adminPortalView.style.display = "block";
    elements.btnLogout.style.display = "inline-flex";

    if (elements.btnSubmitPin) {
      elements.btnSubmitPin.disabled = false;
      elements.btnSubmitPin.textContent = "Authenticate & Access";
    }

    applyRoleRestrictions();

    try {
      if (json.data && json.data.stats) {
        renderStats(json.data.stats);
      }
      await loadCompaniesList();
      await loadDynamicTbts();
      switchTab(currentTab);
    } catch (renderErr) {
      console.error("Error loading initial dashboard content:", renderErr);
    }
  }

  function applyRoleRestrictions() {
    if (!currentUser) return;

    if (currentUser.role === "company_admin") {
      // Company Coordinator View
      elements.adminAuthBadge.style.display = "inline-block";
      elements.adminAuthBadge.textContent = `Company Portal: ${currentUser.company} (${currentUser.account_name})`;
      elements.siteHeaderSubtitle.textContent = `${currentUser.company} • AGC South Site Records`;

      // Hide tabs restricted to super_admin
      elements.tabBtns.forEach((btn) => {
        if (btn.dataset.role === "super_admin") {
          btn.style.display = "none";
        } else {
          btn.style.display = "inline-flex";
        }
      });

      // Hide company filter dropdowns (company is strictly locked)
      if (elements.groupFilterRegisterCompany) elements.groupFilterRegisterCompany.style.display = "none";
      if (elements.groupFilterOutstandingCompany) elements.groupFilterOutstandingCompany.style.display = "none";
      if (elements.groupFilterOperativesCompany) elements.groupFilterOperativesCompany.style.display = "none";

      // If user is on a restricted tab, fall back to register
      if (["tab-audit", "tab-tbts", "tab-companies"].includes(currentTab)) {
        currentTab = "tab-register";
      }
    } else {
      // Principal Super Admin View
      elements.adminAuthBadge.style.display = "inline-block";
      elements.adminAuthBadge.textContent = "Principal Site Admin (Full Site Access)";
      elements.siteHeaderSubtitle.textContent = "Three Eagles Ltd • AGC South Site Records";

      // Show all tabs
      elements.tabBtns.forEach((btn) => {
        btn.style.display = "inline-flex";
      });

      // Show company filter dropdowns
      if (elements.groupFilterRegisterCompany) elements.groupFilterRegisterCompany.style.display = "block";
      if (elements.groupFilterOutstandingCompany) elements.groupFilterOutstandingCompany.style.display = "block";
      if (elements.groupFilterOperativesCompany) elements.groupFilterOperativesCompany.style.display = "block";
    }
  }

  function showAuthError(msg) {
    elements.authPinError.textContent = msg;
    elements.authPinError.style.display = "block";
  }

  function handleLogout() {
    sessionStorage.removeItem("tbt_admin_pin");
    adminPin = "";
    currentUser = null;
    elements.adminPortalView.style.display = "none";
    elements.authGateCard.style.display = "block";
    elements.btnLogout.style.display = "none";
    elements.adminAuthBadge.style.display = "none";
    elements.adminPinInput.value = "";
    elements.authPinError.style.display = "none";
  }

  // --------------------------------------------------------------------------
  // Dynamic Companies Loading & Dropdowns
  // --------------------------------------------------------------------------
  async function loadCompaniesList() {
    try {
      const res = await fetch("/api/companies");
      const json = await res.json();
      if (json.success && json.data) {
        cachedCompanies = json.data;
        populateCompanyDropdowns();
      }
    } catch (err) {
      console.error("Error loading companies list:", err);
    }
  }

  function populateCompanyDropdowns() {
    const filterDropdowns = [
      elements.filterRegisterCompany,
      elements.filterOutstandingCompany,
      elements.filterOperativesCompany,
    ];

    filterDropdowns.forEach((dropdown) => {
      if (!dropdown) return;
      const current = dropdown.value;
      dropdown.innerHTML = '<option value="">All Site Companies</option>';
      cachedCompanies.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.name;
        opt.textContent = c.name + (c.is_default ? " (Principal)" : "");
        dropdown.appendChild(opt);
      });
      if (current) dropdown.value = current;
    });

    // Populate Modals Company Dropdowns
    const formDropdowns = [
      elements.adminOpCompany,
      elements.editOpCompany,
      elements.newAccCompany,
    ];

    formDropdowns.forEach((dropdown) => {
      if (!dropdown) return;
      dropdown.innerHTML = "";
      if (currentUser && currentUser.role === "company_admin") {
        const opt = document.createElement("option");
        opt.value = currentUser.company;
        opt.textContent = currentUser.company;
        dropdown.appendChild(opt);
        dropdown.disabled = true;
      } else {
        dropdown.disabled = false;
        cachedCompanies.forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c.name;
          opt.textContent = c.name;
          if (c.is_default) opt.selected = true;
          dropdown.appendChild(opt);
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // Dynamic TBT Dropdowns
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
    if (!selectElement) return;
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
  // Event Listeners
  // --------------------------------------------------------------------------
  function setupEventListeners() {
    elements.formAuthPin.addEventListener("submit", (e) => {
      e.preventDefault();
      const pin = elements.adminPinInput.value.trim();
      if (!pin) return;
      verifyAndLogin(pin);
    });

    if (elements.btnTogglePin) {
      elements.btnTogglePin.addEventListener("click", () => {
        if (elements.adminPinInput.type === "password") {
          elements.adminPinInput.type = "text";
          elements.btnTogglePin.textContent = "🔒";
          elements.btnTogglePin.title = "Hide PIN";
        } else {
          elements.adminPinInput.type = "password";
          elements.btnTogglePin.textContent = "👁️";
          elements.btnTogglePin.title = "Show PIN";
        }
      });
    }

    elements.btnLogout.addEventListener("click", handleLogout);

    elements.tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.dataset.tab;
        switchTab(targetTab);
      });
    });

    // Register Tab Filters & Print / Preview
    elements.filterRegisterTbt.addEventListener("change", loadRegisterData);
    if (elements.filterRegisterCompany) {
      elements.filterRegisterCompany.addEventListener("change", loadRegisterData);
    }
    elements.filterRegisterWeek.addEventListener("input", loadRegisterData);
    elements.filterRegisterDate.addEventListener("change", loadRegisterData);
    elements.btnRefreshRegister.addEventListener("click", loadRegisterData);
    elements.btnPrintRegister.addEventListener("click", () => window.print());

    // Print Preview Modal
    if (elements.btnPreviewRegister) {
      elements.btnPreviewRegister.addEventListener("click", openPrintPreview);
    }
    if (elements.btnClosePrintPreview) {
      elements.btnClosePrintPreview.addEventListener("click", closePrintPreview);
    }
    if (elements.btnPrintFromPreview) {
      elements.btnPrintFromPreview.addEventListener("click", () => window.print());
    }

    // Outstanding Tab Filter & Copy Button
    elements.filterOutstandingTbt.addEventListener("change", loadOutstandingData);
    if (elements.filterOutstandingCompany) {
      elements.filterOutstandingCompany.addEventListener("change", loadOutstandingData);
    }
    elements.btnCopyReminderList.addEventListener("click", copyReminderList);

    // Audit Tab CSV Export
    elements.btnExportCsv.addEventListener("click", exportAuditToCsv);

    // Operatives Tab Filter & Modals
    if (elements.filterOperativesCompany) {
      elements.filterOperativesCompany.addEventListener("change", loadOperativesData);
    }
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

    // Edit Operative Details Modal
    elements.btnCloseEditOp.addEventListener("click", () => {
      elements.modalEditOperative.classList.remove("active");
    });
    elements.btnCancelEditOp.addEventListener("click", () => {
      elements.modalEditOperative.classList.remove("active");
    });
    elements.btnSaveEditOp.addEventListener("click", handleSaveEditOperative);

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
      if (elements.tbtDuplicateWarning) elements.tbtDuplicateWarning.style.display = "none";
      if (elements.chkConfirmOverwriteTbt) elements.chkConfirmOverwriteTbt.checked = false;
      checkTbtCodeDuplicate();
      elements.modalAddTbt.classList.add("active");
    });
    elements.btnCloseAddTbt.addEventListener("click", () => {
      elements.modalAddTbt.classList.remove("active");
    });
    elements.btnCancelAddTbt.addEventListener("click", () => {
      elements.modalAddTbt.classList.remove("active");
    });
    elements.btnSaveNewTbt.addEventListener("click", handleSaveNewTbt);

    if (elements.newTbtCode) {
      elements.newTbtCode.addEventListener("input", checkTbtCodeDuplicate);
    }
    if (elements.chkConfirmOverwriteTbt) {
      elements.chkConfirmOverwriteTbt.addEventListener("change", checkTbtCodeDuplicate);
    }

    // PDF Auto-Extraction Trigger & Change
    if (elements.btnTriggerPdfUpload && elements.tbtPdfUpload) {
      elements.btnTriggerPdfUpload.addEventListener("click", () => {
        elements.tbtPdfUpload.click();
      });
      elements.tbtPdfUpload.addEventListener("change", handlePdfFileSelected);
    }

    // Companies & Accounts Modals (Super Admin)
    if (elements.btnAdminAddCompany) {
      elements.btnAdminAddCompany.addEventListener("click", () => {
        elements.modalAddCompany.classList.add("active");
      });
    }
    if (elements.btnCloseAddCompany) {
      elements.btnCloseAddCompany.addEventListener("click", () => {
        elements.modalAddCompany.classList.remove("active");
      });
    }
    if (elements.btnCancelAddCompany) {
      elements.btnCancelAddCompany.addEventListener("click", () => {
        elements.modalAddCompany.classList.remove("active");
      });
    }
    if (elements.btnSaveNewCompany) {
      elements.btnSaveNewCompany.addEventListener("click", handleSaveNewCompany);
    }

    if (elements.btnAdminAddAccount) {
      elements.btnAdminAddAccount.addEventListener("click", () => {
        elements.modalAddAccount.classList.add("active");
      });
    }
    if (elements.btnCloseAddAccount) {
      elements.btnCloseAddAccount.addEventListener("click", () => {
        elements.modalAddAccount.classList.remove("active");
      });
    }
    if (elements.btnCancelAddAccount) {
      elements.btnCancelAddAccount.addEventListener("click", () => {
        elements.modalAddAccount.classList.remove("active");
      });
    }
    if (elements.btnSaveNewAccount) {
      elements.btnSaveNewAccount.addEventListener("click", handleSaveNewAccount);
    }

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
    } else if (tabId === "tab-companies") {
      loadCompaniesData();
      loadAccountsData();
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
  // TAB 1: OFFICIAL A4 REGISTER GENERATOR & A4 PRINT PREVIEW
  // --------------------------------------------------------------------------
  async function loadRegisterData() {
    const docCode = elements.filterRegisterTbt.value || "AVC032";
    const weekVal = elements.filterRegisterWeek.value.trim();
    const dateVal = elements.filterRegisterDate.value;
    const compVal = elements.filterRegisterCompany ? elements.filterRegisterCompany.value : "";

    let url = `/api/admin?action=register&doc_code=${encodeURIComponent(docCode)}`;
    if (weekVal) url += `&briefing_week=${encodeURIComponent(weekVal)}`;
    if (dateVal) url += `&date=${encodeURIComponent(dateVal)}`;
    if (compVal) url += `&company=${encodeURIComponent(compVal)}`;

    try {
      const res = await fetch(url, {
        headers: getAdminHeaders(),
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

    const companyLabel =
      currentUser && currentUser.role === "company_admin"
        ? currentUser.company
        : elements.filterRegisterCompany && elements.filterRegisterCompany.value
        ? elements.filterRegisterCompany.value
        : "Three Eagles Ltd & Subcontractors";

    elements.printSiteName.innerHTML = `AGC South Site - ${escapeHtml(companyLabel)} (<span id="print-sub-week">${escapeHtml(week)}</span>)`;
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

  function openPrintPreview() {
    if (!elements.modalPrintPreview || !elements.printPreviewContent) return;
    elements.printPreviewContent.innerHTML = elements.printableRegisterContainer.innerHTML;
    elements.modalPrintPreview.classList.add("active");
  }

  function closePrintPreview() {
    if (!elements.modalPrintPreview) return;
    elements.modalPrintPreview.classList.remove("active");
  }

  // --------------------------------------------------------------------------
  // TAB 2: OUTSTANDING OPERATIVES PANEL & REMINDER LIST
  // --------------------------------------------------------------------------
  async function loadOutstandingData() {
    const docCode = elements.filterOutstandingTbt.value || "AVC032";
    const compVal = elements.filterOutstandingCompany ? elements.filterOutstandingCompany.value : "";

    let url = `/api/admin?action=outstanding&doc_code=${encodeURIComponent(docCode)}`;
    if (compVal) url += `&company=${encodeURIComponent(compVal)}`;

    try {
      const res = await fetch(url, {
        headers: getAdminHeaders(),
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
    const { tbt, outstanding, signed_count, total_active, target_company } = data;
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
      ${target_company ? `&nbsp;•&nbsp;<span style="color: var(--secondary); font-weight:700;">${escapeHtml(target_company)}</span>` : ""}
    `;

    const tbody = elements.outstandingTableBody;
    tbody.innerHTML = "";

    if (outstanding.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--success); font-weight: 700; padding: 2rem;">
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
      `;
      tbody.appendChild(tr);
    });
  }

  function copyReminderList() {
    if (!currentOutstandingData || !currentOutstandingData.outstanding) {
      showToast("No outstanding data loaded.", "error");
      return;
    }

    const { tbt, outstanding, target_company } = currentOutstandingData;
    if (outstanding.length === 0) {
      showToast("All operatives are 100% compliant! No reminder needed.", "success");
      return;
    }

    const scopeTitle = target_company ? target_company.toUpperCase() : "AGC SITE";
    let text = `🚨 *${scopeTitle} - TOOLBOX TALK COMPLIANCE REMINDER*\n`;
    text += `*Topic:* ${tbt.doc_code} - ${tbt.title} (${tbt.briefing_week})\n\n`;
    text += `The following ${outstanding.length} operative(s) must complete their mandatory Toolbox Talk sign-off:\n`;

    outstanding.forEach((op, idx) => {
      text += `${idx + 1}. ${op.name} (${op.role || 'Operative'}, ${op.company})\n`;
    });

    text += `\n📲 *Sign off online now:* ${window.location.origin}\n`;
    text += `(Review safety talk, answer comprehension check, and sign with finger)`;

    navigator.clipboard.writeText(text).then(
      () => {
        showToast("Reminder list copied to clipboard!", "success");
      },
      () => {
        showToast("Could not access clipboard. Please copy manually.", "error");
      }
    );
  }

  // --------------------------------------------------------------------------
  // TAB 3: IMMUTABLE AUDIT LOG (SUPER ADMIN ONLY)
  // --------------------------------------------------------------------------
  async function loadAuditData() {
    try {
      const res = await fetch("/api/admin?action=signoffs", {
        headers: getAdminHeaders(),
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
  // TAB 4: OPERATIVES DIRECTORY
  // --------------------------------------------------------------------------
  async function loadOperativesData() {
    const compVal =
      currentUser && currentUser.role === "company_admin"
        ? currentUser.company
        : elements.filterOperativesCompany
        ? elements.filterOperativesCompany.value
        : "";

    let url = "/api/admin?action=operatives";
    if (compVal) url += `&company=${encodeURIComponent(compVal)}`;

    try {
      const res = await fetch(url, {
        headers: getAdminHeaders(),
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

    if (!list || list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No operatives found for this company.
          </td>
        </tr>
      `;
      return;
    }

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
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            <button type="button" class="sig-btn btn-edit-op" data-id="${op.id}" data-name="${escapeHtml(op.name)}" data-company="${escapeHtml(op.company)}" data-role="${escapeHtml(op.role || 'Operative')}" data-trade="${escapeHtml(op.trade || 'General')}">
              Edit
            </button>
            <button type="button" class="sig-btn btn-toggle-op" data-id="${op.id}" data-active="${op.active}">
              ${op.active ? "Deactivate" : "Activate"}
            </button>
            <button type="button" class="sig-btn btn-delete-op" data-id="${op.id}" data-name="${escapeHtml(op.name)}" style="color: var(--danger); border-color: #fca5a5;">
              Delete
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-edit-op").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingOpId = parseInt(btn.dataset.id, 10);
        elements.editOpName.value = btn.dataset.name;
        elements.editOpCompany.value = btn.dataset.company;
        elements.editOpRole.value = btn.dataset.role;
        elements.editOpTrade.value = btn.dataset.trade;
        elements.modalEditOperative.classList.add("active");
        elements.editOpName.focus();
      });
    });

    tbody.querySelectorAll(".btn-delete-op").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.dataset.id, 10);
        const name = btn.dataset.name;
        if (!confirm(`Are you sure you want to permanently delete operative "${name}"?\n\nNote: Workers with signed legal records cannot be deleted and must be deactivated instead.`)) {
          return;
        }
        await deleteOperative(id, name);
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

  async function handleSaveEditOperative() {
    const name = elements.editOpName.value.trim();
    const company = elements.editOpCompany.value.trim() || "Three Eagles Ltd";
    const role = elements.editOpRole.value.trim() || "Operative";
    const trade = elements.editOpTrade.value.trim() || "General Labour";

    if (!name) {
      showToast("Operative full name is required.", "error");
      elements.editOpName.focus();
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "update_operative",
          id: editingOpId,
          name,
          company,
          role,
          trade,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Operative ${name} updated successfully!`, "success");
        elements.modalEditOperative.classList.remove("active");
        loadOperativesData();
        if (currentTab === "tab-outstanding") loadOutstandingData();
      } else {
        showToast(json.error || "Failed to update operative.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error updating operative.", "error");
    }
  }

  async function deleteOperative(id, name) {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "delete_operative",
          id: id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Operative "${name}" deleted successfully.`, "success");
        loadOperativesData();
        if (currentTab === "tab-outstanding") loadOutstandingData();
      } else {
        showToast(json.error || "Failed to delete operative.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error deleting operative.", "error");
    }
  }

  async function toggleOperativeStatus(id, newActive) {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
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
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
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
  // TAB 5: TBT DOCUMENT LIBRARY & CYCLE MANAGEMENT (SUPER ADMIN ONLY)
  // --------------------------------------------------------------------------
  async function loadTbtsData() {
    try {
      const res = await fetch("/api/admin?action=tbts", {
        headers: getAdminHeaders(),
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
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
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
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
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

  // --------------------------------------------------------------------------
  // TAB 6: COMPANIES & ACCOUNTS MANAGEMENT (SUPER ADMIN ONLY)
  // --------------------------------------------------------------------------
  async function loadCompaniesData() {
    try {
      const res = await fetch("/api/admin?action=companies", {
        headers: getAdminHeaders(),
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error || "Failed to load companies.", "error");
        return;
      }

      cachedCompanies = json.data || [];
      populateCompanyDropdowns();
      renderCompaniesTable(cachedCompanies);
    } catch (err) {
      console.error(err);
      showToast("Network error fetching companies.", "error");
    }
  }

  function renderCompaniesTable(list) {
    const tbody = elements.companiesTableBody;
    if (!tbody) return;
    tbody.innerHTML = "";

    list.forEach((comp) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 700;">${escapeHtml(comp.name)}</td>
        <td>
          ${
            comp.is_default
              ? `<span class="banner-badge" style="background:#dbeafe; color:#1e40af;">Principal Contractor</span>`
              : `<span class="banner-badge" style="background:#f1f5f9; color:#475569;">Subcontractor</span>`
          }
        </td>
        <td>${comp.display_order}</td>
        <td>
          <span style="font-weight: 700; color: ${comp.active ? "var(--success)" : "var(--danger)"};">
            ${comp.active ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          ${
            comp.is_default
              ? `<span style="font-size:0.75rem; color:#94a3b8; font-style:italic;">Default (Locked)</span>`
              : `<button type="button" class="sig-btn btn-toggle-company" data-id="${comp.id}" data-active="${comp.active}">
                   ${comp.active ? "Deactivate" : "Activate"}
                 </button>`
          }
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-toggle-company").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.dataset.id, 10);
        const currentActive = btn.dataset.active === "1";
        await toggleCompanyStatus(id, !currentActive);
      });
    });
  }

  async function handleSaveNewCompany() {
    const name = elements.newCompanyName.value.trim();
    const order = parseInt(elements.newCompanyOrder.value || "10", 10);

    if (!name) {
      showToast("Company name is required.", "error");
      elements.newCompanyName.focus();
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "add_company",
          name,
          display_order: order,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Company '${name}' added successfully!`, "success");
        elements.modalAddCompany.classList.remove("active");
        elements.formAddCompany.reset();
        await loadCompaniesData();
      } else {
        showToast(json.error || "Failed to add company.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error adding company.", "error");
    }
  }

  async function toggleCompanyStatus(id, newActive) {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "toggle_company",
          id: id,
          active: newActive,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Company status updated.", "success");
        await loadCompaniesData();
      } else {
        showToast(json.error || "Failed to update company.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error updating company.", "error");
    }
  }

  async function loadAccountsData() {
    try {
      const res = await fetch("/api/admin?action=accounts", {
        headers: getAdminHeaders(),
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.error || "Failed to load coordinator accounts.", "error");
        return;
      }

      renderAccountsTable(json.data || []);
    } catch (err) {
      console.error(err);
      showToast("Network error fetching coordinator accounts.", "error");
    }
  }

  function renderAccountsTable(list) {
    const tbody = elements.accountsTableBody;
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!list || list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            No delegated coordinator accounts created yet.
          </td>
        </tr>
      `;
      return;
    }

    list.forEach((acc) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 700;">${escapeHtml(acc.account_name)}</td>
        <td><strong>${escapeHtml(acc.company_name)}</strong></td>
        <td><code>•••• (${acc.access_pin.length}-digit PIN)</code></td>
        <td>
          <span style="font-weight: 700; color: ${acc.active ? "var(--success)" : "var(--danger)"};">
            ${acc.active ? "Active" : "Inactive"}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button type="button" class="sig-btn btn-toggle-acc" data-id="${acc.id}" data-active="${acc.active}">
              ${acc.active ? "Deactivate" : "Activate"}
            </button>
            <button type="button" class="sig-btn btn-delete-acc" data-id="${acc.id}" data-name="${escapeHtml(acc.account_name)}" style="color: var(--danger); border-color: #fca5a5;">
              Delete
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-toggle-acc").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.dataset.id, 10);
        const currentActive = btn.dataset.active === "1";
        await toggleAccountStatus(id, !currentActive);
      });
    });

    tbody.querySelectorAll(".btn-delete-acc").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.dataset.id, 10);
        const name = btn.dataset.name;
        if (!confirm(`Are you sure you want to delete coordinator account "${name}"?`)) {
          return;
        }
        await deleteAccount(id, name);
      });
    });
  }

  async function handleSaveNewAccount() {
    const accountName = elements.newAccName.value.trim();
    const companyName = elements.newAccCompany.value.trim();
    const accessPin = elements.newAccPin.value.trim();

    if (!accountName || !companyName || !accessPin) {
      showToast("Please fill in all account fields.", "error");
      return;
    }

    if (!/^\d{4,6}$/.test(accessPin)) {
      showToast("Access PIN must be 4 to 6 numeric digits.", "error");
      elements.newAccPin.focus();
      return;
    }

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "add_account",
          account_name: accountName,
          company_name: companyName,
          access_pin: accessPin,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Account for ${companyName} created successfully!`, "success");
        elements.modalAddAccount.classList.remove("active");
        elements.formAddAccount.reset();
        await loadAccountsData();
      } else {
        showToast(json.error || "Failed to create coordinator account.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error creating coordinator account.", "error");
    }
  }

  async function toggleAccountStatus(id, newActive) {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "toggle_account",
          id: id,
          active: newActive,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Coordinator account status updated.", "success");
        await loadAccountsData();
      } else {
        showToast(json.error || "Failed to update account.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error updating account.", "error");
    }
  }

  async function deleteAccount(id, name) {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "delete_account",
          id: id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Coordinator account "${name}" deleted.`, "success");
        await loadAccountsData();
      } else {
        showToast(json.error || "Failed to delete account.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error deleting account.", "error");
    }
  }

  // --------------------------------------------------------------------------
  // Mozilla PDF.js AIM TBT PDF Parser (100% Client-Side, Zero External APIs)
  // --------------------------------------------------------------------------
  async function handlePdfFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Please select a valid PDF file.", "error");
      return;
    }

    const statusEl = elements.pdfUploadStatus;
    if (statusEl) {
      statusEl.style.display = "block";
      statusEl.style.color = "var(--primary)";
      statusEl.textContent = `Extracting text and structure from ${file.name}...`;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const extracted = await parseAimTbtPdf(arrayBuffer);

      // Populate Form Fields
      if (extracted.doc_code) elements.newTbtCode.value = extracted.doc_code;
      if (extracted.title) elements.newTbtTitle.value = extracted.title;
      if (extracted.doc_owner && elements.newTbtOwner) elements.newTbtOwner.value = extracted.doc_owner;
      if (extracted.last_revision && elements.newTbtLr) elements.newTbtLr.value = extracted.last_revision;
      if (extracted.next_revision && elements.newTbtNr) elements.newTbtNr.value = extracted.next_revision;
      if (extracted.category) elements.newTbtCategory.value = extracted.category;
      if (extracted.prepare && elements.newTbtPrepare) elements.newTbtPrepare.value = extracted.prepare;
      if (extracted.reason && elements.newTbtReason) elements.newTbtReason.value = extracted.reason;
      if (extracted.why && elements.newTbtWhy) elements.newTbtWhy.value = extracted.why;
      if (extracted.outline && elements.newTbtOutline) elements.newTbtOutline.value = extracted.outline;
      if (extracted.question) elements.newTbtQuestion.value = extracted.question;
      if (extracted.options && extracted.options.length > 0) {
        elements.newTbtOptions.value = extracted.options.join("\n");
      }
      elements.newTbtCorrectIdx.value = "0";

      // Build JSON content structure
      const contentJson = {
        prepare: extracted.prepare || "Quiet location? No distractions? Talk aids ready?",
        reason: extracted.reason || `To ensure safe working practice regarding ${extracted.title}.`,
        why: extracted.why || "To prevent workplace injuries and uphold safety standards.",
        outline: extracted.outline || `This briefing covers ${extracted.title}.`,
        sections: extracted.sections || [],
      };

      elements.newTbtBody.value = JSON.stringify(contentJson, null, 2);

      checkTbtCodeDuplicate();

      const sectionCount = extracted.sections ? extracted.sections.length : 0;
      let bulletCount = 0;
      if (extracted.sections) {
        extracted.sections.forEach((sec) => {
          if (sec.points) bulletCount += sec.points.length;
        });
      }

      if (statusEl) {
        statusEl.style.color = "var(--success)";
        statusEl.textContent = `✓ Extracted ${extracted.doc_code || file.name}: ${sectionCount} sections, ${bulletCount} safety points.`;
      }
      showToast(`Auto-filled fields from ${file.name}!`, "success");
    } catch (err) {
      console.error("PDF Parsing Error:", err);
      if (statusEl) {
        statusEl.style.color = "var(--danger)";
        statusEl.textContent = "Failed to parse PDF. Please check the file or enter details manually.";
      }
      showToast("Could not parse PDF text.", "error");
    }
  }

  async function parseAimTbtPdf(arrayBuffer) {
    if (typeof pdfjsLib === "undefined") {
      throw new Error("Mozilla PDF.js library is not loaded.");
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    const allLines = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageLines = extractPageLines(textContent.items);
      allLines.push(...pageLines);
    }

    return parseLinesToTbt(allLines);
  }

  function extractPageLines(items) {
    if (!items || items.length === 0) return [];

    // Sort descending by Y coordinate, ascending by X
    const sorted = [...items].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 3) {
        return yDiff;
      }
      return a.transform[4] - b.transform[4];
    });

    const lines = [];
    let currentY = null;
    let currentLine = "";

    sorted.forEach((item) => {
      const str = item.str.trim();
      if (!str) return;

      const y = item.transform[5];
      if (currentY === null || Math.abs(currentY - y) > 3) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = str;
        currentY = y;
      } else {
        currentLine += " " + str;
      }
    });

    if (currentLine) lines.push(currentLine.trim());
    return lines;
  }

  function parseLinesToTbt(lines) {
    const data = {
      doc_code: "",
      title: "",
      doc_owner: "Operations Director",
      last_revision: "",
      next_revision: "",
      category: "Working at Height",
      prepare: "",
      reason: "",
      why: "",
      outline: "",
      sections: [],
      question: "",
      options: [],
    };

    // 1. Search Header / Footer for Metadata
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match: Document Owner: Operations Director Document Number: AVC032 LR: 05/01/2026 NR: 04/01/2028
      const ownerMatch = line.match(/Document\s+Owner:\s*([^D]+?)\s*Document\s+Number:\s*([A-Za-z0-9_-]+)/i);
      if (ownerMatch) {
        data.doc_owner = ownerMatch[1].trim();
        data.doc_code = ownerMatch[2].trim();
      }

      const revMatch = line.match(/LR:\s*([0-9/.-]+)\s*NR:\s*([0-9/.-]+)/i);
      if (revMatch) {
        data.last_revision = revMatch[1].trim();
        data.next_revision = revMatch[2].trim();
      }

      // Title line matching
      if (!data.title && (line.includes("Toolbox Talk") || line.includes("AVC"))) {
        const titleCandidate = line
          .replace(/Toolbox\s+Talk/gi, "")
          .replace(/AVC\d+/gi, "")
          .replace(/Page\s+\d+\s+of\s+\d+/gi, "")
          .trim();
        if (titleCandidate.length > 4) {
          data.title = titleCandidate;
        }
      }

      // Category inference
      const lower = line.toLowerCase();
      if (lower.includes("ladder") || lower.includes("height") || lower.includes("scaffold")) {
        data.category = "Working at Height";
      } else if (lower.includes("dust") || lower.includes("health") || lower.includes("asbestos")) {
        data.category = "Occupational Health";
      } else if (lower.includes("waste") || lower.includes("housekeeping")) {
        data.category = "Site Logistics";
      } else if (lower.includes("ppe") || lower.includes("protective")) {
        data.category = "General Safety";
      }
    }

    if (!data.doc_code) {
      for (const line of lines) {
        const m = line.match(/\b(AVC\d+)\b/);
        if (m) {
          data.doc_code = m[1];
          break;
        }
      }
    }

    if (!data.title) {
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        const l = lines[i];
        if (l.length > 5 && !l.includes("AIM") && !l.includes("Document") && !l.includes("Zero Accidents")) {
          data.title = l.replace(/\bAVC\d+\b/g, "").trim();
          break;
        }
      }
    }

    // 2. Summary Block (Prepare, Reason, Why, Outline)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^Prepare:/i.test(line)) {
        data.prepare = line.replace(/^Prepare:\s*/i, "").trim();
      } else if (/^Reason:/i.test(line)) {
        data.reason = line.replace(/^Reason:\s*/i, "").trim();
      } else if (/^Why:/i.test(line)) {
        data.why = line.replace(/^Why:\s*/i, "").trim();
      } else if (/^Outline:/i.test(line)) {
        data.outline = line.replace(/^Outline:\s*/i, "").trim();
      }
    }

    // 3. Structured Sections & Points
    const sections = [];
    let currentSection = null;
    let inBody = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Stop parsing body when reaching Question or Signature section
      if (
        line.includes("Questions for you") ||
        line.includes("Do you have any questions for me?") ||
        line.includes("Date Name Signature Company")
      ) {
        inBody = false;
        break;
      }

      // Start parsing body after Summary block or after Outline
      if (line.includes("Outline:") || line.includes("1.") || line.includes("Overview")) {
        inBody = true;
      }

      if (!inBody) continue;

      // Skip repeated page header/footer stamps
      if (
        line.includes("Document Owner:") ||
        line.includes("Page ") ||
        line.includes("FOR ZERO ACCIDENTS") ||
        (data.doc_code && line.includes(data.doc_code) && line.length < 35)
      ) {
        continue;
      }

      // Detect Section Heading (e.g. "1. Selection:", "Pre-use checks:", or lines ending in ':')
      const isHeading =
        /^[0-9]+\.\s+[A-Za-z]/.test(line) ||
        (line.length < 50 && line.endsWith(":") && !line.startsWith("•"));

      if (isHeading) {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: line.replace(/:$/, "").trim(),
          body: "",
          points: [],
        };
        continue;
      }

      // Detect Bullet Points
      const isBullet =
        line.startsWith("•") ||
        line.startsWith("-") ||
        /^\([a-z]\)/i.test(line) ||
        /^[0-9]+\)\s+/.test(line);

      if (isBullet) {
        if (!currentSection) {
          currentSection = { title: "Safety Instructions", body: "", points: [] };
        }
        const cleanedBullet = line
          .replace(/^[•\-\*]\s*/, "")
          .replace(/^\([a-z]\)\s*/i, "")
          .replace(/^[0-9]+\)\s*/, "")
          .trim();
        if (cleanedBullet) currentSection.points.push(cleanedBullet);
      } else {
        if (!currentSection) {
          currentSection = { title: "Safety Instructions", body: line, points: [] };
        } else if (!currentSection.body) {
          currentSection.body = line;
        } else {
          currentSection.body += " " + line;
        }
      }
    }

    if (currentSection) sections.push(currentSection);
    data.sections = sections;

    // 4. Comprehension Question & Options
    let foundQuestion = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^Q:\s*/i.test(line) || (/Questions for you/i.test(line) && lines[i + 1])) {
        if (/^Q:\s*/i.test(line)) {
          foundQuestion = line.replace(/^Q:\s*/i, "").trim();
        } else if (lines[i + 1] && lines[i + 1].startsWith("Q:")) {
          foundQuestion = lines[i + 1].replace(/^Q:\s*/i, "").trim();
        } else {
          foundQuestion = lines[i + 1].trim();
        }
        break;
      }
    }

    if (foundQuestion) {
      data.question = foundQuestion;
    } else {
      data.question = `When must a safety inspection be completed before using equipment?`;
    }

    // Generate 4 plausible options (Option 0 = correct answer based on talk rules)
    data.options = [
      "Before every single use (Pre-use check) and tagged out if defective",
      "Only once per month by a general labourer",
      "Only after an equipment failure or near miss occurs",
      "Inspection is never required for short duration tasks",
    ];

    return data;
  }

  // --------------------------------------------------------------------------
  // Check Duplicate TBT Document Code
  // --------------------------------------------------------------------------
  function checkTbtCodeDuplicate() {
    if (!elements.newTbtCode || !elements.tbtDuplicateWarning) return;
    const code = elements.newTbtCode.value.trim().toUpperCase();

    if (!code) {
      elements.tbtDuplicateWarning.style.display = "none";
      if (elements.chkConfirmOverwriteTbt) elements.chkConfirmOverwriteTbt.checked = false;
      if (elements.btnSaveNewTbt) {
        elements.btnSaveNewTbt.disabled = false;
        elements.btnSaveNewTbt.textContent = "Create Toolbox Talk";
      }
      return;
    }

    const match = cachedTbts.find(
      (t) => (t.doc_code || "").toUpperCase() === code || (t.id || "").toUpperCase() === code
    );

    if (match) {
      elements.tbtDuplicateWarning.style.display = "block";
      if (elements.tbtDuplicateInfo) {
        elements.tbtDuplicateInfo.textContent = `A module with code "${match.doc_code || code}" already exists: "${match.title}" (Last Revision: ${match.last_revision || "N/A"}).`;
      }

      const isConfirmed = Boolean(elements.chkConfirmOverwriteTbt && elements.chkConfirmOverwriteTbt.checked);
      if (isConfirmed) {
        if (elements.btnSaveNewTbt) {
          elements.btnSaveNewTbt.disabled = false;
          elements.btnSaveNewTbt.textContent = "Update Existing Toolbox Talk";
        }
      } else {
        if (elements.btnSaveNewTbt) {
          elements.btnSaveNewTbt.disabled = true;
          elements.btnSaveNewTbt.textContent = "Confirm Overwrite Required";
        }
      }
    } else {
      elements.tbtDuplicateWarning.style.display = "none";
      if (elements.chkConfirmOverwriteTbt) elements.chkConfirmOverwriteTbt.checked = false;
      if (elements.btnSaveNewTbt) {
        elements.btnSaveNewTbt.disabled = false;
        elements.btnSaveNewTbt.textContent = "Create Toolbox Talk";
      }
    }
  }

  // --------------------------------------------------------------------------
  // Create / Update TBT Handler
  // --------------------------------------------------------------------------
  async function handleSaveNewTbt() {
    const docCode = elements.newTbtCode.value.trim();
    const title = elements.newTbtTitle.value.trim();
    const docOwner = (elements.newTbtOwner?.value || "").trim() || "Operations Director";
    const lastRev = (elements.newTbtLr?.value || "").trim() || "05/01/2026";
    const nextRev = (elements.newTbtNr?.value || "").trim() || "04/01/2028";
    const category = elements.newTbtCategory.value.trim() || "Health & Safety";
    const week = elements.newTbtWeek.value.trim() || "Week 1";
    const prepareText = (elements.newTbtPrepare?.value || "").trim() || "Quiet location? No distractions? Talk aids ready?";
    const reasonText = (elements.newTbtReason?.value || "").trim() || `To ensure safe working practice regarding ${title}.`;
    const whyText = (elements.newTbtWhy?.value || "").trim() || "To prevent workplace injuries.";
    const outlineText = (elements.newTbtOutline?.value || "").trim() || `Safe work instructions for ${title}.`;
    const question = elements.newTbtQuestion.value.trim();
    const optionsRaw = elements.newTbtOptions.value.trim();
    const correctIdx = parseInt(elements.newTbtCorrectIdx.value, 10);
    const bodyRaw = elements.newTbtBody.value.trim();

    if (!docCode || !title || !question || !optionsRaw || !bodyRaw) {
      showToast("Please fill in all required fields (Doc Code, Title, Question, Options, and Content).", "error");
      return;
    }

    let optionsArray = [];
    try {
      if (optionsRaw.startsWith("[")) {
        optionsArray = JSON.parse(optionsRaw);
      } else if (optionsRaw.includes("\n")) {
        optionsArray = optionsRaw.split("\n").map((s) => s.trim()).filter(Boolean);
      } else {
        optionsArray = optionsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } catch (e) {
      optionsArray = optionsRaw.split("\n").map((s) => s.trim()).filter(Boolean);
    }

    if (optionsArray.length < 2) {
      showToast("Please provide at least 2 answer options for the comprehension check.", "error");
      return;
    }

    let contentObj;
    try {
      if (bodyRaw.startsWith("{")) {
        contentObj = JSON.parse(bodyRaw);
      } else {
        contentObj = {
          prepare: prepareText,
          reason: reasonText,
          why: whyText,
          outline: outlineText,
          sections: [
            {
              title: "1. Key Instructions",
              body: bodyRaw,
            },
          ],
        };
      }
    } catch (err) {
      contentObj = {
        prepare: prepareText,
        reason: reasonText,
        why: whyText,
        outline: outlineText,
        sections: [
          {
            title: "1. Key Instructions",
            body: bodyRaw,
          },
        ],
      };
    }

    if (!contentObj.prepare) contentObj.prepare = prepareText;
    if (!contentObj.reason) contentObj.reason = reasonText;
    if (!contentObj.why) contentObj.why = whyText;
    if (!contentObj.outline) contentObj.outline = outlineText;

    const confirmOverwrite = Boolean(elements.chkConfirmOverwriteTbt && elements.chkConfirmOverwriteTbt.checked);

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: getAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "add_tbt",
          doc_code: docCode,
          title: title,
          doc_owner: docOwner,
          last_revision: lastRev,
          next_revision: nextRev,
          category: category,
          briefing_week: week,
          prepare_text: prepareText,
          reason_text: reasonText,
          why_text: whyText,
          outline_text: outlineText,
          content_json: contentObj,
          comprehension_question: question,
          comprehension_options_json: optionsArray,
          correct_option_index: isNaN(correctIdx) ? 0 : correctIdx,
          confirm_overwrite: confirmOverwrite,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || `Toolbox Talk ${docCode} saved successfully!`, "success");
        elements.modalAddTbt.classList.remove("active");
        elements.formAddTbt.reset();
        if (elements.tbtDuplicateWarning) elements.tbtDuplicateWarning.style.display = "none";
        if (elements.chkConfirmOverwriteTbt) elements.chkConfirmOverwriteTbt.checked = false;
        if (elements.btnSaveNewTbt) {
          elements.btnSaveNewTbt.disabled = false;
          elements.btnSaveNewTbt.textContent = "Create Toolbox Talk";
        }
        if (elements.pdfUploadStatus) {
          elements.pdfUploadStatus.style.display = "none";
        }
        await loadDynamicTbts();
        loadTbtsData();
      } else {
        if (res.status === 409 || json.code_exists) {
          checkTbtCodeDuplicate();
        }
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
