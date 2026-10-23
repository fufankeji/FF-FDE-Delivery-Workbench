---
description: "Shared Workspace browser and picker plugin for the dsh web client: grouped or flat session rows, management actions, the slot-composed Session row actions, and directory picking."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-workspace

English | [中文](README.zh.md)

Shared FDE project browser and picker plugin, backed directly by Harness Workspace entities. `WorkspaceBrowser` fills the sidebar's `sidebar.workspaces` slot, while `WorkspacePicker` fills the page-local Session Intent hero's `conversation.hero.workspace` slot; both surfaces use the same project menu and directory-adoption flow.

`WorkspaceBrowser` also declares the root-scoped `sidebar.workspaces.projectActions` list slot and renders its occupants only inside real project rows, supplying the exact Workspace id, title, and canonical path. Downstream project capabilities can add compact actions without teaching this package their business behavior; the ungrouped bucket has no project-action outlet.

The browser renders grouped or flat Session rows from the global runtime hooks and owns project creation/rename/reorder plus Session reorder. Its primary action is **New project**, which opens a structured form for the required business-facing project name, optional company/business owner, pending-or-estimated delivery window, a project root, and an independent physical folder name. Project Center requests this same form through the browser event bridge; it does not own a duplicate form or creation state. With no remembered root the form stays unselected and cannot submit until the user chooses one; the user may explicitly remember that root for future forms. The business name may be Chinese, while the editable physical folder defaults to an ASCII `fde-YYYYMMDD-xxxx` value and accepts only portable characters. Submit creates that child directory, registers the Workspace, applies the business display name, persists the initial FDE metadata and optional default root, then opens the returned Workspace's project-management page when the FDE page plugin is present. It does not create a Session; only a later explicit Enter Project action does so. A composition without the FDE page keeps the upstream first-Session fallback. **Import existing project** uses the same post-registration navigation while remaining a separate form action that adopts a complete existing directory. Clicking a project row expands it and opens its most recently updated non-archived ordinary Session without creating another one; the separate chevron changes expansion only, and the row's plus action starts a Session with that explicit Workspace id. Company and delivery dates persist in the registered project’s `.fde/project-metadata.json` through the FDE Host. Project Center and sidebar hover cards consume one shared client service. Only when the Host record is absent does that service import the current browser’s legacy metadata; it retains the browser copy and never overwrites a saved project record. A failed metadata save leaves the created project reachable and exposes retry, without creating a duplicate project. The user-confirmed default root remains a browser preference. View options, ordering, dragging, and session activity behavior otherwise remain unchanged.

Search remains a section-header action while New project is the full-width primary action above it. In the rail, New project and search render as 36px controls on the shell's shared horizontal entry path with a 12px vertical gap; the wide-only section header occupies no rail space. Activating search expands the field across the header; an outside click collapses only a query that is empty after trimming — except while the rail search gesture is still in flight (until focus lands in the input after the column slide), so the expanding click cannot dismiss the search it opened — while the clear control always resets and collapses it. A non-blank search query replaces either browsing mode with one flat result list: case-insensitive title and Workspace substring matches appear immediately, while a 250 ms debounced Host request adds ranked current-conversation content matches and snippets. The English search input and its defensive request path remove NUL, cap the query at the wire schema's 500 UTF-16 code units without splitting a surrogate pair, and preserve the existing debounce and cancellation behavior. Each new query aborts the preceding request; a failed content search leaves metadata matches visible with a warning. The list is capped at 20, asks the user to narrow broader queries, and opens the selected Session without clearing the query or jumping to a specific event.

The picker lists real Host Workspace entities as user-visible projects through the global `useWorkspaces` hook. Selecting a project invokes the slot owner's `onPick` callback to retarget the frontend Session object. Distinct canonical paths remain separate id-keyed projects when their basenames and display titles match; the sidebar hover detail adds stored company and estimated/pending delivery facts to the existing path and creation time. Each registration declares a **directory-flow child hole** (`single` kind: `conversation.hero.workspace.directoryFlow` / `sidebar.workspaces.directoryFlow`) that the composed picker package's client half fills with its picking interaction — the [`-native`](../../host/directory-picker-native/README.md) backend's renderless OS-chooser driver today, an in-app browsing dialog under a `-browse` composition. In the sidebar form this one flow either selects a storage parent or imports an existing project, while the conversation picker continues to adopt a selected project directory directly. Cancellation is silent and failures return to the form with the current fields retained. The project row's **Remove from workbench** action explicitly states that the local directory and Session logs remain; success removes the group while its Sessions remain under Ungrouped. Session rename, archive, and blank-row behavior remain unchanged.
Desktop product events use the optional [product analytics service](../product-analytics/README.md); ordinary Web interactions are excluded.
## Summary

