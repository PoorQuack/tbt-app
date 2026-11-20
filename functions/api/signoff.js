// functions/api/signoff.js
// Cloudflare Pages Function: Secure, legally defensible TBT sign-off submission and retrieval

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(
      JSON.stringify({ success: false, error: "Database binding 'DB' not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(context.request.url);
  const docCode = url.searchParams.get("doc_code") || url.searchParams.get("code");
  const dateFilter = url.searchParams.get("date"); // YYYY-MM-DD or DD/MM/YYYY
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "200", 10), 500);

  try {
    let query = "SELECT id, tbt_id, doc_code, tbt_title, doc_owner, last_revision, next_revision, operative_id, operative_name, operative_company, scrolled_to_bottom, comprehension_passed, selected_answer, notes, signature_png, signed_at FROM signoffs WHERE 1=1";
    const params = [];

    if (docCode) {
      query += " AND doc_code = ?";
      params.push(docCode);
    }

    if (dateFilter) {
      // Support matching date portion of signed_at
      query += " AND (date(signed_at) = date(?) OR signed_at LIKE ?)";
      params.push(dateFilter, `${dateFilter}%`);
    }

    query += " ORDER BY signed_at ASC LIMIT ?";
    params.push(limit);

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

  try {
    const body = await context.request.json();
    const {
      doc_code,
      operative_id,
      scrolled_to_bottom,
      answer_index,
      notes = "",
      signature_png,
    } = body;

    // 1. Validate doc_code
    if (!doc_code) {
      return new Response(
        JSON.stringify({ success: false, error: "Document code (TBT) is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const tbt = await db
      .prepare(
        "SELECT id, doc_code, title, doc_owner, last_revision, next_revision, correct_option_index, comprehension_options_json FROM tbts WHERE (doc_code = ? OR id = ?) AND active = 1"
      )
      .bind(doc_code, doc_code)
      .first();

    if (!tbt) {
      return new Response(
        JSON.stringify({ success: false, error: `Toolbox Talk '${doc_code}' not found or inactive.` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Validate operative_id
    if (!operative_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Please select an operative." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const operative = await db
      .prepare("SELECT id, name, company FROM operatives WHERE id = ? AND active = 1")
      .bind(operative_id)
      .first();

    if (!operative) {
      return new Response(
        JSON.stringify({ success: false, error: "Operative profile not found or inactive." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. UK Legal Defensibility Check 1: Must scroll to bottom
    if (scrolled_to_bottom !== true && scrolled_to_bottom !== "true") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "UK Legal Compliance Requirement: You must review and scroll through the entire Toolbox Talk before signing.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. UK Legal Defensibility Check 2: Correct answer to comprehension question
    const parsedAnswerIndex = parseInt(answer_index, 10);
    if (isNaN(parsedAnswerIndex) || parsedAnswerIndex !== tbt.correct_option_index) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Comprehension check failed: You must select the correct answer to confirm understanding of this safety topic before signing.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. UK Legal Defensibility Check 3: Valid signature image
    if (
      !signature_png ||
      typeof signature_png !== "string" ||
      !signature_png.startsWith("data:image/png;base64,") ||
      signature_png.length < 200
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "A valid digital signature drawing is mandatory for legal defensibility.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prevent duplicate sign-offs on the same day for same TBT and operative
    const existing = await db
      .prepare(
        "SELECT id, signed_at FROM signoffs WHERE doc_code = ? AND operative_id = ? AND date(signed_at) = date('now')"
      )
      .bind(tbt.doc_code, operative.id)
      .first();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `${operative.name} has already signed off ${tbt.doc_code} today. Duplicate submission rejected.`,
          already_signed: true,
          signed_at: existing.signed_at,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Resolve readable answer text for audit record
    let answerText = `Option #${parsedAnswerIndex}`;
    try {
      const options = JSON.parse(tbt.comprehension_options_json);
      if (options[parsedAnswerIndex]) {
        answerText = options[parsedAnswerIndex];
      }
    } catch (e) {
      // fallback
    }

    const clientIp =
      context.request.headers.get("cf-connecting-ip") ||
      context.request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = context.request.headers.get("user-agent") || "";
    const nowIso = new Date().toISOString();

    // 6. Insert immutable sign-off record
    const result = await db
      .prepare(
        `INSERT INTO signoffs (
          tbt_id, doc_code, tbt_title, doc_owner, last_revision, next_revision,
          operative_id, operative_name, operative_company,
          scrolled_to_bottom, comprehension_passed, selected_answer,
          notes, signature_png, user_agent, client_ip, signed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        tbt.id,
        tbt.doc_code,
        tbt.title,
        tbt.doc_owner,
        tbt.last_revision,
        tbt.next_revision,
        operative.id,
        operative.name,
        operative.company,
        answerText,
        (notes || "").trim().slice(0, 2000),
        signature_png,
        userAgent.slice(0, 500),
        clientIp,
        nowIso
      )
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Toolbox Talk sign-off successfully recorded.",
        data: {
          record_id: result.meta?.last_row_id,
          doc_code: tbt.doc_code,
          operative_name: operative.name,
          operative_company: operative.company,
          signed_at: nowIso,
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
