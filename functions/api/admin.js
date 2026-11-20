// functions/api/admin.js
// Cloudflare Pages Function: Role-based supervisor portal, register export, companies & accounts management
// Supports super_admin (Principal Site Admin) and company_admin (Delegated Company Coordinator)

async function verifyAdminAuth(context, db) {
  const envPin = (context.env.ADMIN_PIN || "2026").trim();
  const reqHeaders = context.request.headers;
  const requestPin =
    reqHeaders.get("X-Admin-PIN") ||
    reqHeaders.get("x-admin-pin") ||
    reqHeaders.get("Admin-PIN") ||
    reqHeaders.get("admin-pin") ||
    reqHeaders.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!requestPin || !requestPin.trim()) return null;
  const pin = requestPin.trim();

  // 1. Super Admin Check
  if (pin === envPin) {
    return {
      role: "super_admin",
      account_name: "Principal Site Admin",
      company: null,
    };
  }

  // 2. Delegated Company Coordinator Account Check
  const account = await db
    .prepare(
      "SELECT id, account_name, company_name FROM company_accounts WHERE access_pin = ? AND active = 1"
    )
    .bind(pin)
    .first();

  if (account) {
    return {
      role: "company_admin",
      account_name: account.account_name,
      company: account.company_name,
    };
  }

  return null;
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(
      JSON.stringify({ success: false, error: "Database binding 'DB' not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const auth = await verifyAdminAuth(context, db);
  if (!auth) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized: Valid Admin or Company Coordinator PIN required.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(context.request.url);
  const action = url.searchParams.get("action") || "stats";

  try {
    // ------------------------------------------------------------------------
    // Action: stats
    // ------------------------------------------------------------------------
    if (action === "stats") {
      let totalSignoffs, todaySignoffs, totalOperatives, recentSignoffs;

      if (auth.role === "company_admin") {
        totalSignoffs = await db
          .prepare("SELECT COUNT(*) AS count FROM signoffs WHERE operative_company = ?")
          .bind(auth.company)
          .first();

        todaySignoffs = await db
          .prepare(
            "SELECT COUNT(*) AS count FROM signoffs WHERE operative_company = ? AND date(signed_at) = date('now')"
          )
          .bind(auth.company)
          .first();

        totalOperatives = await db
          .prepare("SELECT COUNT(*) AS count FROM operatives WHERE active = 1 AND company = ?")
          .bind(auth.company)
          .first();

        const recent = await db
          .prepare(
            `SELECT id, doc_code, tbt_title, briefing_week, operative_name, operative_company, notes, signed_at
             FROM signoffs
             WHERE operative_company = ?
             ORDER BY signed_at DESC LIMIT 10`
          )
          .bind(auth.company)
          .all();
        recentSignoffs = recent.results;
      } else {
        totalSignoffs = await db
          .prepare("SELECT COUNT(*) AS count FROM signoffs")
          .first();

        todaySignoffs = await db
          .prepare("SELECT COUNT(*) AS count FROM signoffs WHERE date(signed_at) = date('now')")
          .first();

        totalOperatives = await db
          .prepare("SELECT COUNT(*) AS count FROM operatives WHERE active = 1")
          .first();

        const recent = await db
          .prepare(
            `SELECT id, doc_code, tbt_title, briefing_week, operative_name, operative_company, notes, signed_at
             FROM signoffs
             ORDER BY signed_at DESC LIMIT 10`
          )
          .all();
        recentSignoffs = recent.results;
      }

      const totalTbts = await db
        .prepare("SELECT COUNT(*) AS count FROM tbts WHERE active = 1")
        .first();

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            auth: {
              role: auth.role,
              account_name: auth.account_name,
              company: auth.company,
            },
            stats: {
              total_signoffs: totalSignoffs?.count || 0,
              today_signoffs: todaySignoffs?.count || 0,
              active_operatives: totalOperatives?.count || 0,
              active_tbts: totalTbts?.count || 0,
            },
            recent_signoffs: recentSignoffs || [],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // Action: signoffs / register
    // ------------------------------------------------------------------------
    if (action === "signoffs" || action === "register") {
      const docCode = url.searchParams.get("doc_code");
      const briefingWeek = url.searchParams.get("briefing_week");
      const dateFilter = url.searchParams.get("date");
      const requestedCompany = url.searchParams.get("company");

      let query = `
        SELECT id, tbt_id, doc_code, tbt_title, doc_owner, last_revision, next_revision,
               briefing_week, operative_id, operative_name, operative_company, notes,
               signature_png, client_ip, user_agent, signed_at
        FROM signoffs
        WHERE 1=1
      `;
      const params = [];

      // Company scoping: company_admin strictly locked to auth.company
      if (auth.role === "company_admin") {
        query += " AND operative_company = ?";
        params.push(auth.company);
      } else if (requestedCompany && requestedCompany.trim()) {
        query += " AND operative_company = ?";
        params.push(requestedCompany.trim());
      }

      if (docCode) {
        query += " AND doc_code = ?";
        params.push(docCode);
      }

      if (briefingWeek) {
        query += " AND briefing_week = ?";
        params.push(briefingWeek);
      }

      if (dateFilter) {
        query += " AND (date(signed_at) = date(?) OR signed_at LIKE ?)";
        params.push(dateFilter, `${dateFilter}%`);
      }

      query += " ORDER BY signed_at ASC";

      const { results: records } = await db.prepare(query).bind(...params).all();

      let tbtMeta = null;
      if (docCode) {
        tbtMeta = await db
          .prepare("SELECT * FROM tbts WHERE doc_code = ? OR id = ?")
          .bind(docCode, docCode)
          .first();
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            tbt: tbtMeta,
            records: records || [],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // Action: outstanding operatives
    // ------------------------------------------------------------------------
    if (action === "outstanding") {
      const docCode = url.searchParams.get("doc_code") || "AVC032";
      const tbt = await db
        .prepare("SELECT id, doc_code, title, briefing_week FROM tbts WHERE doc_code = ? OR id = ?")
        .bind(docCode, docCode)
        .first();

      if (!tbt) {
        return new Response(
          JSON.stringify({ success: false, error: "TBT not found." }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      const week = url.searchParams.get("briefing_week") || tbt.briefing_week || "Week 1";
      const requestedCompany = url.searchParams.get("company");

      let targetCompany = null;
      if (auth.role === "company_admin") {
        targetCompany = auth.company;
      } else if (requestedCompany && requestedCompany.trim()) {
        targetCompany = requestedCompany.trim();
      }

      let opQuery = `
        SELECT id, name, company, role, trade, phone
        FROM operatives
        WHERE active = 1
      `;
      const opParams = [];

      if (targetCompany) {
        opQuery += " AND company = ?";
        opParams.push(targetCompany);
      }

      opQuery += `
        AND id NOT IN (
          SELECT operative_id FROM signoffs WHERE doc_code = ? AND briefing_week = ?
        )
        ORDER BY name ASC
      `;
      opParams.push(tbt.doc_code, week);

      const { results: outstanding } = await db.prepare(opQuery).bind(...opParams).all();

      let signedCountRow, totalActiveRow;
      if (targetCompany) {
        signedCountRow = await db
          .prepare(
            "SELECT COUNT(*) AS count FROM signoffs WHERE doc_code = ? AND briefing_week = ? AND operative_company = ?"
          )
          .bind(tbt.doc_code, week, targetCompany)
          .first();

        totalActiveRow = await db
          .prepare("SELECT COUNT(*) AS count FROM operatives WHERE active = 1 AND company = ?")
          .bind(targetCompany)
          .first();
      } else {
        signedCountRow = await db
          .prepare("SELECT COUNT(*) AS count FROM signoffs WHERE doc_code = ? AND briefing_week = ?")
          .bind(tbt.doc_code, week)
          .first();

        totalActiveRow = await db
          .prepare("SELECT COUNT(*) AS count FROM operatives WHERE active = 1")
          .first();
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            tbt: {
              doc_code: tbt.doc_code,
              title: tbt.title,
              briefing_week: week,
            },
            target_company: targetCompany,
            outstanding: outstanding || [],
            signed_count: signedCountRow?.count || 0,
            total_active: totalActiveRow?.count || 0,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // Action: operatives directory
    // ------------------------------------------------------------------------
    if (action === "operatives") {
      let query = "SELECT id, name, company, role, trade, phone, active, created_at FROM operatives";
      const params = [];

      if (auth.role === "company_admin") {
        query += " WHERE company = ?";
        params.push(auth.company);
      } else {
        const companyFilter = url.searchParams.get("company");
        if (companyFilter && companyFilter.trim()) {
          query += " WHERE company = ?";
          params.push(companyFilter.trim());
        }
      }

      query += " ORDER BY active DESC, name ASC";

      const { results } = await db.prepare(query).bind(...params).all();

      return new Response(
        JSON.stringify({ success: true, data: results || [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // Action: tbts
    // ------------------------------------------------------------------------
    if (action === "tbts") {
      const { results } = await db
        .prepare(
          "SELECT id, doc_code, title, doc_owner, last_revision, next_revision, category, briefing_week, active, created_at FROM tbts ORDER BY doc_code ASC"
        )
        .all();

      return new Response(
        JSON.stringify({ success: true, data: results || [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // Action: companies (super_admin only)
    // ------------------------------------------------------------------------
    if (action === "companies") {
      if (auth.role !== "super_admin") {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: Super admin privileges required." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      const { results } = await db
        .prepare(
          "SELECT id, name, is_default, display_order, active, created_at FROM companies ORDER BY is_default DESC, display_order ASC, name ASC"
        )
        .all();

      return new Response(
        JSON.stringify({ success: true, data: results || [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // Action: accounts (company coordinators, super_admin only)
    // ------------------------------------------------------------------------
    if (action === "accounts") {
      if (auth.role !== "super_admin") {
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: Super admin privileges required." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      const { results } = await db
        .prepare(
          "SELECT id, account_name, company_name, access_pin, active, created_at FROM company_accounts ORDER BY company_name ASC, account_name ASC"
        )
        .all();

      return new Response(
        JSON.stringify({ success: true, data: results || [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown admin action requested." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function onRequestPost(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(
      JSON.stringify({ success: false, error: "Database binding 'DB' not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const auth = await verifyAdminAuth(context, db);
  if (!auth) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized: Valid Admin or Company Coordinator PIN required.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await context.request.json();
    const action = body.action;

    // ------------------------------------------------------------------------
    // 1. Toggle operative active status
    // ------------------------------------------------------------------------
    if (action === "toggle_operative") {
      const id = body.id;
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: "Operative ID required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check scoping for company_admin
      if (auth.role === "company_admin") {
        const op = await db.prepare("SELECT company FROM operatives WHERE id = ?").bind(id).first();
        if (!op || op.company !== auth.company) {
          return new Response(
            JSON.stringify({ success: false, error: "Forbidden: You may only modify operatives in your company." }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      const active = body.active ? 1 : 0;
      await db.prepare("UPDATE operatives SET active = ? WHERE id = ?").bind(active, id).run();
      return new Response(
        JSON.stringify({ success: true, message: "Operative status updated." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 2. Full Update Operative Details (Name, Company, Role, Trade)
    // ------------------------------------------------------------------------
    if (action === "update_operative") {
      const { id, name, role = "Operative", trade = "General" } = body;
      const cleanName = (name || "").trim();

      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: "Operative ID is required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!cleanName) {
        return new Response(
          JSON.stringify({ success: false, error: "Operative full name is required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check scoping for company_admin
      const op = await db.prepare("SELECT company FROM operatives WHERE id = ?").bind(id).first();
      if (!op) {
        return new Response(
          JSON.stringify({ success: false, error: "Operative not found." }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      let company;
      if (auth.role === "company_admin") {
        if (op.company !== auth.company) {
          return new Response(
            JSON.stringify({ success: false, error: "Forbidden: You may only modify operatives in your company." }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
        company = auth.company;
      } else {
        company = (body.company || op.company || "Three Eagles Ltd").trim();
      }

      await db
        .prepare(
          "UPDATE operatives SET name = ?, company = ?, role = ?, trade = ? WHERE id = ?"
        )
        .bind(
          cleanName,
          company,
          (role || "Operative").trim(),
          (trade || "General").trim(),
          id
        )
        .run();

      return new Response(
        JSON.stringify({
          success: true,
          message: `Operative details for ${cleanName} updated successfully.`,
          data: { id, name: cleanName, company, role, trade },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 3. Delete Operative (blocked if legal audit signoffs exist)
    // ------------------------------------------------------------------------
    if (action === "delete_operative") {
      const id = body.id;
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: "Operative ID is required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (auth.role === "company_admin") {
        const op = await db.prepare("SELECT company FROM operatives WHERE id = ?").bind(id).first();
        if (!op || op.company !== auth.company) {
          return new Response(
            JSON.stringify({ success: false, error: "Forbidden: You may only delete operatives in your company." }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      const signoffCheck = await db
        .prepare("SELECT COUNT(*) AS count FROM signoffs WHERE operative_id = ?")
        .bind(id)
        .first();

      if (signoffCheck && signoffCheck.count > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Cannot delete operative: ${signoffCheck.count} legal audit sign-off record(s) exist for this worker. Please deactivate the operative instead to preserve statutory HSE safety history.`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await db.prepare("DELETE FROM operatives WHERE id = ?").bind(id).run();

      return new Response(
        JSON.stringify({ success: true, message: "Operative deleted successfully." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 4. Add new operative
    // ------------------------------------------------------------------------
    if (action === "add_operative") {
      const { name, role = "Operative", trade = "General" } = body;
      const cleanName = (name || "").trim();

      if (!cleanName) {
        return new Response(
          JSON.stringify({ success: false, error: "Operative full name is required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const company =
        auth.role === "company_admin"
          ? auth.company
          : (body.company || "Three Eagles Ltd").trim();

      await db
        .prepare(
          "INSERT INTO operatives (name, company, role, trade, pin, active) VALUES (?, ?, ?, ?, '1234', 1)"
        )
        .bind(cleanName, company, (role || "Operative").trim(), (trade || "General").trim())
        .run();

      return new Response(
        JSON.stringify({ success: true, message: `Operative '${cleanName}' added successfully for ${company}.` }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // Actions below require super_admin privileges
    // ------------------------------------------------------------------------
    if (auth.role !== "super_admin") {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: Super admin privileges required for this action." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 5. Add Company (super_admin)
    // ------------------------------------------------------------------------
    if (action === "add_company") {
      const name = (body.name || "").trim();
      const displayOrder = parseInt(body.display_order || "10", 10);

      if (!name) {
        return new Response(
          JSON.stringify({ success: false, error: "Company name is required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const existing = await db.prepare("SELECT id FROM companies WHERE name = ?").bind(name).first();
      if (existing) {
        return new Response(
          JSON.stringify({ success: false, error: `Company '${name}' already exists.` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await db
        .prepare("INSERT INTO companies (name, is_default, display_order, active) VALUES (?, 0, ?, 1)")
        .bind(name, isNaN(displayOrder) ? 10 : displayOrder)
        .run();

      return new Response(
        JSON.stringify({ success: true, message: `Company '${name}' added successfully.` }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 6. Toggle Company Status (super_admin)
    // ------------------------------------------------------------------------
    if (action === "toggle_company") {
      const id = body.id;
      const active = body.active ? 1 : 0;

      const comp = await db.prepare("SELECT is_default, name FROM companies WHERE id = ?").bind(id).first();
      if (!comp) {
        return new Response(
          JSON.stringify({ success: false, error: "Company not found." }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      if (comp.is_default && active === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Cannot deactivate the default principal contractor company." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await db.prepare("UPDATE companies SET active = ? WHERE id = ?").bind(active, id).run();

      return new Response(
        JSON.stringify({ success: true, message: `Company status updated.` }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 7. Add Company Coordinator Account (super_admin)
    // ------------------------------------------------------------------------
    if (action === "add_account") {
      const accountName = (body.account_name || "").trim();
      const companyName = (body.company_name || "").trim();
      const accessPin = String(body.access_pin || "").trim();

      if (!accountName || !companyName) {
        return new Response(
          JSON.stringify({ success: false, error: "Account Name and Assigned Company are required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!/^\d{4,6}$/.test(accessPin)) {
        return new Response(
          JSON.stringify({ success: false, error: "Access PIN must be 4 to 6 numeric digits." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const envPin = (context.env.ADMIN_PIN || "2026").trim();
      if (accessPin === envPin) {
        return new Response(
          JSON.stringify({ success: false, error: "Coordinator PIN cannot be identical to the Principal Site Admin PIN." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const pinExists = await db
        .prepare("SELECT id FROM company_accounts WHERE access_pin = ?")
        .bind(accessPin)
        .first();

      if (pinExists) {
        return new Response(
          JSON.stringify({ success: false, error: "This PIN is already assigned to another coordinator account. Please select a unique PIN." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await db
        .prepare(
          "INSERT INTO company_accounts (account_name, company_name, access_pin, active) VALUES (?, ?, ?, 1)"
        )
        .bind(accountName, companyName, accessPin)
        .run();

      return new Response(
        JSON.stringify({ success: true, message: `Coordinator account '${accountName}' created for ${companyName}.` }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 8. Toggle Company Coordinator Account (super_admin)
    // ------------------------------------------------------------------------
    if (action === "toggle_account") {
      const id = body.id;
      const active = body.active ? 1 : 0;

      await db.prepare("UPDATE company_accounts SET active = ? WHERE id = ?").bind(active, id).run();

      return new Response(
        JSON.stringify({ success: true, message: "Coordinator account status updated." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 9. Delete Company Coordinator Account (super_admin)
    // ------------------------------------------------------------------------
    if (action === "delete_account") {
      const id = body.id;
      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: "Account ID is required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await db.prepare("DELETE FROM company_accounts WHERE id = ?").bind(id).run();

      return new Response(
        JSON.stringify({ success: true, message: "Coordinator account deleted." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 10. Update TBT (briefing_week or active status, super_admin)
    // ------------------------------------------------------------------------
    if (action === "update_tbt") {
      const id = body.id || body.doc_code;
      const briefingWeek = body.briefing_week ? String(body.briefing_week).trim() : null;
      const hasActive = body.active !== undefined;
      const active = body.active ? 1 : 0;

      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: "TBT ID/Doc Code is required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (briefingWeek && hasActive) {
        await db
          .prepare("UPDATE tbts SET briefing_week = ?, active = ? WHERE id = ? OR doc_code = ?")
          .bind(briefingWeek, active, id, id)
          .run();
      } else if (briefingWeek) {
        await db
          .prepare("UPDATE tbts SET briefing_week = ? WHERE id = ? OR doc_code = ?")
          .bind(briefingWeek, id, id)
          .run();
      } else if (hasActive) {
        await db
          .prepare("UPDATE tbts SET active = ? WHERE id = ? OR doc_code = ?")
          .bind(active, id, id)
          .run();
      }

      return new Response(
        JSON.stringify({ success: true, message: "TBT updated successfully." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ------------------------------------------------------------------------
    // 11. Add/Update TBT Module (super_admin)
    // ------------------------------------------------------------------------
    if (action === "add_tbt") {
      const {
        doc_code,
        title,
        doc_owner = "Operations Director",
        last_revision = new Date().toISOString().slice(0, 10),
        next_revision = "",
        category = "Health & Safety",
        briefing_week = "Week 1",
        prepare_text = "Quiet location? No distractions? Talk aids ready?",
        reason_text = "",
        why_text = "",
        outline_text = "",
        content_json,
        comprehension_question,
        comprehension_options_json,
        correct_option_index = 0,
      } = body;

      if (!doc_code || !title || !comprehension_question) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Doc Code, Title, and Comprehension Question are required.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const contentStr =
        typeof content_json === "string" ? content_json : JSON.stringify(content_json || {});
      const optionsStr =
        typeof comprehension_options_json === "string"
          ? comprehension_options_json
          : JSON.stringify(comprehension_options_json || ["Yes", "No"]);

      const cleanCode = doc_code.trim();

      // In-place upsert if doc_code exists
      const existingTbt = await db
        .prepare("SELECT id, doc_code FROM tbts WHERE doc_code = ? OR id = ?")
        .bind(cleanCode, cleanCode)
        .first();

      if (existingTbt) {
        await db
          .prepare(
            `UPDATE tbts SET
              title = ?, doc_owner = ?, last_revision = ?, next_revision = ?, category = ?,
              briefing_week = ?, prepare_text = ?, reason_text = ?, why_text = ?, outline_text = ?,
              content_json = ?, comprehension_question = ?, comprehension_options_json = ?,
              correct_option_index = ?, active = 1
             WHERE doc_code = ? OR id = ?`
          )
          .bind(
            title.trim(),
            doc_owner.trim(),
            last_revision.trim(),
            next_revision.trim() || "01/01/2028",
            category.trim(),
            briefing_week.trim(),
            prepare_text.trim(),
            reason_text.trim(),
            why_text.trim(),
            outline_text.trim(),
            contentStr,
            comprehension_question.trim(),
            optionsStr,
            parseInt(correct_option_index, 10),
            cleanCode,
            cleanCode
          )
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            message: `Toolbox Talk '${cleanCode}' updated successfully with latest PDF revisions.`,
            updated: true,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      await db
        .prepare(
          `INSERT INTO tbts (
            id, doc_code, title, doc_owner, last_revision, next_revision, category,
            briefing_week, prepare_text, reason_text, why_text, outline_text,
            content_json, comprehension_question, comprehension_options_json,
            correct_option_index, active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
        )
        .bind(
          cleanCode,
          cleanCode,
          title.trim(),
          doc_owner.trim(),
          last_revision.trim(),
          next_revision.trim() || "01/01/2028",
          category.trim(),
          briefing_week.trim(),
          prepare_text.trim(),
          reason_text.trim(),
          why_text.trim(),
          outline_text.trim(),
          contentStr,
          comprehension_question.trim(),
          optionsStr,
          parseInt(correct_option_index, 10)
        )
        .run();

      return new Response(
        JSON.stringify({ success: true, message: `Toolbox Talk '${cleanCode}' created successfully.` }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
