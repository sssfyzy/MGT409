# HW4 AI Prompt Log

## Problem 1: Vibe coder prompts

### Initial prompt

> For Problem 1, help me set up a running record of the prompts I give you while working on HW4. I want one section for each problem, with its number and title.  Record my actual requests and any follow-up requests, along with a brief note about what the first attempt was missing.

### Follow-up prompt

None yet.

## Problem 2: Analyze the database

### Initial prompt

> For Problem 2, please extract the data zip I placed in Homework4 and inspect the actual SQLite database. Help me understand the tables, especially catalogue, inventory, and users. Create output/harness.md with each table’s fields and a short explanation of how each field is useful to the shop or chatbot. Base the descriptions on what is really in the database, and point out anything whose meaning is unclear. Start the file output/harness.md

### Follow-up prompt

> One finding to keep in mind for later development: inventory is tracked by product and size, not by color, so the product's color list alone cannot confirm that a particular color and size combination is in stock. This is useful; add it to the record. Next time, give me a draft directly.

What the first pass lacked: this limitation was in the database explanation, but I wanted it called out clearly as a note for later development.

## Problem 3: Build the Campus Customs website

### Initial prompt

> For Problem 3, build the first working Campus Customs storefront using React, Vite, and TypeScript. Add navigation for Home, Products, About Us, Log in, and Create account. Write original Home and About Us text inspired by the Campus Customs website. Show products from the supplied database with their images, names, prices, and short descriptions. Make each product card open a detail page with a larger image, full description, price, and available size stock. Add a chat panel in the bottom right; it can be a placeholder for now. If the frontend needs an API to read products and images, add a small FastAPI backend. Please check that the pages, product links, images, and data work.

### Follow-up prompt

None yet.

## Problem 4: Create account and login

### Initial prompt

> For Problem 4, make the Create account and Log in pages work. Registration should ask for first name, last name, email, and password, with password confirmation if helpful. Save new users in the existing users table, and protect passwords with a secure hash rather than storing them in plain text. Let users log in with their email and password, and show when they are signed in. Verify the flow with the test account provided in the assignment and with a newly created account. Update output/harness.md to explain what user information is stored and how password protection works.

### Follow-up prompt

None yet.

## Problem 5: PydanticAI agent backend

### Initial prompt

> For Problem 5, connect the storefront chat widget to a PydanticAI agent through the FastAPI backend. Keep the API in backend/main.py and organize the agent into backend/agent.py, backend/tools.py, backend/models.py, and backend/prompts/prompt.md. Use an API key from my local environment, never hard-code it. The chat should send a shopper’s message to the backend and display the agent’s reply. Please show me a draft of the Campus Customs system prompt, including its voice and basic safety rules, and wait for my approval before writing prompt.md. Update output/harness.md to explain the frontend-to-backend chat flow and how the prompt and model are loaded. Verify that the backend starts from the backend folder and that a chat message receives a response.

### Follow-up prompt

> Approved the proposed Campus Customs system prompt for `backend/prompts/prompt.md`.

## Problem 6: Product and inventory tools

### Initial prompt

> For Problem 6, add read-only PydanticAI tools that query the supplied SQLite database for real product information. The agent should be able to find products and answer questions about their descriptions, prices, available sizes, and stock quantities. Update the system prompt so it uses these tools for product facts and says clearly when a detail cannot be verified. In particular, inventory is tracked by product and size, not by color, so the chatbot must not claim that a specific color-and-size combination is available. Update `output/harness.md` to explain the tools and test the chat with product, price, and inventory questions, including an out-of-stock or uncertain case.

### Follow-up prompt

None yet.

### First-attempt note

In a live color-and-size test, the first agent reply opened with a misleading "Yes" before stating that combination stock could not be confirmed. The system prompt was tightened, and the retest began with the limitation instead.

## Problem 7: Structured chat product cards

### Initial prompt

> For Problem 7, make product recommendations in the chatbot structured so the storefront can display them as product cards. When a shopper asks a question such as “What hoodies do you have?”, return a conversational reply plus a list of matching products sourced from the SQLite catalogue. Include the product IDs and the fields the frontend needs for each card, such as name, price, image, and short description. Render those cards dynamically in the chat panel, and make each card open the correct product detail page. Keep ordinary text-only chat working. Update `output/harness.md` to explain the response format and frontend behavior, then test the hoodie question, card images, links, and a message with no product matches.

