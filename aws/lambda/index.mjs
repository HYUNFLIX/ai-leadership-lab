// AI Leadership Lab API — lectures/clients CRUD + 공개 강의실적
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const LECTURES = process.env.LECTURES_TABLE;
const CLIENTS = process.env.CLIENTS_TABLE;

// 공개 응답에서 제거할 민감 필드 (강의료 등)
const SENSITIVE_LECTURE_FIELDS = ['fee', 'netPayment', 'taxDeduction', 'notes', 'contractor', 'paymentStatus'];

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

async function scanAll(TableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const out = await ddb.send(new ScanCommand({ TableName, ExclusiveStartKey }));
    items.push(...(out.Items ?? []));
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function sanitizeLecture(item) {
  const copy = { ...item };
  for (const f of SENSITIVE_LECTURE_FIELDS) delete copy[f];
  return copy;
}

async function crud(table, method, id, body) {
  if (method === 'GET') {
    const items = await scanAll(table);
    return json(200, { items });
  }
  if (method === 'POST') {
    const now = new Date().toISOString();
    const item = { ...body, id: body.id || randomUUID(), createdAt: body.createdAt || now, updatedAt: now };
    await ddb.send(new PutCommand({ TableName: table, Item: item }));
    return json(201, { item });
  }
  if (method === 'PUT') {
    if (!id) return json(400, { error: 'id required' });
    const now = new Date().toISOString();
    const fields = { ...body, updatedAt: now };
    delete fields.id;
    const names = {}, values = {}, sets = [];
    Object.entries(fields).forEach(([k, v], i) => {
      names[`#k${i}`] = k;
      values[`:v${i}`] = v;
      sets.push(`#k${i} = :v${i}`);
    });
    await ddb.send(new UpdateCommand({
      TableName: table,
      Key: { id },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }));
    return json(200, { ok: true });
  }
  if (method === 'DELETE') {
    if (!id) return json(400, { error: 'id required' });
    await ddb.send(new DeleteCommand({ TableName: table, Key: { id } }));
    return json(200, { ok: true });
  }
  return json(405, { error: 'method not allowed' });
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? 'GET';
  const path = event.rawPath ?? '';
  const id = event.pathParameters?.id;
  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.body); } catch { return json(400, { error: 'invalid JSON' }); }
  }

  try {
    // 공개: 홈페이지 강의실적 — 민감 필드 제거
    if (path.endsWith('/public/lectures')) {
      const items = await scanAll(LECTURES);
      return json(200, { items: items.map(sanitizeLecture) });
    }
    if (path.includes('/lectures')) return crud(LECTURES, method, id, body);
    if (path.includes('/clients')) return crud(CLIENTS, method, id, body);
    return json(404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'internal error' });
  }
};
