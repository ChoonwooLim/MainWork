# /project-start-api

API project initialization (FastAPI + JWT + PostgreSQL). Run after `/init`.

## Prerequisites
- Python 3.12+ installed
- PostgreSQL accessible (local or Orbitron)

## Steps

1. **Verify project structure**
   - Confirm `backend/` directory exists with main.py, database.py, deps.py, models/, routers/, services/
   - Confirm `backend/.env.example` exists
   - Confirm `Dockerfile` exists at project root
   - Confirm docs/ are present

2. **Configure environment**
   - Create `backend/.env` from `.env.example`
   - Ask user for database name (default: project name lowercase)
   - Set DATABASE_URL with the chosen database name
   - Generate a random SECRET_KEY
   - Set SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD (ask user or use defaults)

3. **Install dependencies**
   ```bash
   cd backend && pip install -r requirements.txt
   ```

4. **Test the backend**
   ```bash
   cd backend && python -c "from main import app; print('FastAPI app OK')"
   ```

5. **Start the server and verify**
   ```bash
   cd backend && uvicorn main:app --reload
   ```
   - Verify /health returns 200
   - Verify /api/auth/login works with superadmin credentials
   - Stop the server

6. **Update CLAUDE.md**
   - Add backend-specific conventions
   - Add API endpoint documentation section
   - Add database migration notes

7. **Commit and push**
   ```bash
   git add -A
   git commit -m "feat: API project initialization via /project-start-api"
   git push origin main
   ```

8. **Report**
   - Backend URL: http://localhost:8000
   - Health check: /health
   - Auth endpoints: /api/auth/login, /api/auth/register, /api/auth/me
   - Superadmin credentials
   - Suggest next steps: add more routers, set up Orbitron deployment
