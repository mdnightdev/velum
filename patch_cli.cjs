const fs = require('fs');
let code = fs.readFileSync('cli.js', 'utf8');

const validCommandsToAdd = [
  "'delete-lounge', 'delete_lounge',",
  "  'delete-user', 'delete_user',",
  "  'restore-user', 'restore_user',",
  "  'reset-avatar', 'reset_avatar',"
].join('\n');

code = code.replace(
  /'unmute-user', 'unmute_user', 'unmute',/,
  "'unmute-user', 'unmute_user', 'unmute',\n  " + validCommandsToAdd
);

const shortMappingsToAdd = [
  "  'delete-lounge': 'delete-lounge',",
  "  'delete-user': 'delete-user',",
  "  'restore': 'restore-user',",
  "  'avatar': 'reset-avatar',"
].join('\n');

code = code.replace(
  /'unmute': 'unmute-user',/,
  "'unmute': 'unmute-user',\n" + shortMappingsToAdd
);

const requiresTargetToAdd = [
  "  'delete-user', 'delete_user', 'delete-lounge', 'delete_lounge',",
  "  'restore-user', 'restore_user', 'reset-avatar', 'reset_avatar',"
].join('\n');

code = code.replace(
  /'unmute-user', 'unmute_user', 'unmute',/,
  "'unmute-user', 'unmute_user', 'unmute',\n" + requiresTargetToAdd
);

fs.writeFileSync('cli.js', code);
