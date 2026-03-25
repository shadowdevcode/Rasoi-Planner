# QA Edge Case Matrix

| ID | Priority | Area | Edge case | Expected result |
|---|---|---|---|---|
| Q-01 | P0 | Owner flow | Owner signs in with the matching household owner UID. | Owner dashboard loads with settings, meals, grocery, and pantry access. |
| Q-02 | P0 | Cook flow | Cook signs in with the invited household email. | Cook dashboard loads with the cook workspace and pantry check tools. |
| Q-03 | P0 | Access control | Cook signs in after access is removed by the owner. | Access removed screen appears and the cook cannot continue. |
| Q-04 | P1 | Owner flow | Owner changes the cook invite email casing before saving. | Email is normalized to lowercase and persisted consistently. |
| Q-05 | P1 | Multilingual labels | Owner language is switched to Hindi. | Owner-facing labels update to Hindi copy. |
| Q-06 | P1 | Multilingual labels | Cook language is switched to English. | Cook-facing labels update to English copy. |
| Q-07 | P0 | Inventory transition | In-stock item is marked low by the owner. | Pantry item updates, and a matching activity log entry is written. |
| Q-08 | P0 | Inventory transition | In-stock item is marked out within the anomaly window. | Verification warning appears with a clear anomaly reason. |
| Q-09 | P0 | Inventory transition | Low or out item gets a note from the cook. | Requested quantity persists and renders on reopen. |
| Q-10 | P1 | Inventory transition | Owner clears a verification warning after review. | Warning text disappears while item status stays unchanged. |
| Q-11 | P1 | Inventory transition | Owner adds a new pantry item with a custom quantity. | Item is saved with normalized category and default quantity. |
| Q-12 | P1 | Search behavior | Pantry search uses the English alias `ration`. | Staples items match and remain visible. |
| Q-13 | P1 | Search behavior | Pantry search uses the Hindi label `मुख्य`. | Staples items match through localized category copy. |
| Q-14 | P0 | AI parsing | AI returns a valid response with multiple updates and one unlisted item. | All valid updates apply and the unlisted item is created. |
| Q-15 | P0 | AI parsing | AI response sets `understood` to a non-boolean value. | Parsing fails safely with no writes. |
| Q-16 | P0 | AI parsing | AI response has malformed arrays or invalid item shapes. | Parsing fails safely and the cook view stays usable. |
| Q-17 | P1 | AI parsing | AI response contains one valid update and one unknown item. | Valid updates apply and the partial-match warning appears. |
| Q-18 | P1 | AI parsing | AI response includes a quantity like `2kg`. | Requested quantity is preserved on the inventory item and note display. |
| Q-19 | P1 | Multilingual labels | Pantry labels are viewed in English and Hindi for the same category. | English and Hindi names stay aligned for the same pantry category. |
| Q-20 | P1 | Multilingual labels | Cook helper text switches with the selected language. | Assistant hints and button labels match the current language. |
| Q-21 | P0 | Activity logs | Every successful pantry status change writes a log entry. | Logs tab shows the new entry immediately after the change. |
| Q-22 | P0 | Activity logs | Log entry is created for the correct actor and item. | Role, item name, and status text match the write that occurred. |
| Q-23 | P1 | Activity logs | Multiple updates happen in sequence. | Logs are ordered newest-first and no entry is lost. |
| Q-24 | P1 | Activity logs | No pantry writes have occurred yet. | Empty-state copy is shown instead of stale or partial logs. |
| Q-25 | P1 | Future ingredient additions | Owner adds a new pantry item that is not in the ingredient catalog yet, such as `Curry Leaves`. | The item saves successfully with a category fallback icon and no dependency on catalog metadata. |
| Q-26 | P1 | Future ingredient additions | Owner adds a new pantry item with punctuation and casing variation, such as `Red Chilli Powder (Kashmiri)`. | The item name is preserved, the category is normalized, and the best matching visual path is still selected. |
| Q-27 | P1 | Future ingredient additions | Cook submits an unlisted ingredient request for a future inventory item. | The new item is created, stays readable on reopen, and keeps the requested quantity intact. |
| Q-28 | P1 | Bilingual naming recognition | Ingredient matching is attempted with English and Hindi aliases for the same item, such as `Cumin Seeds` and `जीरा`. | Search and visual resolution land on the same pantry item instead of creating a duplicate. |
| Q-29 | P1 | Bilingual naming recognition | Ingredient matching is attempted with Hindi first and an English alias, such as `नमक` and `Salt`. | The same pantry item is recognized correctly in both directions. |
| Q-30 | P1 | Bilingual naming recognition | Pantry search uses a mixed-language query like `atta आटा` or `sabzi सब्ज़ियाँ`. | The expected item or category stays visible and unrelated rows remain hidden. |
| Q-31 | P2 | Responsive behavior | Owner workspace is viewed on a narrow mobile viewport. | The tab row stacks cleanly, labels stay readable, and horizontal overflow does not block section switching. |
| Q-32 | P2 | Responsive behavior | Pantry add form is viewed on a small screen while typing a long ingredient name. | The inputs stack vertically and the add button remains fully usable without clipping. |
| Q-33 | P2 | Owner tab keyboard interactions | Keyboard user tabs to the owner tablist and activates Grocery or Pantry with Enter or Space. | The selected tab changes without a mouse and the visible panel updates immediately. |
| Q-34 | P2 | Owner tab keyboard interactions | Keyboard user navigates the stacked owner tabs on a narrow screen. | Focus remains visible, the active tab state stays clear, and wrapped labels do not trap keyboard navigation. |
