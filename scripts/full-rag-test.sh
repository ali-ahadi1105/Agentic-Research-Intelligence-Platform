#!/bin/bash
# Start server, keep it alive, run test
cd /home/z/my-project

# Kill any existing
pkill -9 -f "next dev" 2>/dev/null
sleep 2

# Start server with setsid — this should keep it alive
setsid node_modules/.bin/next dev -p 3000 > /tmp/dev-test.log 2>&1 &
SERVER_PID=$!
disown

echo "Server PID: $SERVER_PID"

# Wait for server
for i in $(seq 1 30); do
  sleep 2
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "Server ready (after ${i}x2s)"
    break
  fi
done

# Login and get cookie
echo "=== Login ==="
curl -s -D /tmp/headers.txt -X POST http://localhost:3000/api/v1/auth \
  -H 'Content-Type: application/json' \
  -d '{"action":"login","email":"demo@research.ai","password":"demo1234"}' > /tmp/login-body.txt

COOKIE=$(grep -o 'research_session=[^;]*' /tmp/headers.txt)
echo "Cookie: ${COOKIE:0:40}..."

if [ -z "$COOKIE" ]; then
  echo "FAILED: No cookie. Body:"
  cat /tmp/login-body.txt | head -c 200
  echo ""
  echo "Headers:"
  cat /tmp/headers.txt
  exit 1
fi

# Get source
echo "=== Get source ==="
DOCS=$(curl -s "http://localhost:3000/api/v1/workspaces/cmrj3q1mr0009s0ypo5j21jnd/documents" -H "Cookie: $COOKIE")
SOURCE_ID=$(echo "$DOCS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Source ID: $SOURCE_ID"

if [ -z "$SOURCE_ID" ]; then
  echo "FAILED: No source. Docs:"
  echo "$DOCS" | head -c 300
  exit 1
fi

# Reprocess
echo "=== Reprocess ==="
curl -s -X POST "http://localhost:3000/api/v1/workspaces/cmrj3q1mr0009s0ypo5j21jnd/documents/$SOURCE_ID?action=reprocess" -H "Cookie: $COOKIE" > /dev/null
echo "Triggered"

# Wait for processing
echo "=== Waiting for processing ==="
for i in $(seq 1 24); do
  sleep 10
  STATS=$(curl -s "http://localhost:3000/api/v1/workspaces/cmrj3q1mr0009s0ypo5j21jnd/stats" -H "Cookie: $COOKIE")
  PROCESSED=$(echo "$STATS" | grep -o '"processed":[0-9]*' | head -1 | cut -d':' -f2)
  PROCESSING=$(echo "$STATS" | grep -o '"processing":[0-9]*' | head -1 | cut -d':' -f2)
  echo "[$i/24] processed=$PROCESSED processing=$PROCESSING"
  if [ -z "$PROCESSING" ] || [ "$PROCESSING" = "0" ]; then
    break
  fi
done

# Check vector store
echo "=== Vector Store ==="
node -e "
const Database = require('better-sqlite3');
const {load} = require('sqlite-vec');
const db = new Database('./db/custom.db');
load(db);
const t = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='chunk_embeddings'\").get();
console.log('Table exists:', !!t);
if (t) {
  const c = db.prepare('SELECT COUNT(*) as c FROM chunk_embeddings').get();
  console.log('Embeddings:', c.c);
  const s = db.prepare('SELECT chunk_id FROM chunk_embeddings LIMIT 3').all();
  console.log('Samples:', s.map(x => x.chunk_id));
}
db.close();
"

# Test semantic search
echo "=== Semantic Search ==="
SEARCH=$(curl -s "http://localhost:3000/api/v1/workspaces/cmrj3q1mr0009s0ypo5j21jnd/search?q=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("سرمایه‌گذاری"))')" -H "Cookie: $COOKIE")
echo "$SEARCH" | head -c 500
echo ""

# Check logs
echo "=== Logs ==="
grep -i "vector\|embed\|Pipeline\|Local\|Error" /tmp/dev-test.log 2>&1 | tail -15

echo "=== Done ==="
