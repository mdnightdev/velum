# Rule: TypeScript Compilation Check

## Guardrail Constraint
After making any code modifications and before completing a task or ending your turn, you MUST explicitly run a compilation check to verify that your work compiles perfectly without any errors.

## Actionable Steps
1. Perform the code modification(s).
2. Execute the compilation check using the terminal command:
   ```bash
   npx tsc --noEmit
   ```
3. Verify that the command outputs no errors (successful compilation).
4. If there are compilation errors, resolve them and re-run the compilation check before completing the task.
