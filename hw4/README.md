# Campus Customs storefront and shopping chatbot

MGT 409 Homework 4. The storefront uses React, Vite, and TypeScript; the API uses FastAPI and SQLite; the shopping chatbot uses PydanticAI. Product recommendations are returned as structured cards. Signed-in shoppers can return to their saved conversations.

## Required local data

The course data pack is intentionally **not** in this repository. Place it beside `backend/` and `frontend/` with this layout before running the app:

```text
data/
  campus_customs.db
  products/
    ...product image files...
```

The database contains the catalogue, inventory, users, and chat history. Inventory is recorded by product and size, not by color-and-size combination. Do not infer that a listed color is in stock in a particular size.

## Backend

Use Python 3.12 or a compatible recent Python version. From the project root, create a virtual environment and install the root requirements file:

```text
python -m venv .venv
python -m pip install -r requirements.txt
```

Activate the environment using your operating system's usual virtual-environment command. Set either `OPENAI_API_KEY` or `PORTKEY_API_KEY` in your **local environment**, never in committed code. `.env.example` lists placeholder names; the current app reads environment variables directly and does not automatically load a `.env` file. `CAMPUS_CUSTOMS_MODEL` can override the default model. If using Portkey, `PORTKEY_VIRTUAL_KEY`, `PORTKEY_PROVIDER`, and `PORTKEY_BASE_URL` are optional configuration variables.

Start the API from the `backend/` folder:

```text
cd backend
uvicorn main:app --reload --port 8000
```

The shop API is available at `http://127.0.0.1:8000/api/products`. The backend requires the local data pack even if you only want to browse products.

## Frontend

Use a Node.js version compatible with Vite 7 and pnpm. In a second terminal:

```text
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL reported by Vite (normally `http://127.0.0.1:5173`). Vite proxies `/api` and `/media` to the backend on port 8000. For a production build, run `pnpm build` from `frontend/`.

## Project files

- `backend/main.py`: FastAPI routes for products, images, accounts, and chat.
- `backend/agent.py`, `tools.py`, `models.py`, `audit.py`, `prompts/prompt.md`: PydanticAI agent, database tools, structured response models, append-only activity logging, and the student-approved system prompt.
- `frontend/src/`: storefront pages, authentication UI, product filters, and chat widget.
- `output/harness.md`: architecture, database fields, behavior, and verification notes.
- `output/design.md` and `output/usability.md`: design and Problem 9 choices.
- `output/app_check.html` and `output/app_check_images/`: real-browser Problem 11 test evidence.
- `output/audit_trail.json`: append-only agent activity records for Problem 12.
- `AI_prompts.md`: the student's prompts and follow-up requests, recorded by problem.

## Publishing safety

The `.gitignore` excludes local credentials, the supplied database and product images, the original data zip, installed dependencies, and build artifacts. The included `.env.example` contains placeholders only. Check the files to be committed before publishing a public repository, then submit its URL on Canvas; do not submit a zip.