This package lets users browse grouped or flat Session lists, choose a Workspace for a new Session, and manage Workspaces and Sessions through add, rename, reorder, search, fork, archive, and Workspace deletion; the Session row menu and its hover buttons are slot lists that client plugins extend. Pending interactions appear as warning dots, and subagent-origin Sessions remain hidden. An idle, unarchived Session row with active scheduled tasks shows a clock mark, and its hover card lists those tasks. Canonically distinct folder paths remain separate Workspaces. Adding a Workspace requires a composed directory picker; without one, adding is unavailable.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Use the sidebar to browse Workspaces and their Sessions, reorder them, and start new ones; use the picker in the Session Intent hero to choose a Workspace for a new session. An open Workspace shows its first non-blank Sessions in list order up to a per-Workspace watermark, initially five. The watermark rises to cover the last Session within the first 50 that is running, has a running child, awaits the user, has an unread completion, or is open in the main view; a Session opened from search raises it to that Session at any position. The watermark is a row count that never falls on its own, so the rows stay visible after a run or notification ends; a reorder that moves a Session past the watermark hides it. Each **Show more** click raises it by five, without the 50-row limit, and reveals the rest when five or fewer remain; after the final batch, **Show less** resets it. Folding a Workspace resets its watermark and those of its nested Workspaces; a reset watermark still covers the qualifying Sessions. The selected blank **New Session** is an extra row outside the watermark until its first prompt. Watermarks are not persisted; any unmount of the grouped tree resets them.

History rows without a stored title use the localized unnamed label (未命名 / Untitled), rather than a directory name. The current blank row remains New Session; other blank rows remain hidden. Rename drafts use the stored title, or start empty when unnamed; unnamed rows do not offer title copying.

### Reordering and view options

Pinned Sessions lead ordinary Sessions in both grouped and flat views. **Last updated** sorts each partition strictly by the latest user prompt or steer time, newest first; pin time does not affect it. **Manual** uses the relative positions in one complete Session sequence, including hidden archives. Returning to Last updated discards the manual layout, and entering Manual again freezes the then-current chronological order. The browser defaults to Last updated and remembers the selected mode across reloads.

Pinning moves the Session to the front of its complete saved sequence without changing the selected mode. It leads the pinned partition in Manual but need not lead it in Last updated. Unpinning leaves the saved position unchanged. Dragging either a pinned or ordinary row edits that same complete sequence and selects Manual; hidden archived members are retained. Missing pinned members prepend in pin-array order. New ordinary forks precede their sources in the complete sequence without inheriting pin membership; visible pins still lead ordinary rows. Other missing members append by recency with missing archives last. Supplementation stays in memory until a Session-order write records the complete result. Archive filtering alone changes neither saved positions nor account membership.

The selected blank **New Session** retains its provisional first slot and cannot be dragged; after its first prompt it becomes an ordinary draggable row, retaining that position in Manual or following its current timestamp in Last updated. A collapsed-group drag uses the target Session identity and keeps the source visible. Session display orders for real Workspaces, Ungrouped, and the flat list are browser-local; Workspace group drag order remains Host-durable.

### Workspace hierarchy

Choose **Add workspace** and select a directory to register it and open a Session. **View options → Group by** defaults to **WorkSpace**, which lists Workspaces as sibling sections. Select **Workspace Tree** to nest each Workspace under its nearest registered ancestor, including Workspaces added later. Each Workspace keeps its own Sessions and row actions. Child Workspaces appear before the parent's own Sessions. Ancestors start expanded unless a saved collapsed state exists. A saved collapse also hides the current Session; ancestor folder icons stay highlighted when a descendant Workspace contains it. Row fills and hit targets span the same width at every level; only the contents indent. Workspace dragging reorders siblings; dropping on a descendant targets the nearest compatible ancestor, so an expanded parent can be moved past without collapsing it. Search-result navigation expands every ancestor. Grouping and expansion are saved in the current browser; switching modes preserves each Workspace's expansion preference, and the single-list view stays flat.

