# Tag v1.17.5-2 Creation

## What Was Done

1. **Version Update**: Updated `package.json` version from `1.17.5-1` to `1.17.5-2`
2. **CHANGELOG Update**: Added v1.17.5-2 entry to `CHANGELOG.MD` with the fix description
3. **Local Tag Created**: Created annotated git tag `v1.17.5-2` pointing to master branch commit `f362c99`
   - Commit: `f362c994556000dd9a92dd3a89e50a63d46120fe`
   - Message: "Release v1.17.5-2: Fix additional functions call error in runtime"

## Manual Steps Required

To complete the tag creation, you need to manually push the tag to the remote repository:

```bash
git push origin v1.17.5-2
```

Or if you prefer to push all tags:

```bash
git push origin --tags
```

## Verification

After pushing, you can verify the tag at:
- GitHub Tags: https://github.com/msojocs/bilibili-linux/tags
- GitHub Releases: https://github.com/msojocs/bilibili-linux/releases

The tag `v1.17.5-2` points to the commit that fixes the additional functions call error in the runtime settings component.
