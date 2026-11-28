#!/bin/bash
cd /data/gitcg || exit 1
BIN=bin2/ab-value.bundle.mjs
LIB=data/deck-library.json
PAIRS=20

run() {
  local n=$1
  local start=$(date +%s.%N)
  for i in $(seq 0 $((n-1))); do
    node "$BIN" --a=heur --b=heur --pairs=$PAIRS --offset=$((1000 + i*37)) --lib=$LIB > /tmp/bench-$n-$i.log 2>&1 &
  done
  wait
  local end=$(date +%s.%N)
  python3 -c "
n=$n; pairs=$PAIRS; el=$end-$start
games=n*pairs*2
print(f'并发 {n:2d} 进程: {games} 局 / {el:.1f}s = {games/el:.2f} 局/秒  (单局 {el/games:.2f}s)')
"
}

run 1
run 8
run 16
