// functions/api/admin.js
// Cloudflare Pages Function: Admin dashboard management, register export, and auditing
// Strictly authenticates via X-Admin-PIN or Authorization headers (no query-string pin)

function verifyAdminAuth(context) {
  const envPin = (context.env.ADMIN_PIN || "2026").trim();
  // Strictly enforce header authentication (query-string ?pin= removed for security)
  const requestPin =
    context.request.headers.get("X-Admin-PIN") ||
    context.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  return Boolean(requestPin && requestPin.trim() === envPin);
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(
      JSON.stringify({ success: false, error: "Database binding 'DB' not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!verifyAdminAuth(context)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized: Header authentication required (X-Admin-PIN or Authorization Bearer).",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(context.request.url);
  const action = url.searchParams.get("action") || "stats";

  try {
    if (action === "stats") {
      const totalSignoffs = await db
        .prepare("SELECT COUNT(*) AS count FROM signoffs")
        .first();

      const todaySignoffs = await db
        .prepare("SELECT COUNT(*) AS count FROM signoffs WHERE date(signed_at) = date('now')")
        .first();

      const totalOperatives = await db
        .prepare("SELECT COUNT(*) AS count FROM operatives WHERE active = 1")
        .first();

      const totalTbts = await db
        .prepare("SELECT COUNT(*) AS count FROM tbts WHERE active = 1")
        .first();

      const { results: recentSignoffs } = await db
        .prepare(
          "SELECT id, doc_code, tbt_title, briefing_week, operative_name, operative_company, notes, signed_at FROM signoffs ORDER BY signed_at DESC LIMIT 10"
        )
        .all();

      return new Response(
        JSON.stringify({
          success: true,
          data: {
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

    if (action === "signoffs" || action === "register") {
      const docCode = url.searchParams.get("doc_code");
      const briefingWeek = url.searchParams.get("briefing_week");
      const dateFilter = url.searchParams.get("date");
      let query = `
        SELECT id, tbt_id, doc_code, tbt_title, doc_owner, last_revision, next_revision,
               briefing_week, operative_id, operative_name, operative_company, notes,
               signature_png, client_ip, user_agent, signed_at
        FROM signoffs
        WHERE 1=1
      `;
      const params = [];

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

    // Outstanding Operatives for a selected TBT and its briefing_week
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

      const { results: outstanding } = await db
        .prepare(
          `SELECT id, name, company, role, trade, phone, pin
           FROM operatives
           WHERE active = 1
             AND id NOT IN (
               SELECT operative_id FROM signoffs WHERE doc_code = ? AND briefing_week = ?
             )
           ORDER BY name ASC`
        )
        .bind(tbt.doc_code, week)
        .all();

      const signedCountRow = await db
        .prepare("SELECT COUNT(*) AS count FROM signoffs WHERE doc_code = ? AND briefing_week = ?")
        .bind(tbt.doc_code, week)
        .first();

      const totalActiveRow = await db
        .prepare("SELECT COUNT(*) AS count FROM operatives WHERE active = 1")
        .first();

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            tbt: {
              doc_code: tbt.doc_code,
              title: tbt.title,
              briefing_week: week,
            },
            outstanding: outstanding || [],
            signed_count: signedCountRow?.count || 0,
            total_active: totalActiveRow?.count || 0,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (action === "operatives") {
      // Admin view includes PIN for supervisor assistance & reset
      const { results } = await db
        .prepare(
          "SELECT id, name, company, role, trade, phone, pin, active, created_at FROM operatives ORDER BY active DESC, name ASC"
        )
        .all();

      return new Response(
        JSON.stringify({ success: true, data: results || [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

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

  if (!verifyAdminAuth(context)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized: Header authentication required (X-Admin-PIN or Authorization Bearer).",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await context.request.json();
    const action = body.action;

    // 1. Toggle operative active status
    if (action === "toggle_operative") {
      const id = body.id;
      const active = body.active ? 1 : 0;
      await db.prepare("UPDATE operatives SET active = ? WHERE id = ?").bind(active, id).run();
      return new Response(
        JSON.stringify({ success: true, message: "Operative status updated." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Edit / Reset Operative PIN
    if (action === "update_pin") {
      const id = body.id;
      const pin = String(body.pin || "").trim();
      if (!/^\d{4}$/.test(pin)) {
        return new Response(
          JSON.stringify({ success: false, error: "Operative PIN must be exactly 4 digits (e.g. 1234)." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      await db.prepare("UPDATE operatives SET pin = ? WHERE id = ?").bind(pin, id).run();
      return new Response(
        JSON.stringify({ success: true, message: "Operative PIN successfully updated." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Add new operative
    if (action === "add_operative") {
      const { name, company = "Three Eagles Ltd", role = "Operative", trade = "General" } = body;
      let pin = String(body.pin || "1234").trim();
      if (!/^\d{4}$/.test(pin)) {
        pin = "1234";
      }

      if (!name) {
        return new Response(
          JSON.stringify({ success: false, error: "Name is required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      await db
        .prepare(
          "INSERT INTO operatives (name, company, role, trade, pin, active) VALUES (?, ?, ?, ?, ?, 1)"
        )
        .bind(name.trim(), company.trim(), role.trim(), trade.trim(), pin)
        .run();
      return new Response(
        JSON.stringify({ success: true, message: "Operative added successfully." }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Update TBT (briefing_week or active status)
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

    // 5. Add a new TBT
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
          doc_code.trim(),
          doc_code.trim(),
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
        JSON.stringify({ success: true, message: `Toolbox Talk '${doc_code}' added successfully.` }),
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
