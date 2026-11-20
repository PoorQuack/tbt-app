// functions/api/companies.js
// Cloudflare Pages Function: List active site companies for multi-company operative sign-off

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
      .prepare(
        "SELECT id, name, is_default, display_order FROM companies WHERE active = 1 ORDER BY is_default DESC, display_order ASC, name ASC"
      )
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
