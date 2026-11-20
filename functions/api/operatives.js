// functions/api/operatives.js
// Cloudflare Pages Function: List and create site operatives with company filtering and coordinator auth

async function getAuth(context, db) {
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

  if (pin === envPin) {
    return { role: "super_admin", account_name: "Principal Site Admin", company: null };
  }

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

  try {
    const url = new URL(context.request.url);
    const companyFilter = url.searchParams.get("company");

    let query = "SELECT id, name, company, role, trade FROM operatives WHERE active = 1";
    const params = [];

    if (companyFilter && companyFilter.trim()) {
      query += " AND company = ?";
      params.push(companyFilter.trim());
    }

    query += " ORDER BY name ASC";

    const { results } = await db.prepare(query).bind(...params).all();

    return new Response(
      JSON.stringify({
        success: true,
        data: results || [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
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

  const auth = await getAuth(context, db);
  if (!auth) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized: Site admin or company coordinator authorization required to add operatives.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await context.request.json();
    const name = (body.name || "").trim();
    // If company_admin, lock company to their assigned company
    const company =
      auth.role === "company_admin"
        ? auth.company
        : (body.company || "Three Eagles Ltd").trim();
    const role = (body.role || "Operative").trim();
    const trade = (body.trade || "General").trim();
    const phone = (body.phone || "").trim();
    const pin = (body.pin || "1234").trim();

    if (!name) {
      return new Response(
        JSON.stringify({ success: false, error: "Operative name is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await db
      .prepare(
        "INSERT INTO operatives (name, company, role, trade, phone, pin, active) VALUES (?, ?, ?, ?, ?, ?, 1)"
      )
      .bind(name, company, role, trade, phone, pin)
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Operative successfully registered.",
        data: {
          id: result.meta?.last_row_id || null,
          name,
          company,
          role,
          trade,
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
