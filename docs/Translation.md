# Translation Maintenance

The extension supports `zh-CN` and `en`. Stored `zhCn` values are normalized to
`zh-CN` when read. Unsupported language values fall back to Chinese.

## Language State

`src/extension/ui/store/storage.ts` contains pure language reducers. The listener
middleware in `store/index.ts` updates i18next, serializes persistence writes,
and publishes the existing `changeLanguage` event for the DOM adapter and sibling
frames. Incoming events and native `dataSync` updates do not write storage again.
`initStore()` runs once, after the page/content communication bridge is registered.
A delayed storage read cannot replace a more recent user or window update.

## Extension UI

React translations live in `src/extension/ui/locales/en.ts`, in the `extension`
i18next namespace. Existing Chinese message keys remain supported; missing
translations display the source message. `LocaleProvider` keeps Ant Design in
the same language and isolates its popup, modal and notification contents.

Mark every React mount point with `data-bili-i18n-skip`. For custom portals,
apply the same attribute to their container. The DOM adapter must not rewrite
React-managed content. User input, contenteditable regions, `translate="no"`,
video titles and the existing user-content selectors are excluded as well.

## Official Client UI

`common/translation/translator.ts` is a pure source-to-target function. Exact
translations and dynamic rules live in `common/translation/en.ts`. Dynamic rules
use anchored, precompiled regular expressions and named parameters. Do not add
global or sticky flags. Keep literal punctuation escaped, and add an input/output
example for every rule in `tests/translation/browser.ts`. Compact counts use
`Intl.NumberFormat` after converting the source quantity to a number.

`page/translation/dom-translator.ts` translates initial content and batches
subsequent added nodes, character data and `title`, `placeholder`, `aria-label`
changes. It does not rewrite `createTextNode`. WeakMaps retain the source and last
rendered value without keeping removed text nodes alive. Language switches scan
the current document and known shadow roots using the original source.

Chinese mode skips translation work on DOM mutations. Shadow roots created after
initialization are registered through a small `attachShadow` wrapper; existing
open roots are discovered on scans. A closed root created before initialization
cannot be inspected through standard DOM APIs. Detached shadow observers are
disconnected; host-to-root WeakMap entries allow re-registration on reinsertion.
Disposal restores visible source text, disconnects observers and removes the
wrapper when still owned by the adapter. Comment `part` exposure is kept in a
separate helper so the existing English layout rules continue to work.

## Collection and Validation

The existing collection script writes `tools/translation/result/translation.json`.
Run `node 'tools/translation/2. gen-ts.js'` to generate `result/candidates.json`.
Candidates contain source examples and escaped, anchored patterns with named
parameters. Review them before adding translations: a number may be a fixed
codec or version identifier rather than a runtime parameter. The generator does
not overwrite reviewed dictionaries.

Run `pnpm test:translation` for dictionary, generator, real Chromium DOM, Redux,
React and Ant Design integration checks. The runner uses the existing
`electron/electron` binary when available, otherwise the Electron dev dependency.
Set `TRANSLATION_ELECTRON_BINARY` to override the executable. Linux requires a
working display; CI can run `xvfb-run -a pnpm test:translation`. Tests use a hidden
window and a temporary profile, with no connection to an active client session.
They also verify that a 1000-node insertion leaves existing siblings untouched.

Run `pnpm build` for the TypeScript and production bundle checks. The tests do not
cover every upstream client layout; verify player controls, comments and settings
against the supported client version when its markup changes.
