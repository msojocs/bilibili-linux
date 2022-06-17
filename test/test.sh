#!/bin/bash

root_dir=$(cd `dirname $0`/.. && pwd -P)

"$root_dir/tools/app-decrypt.js" "$root_dir/app/app/main/.biliapp" "$root_dir/app/app/main/.biliapp.js"