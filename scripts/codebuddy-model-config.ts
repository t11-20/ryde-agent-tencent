export type CodeBuddyModel = {id?: string; name?: string; url?: string; apiKey?: string};
const PLACEHOLDER = '__SET_BY_CODEBUDDY_INTEGRATION__';

function modelHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return undefined;
    return parsed.host;
  } catch { return undefined; }
}

// Explicit runtime settings take precedence. Never combine one provider's key
// with a different or unrecognized endpoint during the CodeBuddy fallback.
export function resolveCodeBuddyEnvironment(env: NodeJS.ProcessEnv, models: CodeBuddyModel[]): NodeJS.ProcessEnv {
  const resolved = {...env};
  const nameHint = env.MODEL_NAME;
  const urlHint = env.MODEL_BASE_URL;
  const candidates = models.filter(model => modelHost(model.url));
  const model = nameHint
    ? candidates.find(value => value.id === nameHint || value.name === nameHint)
    : urlHint
      ? candidates.find(value => modelHost(value.url) === modelHost(urlHint))
      : candidates.find(value => value.id === 'MiniMax-M2.5') ?? (candidates.length === 1 ? candidates[0] : undefined);
  if (!model || (urlHint && modelHost(urlHint) !== modelHost(model.url))) return resolved;
  if (env.MODEL_API_KEY && env.MODEL_API_KEY !== PLACEHOLDER && env.MODEL_API_KEY !== model.apiKey) return resolved;
  if (!resolved.MODEL_NAME && model.id) resolved.MODEL_NAME = model.id;
  if (!resolved.MODEL_BASE_URL && model.url) resolved.MODEL_BASE_URL = model.url.replace(/\/chat\/completions\/?$/, '');
  if ((!resolved.MODEL_API_KEY || resolved.MODEL_API_KEY === PLACEHOLDER) && model.apiKey) resolved.MODEL_API_KEY = model.apiKey;
  return resolved;
}
