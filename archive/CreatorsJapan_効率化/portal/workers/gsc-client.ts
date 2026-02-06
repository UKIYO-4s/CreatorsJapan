/**
 * Google Search Console API クライアント
 * サービスアカウント認証 + 検索パフォーマンスデータ取得
 */

export interface GSCSummary {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCReport {
  period: string;
  summary: GSCSummary;
  topQueries: GSCQuery[];
  topPages: GSCPage[];
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/**
 * サービスアカウントでアクセストークンを取得
 */
async function getAccessToken(serviceAccountKey: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: exp,
  };

  const jwt = await signJWT(header, payload, serviceAccountKey.private_key);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

/**
 * JWTに署名
 */
async function signJWT(
  header: object,
  payload: object,
  privateKeyPem: string
): Promise<string> {
  const encoder = new TextEncoder();

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${signatureInput}.${signatureB64}`;
}

/**
 * Base64 URL エンコード
 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * GSCレポートを取得
 */
export async function fetchGSCReport(
  siteUrl: string,
  serviceAccountKeyJson: string,
  startDate: string,
  endDate: string
): Promise<GSCReport> {
  const serviceAccountKey = JSON.parse(serviceAccountKeyJson) as ServiceAccountKey;
  const accessToken = await getAccessToken(serviceAccountKey);

  const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

  // サマリーデータ取得
  const summaryResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
    }),
  });

  if (!summaryResponse.ok) {
    const error = await summaryResponse.text();
    throw new Error(`GSC API error: ${error}`);
  }

  const summaryData = await summaryResponse.json() as any;

  // 検索クエリ取得
  const queriesResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: 50,
    }),
  });

  const queriesData = await queriesResponse.json() as any;

  // ページ別データ取得
  const pagesResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 50,
    }),
  });

  const pagesData = await pagesResponse.json() as any;

  return transformGSCResponse(startDate, summaryData, queriesData, pagesData);
}

/**
 * GSCレスポンスを変換
 */
function transformGSCResponse(
  startDate: string,
  summaryData: any,
  queriesData: any,
  pagesData: any
): GSCReport {
  // サマリー（全体の合計/平均）
  const summaryRows = summaryData.rows || [];
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalCtr = 0;
  let totalPosition = 0;

  if (summaryRows.length > 0) {
    totalClicks = summaryRows.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0);
    totalImpressions = summaryRows.reduce((sum: number, row: any) => sum + (row.impressions || 0), 0);
    totalCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    totalPosition = summaryRows.reduce((sum: number, row: any) => sum + (row.position || 0), 0) / summaryRows.length;
  }

  const summary: GSCSummary = {
    clicks: totalClicks,
    impressions: totalImpressions,
    ctr: Math.round(totalCtr * 10000) / 100, // パーセント表示
    position: Math.round(totalPosition * 10) / 10,
  };

  // 検索クエリ
  const queryRows = queriesData.rows || [];
  const topQueries: GSCQuery[] = queryRows.map((row: any) => ({
    query: row.keys[0],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Math.round((row.ctr || 0) * 10000) / 100,
    position: Math.round((row.position || 0) * 10) / 10,
  }));

  // ページ別
  const pageRows = pagesData.rows || [];
  const topPages: GSCPage[] = pageRows.map((row: any) => ({
    page: row.keys[0],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Math.round((row.ctr || 0) * 10000) / 100,
    position: Math.round((row.position || 0) * 10) / 10,
  }));

  // 期間をYYYY-MM形式に
  const period = startDate.slice(0, 7);

  return {
    period,
    summary,
    topQueries,
    topPages,
  };
}

/**
 * 期間を計算（YYYY-MM → startDate, endDate）
 */
export function calculateDateRange(yearMonth?: string): {
  startDate: string;
  endDate: string;
  period: string;
} {
  const now = new Date();
  let year: number;
  let month: number;

  if (yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)) {
    [year, month] = yearMonth.split('-').map(Number);
  } else {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

  // 月末日を計算
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return {
    startDate,
    endDate,
    period: `${year}-${String(month).padStart(2, '0')}`,
  };
}
