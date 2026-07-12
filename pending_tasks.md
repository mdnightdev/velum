# Pending Tasks

1. **Revert User Purge (CLI Command)**
   - **Context:** Login Admins currently have the ability to purge user accounts.
   - **Task:** Add a CLI command that allows CLI Admins to reverse this decision and restore the purged account. (Implementation details to be defined later).

2. **Persistent User Data on Seeding Accounts**
   - **Context:** Currently, when the CLI `seed` command is run, it wipes user data clean.
   - **Task:** Override the seed behavior so that existing user data remains persistent in the database. When the user logs in with the newly seeded credentials, the system should prompt them to change their credentials and subsequently delete the seeded credentials.
