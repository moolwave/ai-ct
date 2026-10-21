/**
 * Next.js가 서버에서 화면·라우트·서버 액션을 처리하다 잡지 못한 예외를 넘겨 줍니다.
 * 스택과 digest를 data/logs/errors.log에 남겨, 화면에 보인 digest로 원인을 찾을 수 있게 합니다.
 */
export async function register() {}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logError } = await import("./lib/error-log");
  logError(`next:${context.routeType}`, error, {
    path: request.path.split("?")[0].slice(0, 200),
    method: request.method,
    route: context.routePath,
  });
}
