const messages = {
  LOGIN_REQUIRED: "Sua sessão expirou. Entre novamente.",
  ACCESS_DENIED: "Esta conta ainda não tem acesso às fichas de RPG.",
  AUTH_UNAVAILABLE: "A autenticação está indisponível. Tente novamente.",
  DATABASE_UNAVAILABLE: "Não foi possível acessar o banco agora.",
  CONNECTION_FAILED: "Sem conexão com o servidor.",
  SHEET_CONFLICT: "A ficha foi alterada em outra aba ou dispositivo. Recarregue antes de continuar.",
  SHEET_NOT_FOUND: "Esta ficha não existe ou pertence a outra conta.",
  SHEET_TOO_LARGE: "A ficha excede o tamanho permitido.",
  INVALID_SHEET: "Algum campo excede o limite permitido.",
  INVALID_SHEET_NAME: "O nome deve ter entre 1 e 120 caracteres.",
  INVALID_ORIGIN: "A origem desta solicitação não foi aceita.",
  invalid_invite: "O convite é inválido ou expirou.",
  enrollment_flow_failed: "Não foi possível concluir o cadastro. Tente novamente ou fale com a administração.",
};

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json", ...options.headers },
    });
  } catch {
    throw Object.assign(new Error(messages.CONNECTION_FAILED), { code: "CONNECTION_FAILED" });
  }
  if (response.type === "opaqueredirect" || response.status === 401) {
    throw Object.assign(new Error(messages.LOGIN_REQUIRED), { code: "LOGIN_REQUIRED" });
  }
  if (response.status === 204) return null;
  const isJson = response.headers.get("Content-Type")?.includes("application/json");
  if (response.status === 403 && !isJson) {
    throw Object.assign(new Error(messages.ACCESS_DENIED), { code: "ACCESS_DENIED" });
  }
  if (!isJson) throw Object.assign(new Error(messages.CONNECTION_FAILED), { code: "CONNECTION_FAILED" });
  const data = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(messages[data.error] || "Não foi possível concluir a operação."), { code: data.error });
  }
  return data;
}

export function writeHeaders(uid) {
  return {
    "Content-Type": "application/json",
    "X-Ficha-Request": "1",
    "X-Ficha-Account": uid,
  };
}

