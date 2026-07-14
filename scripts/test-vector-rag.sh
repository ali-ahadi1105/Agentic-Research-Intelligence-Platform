#!/bin/bash
# Start dev server and run tests
cd /home/z/my-project

# Kill any existing
pkill -9 -f "next" 2>/dev/null
sleep 2

# Start server with setsid
setsid bun run dev > /tmp/dev-server.log 2>&1 &
disown
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to be ready
for i in $(seq 1 30); do
  sleep 2
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "Server is up (after ${i}x2s)"
    break
  fi
  echo "Waiting... [$i] code=$CODE"
done

# Login
echo "=== Login ==="
LOGIN_RESP=$(curl -s -X POST http://localhost:3000/api/v1/auth \
  -H 'Content-Type: application/json' \
  -d '{"action":"login","email":"demo@research.ai","password":"demo1234"}')
echo "$LOGIN_RESP" | head -c 200
echo ""

# Extract cookie using grep
COOKIE=$(echo "$LOGIN_RESP" | grep -o 'research_session' | head -1)
# The cookie is in the Set-Cookie header, not body. Need to use -D
echo "=== Login with headers ==="
curl -s -D /tmp/hdr.txt -X POST http://localhost:3000/api/v1/auth \
  -H 'Content-Type: application/json' \
  -d '{"action":"login","email":"demo@research.ai","password":"demo1234"}' > /dev/null
cat /tmp/hdr.txt | grep -i cookie
COOKIE=$(grep -i "set-cookie" /tmp/hdr.txt | grep -o 'research_session=[^;]*')
echo "Cookie: $COOKIE"

# Get documents
echo "=== Documents ==="
DOCS=$(curl -s "http://localhost:3000/api/v1/workspaces/cmrj3q1mr0009s0ypo5j21jnd/documents" -H "Cookie: $COOKIE")
echo "$DOCS" | head -c 200
echo ""
SOURCE_ID=$(echo "$DOCS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Source ID: $SOURCE_ID"

# Reprocess
echo "=== Reprocess ==="
curl -s -X POST "http://localhost:3000/api/v1/workspaces/cmrj3q1mr0009s0ypo5j21jnd/documents/$SOURCE_ID?action=reprocess" -H "Cookie: $COOKIE"
echo ""

# Wait for processing
echo "=== Waiting for processing ==="
for i in $(seq 1 30); do
  sleep 10
  STATS=$(curl -s "http://localhost:3000/api/v1/workspaces/cmrj3q1mr0009s0ypo5j21jnd/stats" -H "Cookie: $COOKIE")
  PROCESSED=$(echo "$STATS" | grep -o '"processed":[0-9]*' | head -1 | cut -d':' -f2)
  PROCESSING=$(echo "$STATS" | grep -o '"processing":[0-9]*' | head -1 | cut -d':' -f2)
  echo "[$i/30] processed=$PROCESSED processing=$PROCESSING"
  if [ -z "$PROCESSING" ] || [ "$PROCESSING" = "0" ]; then
    echo "Processing complete!"
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
const table = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='chunk_embeddings'\").get();
console.log('Table exists:', !!table);
if (table) {
  const count = db.prepare('SELECT COUNT(*) as c FROM chunk_embeddings').get();
  console.log('Embeddings stored:', count.c);
}
db.close();
"

# Test semantic search
echo "=== Semantic Search ==="
curl -s "http://localhost:3000/api/v1/workspaces/cmrj3q1mr0009s0ypo5j21jnd/search?q=%D8%B3%D8%B1%D9%85%D8%A7%DB%8C%D9%87" -H "Cookie: $COOKIE" | head -c 500
echo ""

echo "=== Done ==="