Hierarchy uses registered canonical paths only. It does not scan for projects or resolve symlink aliases. Nesting does not change Session working directories, logs, or Workspace membership. Deleting a parent Workspace leaves its child Workspaces registered and places them under their next registered ancestor, or at the root.

### Search

Collapsed search is one header action beside the view and add actions: activating it expands the field across the header. A non-blank query replaces either browsing mode with one flat result list — case-insensitive title and Workspace substring matches appear immediately, while a 250 ms debounced Host request adds ranked current-conversation content matches and snippets. Each new query aborts the preceding request; a failed content search leaves metadata matches visible without an additional warning. The list is capped at 20. Choosing an unarchived result clears and collapses search, opens the Session, and scrolls its row into view in the configured browsing mode; grouped browsing also expands its Workspace and the full Session list when required. Archived results offer Unarchive; attempting to open one explains that restriction without clearing the query or navigating.

### Managing sessions

The final built-in item in a Session row's "..." menu is Copy Session ID. It closes the menu and copies the complete ID directly, without opening a dialog. Clipboard success or failure appears in the global toast; a failed copy can be retried from the menu. Copying does not retain the Session, load its history, or call the Host.

The Session row's Rename action opens a dialog prefilled with the row's display title; confirming an unchanged title is deliberately allowed — it pins the current automatic title against regeneration. Double-clicking a title also opens Rename; for an unarchived Session, the preceding clicks open its conversation. Rename uses a temporary `workspaceOperation` reference and awaits its initial history opening. The row's Fork action reads ordinary cold history normally. When the Host reports that source migration is required, an app-wide Toast offers to open that Session; the action only navigates and does not retry fork. A successful fork uses the source's last completed turn and increments the inherited persisted title through Session Controller without retaining the child, opening its history, or changing selection. Workspace Delete opens a confirmation that states the retention boundary; success removes the group while its Sessions remain under Ungrouped. Pin, Rename, Fork, Archive, and Copy Session ID are themselves entries of the `sidebar.workspaces.session.menu.item` list (pin and archive also of `sidebar.workspaces.session.row.action`), so a client plugin's action takes whatever position its `order` gives it.

Archive commits without a confirmation dialog for a quiet Session and retains the Session's account position. A Session with running work is the one case that asks first: the Host refuses the plain archive and names that work, and the sidebar opens a stop-and-archive dialog listing it by family — the turn in progress, running subagents, background jobs, scheduled reminders, each with its labels — with the restore path stated; confirming asks the Host to stop the work the way the stop button does and archives once the archive set is durable, while the stops settle in the background, and cancelling leaves the Session running and visible. View options control visibility through one explicit three-way choice: Hide archived (the default) hides archived Sessions, All conversations (show archived) includes them, and Archived only hides ordinary Sessions and drops Workspaces without an archived Session; in tree grouping, children of a dropped Workspace nest under the nearest shown ancestor. Visible archived rows are grayed and carry an accessible explanation that they cannot be opened until restored; Rename, Fork, and Unarchive remain available. A successful archive shows a notice with an undo action and — while archived rows are hidden — a "filter archived sessions" action that switches the filter to All conversations (show archived); a stop-and-archive shows the same notice under its own wording, and undo restores the Session without resuming the stopped work. Unarchive removes the archive mark without restoring a pin or changing the saved position. An empty list shows a centered glyph-over-text placeholder; the Archived-only view names its own emptiness (No archived sessions yet) and adds a View other sessions text action that switches the filter back to Hide archived.

Session update times use the tertiary label color, including on archived rows. A Session title wider than its row is clipped with an ellipsis at rest. Hovering the row scrolls the title to its far edge — the incremented title of a fork, for example — and reveals it without the ellipsis; leaving the row returns the title to its start.

