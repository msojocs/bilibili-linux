#!/bin/bash
root_dir=$(cd `dirname $0`/.. && pwd -P)

mv $root_dir/app/app/main/assets/bili-inject.js $root_dir/app/app/main/assets/bili-inject.original.js
node $root_dir/tools/js-decode.js $root_dir/app/app/main/assets/bili-inject.original.js $root_dir/app/app/main/assets/bili-inject.js
# DEBUG=2 bin/bilibili