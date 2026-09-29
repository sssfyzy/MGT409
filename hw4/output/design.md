# Problem 10 — Campus Customs design

## Design direction

Campus Customs uses an editorial campus-shop direction: familiar collegiate navy and an inviting serif headline, balanced by clean, easy-to-scan product information. The aim is to make the storefront feel like an apparel shop while keeping shopping facts clear. The spacious navy-and-ivory composition is also consistent with the project workspace's FinCanvas-inspired visual direction, without copying that site's content.

## Decisions and reasons

| Area | Implemented decision | Why it helps |
| --- | --- | --- |
| Typography | Keep Playfair Display for major headlines and DM Sans for navigation, prices, body copy, forms, and chat. Use a consistent hierarchy of large page titles, smaller product names, and compact category labels. | Gives the shop a collegiate editorial voice without sacrificing legibility for factual product information. |
| Color | Define navy `#0B315E`, ink `#17304B`, warm ivory `#FCFAF6`, gold `#C99C54`, and a light border token. Use gold sparingly for accents and active states. | Keeps the brand recognizable while letting product images and prices receive attention. |
| Home hierarchy | Replace the decorative letter-Y hero artwork with the actual Basic Hoodie Big Yale catalogue photo, linked to its detail page. Put the main collection action beside it and a short product name/price caption over the image. Keep a fallback graphic when products cannot load. | A visitor immediately sees a real item sold by the shop and has two clear paths: browse the collection or inspect the featured product. The featured name, image, price, and link come from the product API. |
| Product cards | Keep a consistent square image area and make the card body a vertical layout: garment type, name, price, short description, then a bottom-aligned detail action. Refine spacing and subtle hover/focus feedback. | Product names and prices appear in predictable places even when descriptions differ in length. Whole cards remain clickable. |
| Product detail | Arrange recorded sizes in a deliberate three-column grid, distinguish stocked and sold-out states, and display the size-only inventory limitation in a highlighted note. | Makes size information easy to scan while preventing a listed color from being mistaken for verified color-and-size stock. |
| Responsive layout | Use the existing two-column desktop hero and four-column catalogue; on narrower screens, stack the hero, wrap the visible navigation and filter controls, reduce the product grid to two columns, and stack product-detail image and copy. Do not add a hamburger-menu feature. | Keeps essential actions visible and touchable across widths without changing the selected Problem 9 feature scope. |
| Motion | Use short entrance fades for the hero, small card/image hover transitions, and a short chat-panel entrance. Disable these effects for `prefers-reduced-motion: reduce`. | Adds polish without making shopping slower or forcing animation on motion-sensitive visitors. |
| Chat | Widen the desktop panel, give it more height for message and product-card history, and use nearly the available viewport on narrow screens. Keep the same chat API, memory, product cards, and retry behavior. | More conversation and recommendations remain readable without changing chatbot facts or account behavior. |

## Verification

- The TypeScript/Vite production build completed successfully after the redesign.
- The shop API still returned 102 catalogue products. No database, authentication, agent, or system-prompt files were changed for this problem.
- In a wide browser preview, the home hero showed the real hoodie image and caption; clicking it opened the matching Basic Hoodie Big Yale detail page. The product listing showed four aligned card columns, and the chat panel opened at its larger size.
- In a narrow browser preview at the mobile layout breakpoint, the home hero stacked vertically, navigation remained visible, the filters wrapped, product cards formed two columns, and the detail page stacked the image above the product information. The highlighted inventory limitation remained readable.
- The three-column size grid was checked in the wide detail preview. The available browser preview did not expose a precise 375-pixel device preset, so the smallest phone breakpoint was checked from its CSS rules rather than claimed as a separate device screenshot.

The site does not imply that a shopper can buy an item directly, and it does not infer color-specific stock from the database's product-and-size quantities.
