---
name: Listing visibility
description: RentFaster Ghana's rule for which rental homes may appear in the frontend.
---

Public rental pages must display only database-backed listings with status `approved`. Do not add hardcoded sample homes or fallback listing arrays; when the database returns no listings, render an empty state.

**Why:** The user explicitly asked that only real, newly approved homes appear and that demo listings never be shown.

**How to apply:** Use the existing API/database responses for homepage, search, and listing details; an empty response should remain empty rather than triggering example data.