The keyboard reference exposes New Session, Search sessions, Add workspace, Rename session, Fork session, and Archive session. Desktop defaults use the platform's primary modifier, with Mod+K for search; Windows and macOS Web use the [shortcut service’s platform defaults](../shortcuts/README.md); Linux Web leaves these commands unbound until configured. Button tooltips and Session row menus display the effective bindings. Clicking a menu item targets that row; pressing its shortcut targets the main Session. Desktop and Windows/macOS Web rename use Mod+Alt+G, leaving Mod+Shift+R to browser reload. Rename requires a nonblank main Conversation with no modal obscuring it; a retained Session behind another main panel is unavailable. Other Windows and macOS Desktop bindings also execute from terminal input and modal dialogs; other environments follow the command's region and modal restrictions. Search and rename requests belong to this package; input drafts remain in the browser. The directory picker rejects another open while selection or Workspace adoption is pending. Fork captures the retained main-view Session, for which navigation has requested history opening, and keeps automatic migration. It uses the row action's Host operation to select its last completed turn, without loading older Client history. Missing or blank Sessions are unavailable; the Host rejects a source with no completed turn. A rejected shortcut fork preserves the current selection, displays a localized notification, and can be retried; unexpected failures also retain diagnostic logging. Its notification shares the frame-wide Workspace notice channel: only the latest notice remains visible, and removing the browsing region does not dismiss it.

### Pending interactions

Session rows render the runtime's live `pendingInteraction` classification: approvals report **Waiting for approval**, plan reviews report **Plan awaiting review**, and ordinary questions report **Waiting for answer**. While an interaction is pending, the row uses the shared warning dot and replaces its trailing update time with **Approval**, **Plan review**, or **Answer**; the full status and relative time remain in hover details. Pending interaction takes precedence over the shared ongoing loader; a finished-but-unviewed Session uses done, while idle remains dot-free in the row and uses the shared idle dot in its hover details. The leading seat renders only while the row's primary status is idle — no pending interaction, no own or descendant activity, and no unviewed completion — so an occupant there never appears beside the row's own status dot. An archived row keeps that cell blank: it shows neither a status dot nor the seat, and its live status appears on the hover card only.

### Active Schedule markers

Grouped and flat Session rows show a clock mark when the Session has active scheduled tasks. It is an occupant of the row's `sidebar.session.row.leading` seat, so it renders only on a row whose primary status is idle and never beside the row's own status dot; an archived row keeps that cell blank, and a search result has no leading seat and shows no mark. It is not a button, has no tab stop, and a press on its area does not open the row. The mark's own read and the meaning of its active-task condition belong to [ui-schedule](../ui-schedule/README.md).

-----

`ctx.uiWorkspace.openSession(target)` synchronously replaces the owned `mainView` reference and returns the main area to Conversation without waiting for `reference.ready`, so history loading renders inside the selected Session view. The target may be a known Session id or a durable direct-parent subagent address; an explicit address does not require a preloaded parent catalog. `openWorkspace(id, beforeOpen?, options?)` opens a Workspace blank only if no later navigation has superseded the request; an explicit New Session creates a fresh Session. `forkSession(id)` creates the child without navigating or superseding a pending navigation. The optional synchronous preparation callback runs after the target is retained and only for a current Workspace request, so superseded requests do not move composer drafts. Navigation or owner disposal suppresses the late UI commit, not the underlying Session creation. Startup restoration retains its main reference without changing the selected panel or cancelling a later navigation. Archiving the main Session releases its reference and clears the main selection. Selection failure leaves a global panel visible. Session rows read `usePanelInfo` to suppress their selected appearance while a global panel is active; search and directory-picker focus alone do not leave that panel.

Navigation and startup restoration obtain the selected Session's projections from its `follow`; neither issues a separate projection refresh for that Session or its parent, except that restoring a saved blank first reloads that Session's projections, because listed values are cached hints that can lag its log after an unclean Host exit.

