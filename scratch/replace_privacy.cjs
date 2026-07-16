const fs = require('fs');
let code = fs.readFileSync('src/views/UserWorkspace/SettingsDrawer.tsx', 'utf8');

const importStatement = `import { SettingsPrivacyTab } from './SettingsTabs/SettingsPrivacyTab';\n`;
if (!code.includes('SettingsPrivacyTab')) {
  code = code.replace(`import { SettingsAccountTab }`, `${importStatement}import { SettingsAccountTab }`);
}

const startMarker = `            {activeView === 'privacy' && (`
const endMarker = `            {activeView === 'appearance' && (`;

const startIdx = code.indexOf(startMarker);
if (startIdx !== -1) {
  const endIdx = code.indexOf(endMarker, startIdx);
  const before = code.substring(0, startIdx);
  const after = code.substring(endIdx);
  
  const replacement = `            {activeView === 'privacy' && (
              <SettingsPrivacyTab
                accountMsg={accountMsg}
                accountError={accountError}
                handlePasswordReset={handlePasswordReset}
                currentPassword={currentPassword}
                setCurrentPassword={setCurrentPassword}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
              />
            )}
\n`;
            
  fs.writeFileSync('src/views/UserWorkspace/SettingsDrawer.tsx', before + replacement + after);
  console.log("Privacy tab replaced!");
} else {
  console.log("Start marker not found");
}
