import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 자발화 분석 API 접근 토큰 발급.
 *
 * 분석 백엔드(FastAPI)는 공개 인터넷에 있고 뒤로 유료 API(OpenAI·Deepgram)를
 * 호출한다. 공유 비밀은 서버에만 두고, 비밀번호를 맞힌 사용자에게만 수명이
 * 짧은 HMAC 토큰을 준다. 브라우저는 비밀 자체를 보지 못한다.
 *
 * 토큰 형식은 api/main.py 의 make_token 과 동일: `<exp>.<hex hmac-sha256(exp)>`
 */

const TTL_SEC = 6 * 60 * 60;

function eq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // timingSafeEqual 은 길이가 다르면 throw 한다 → 길이 비교를 먼저 하되
  // 길이 자체는 비밀이 아니므로 조기 반환해도 무방하다.
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  const secret = process.env.SPONTANEOUS_SECRET ?? "";
  const password = process.env.SPONTANEOUS_PASSWORD ?? "";
  const apiUrl = process.env.SPONTANEOUS_API_URL ?? "";

  if (!secret || !apiUrl) {
    return Response.json(
      { error: "서버에 자발화 분석 API가 설정되어 있지 않습니다. (SPONTANEOUS_SECRET / SPONTANEOUS_API_URL)" },
      { status: 503 },
    );
  }

  let given = "";
  try {
    given = String(((await req.json()) as { password?: unknown })?.password ?? "");
  } catch {
    given = "";
  }

  if (password && !eq(given, password)) {
    return Response.json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  const exp = String(Math.floor(Date.now() / 1000) + TTL_SEC);
  const sig = createHmac("sha256", secret).update(exp).digest("hex");

  return Response.json({ token: `${exp}.${sig}`, apiUrl, expiresAt: Number(exp) * 1000 });
}
