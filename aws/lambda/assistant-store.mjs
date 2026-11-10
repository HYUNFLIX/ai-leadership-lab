// AI 비서 DynamoDB 접근 — 강의·고객 읽기/쓰기, 대화 읽기/쓰기
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const LECTURES = process.env.LECTURES_TABLE;
const CLIENTS = process.env.CLIENTS_TABLE;
const CONVERSATIONS = process.env.ASSISTANT_TABLE;
const TTL_SECONDS = 7 * 24 * 3600;

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

async function getItem(TableName, id) {
  const out = await ddb.send(new GetCommand({ TableName, Key: { id } }));
  return out.Item ?? null;
}

// 저장 형식은 index.mjs의 CRUD와 같다: id, createdAt, updatedAt
async function createItem(TableName, fields) {
  const now = new Date().toISOString();
  const item = { ...fields, id: randomUUID(), createdAt: now, updatedAt: now };
  await ddb.send(new PutCommand({ TableName, Item: item, ConditionExpression: 'attribute_not_exists(id)' }));
  return item;
}

// 없는 id로 새 항목이 생기지 않도록 attribute_exists 조건을 건다
async function updateItem(TableName, id, fields) {
  const entries = Object.entries({ ...fields, updatedAt: new Date().toISOString() });
  const names = {}, values = {}, sets = [];
  entries.forEach(([key, value], i) => {
    names[`#k${i}`] = key;
    values[`:v${i}`] = value;
    sets.push(`#k${i} = :v${i}`);
  });
  await ddb.send(new UpdateCommand({
    TableName,
    Key: { id },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ConditionExpression: 'attribute_exists(id)',
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export const data = {
  listLectures: () => scanAll(LECTURES),
  listClients: () => scanAll(CLIENTS),
  getLecture: (id) => getItem(LECTURES, id),
  getClient: (id) => getItem(CLIENTS, id),
  createLecture: (fields) => createItem(LECTURES, fields),
  updateLecture: (id, fields) => updateItem(LECTURES, id, fields),
  createClient: (fields) => createItem(CLIENTS, fields),
  updateClient: (id, fields) => updateItem(CLIENTS, id, fields),
};

// 대화는 통째로 JSON 문자열로 저장한다(사고 블록 포함, 추가 전용). 7일 뒤 TTL로 삭제된다.
export const store = {
  async get(id) {
    const item = await getItem(CONVERSATIONS, id);
    return item ? JSON.parse(item.convJson) : null;
  },
  async put(conv) {
    await ddb.send(new PutCommand({
      TableName: CONVERSATIONS,
      Item: {
        id: conv.id,
        status: conv.status,
        updatedAt: conv.updatedAt,
        ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
        convJson: JSON.stringify(conv),
      },
    }));
  },
};
