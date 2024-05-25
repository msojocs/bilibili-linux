#!/bin/bash
root_dir=$(cd `dirname $0`/.. && pwd -P)

node $root_dir/tools/js-decode.js $root_dir/app/app/main/app.orgi.js $root_dir/app/app/main/app.js
DEBUG=2 bin/bilibili