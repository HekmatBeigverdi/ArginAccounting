# GitHub Publishing Workflow

This is the permanent publishing policy for every ArginAccounting phase and maintenance task.

## Known User Environment

- The repository owner uses macOS and has GitHub CLI installed.
- `gh auth status` has already confirmed the active `HekmatBeigverdi` account.
- The token has the `repo` and `workflow` scopes required by the project.
- Do not repeatedly ask the repository owner to reinstall `gh`, authenticate again, or diagnose their Mac merely because an agent runtime lacks `gh` or Git credentials.

## Agent Publishing Order

1. Confirm the intended branch, commit scope, working-tree status, and validation evidence.
2. Try the authenticated GitHub connector available to the agent runtime.
3. If direct Git transport is authenticated in the agent runtime, a fast-forward `git push` is acceptable.
4. If direct Git transport lacks credentials, publish the validated commit through the GitHub Git Data API/connector by creating blobs, a tree, commits, and a non-forced branch-ref update.
5. Verify the remote branch head and report the remote commit identifiers.
6. Never create a PR, merge branches, force-push, or publish another branch unless that action is explicitly in scope.

## Failure Ownership

Missing `gh`, a missing credential helper, or an unauthenticated HTTPS remote inside an isolated agent runtime is an agent-environment limitation. It is not evidence of a problem on the repository owner's Mac.

Manual Mac commands are a last-resort recovery path only after the connected GitHub write path is unavailable or rejects the requested operation. When manual action is genuinely required, state the exact external blocker and provide the smallest safe command set.

## Phase Checkpoint

Before closing every implementation step:

- reread this workflow;
- confirm the commit contains only the current step;
- publish it to the current `phase/*` branch when authorized;
- verify that the remote branch contains the expected content;
- provide pull and offline-validation commands without asking for redundant authentication checks.
