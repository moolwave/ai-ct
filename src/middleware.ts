import { NextResponse, type NextRequest } from "next/server";
import {
  MIN_TOKEN_LENGTH,
  SESSION_COOKIE,
  configuredToken,
  isLoopbackHost,
  verifySession,
} from "@/lib/session";

/**
 * 모든 화면과 서버 액션(POST) 앞에서 접근을 확인합니다.
 * 서버 액션은 화면 주소로 POST가 오므로 여기서 함께 막힙니다.
 */
export async function middleware(request: NextRequest) {
  const token = configuredToken();
  const { pathname, search } = request.nextUrl;

  if (!token) {
    // 토큰이 없으면 이 컴퓨터에서만 씁니다. 같은 와이파이의 다른 기기가 검수를 지우지 못하게 합니다.
    if (isLoopbackHost(request.headers.get("host"))) return NextResponse.next();
    return new NextResponse(
      "ai ct: 이 서버는 로컬 전용입니다. 다른 기기에서 쓰려면 AICT_ACCESS_TOKEN을 설정하고 다시 시작하세요.",
      { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  if (token.length < MIN_TOKEN_LENGTH) {
    return new NextResponse(`ai ct: AICT_ACCESS_TOKEN은 ${MIN_TOKEN_LENGTH}자 이상이어야 합니다.`, {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (pathname === "/login") return NextResponse.next();

  if (await verifySession(token, request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("ai ct: 로그인이 필요합니다.", { status: 401 });
  }
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
