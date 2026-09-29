# Problem 9 — usability improvements

The student chose two frontend improvements (F1 and F3) and two agent/backend improvements (B1 and B2). These are implemented in the Campus Customs storefront and tested against the supplied SQLite catalogue and inventory. The previously approved `backend/prompts/prompt.md` was not changed.

## Frontend improvement 1 (F1): product search and filters

**Shopper benefit.** The Products page no longer requires scrolling through all 102 cards to find an item. Shoppers can search product names, descriptions, garment types, tags, or listed colors, narrow the result to an exact catalogue garment type, and set a maximum price. The page shows the matching count, an empty-results explanation, and a one-click reset. The filters use the products loaded from the shop API, so card names, prices, images, and links remain database-backed. Searching for the plural “hoodies” also matches “hoodie.” This filters listed product colors, not color-specific inventory.

**Verification.** In the browser, the unfiltered page showed 102 of 102 products. Searching “hoodies” showed 27 matches; adding a $50 maximum left two $45 hooded items. Searching “astronaut” showed zero matches and the empty-state action; “Show all products” restored the full 102. The frontend production build passed.

## Frontend improvement 2 (F3): chat scrolling and retry

**Shopper benefit.** The chat message area scrolls to the latest reply or product cards as the conversation grows. If a request fails, the widget keeps the shopper's message visible, shows a readable error with Retry and Dismiss actions, and does not add a fake assistant reply. Retry resends the failed message without duplicating its user bubble. While a retry decision is pending, the input is disabled to keep message order clear.

**Verification.** The backend was stopped while the browser sent a test chat message. The widget showed “Message not delivered: The chat is unavailable right now,” with Retry and Dismiss; the input was disabled. After restarting the backend, Retry produced a successful answer and product cards, with the original shopper bubble appearing once. A longer conversation with several cards visibly scrolled to the newest cards. The frontend production build passed.

## Agent/backend improvement 1 (B1): budget-and-size product finding

**Shopper benefit.** `find_products_by_budget_and_size` is a read-only SQLite tool that combines a keyword/category, maximum price, and positively stocked size. It returns real product IDs, prices, and size quantities. For common explicit requests such as “Find hoodies under 50 dollars with size M in stock,” the backend uses this verified filter directly to make the answer and structured product cards reliable; less explicit conversation still goes to the PydanticAI agent. “Under” is treated as strictly less than the amount, while “up to” is inclusive. A listed color is never treated as proof of color-and-size stock.

**Verification.** Direct tool queries for hoodies under $70 in M returned only rows with price below $70 and M quantity greater than zero. A live `POST /api/chat` request for hoodies under $50 in M returned two $45 catalogue cards with correct product links and images: Ua Gameday Double Knit Hood and Yale Sports Hoodie Tennis. The same request under $30 returned no cards and a useful no-match message. The browser displayed both $45 cards.

## Agent/backend improvement 2 (B2): in-stock alternatives

**Shopper benefit.** `find_in_stock_alternatives` checks the requested product's exact size first. When that size has zero recorded units, it finds other products of the same database garment type with positive stock for that size and sorts them by price closeness. A product whose requested size is already in stock, or whose size is not listed, is not falsely labeled sold out. The agent can use the results to suggest alternatives with structured cards while making no color-specific availability claim.

**Verification.** The Baseball Left Chest Crewneck has zero XS units; a direct tool check returned same-type crewnecks with positive XS quantities. The Basic Hoodie Big Yale has five M units and returned no sold-out alternatives. A live product-page `POST /api/chat` request about the baseball crewneck's XS returned six real alternative cards, prices from SQLite, and a reply that explicitly separated size stock from color-and-size availability. The original structured-card chat and ordinary text chat continued to work.
