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