### Follow-up prompt

> Approved the proposed Problem 7 addition to `backend/prompts/prompt.md`.

### First-attempt note

The initial implementation and provisional tests worked, but the proposed change to `backend/prompts/prompt.md` was removed because this request did not explicitly approve editing that student-owned prompt. The student then approved the addition, allowing final live verification.

## Problem 8: Customer memory and page context

### Initial prompt

> For Problem 8, add customer memory and page context to the Campus Customs chatbot. For signed-in shoppers, save user and assistant messages in the existing `chat_messages` table, restore their conversation when they return, and give the agent relevant recent history plus the shopper’s name and email. Use the authenticated session to identify the user; do not trust a user ID sent by the browser. Pass the current page and, on a product detail page, the current product ID so a question like “Do you have this in pink?” refers to the right product. Keep guest chat usable without account-linked memory, preserve structured product cards, and never infer color-specific stock from size-only inventory. Update `output/harness.md` and test saving, reloading, product-page context, and separation between users.

### Follow-up prompt

> Use this as the prompt.

## Problem 9: Usability improvements

### Initial prompt

> For Problem 9, review the current Campus Customs storefront and chatbot. Propose several concrete options for frontend usability improvements and agent/backend improvements. For each option, briefly explain the shopper benefit and how we could test it. Do not implement anything or write `output/usability.md` yet. I will choose exactly two frontend improvements and two agent/backend improvements. After I confirm my four choices, implement and verify them, then document them in `output/usability.md`.

### Follow-up prompts

> Can't I have all of them?

> Oh, then let's follow the assignment requirements. For the frontend, I want F1 and F3; for the backend, I want B1 and B2.

### First-attempt note

The first set of options did not make clear whether more than four improvements could be selected. After asking about that, I chose the required two frontend and two agent/backend improvements.

## Problem 10: Website design

### Initial prompt

> For Problem 10, review the current Campus Customs storefront against the assignment’s design requirements. Propose a coherent design direction for the typography, colors, visual hierarchy, product presentation, responsive layout, motion, and chat experience. Explain the specific changes and why they would make the shop feel more polished and usable. Show me the proposal first and wait for my approval before changing the design or writing `output/design.md`. After I approve it, implement the changes, check the desktop and mobile layouts, and document the design decisions in `output/design.md`.

### Follow-up prompt

> Approved the proposed Problem 10 design direction.

### First-attempt note

None. I approved the proposed design direction without requesting a revision.

## Problem 11: Real-browser app check

### Initial prompt

> For Problem 11, prepare a real-browser test plan for the three required demonstrations: the chatbot answering a stock question using database facts, a chatbot search that displays dynamic product cards, and one Problem 9 usability improvement. Let me choose whether the third demonstration uses F1 product filtering or F3 chat retry before taking screenshots. After I confirm, run the tests, capture clear screenshots, and create `output/app_check.html` explaining what each screenshot proves. Do not fabricate test results or screenshots.

### Follow-up prompt

> F1

### First-attempt note

The initial test plan intentionally left the third demonstration undecided. I selected F1 product filtering before any browser tests or screenshots were taken.

## Problem 12: Audit trail, safety, and final harness

### Initial prompt

> What about Problems 12 and 13? Continue working on them.

### Follow-up prompt

> You misunderstood: Problem 12 is a project summary, an audit trail, safety rules, and the harness. Please implement it now.

### First-attempt note

The first response unnecessarily stopped to request another description of Problem 12. I clarified the work in my own words and asked for implementation.

## Problem 13: GitHub submission

### Initial prompt

> What about Problems 12 and 13? Continue working on them.

### Follow-up prompts

> Can I make the repository private? What if someone copies my homework?

> I will keep it private for now, then make it public just before submitting. Someone could still copy it on the last day, but I cannot prevent that.

> https://github.com/sssfyzy/MGT409.git

> What is the final submission format for this homework?

> Does everything in the GitHub repository now meet the assignment requirements? Do I only need to make it public and submit the link?

> Approved.

### First-attempt note

The first pass prepared the submission files locally but had not uploaded them or recorded my private-until-submission choice and repository URL. The `hw4/` folder has since been pushed to the specified GitHub repository. The repository remains private until I make it public before submitting its URL on Canvas; the Canvas submission has not been made.
