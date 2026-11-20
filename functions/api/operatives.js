// functions/api/operatives.js
// Cloudflare Pages Function: List and create site operatives

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(
      JSON.stringify({ success: false, error: "Database binding 'DB' not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { results } = await db
      .prepare("SELECT id, name, company, role, trade FROM operatives WHERE active = 1 ORDER BY name ASC")
      .all();

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

  try {
    const body = await context.request.json();
    const name = (body.name || "").trim();
    const company = (body.company || "Three Eagles Ltd").trim();
    const role = (body.role || "Operative").trim();
    const trade = (body.trade || "General").trim();
    const phone = (body.phone || "").trim();

    if (!name) {
      return new Response(
        JSON.stringify({ success: false, error: "Operative name is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await db
      .prepare(
        "INSERT INTO operatives (name, company, role, trade, phone, active) VALUES (?, ?, ?, ?, ?, 1)"
      )
      .bind(name, company, role, trade, phone)
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
