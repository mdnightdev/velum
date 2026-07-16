const fs = require('fs');
let code = fs.readFileSync('src/views/UserWorkspace/SettingsDrawer.tsx', 'utf8');

const importStatement = `import { SettingsAccountTab } from './SettingsTabs/SettingsAccountTab';\n`;
if (!code.includes('SettingsAccountTab')) {
  code = code.replace(`import PasswordInput from '../../components/PasswordInput';`, `import PasswordInput from '../../components/PasswordInput';\n${importStatement}`);
}

const startMarker = `{(activeView === 'account' || (!isMobile && activeView === 'menu')) && (`
const endMarker = `</form>\n            )}`;

const startIdx = code.indexOf(startMarker);
if (startIdx !== -1) {
  const realEndIdx = code.indexOf(endMarker, startIdx) + endMarker.length;
  const before = code.substring(0, startIdx);
  const after = code.substring(realEndIdx);
  
  const replacement = `{(activeView === 'account' || (!isMobile && activeView === 'menu')) && (
              <SettingsAccountTab
                profileMsg={profileMsg}
                profileError={profileError}
                handleSaveProfile={handleSaveProfile}
                avatarPreview={avatarPreview}
                avatarUrl={avatarUrl}
                avatarColor={avatarColor}
                getAvatarClass={getAvatarClass}
                displayName={displayName}
                bio={bio}
                loungesCount={loungesCount}
                connectionsCount={connectionsCount}
                currentUsername={currentUsername}
                currentUserRole={currentUserRole}
                email={email}
                setEmail={setEmail}
                phone={phone}
                setPhone={setPhone}
                setDisplayName={setDisplayName}
                setBio={setBio}
                handleAvatarChange={handleAvatarChange}
              />
            )}`;
            
  fs.writeFileSync('src/views/UserWorkspace/SettingsDrawer.tsx', before + replacement + after);
  console.log("Account tab replaced!");
} else {
  console.log("Start marker not found");
}
