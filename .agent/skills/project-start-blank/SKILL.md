# /project-start-blank

Blank project initialization. Run this after `/init` in a new blank project.

## Steps

1. **Verify project structure**
   - Confirm `docs/` directory exists with work-log.md, bugfix-log.md, upgrade-log.md, dev-plan.md
   - Confirm `.gitignore` and `CLAUDE.md` exist
   - Confirm git is initialized on `main` branch

2. **Update docs/dev-plan.md**
   - Ask the user what this project will do
   - Fill in the Vision section
   - Add initial milestones based on the user's description

3. **Set up development environment**
   - Ask the user what language/framework they want to use
   - Create appropriate config files (package.json, requirements.txt, go.mod, etc.)
   - Install dependencies if applicable

4. **Initial commit**
   - Stage all new files
   - Commit with message: `feat: project initialization via /project-start-blank`
   - Push to origin main

5. **Report**
   - Summarize what was created
   - Suggest next steps based on the chosen tech stack