Workspace reopening and explicit draft preparation name the first eligible blank in catalog order when they ask the Host for a Session; startup restoration names the saved blank. The Host reuses the named blank under the requested preset, or under its default when the request names none, and creates another Session when the blank has started, left the Workspace, or is held by another writer; navigation opens the returned Session without trying other blanks. `startSession` with draft options, `openWorkspace`, and `connectWorkspace` accept `{ agentPreset }` for a flow that knows its preset before it starts, such as the creator entry; a connection joins the latest in-flight connection to its Workspace only when both request the same preset, so the latest request always reaches the Host. Startup restoration passes the preset the saved blank's log recorded, so the draft keeps that preset; when the Host reports the preset as missing (`agent-preset/not-found`) or failing to activate (`agent-preset/invalid`), restoration asks again without a preset and the draft continues under the Host default. Other failures abort the request: an explicit New Session or hero Workspace pick shows the failure as a transient notice quoting the Host's code and message (for example a preset that fails to mount) or, for a failure that is not a Host refusal, that failure's own message; a request a later navigation or owner disposal superseded raises no notice, and startup restoration reports only to the console. Released blanks retain their slash-command state when reused. Later navigation cancels a pending startup selection.

Once both Workspace and Session startup baselines are ready, an empty installation calls `workspaces.initializeDefault` and creates or reuses its blank Session. The composer becomes editable when that Session is selected; no message is submitted automatically. Later navigation or owner disposal prevents startup from selecting its result. Ineligible first use leaves the folder picker available without an error. Default Workspace creation failure shows a transient notice directing the user to Choose workspace, and is not retried until the next startup. Session creation failures use the ordinary restoration error handling. The registered Workspace remains available if Session creation or later submission fails.

The first-use directory name and its stored title are fixed, so neither follows the reader's language: `workspaces.initializeDefault` carries no names, and one installation keeps one on-disk path and one stored title across language switches. A Workspace still carrying that automatic title is labeled with the localized default name wherever this package shows it — sidebar rows and their hover card, search result meta, the hero picker menu, and the rename and delete dialogs — through the controller's `workspaceDisplayTitle`. The rename dialog is seeded with the label on screen while the stored title decides whether confirming saves, so confirming the untouched prefill on such a Workspace pins that name and the row stops following the language; the duplicate-title check excludes the target by Workspace identity rather than by title.

