// lectures.json / clients.json → DynamoDB 적재
// 사전 준비: npm install  (이 폴더에서)
// 실행: node import-dynamo.mjs lectures.json AILab-Lectures-prod
//       node import-dynamo.mjs clients.json  AILab-Clients-prod
import { readFileSync } from 'node:fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const [file, table] = process.argv.slice(2);
if (!file || !table) {
  console.error('사용법: node import-dynamo.mjs <json파일> <테이블명>');
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-northeast-2' }), {
  marshallOptions: { removeUndefinedValues: true },
});

const items = JSON.parse(readFileSync(file, 'utf-8'));
console.log(`${file} → ${table}: ${items.length}건 적재 시작`);

// 빈 문자열 id 방지 + 25건 단위 배치
let done = 0;
for (let i = 0; i < items.length; i += 25) {
  const batch = items.slice(i, i + 25).filter((it) => it.id);
  if (!batch.length) continue;
  await ddb.send(new BatchWriteCommand({
    RequestItems: { [table]: batch.map((Item) => ({ PutRequest: { Item } })) },
  }));
  done += batch.length;
  console.log(`  ${done}/${items.length}`);
}
console.log('적재 완료');
