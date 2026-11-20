// functions/api/admin.js
// Cloudflare Pages Function: Admin dashboard management, register export, and auditing

function verifyAdminAuth(context) {
  const envPin = (context.env.ADMIN_PIN || "2026").trim();
  const requestPin =
    context.request.headers.get("X-Admin-PIN") ||
    context.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(context.request.url).searchParams.get("pin");

  return requestPin && requestPin.trim() === envPin;
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
      JSON.stringify({ success: false, error: "Unauthorized. Valid Admin PIN required." }),
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
          "SELECT id, doc_code, tbt_title, operative_name, operative_company, notes, signed_at FROM signoffs ORDER BY signed_at DESC LIMIT 10"
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
      const dateFilter = url.searchParams.get("date");
      let query = `
        SELECT id, tbt_id, doc_code, tbt_title, doc_owner, last_revision, next_revision,
               operative_id, operative_name, operative_company, notes, signature_png,
               client_ip, user_agent, signed_at
        FROM signoffs
        WHERE 1=1
      `;
      const params = [];

      if (docCode) {
        query += " AND doc_code = ?";
        params.push(docCode);
      }

      if (dateFilter) {
        query += " AND (date(signed_at) = date(?) OR signed_at LIKE ?)";
        params.push(dateFilter, `${dateFilter}%`);
      }

      query += " ORDER BY signed_at ASC";

      const { results: records } = await db.prepare(query).bind(...params).all();

      // If register requested for a specific TBT, also fetch TBT metadata
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

    if (action === "operatives") {
      const { results } = await db
        .prepare("SELECT * FROM operatives ORDER BY active DESC, name ASC")
        .all();

      return new Response(
        JSON.stringify({ success: true, data: results || [] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (action === "tbts") {
      const { results } = await db
        .prepare("SELECT id, doc_code, title, doc_owner, last_revision, next_revision, category, active, created_at FROM tbts ORDER BY doc_code ASC")
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
      JSON.stringify({ success: false, error: "Unauthorized. Valid Admin PIN required." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await context.request.json();
    const action = body.action;

    if (action === "toggle_operative") {
      const id = body.id;
      const active = body.active ? 1 : 0;
      await db.prepare("UPDATE operatives SET active = ? WHERE id = ?").bind(active, id).run();
      return new Response(
        JSON.stringify({ success: true, message: "Operative status updated." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (action === "add_operative") {
      const { name, company = "Three Eagles Ltd", role = "Operative", trade = "General" } = body;
      if (!name) {
        return new Response(
          JSON.stringify({ success: false, error: "Name is required." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      await db
        .prepare("INSERT INTO operatives (name, company, role, trade, active) VALUES (?, ?, ?, ?, 1)")
        .bind(name.trim(), company.trim(), role.trim(), trade.trim())
        .run();
      return new Response(
        JSON.stringify({ success: true, message: "Operative added successfully." }),
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
