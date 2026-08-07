// Firestore lectures 컬렉션 → lectures.json (공개 읽기 가능하므로 REST로 export)
// 실행: node export-lectures.mjs
import { writeFileSync } from 'node:fs';

const PROJECT = 'ai-leadership-lectures-d509b';
const API_KEY = 'AIzaSyDwcyLezAW4nTlfmv6FYzjEe8RgDUgJXuY'; // 클라이언트용 공개 키
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/lectures`;

// Firestore 필드 타입 → JS 값
function fromFirestore(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue' in v) out[k] = v.stringValue;
    else if ('integerValue' in v) out[k] = Number(v.integerValue);
    else if ('doubleValue' in v) out[k] = v.doubleValue;
    else if ('booleanValue' in v) out[k] = v.booleanValue;
    else if ('timestampValue' in v) out[k] = v.timestampValue;
    else if ('nullValue' in v) out[k] = null;
    else if ('arrayValue' in v) out[k] = (v.arrayValue.values ?? []).map((x) => Object.values(x)[0]);
    else out[k] = v; // 기타 타입은 원형 보존
  }
  return out;
}

const items = [];
let pageToken = '';
do {
  const url = `${BASE}?pageSize=300&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
  const data = await res.json();
  for (const doc of data.documents ?? []) {
    const id = doc.name.split('/').pop();
    items.push({ id, ...fromFirestore(doc.fields) });
  }
  pageToken = data.nextPageToken ?? '';
} while (pageToken);

writeFileSync('lectures.json', JSON.stringify(items, null, 2), 'utf-8');
console.log(`lectures.json 저장 완료 — ${items.length}건`);
