// functions/api/tbts.js
// Cloudflare Pages Function: List and fetch Toolbox Talks

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(
      JSON.stringify({ success: false, error: "Database binding 'DB' not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(context.request.url);
  const code = url.searchParams.get("code") || url.searchParams.get("id");

  try {
    if (code) {
      const tbt = await db
        .prepare(
          "SELECT id, doc_code, title, doc_owner, last_revision, next_revision, category, prepare_text, reason_text, why_text, outline_text, content_json, comprehension_question, comprehension_options_json, correct_option_index, active FROM tbts WHERE (doc_code = ? OR id = ?) AND active = 1"
        )
        .bind(code, code)
        .first();

      if (!tbt) {
        return new Response(
          JSON.stringify({ success: false, error: `Toolbox Talk '${code}' not found.` }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      let parsedContent = null;
      let parsedOptions = [];
      try {
        parsedContent = JSON.parse(tbt.content_json);
      } catch (e) {
        parsedContent = { raw: tbt.content_json };
      }

      try {
        parsedOptions = JSON.parse(tbt.comprehension_options_json);
      } catch (e) {
        parsedOptions = [];
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: tbt.id,
            doc_code: tbt.doc_code,
            title: tbt.title,
            doc_owner: tbt.doc_owner,
            last_revision: tbt.last_revision,
            next_revision: tbt.next_revision,
            category: tbt.category,
            prepare_text: tbt.prepare_text,
            reason_text: tbt.reason_text,
            why_text: tbt.why_text,
            outline_text: tbt.outline_text,
            content: parsedContent,
            comprehension_question: tbt.comprehension_question,
            comprehension_options: parsedOptions,
            correct_option_index: tbt.correct_option_index,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return list of available TBTs
    const { results } = await db
      .prepare(
        "SELECT id, doc_code, title, doc_owner, last_revision, next_revision, category FROM tbts WHERE active = 1 ORDER BY doc_code ASC"
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
