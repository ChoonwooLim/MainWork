# /project-start-web

Full-stack web project initialization (FastAPI + React + Vite). Run after `/init`.

## Prerequisites
- Python 3.12+ installed
- Node.js 20+ installed
- PostgreSQL accessible (local or Orbitron)

## Steps

1. **Verify project structure**
   - Confirm `backend/` exists (same as api-only)
   - Confirm `frontend/` exists with package.json, vite.config.js, src/App.jsx
   - Confirm `Dockerfile` is multi-stage (Node build + Python serve)
   - Confirm docs/ are present

2. **Configure backend environment**
   - Same as /project-start-api steps 2-5

3. **Install frontend dependencies**
   ```bash
   cd frontend && npm install
   ```

4. **Test frontend build**
   ```bash
   cd frontend && npm run build
   ```

5. **Start both servers and verify**
   - Backend: `cd backend && uvicorn main:app --reload` (port 8000)
   - Frontend: `cd frontend && npm run dev` (port 5173)
   - Verify frontend loads in browser
   - Verify API proxy works (/api/* routes to backend)
   - Stop both servers

6. **Apply design template (if selected)**
   - If a design template was specified during creation, customize:
     - Update page titles and headings with project name
     - Adjust color scheme if needed
     - Add project-specific content placeholders

7. **Update CLAUDE.md**
   - Add full-stack conventions
   - Add frontend component structure guide
   - Add API + frontend routing documentation
   - Add deployment instructions (multi-stage Docker)

8. **Commit and push**
   ```bash
   git add -A
   git commit -m "feat: full-stack web project initialization via /project-start-web"
   git push origin main
   ```

9. **Report**
   - Backend: http://localhost:8000
   - Frontend: http://localhost:5173
   - Design template applied (if any)
   - Suggest next steps: customize design, add features, deploy to Orbitron
