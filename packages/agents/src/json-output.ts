// Extracts the JSON object text from a model reply: drops <think> blocks and markdown fences.
export function extractJsonText(raw: string): string {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fenced?.[1] !== undefined) text = fenced[1].trim();
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
  }
  return text;
}

// Duck-typed Zod issue fields — agents parses with the contracts package's Zod
// schemas but does not depend on zod itself.
interface IssueLike {
  path?: unknown;
  code?: unknown;
  keys?: unknown;
}

// Classifies a failed model-output parse/validation into a short, model-safe
// reason: schema paths and invented key names, a parse failure, or a citation
// id. Raw model text is never included.
export function outputValidationReason(error: unknown): string {
  const issues = (error as {issues?: unknown} | null | undefined)?.issues;
  if (Array.isArray(issues)) {
    const paths = issues.map(issue => {
      const path = (issue as IssueLike).path;
      const rendered = Array.isArray(path) ? path.join('.') : '';
      return rendered || '(root)';
    }).join(', ');
    const first = issues[0] as IssueLike | undefined;
    let detail = typeof first?.code === 'string' ? first.code : 'invalid_type';
    if (first?.code === 'unrecognized_keys' && Array.isArray(first.keys)) {
      detail += ` (${first.keys.join(', ')})`;
    }
    return `schema: ${paths} (${detail})`;
  }
  if (error instanceof SyntaxError) return 'invalid JSON';
  if (error instanceof Error && /citation/i.test(error.message)) return error.message;
  return 'validation error';
}
