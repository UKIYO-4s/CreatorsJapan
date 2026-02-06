/**
 * Google Analytics 4 Data API クライアント
 * サービスアカウント認証 + レポート取得
 */

export interface GA4Summary {
  pageViews: number;
  users: number;
  newUsers: number;
  sessions: number;
  avgSessionDuration: number;
  bounceRate: number;
}

export interface GA4DailyData {
  date: string;
  pageViews: number;
  users: number;
}

export interface GA4TopPage {
  path: string;
  title: string;
  views: number;
}

export interface GA4Report {
  period: string;
  summary: GA4Summary;
  dailyData: GA4DailyData[];
  topPages: GA4TopPage[];
  comparison?: {
    pageViewsChange: number;
    usersChange: number;
  };
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
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
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

  // PEMからCryptoKeyを作成
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
 * GA4レポートを取得
 */
export async function fetchGA4Report(
  propertyId: string,
  serviceAccountKeyJson: string,
  startDate: string,
  endDate: string
): Promise<GA4Report> {
  const serviceAccountKey = JSON.parse(serviceAccountKeyJson) as ServiceAccountKey;
  const accessToken = await getAccessToken(serviceAccountKey);

  const apiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

  // サマリーデータ取得
  const summaryResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    }),
  });

  if (!summaryResponse.ok) {
    const error = await summaryResponse.text();
    throw new Error(`GA4 API error: ${error}`);
  }

  const summaryData = await summaryResponse.json() as any;

  // 日別データ取得
  const dailyResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
  });

  const dailyData = await dailyResponse.json() as any;

  // トップページ取得
  const topPagesResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
      ],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{
        metric: { metricName: 'screenPageViews' },
        desc: true,
      }],
      limit: 10,
    }),
  });

  const topPagesData = await topPagesResponse.json() as any;

  return transformGA4Response(startDate, endDate, summaryData, dailyData, topPagesData);
}

/**
 * GA4レスポンスを変換
 */
function transformGA4Response(
  startDate: string,
  _endDate: string,
  summaryData: any,
  dailyData: any,
  topPagesData: any
): GA4Report {
  // サマリー
  const summaryRow = summaryData.rows?.[0]?.metricValues || [];
  const summary: GA4Summary = {
    pageViews: parseInt(summaryRow[0]?.value || '0', 10),
    users: parseInt(summaryRow[1]?.value || '0', 10),
    newUsers: parseInt(summaryRow[2]?.value || '0', 10),
    sessions: parseInt(summaryRow[3]?.value || '0', 10),
    avgSessionDuration: parseFloat(summaryRow[4]?.value || '0'),
    bounceRate: parseFloat(summaryRow[5]?.value || '0'),
  };

  // 日別データ
  const dailyRows = dailyData.rows || [];
  const daily: GA4DailyData[] = dailyRows.map((row: any) => ({
    date: row.dimensionValues[0].value,
    pageViews: parseInt(row.metricValues[0].value, 10),
    users: parseInt(row.metricValues[1].value, 10),
  }));

  // トップページ
  const topPagesRows = topPagesData.rows || [];
  const topPages: GA4TopPage[] = topPagesRows.map((row: any) => ({
    path: row.dimensionValues[0].value,
    title: row.dimensionValues[1].value,
    views: parseInt(row.metricValues[0].value, 10),
  }));

  // 期間をYYYY-MM形式に
  const period = startDate.slice(0, 7);

  return {
    period,
    summary,
    dailyData: daily,
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