The package injects the Client `remoteAccess` service and provides the root standard Hook `useWorkspaceAccess(workspaceId, action)`, which answers whether the current Peer may call `action` on one Workspace resource; its snapshot semantics belong to [`dsh-api-remote-access`](../../api/remote-access/README.md#client-face).

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The package is one composition: both target slots are declared by other plugins, so `apply` uses `slots.inject()` to register for each declaration lifetime and re-register after a declaring slot is restored.

The browser entry also declares two root-scoped `list` child seats on each Session row: `sidebar.session.row.leading`, rendered only while that row's primary status is idle and left blank on an archived row, and `sidebar.session.row.hover`, mounted only while that row's hover card is open. Both take the row's Session identity and nothing else, so an occupant reads its own data by that id; a Session-scoped seat would force a Session binding, which would activate and retain every listed Session.

Client callers can pass `prompt` and `clearPreviousDraft` in the second argument to `uiWorkspace.startSession`. A prompt is plain text; structured drafts are handled internally during restoration and Workspace transfer. Without clearing, existing text or attachments are preserved; explicit clearing replaces only the target Session's text and inline references, leaving attachments intact. Option values are captured before asynchronous creation and applied to the exact retained binding before navigation commits. Superseded navigation does not write content; a submission-blocked input refuses preparation and keeps the previous selection. Calls without options create a fresh Session using the current Agent preset definition. Workspace reconnection and explicit draft preparation may reuse an existing blank Session. The [draft initialization decision](../../../.agents/notes/implemented/architecture/2026-09-30-structured-draft-initialization.md) describes the input owner's data flow.

### The directory-flow hole

Project Center creation requests always open this package's existing project form, even when the directory-flow surface is missing or loading. The form shows an explicit availability message and disables create, location selection and import until the surface returns; recovery retains the draft. A missing surface cannot issue directory or Workspace writes. The sidebar's own unavailable add action remains hidden.

Each registration declares a **directory-flow child hole** (`single` kind: `conversation.hero.workspace.directoryFlow` / `sidebar.workspaces.directoryFlow`) that the composed picker package's client half fills with its picking interaction — the `-native` backend's renderless OS-chooser driver, an in-app browsing dialog under a `-browse` composition. The flat **Add workspace...** action renders only while the surface's hole is occupied; an empty hole means the composition has no picking affordance. This package owns the trigger and the adoption: the occupant reports one picked path per open through the hole's owner conversation (`open`/`busy`/`onPicked`/`onCancel`/`onError`), and the owner adopts it through the object layer, selecting the committed Workspace only after its list projection has refreshed.

### View state

Once the Workspace baseline is ready, browser-persisted expansion and Session-order records retain only current Workspace ids plus Ungrouped and the flat-list account. `WorkspaceView.sessionIds` supplies real-Workspace membership, not Session display order. View actions receive complete account orders, never filtered rows. A new member without a Session summary waits for that summary, while a saved position survives a temporarily missing summary. Archive visibility is applied only when deriving rows. Pin and drag writes save complete orders; ordinary derivation does not write them. The selected blank Session remains an explicit position write, including during Workspace reconnection, when other saved members are retained until the baseline establishes membership. Ordering remains mounted while the sidebar is a rail or search replaces its body. Last updated derives from current summaries without reading saved positions; equal timestamps use Session ids as a stable tie-break.

The sidebar hides durable summaries with `origin: 'subagent'`. A visible ordinary row shows the shared ongoing loader from running direct children in its loaded parent catalog, never from summary lineage. Child activity uses the latest UI status, falling back to the Session summary until that status is known.

Row motion belongs to [AnimatedRows](src/client/rows/AnimatedRows.tsx). It measures keyed rows before and after React commits that change their membership or order, and uses native movement and opacity animations. Removed rows fade as inert copies outside the scrolling list; they do not delay React unmounting or extend its scroll range. Initial loading, drag commits, overflow expansion, and view-option changes settle immediately. The animator has no layout observers or polling and does not measure content-only updates or scrolling.

### Hover cards

Workspace and Session hover cards copy the value their row clips: activating a Workspace card writes its full directory path, while activating a non-blank Session card writes its full display title. A provisional blank New Session card remains read-only because its localized label is a placeholder rather than session content. A Session card also renders its `sidebar.session.row.hover` seat between the relative time and the trailing status lines whenever the card is open, independent of the row's own state. The first Workspace or Session card in a physical list waits 800ms; after a card is displayed, moving to another Workspace or Session in the same list replaces it immediately. The list and its active portaled card form one pointer interaction: entering the card to read or copy preserves immediate handoff to a neighboring Workspace or Session. After the pointer leaves both, the shared dwell resets when the active card closes through its existing pointer-grace and close lifecycle, with no separate group timer. Leaving a list with no active card resets the dwell immediately. Small action tooltips coexist with the right-side hover card; pin, archive, Workspace new-session, and search-result unarchive tooltips use portals to stay above it. Hovering actions, including More, preserves the card; opening the More menu or starting a Session drag dismisses it.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

These pages cover the sidebar host, the hero surface, and the picking backends.

- [ui-sidebar](../ui-sidebar/README.md) — the sidebar shell hosting the `sidebar.workspaces` hole.
- [ui-conversation](../ui-conversation/README.md) — the chat surface hosting the Session Intent hero's picker hole.
- [directory-picker-native](../../host/directory-picker-native/README.md) — the OS-chooser backend filling the directory-flow hole.
- [Workspace Controller](../../api/workspace-controller/README.md) — the Host mutations and framework-neutral Client projection that own Workspaces, membership, and Workspace group order.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side UI plugin layer that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define the search depth, the archive surface, and the picking carrier; they are current package constraints.

- **No fuzzy content search or event deep links** — the content backend uses literal token/phrase matching, and selecting a result opens the Session rather than the matching event.
- **No Session deletion** — sessions can be archived but never deleted; archived rows stay recoverable in place through the archived view filter and the search results' unarchive action, and Workspace registration deletion does not delete Sessions.
- **Pending user interaction is not aggregated into collapsed groups** — a waiting row inside a collapsed group lights no group-header indicator and becomes visible only after that group is expanded.
- **Native folder selection depends on the local Host carrier** — under the `-native` composition, in-process or remote browser deployments cannot open a local operating-system dialog; remote-capable picking is the `-browse` composition's in-app flow.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
