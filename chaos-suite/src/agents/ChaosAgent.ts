import { VelumApiClient, VelumUser, VelumLounge } from './VelumApiClient.js';
import { VelumCredentials } from './VelumApiClient.js';
import { chaosLogger } from '../utils/chaosLogger.js';
import { persistenceManager } from '../utils/persistence.js';
import crypto from 'crypto';

type PersonaType = 
  | 'SOCIAL_BUTTERFLY' 
  | 'LURKER' 
  | 'SPAMMER' 
  | 'ADMIN_POWER' 
  | 'SUPPORT_SEEKER' 
  | 'DRAMA_QUEEN' 
  | 'TECH_SAVVY' 
  | 'CASUAL_USER';

interface AgentConfig {
  agentId: string;
  persona: PersonaType;
  deviceIndex: number;
  baseUrl: string;
}

// Unpredictable timing patterns
const TIMING_VARIANCE = () => Math.random() * 2000 - 1000; // ±1 second variance
const BASE_INTERVALS = {
  SOCIAL_BUTTERFLY: { min: 2000, max: 8000 },
  LURKER: { min: 5000, max: 20000 },
  SPAMMER: { min: 500, max: 2000 },
  ADMIN_POWER: { min: 3000, max: 10000 },
  SUPPORT_SEEKER: { min: 4000, max: 12000 },
  DRAMA_QUEEN: { min: 2500, max: 7000 },
  TECH_SAVVY: { min: 3000, max: 9000 },
  CASUAL_USER: { min: 4000, max: 15000 }
};

// Varied ticket content
const TICKET_TEMPLATES = [
  { reason: 'Bug report', descriptions: ['Experiencing connectivity issues with messaging', 'Messages not displaying in correct order', 'App crashes when joining large lounges', 'Typo in settings menu', 'Profile picture upload failing randomly'] },
  { reason: 'Feature request', descriptions: ['Would like dark mode implemented', 'Please add notification sound options', 'Need message search functionality', 'Add ability to pin important conversations', 'Custom emoji support needed'] },
  { reason: 'Account issue', descriptions: ['Unable to update profile picture', 'Two-factor authentication not working', 'Email verification not sending', 'Password reset link expired', 'Account showing as offline when active'] },
  { reason: 'Technical support', descriptions: ['Getting error when trying to create lounge', 'Unable to delete old messages', 'Lounge invite codes not working', 'Blocked user still appearing in search', 'Mute settings not persisting'] },
  { reason: 'Abuse report', descriptions: ['User sending inappropriate content', 'Spam bot in general lounge', 'Harassment in private messages', 'User sharing malicious links', 'Impersonation of another user'] }
];

// Varied message content by persona
const MESSAGE_TEMPLATES = {
  SOCIAL_BUTTERFLY: [
    'Hey everyone! How\'s it going today?',
    'Just wanted to spread some positivity! ✨',
    'Who wants to be friends? I love meeting new people!',
    'This is my favorite place to hang out',
    'Let\'s make today amazing together! 💪',
    'I\'m in such a good mood, anyone want to chat?',
    'Has anyone made any new friends lately?',
    'I love how we can all be ourselves here',
    'Anyone else feel like this is their second family? 🥰',
    'Let\'s make some beautiful memories today everyone!'
  ],
  CASUAL_USER: [
    'Hey everyone, what\'s going on?',
    'Just popping in to say hi',
    'Anyone have any interesting stories to share?',
    'What\'s everyone been up to lately?',
    'I\'m just chilling, thought I\'d say hello',
    'Anyone else just relaxing today?',
    'What\'s the topic of conversation today?',
    'Just wanted to see how everyone\'s doing',
    'Anyone working on anything cool?',
    'I\'m in a pretty good mood today'
  ],
  TECH_SAVVY: [
    'Has anyone checked out the latest tech developments?',
    'I\'ve been experimenting with some new coding techniques',
    'Anyone interested in discussing recent software updates?',
    'What\'s everyone\'s take on the new framework trends?',
    'I\'ve been diving deep into system architecture lately',
    'Anyone else working on cool tech projects?',
    'What\'s the latest in the developer community?',
    'I\'ve been optimizing some algorithms',
    'Anyone have experience with the new APIs?',
    'What\'s everyone\'s favorite programming language?'
  ],
  SPAMMER: [
    'Check this out!!!',
    'CLICK HERE NOW!!!',
    'AMAZING DEAL!!!',
    'Don\'t miss this!!!',
    'FREE STUFF!!!',
    'LIMITED TIME OFFER!!!',
    'ACT NOW!!!',
    'BEST DEAL EVER!!!',
    'MUST SEE!!!',
    'HURRY UP!!!'
  ],
  SUPPORT_SEEKER: [
    'Can someone help me with this issue?',
    'I\'m having trouble with my account',
    'Does anyone know how to fix this?',
    'I need some assistance please',
    'Is there a moderator available?',
    'I\'m confused about how this works',
    'Can someone explain this feature?',
    'I think I found a bug',
    'What should I do in this situation?',
    'I need help with my settings'
  ],
  DRAMA_QUEEN: [
    'Can you believe what just happened?!',
    'I\'m so done with this place',
    'You won\'t believe what they said',
    'This is so unfair!!!',
    'I\'m being treated so badly',
    'Everyone needs to see this',
    'I\'m literally shaking right now',
    'This is unacceptable behavior',
    'I\'m calling this out right now',
    'Someone needs to do something about this'
  ],
  LURKER: [
    '...',
    'Just reading along',
    'Interesting conversation',
    '👀',
    'Following along',
    'Good points being made',
    'Not much to add',
    'Just watching',
    'Thanks for sharing',
    'Agreed'
  ],
  ADMIN_POWER: [
    'Please follow the community guidelines',
    'Let\'s keep this discussion civil',
    'Reminder of the rules everyone',
    'I\'ll need to moderate this if it continues',
    'Let\'s keep things on topic',
    'Please be respectful to others',
    'This is against our policies',
    'I\'m issuing a warning here',
    'Let\'s maintain a positive environment',
    'Any issues, please report them properly'
  ]
};

export class ChaosAgent {
  private client: VelumApiClient;
  private config: AgentConfig;
  private credentials: VelumCredentials;
  private isRunning: boolean = false;
  private actionCount: number = 0;
  
  // State for realistic behavior
  private discoveredUsers: VelumUser[] = [];
  private discoveredLounges: VelumLounge[] = [];
  private currentLounge: VelumLounge | null = null;
  private currentSublounge: VelumLounge | null = null;
  private mutedByAdmin: boolean = false;
  private compromised: boolean = false;
  private lastActionTime: number = Date.now();

  constructor(config: AgentConfig) {
    this.config = config;
    
    // Generate username based on naming pattern
    const names = ['alex', 'jordan', 'taylor', 'morgan', 'casey', 'riley', 'quinn', 'avery', 'skylar', 'reese'];
    const name = names[parseInt(config.agentId.split('_').pop() || '0') % names.length];
    const username = `${name}_${config.persona.toLowerCase()}_${config.agentId.split('_').pop() || '0'}`;
    
    // Check for existing credentials using the username
    const existingCreds = persistenceManager.getCredentials(username);
    
    if (existingCreds) {
      this.credentials = {
        username: existingCreds.username,
        password: existingCreds.password,
        panicPhrase: existingCreds.panicPhrase,
        safeWord: existingCreds.safeWord,
        salt: existingCreds.salt
      };
    } else {
      // Generate new credentials
      this.credentials = {
        username: username,
        password: `P@ssword!_${crypto.randomBytes(4).toString('hex')}`,
        panicPhrase: `phrase_${crypto.randomBytes(3).toString('hex')}`,
        safeWord: `word_${crypto.randomBytes(3).toString('hex')}`,
        salt: crypto.randomBytes(16).toString('hex')
      };
    }

    this.client = new VelumApiClient(this.credentials, config.baseUrl);
    chaosLogger.initializeBot(config.agentId, config.persona);
  }

  private async sleep(ms: number): Promise<void> {
    const variance = TIMING_VARIANCE();
    await new Promise(resolve => setTimeout(resolve, Math.max(0, ms + variance)));
  }

  private getRandomInterval(): number {
    const base = BASE_INTERVALS[this.config.persona];
    return base.min + Math.random() * (base.max - base.min);
  }

  private getRandomMessage(): string {
    const templates = MESSAGE_TEMPLATES[this.config.persona] || MESSAGE_TEMPLATES.CASUAL_USER;
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private getRandomTicket(): { reason: string; description: string } {
    const template = TICKET_TEMPLATES[Math.floor(Math.random() * TICKET_TEMPLATES.length)];
    const description = template.descriptions[Math.floor(Math.random() * template.descriptions.length)];
    return { reason: template.reason, description };
  }

  private async discoverUsers(): Promise<void> {
    const startTime = Date.now();
    const result = await this.client.searchUsers('');
    const latency = Date.now() - startTime;

    chaosLogger.logAction(
      this.config.agentId,
      'user_discovery',
      result.success,
      latency,
      result.error
    );

    if (result.success && result.data?.users) {
      this.discoveredUsers = result.data.users;
    }
  }

  private async discoverLounges(): Promise<void> {
    const startTime = Date.now();
    const result = await this.client.getLounges();
    const latency = Date.now() - startTime;

    chaosLogger.logAction(
      this.config.agentId,
      'lounge_discovery',
      result.success,
      latency,
      result.error
    );

    if (result.success && result.data?.lounges) {
      this.discoveredLounges = result.data.lounges;
      
      // Select a random lounge to focus on
      if (this.discoveredLounges.length > 0) {
        this.currentLounge = this.discoveredLounges[Math.floor(Math.random() * this.discoveredLounges.length)];
        
        // Select a sublounge if available
        if (this.currentLounge.sublounges && this.currentLounge.sublounges.length > 0) {
          this.currentSublounge = this.currentLounge.sublounges[Math.floor(Math.random() * this.currentLounge.sublounges.length)];
        }
      }
    }
  }

  private async authenticate(): Promise<boolean> {
    // Try login first with current credentials
    const loginResult = await this.client.login();
    const latency = loginResult.latency || 0;
    
    chaosLogger.logAction(
      this.config.agentId,
      'login',
      loginResult.success,
      latency,
      loginResult.error
    );

    if (loginResult.success) {
      return true;
    }

    // Register if login failed
    const registerResult = await this.client.register();
    const registerLatency = registerResult.latency || 0;
    
    chaosLogger.logAction(
      this.config.agentId,
      'register',
      registerResult.success,
      registerLatency,
      registerResult.error
    );

    if (registerResult.success) {
      // Store credentials
      persistenceManager.storeCredentials({
        username: this.credentials.username,
        password: this.credentials.password,
        panicPhrase: this.credentials.panicPhrase,
        safeWord: this.credentials.safeWord,
        salt: this.credentials.salt,
        createdAt: new Date().toISOString(),
        persona: this.config.persona,
        isActive: true,
        isTestUser: true,
        testTags: ['chaos-test', 'automated']
      });
      return true;
    }

    return false;
  }

  private async performAction(): Promise<void> {
    // Only authenticate if not already authenticated or compromised
    if (!this.client.isAuthenticated() || this.compromised) {
      const authenticated = await this.authenticate();
      if (!authenticated) {
        chaosLogger.logFailure(
          this.config.agentId,
          'authentication',
          'Failed to authenticate',
          true,
          false
        );
        return;
      }
    }

    // Discover users and lounges periodically
    if (this.actionCount % 5 === 0) {
      await this.discoverUsers();
      await this.discoverLounges();
    }

    // Select action based on persona and current state
    const action = this.selectAction();
    await this.executeAction(action);
    
    this.actionCount++;
    this.lastActionTime = Date.now();
  }

  private selectAction(): string {
    const actions = [];
    
    // Base actions available to all
    actions.push('sendMessage');
    
    // Persona-specific actions
    switch (this.config.persona) {
      case 'SOCIAL_BUTTERFLY':
        actions.push('sendMessage', 'createLounge', 'joinLounge', 'uploadAvatar');
        break;
      case 'LURKER':
        actions.push('getMessages', 'readMessages');
        break;
      case 'SPAMMER':
        actions.push('sendMessage', 'sendMessage', 'createLounge');
        break;
      case 'ADMIN_POWER':
        actions.push('blockUser', 'muteUser', 'reportUser', 'createTicket');
        break;
      case 'SUPPORT_SEEKER':
        actions.push('createTicket', 'sendMessage', 'uploadAvatar');
        break;
      case 'DRAMA_QUEEN':
        actions.push('reportUser', 'blockUser', 'muteUser', 'sendMessage');
        break;
      case 'TECH_SAVVY':
        actions.push('sendMessage', 'createLounge', 'createTicket', 'compromiseAccount');
        break;
      case 'CASUAL_USER':
        actions.push('sendMessage', 'joinLounge', 'uploadAvatar', 'createTicket');
        break;
    }

    // Admin interaction testing
    if (this.mutedByAdmin) {
      actions.push('attemptBypass');
    }

    // Account recovery testing
    if (this.compromised) {
      actions.push('attemptRecovery');
    }

    return actions[Math.floor(Math.random() * actions.length)];
  }

  private async executeAction(action: string): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      switch (action) {
        case 'sendMessage':
          success = await this.actionSendMessage();
          break;
        case 'createLounge':
          success = await this.actionCreateLounge();
          break;
        case 'joinLounge':
          success = await this.actionJoinLounge();
          break;
        case 'uploadAvatar':
          success = await this.actionUploadAvatar();
          break;
        case 'readMessages':
          success = await this.actionReadMessages();
          break;
        case 'getMessages':
          success = await this.actionGetMessages();
          break;
        case 'blockUser':
          success = await this.actionBlockUser();
          break;
        case 'muteUser':
          success = await this.actionMuteUser();
          break;
        case 'reportUser':
          success = await this.actionReportUser();
          break;
        case 'createTicket':
          success = await this.actionCreateTicket();
          break;
        case 'compromiseAccount':
          success = await this.actionCompromiseAccount();
          break;
        case 'attemptBypass':
          success = await this.actionAttemptBypass();
          break;
        case 'attemptRecovery':
          success = await this.actionAttemptRecovery();
          break;
        default:
          error = `Unknown action: ${action}`;
      }
    } catch (e) {
      error = (e as Error).message;
    }

    const latency = Date.now() - startTime;
    chaosLogger.logAction(this.config.agentId, action, success, latency, error);
  }

  private async actionSendMessage(): Promise<boolean> {
    if (!this.currentSublounge && !this.currentLounge) {
      return false;
    }

    const targetLounge = this.currentSublounge || this.currentLounge;
    if (!targetLounge) return false;

    // Use the slug as room ID, fallback to ID-based format
    const roomId = targetLounge.slug || String(targetLounge.id);
    const message = this.getRandomMessage();

    const result = await this.client.sendMessage(roomId, message);
    
    if (!result.success) {
      // Check if muted by admin
      if (result.error?.includes('muted') || result.error?.includes('blocked')) {
        this.mutedByAdmin = true;
        chaosLogger.logAdminInteraction(
          this.config.agentId,
          'mute',
          true,
          false,
          false
        );
      }
      return false;
    }

    // Verify message was actually posted by checking recent messages
    const verifyResult = await this.client.getMessages(roomId, 5);
    if (verifyResult.success && verifyResult.data) {
      const messageExists = verifyResult.data.some(msg => 
        msg.content === message && msg.senderId === this.client.getUserId()
      );
      if (!messageExists) {
        chaosLogger.logFailure(
          this.config.agentId,
          'sendMessage',
          'API returned success but message not found in recent messages',
          false,
          false
        );
        return false;
      }
    }

    return true;
  }

  private async actionCreateLounge(): Promise<boolean> {
    const names = ['General Discussion', 'Random Chat', 'Tech Talk', 'Off Topic', 'Community Hub'];
    const name = names[Math.floor(Math.random() * names.length)] + ` ${Math.floor(Math.random() * 1000)}`;
    const description = 'A lounge for chatting and hanging out';

    const result = await this.client.createLounge(name, description, false);
    
    if (!result.success) {
      return false;
    }

    if (result.data) {
      // Verify lounge was actually created by checking if it appears in user lounges
      const verifyResult = await this.client.getUserLounges();
      if (verifyResult.success && verifyResult.data) {
        const loungeExists = verifyResult.data.lounges.some(lounge => 
          lounge.name === name || lounge.id === result.data?.id
        );
        if (!loungeExists) {
          chaosLogger.logFailure(
            this.config.agentId,
            'createLounge',
            'API returned success but lounge not found in user lounges',
            false,
            false
          );
          return false;
        }
        this.discoveredLounges.push(result.data);
      }
    }

    return true;
  }

  private async actionJoinLounge(): Promise<boolean> {
    if (this.discoveredLounges.length === 0) {
      return false;
    }

    const randomLounge = this.discoveredLounges[Math.floor(Math.random() * this.discoveredLounges.length)];
    const roomId = randomLounge.lounge_id || randomLounge.slug || `lounge_${randomLounge.id}`;

    const result = await this.client.joinLounge(roomId);
    
    if (!result.success) {
      return false;
    }

    // Verify joined by checking if lounge appears in user lounges
    const verifyResult = await this.client.getUserLounges();
    if (verifyResult.success && verifyResult.data) {
      const joined = verifyResult.data.lounges.some(lounge => 
        lounge.id === randomLounge.id || lounge.slug === randomLounge.slug
      );
      if (!joined) {
        chaosLogger.logFailure(
          this.config.agentId,
          'joinLounge',
          'API returned success but lounge not found in user lounges',
          false,
          false
        );
        return false;
      }
      this.currentLounge = randomLounge;
    }

    return true;
  }

  private async actionUploadAvatar(): Promise<boolean> {
    // Generate random avatar data (1x1 pixel webp for testing)
    const avatarData = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x12, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x4c, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x41, 0x4d, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);

    const result = await this.client.uploadAvatar(avatarData);
    
    if (!result.success) {
      return false;
    }

    // Verify avatar was uploaded by checking if URL was returned
    if (!result.data?.url) {
      chaosLogger.logFailure(
        this.config.agentId,
        'uploadAvatar',
        'API returned success but no avatar URL provided',
        false,
        false
      );
      return false;
    }

    return true;
  }

  private async actionReadMessages(): Promise<boolean> {
    if (!this.currentSublounge && !this.currentLounge) {
      return false;
    }

    const targetLounge = this.currentSublounge || this.currentLounge;
    if (!targetLounge) return false;

    const roomId = targetLounge.slug || String(targetLounge.id);
    const result = await this.client.getMessages(roomId, 10);
    
    if (result.success && result.data && result.data.length > 0) {
      // Mark last message as read
      const lastMessage = result.data[result.data.length - 1];
      await this.client.markAsRead(roomId, String(lastMessage.id));
    }

    return result.success;
  }

  private async actionGetMessages(): Promise<boolean> {
    if (!this.currentSublounge && !this.currentLounge) {
      return false;
    }

    const targetLounge = this.currentSublounge || this.currentLounge;
    if (!targetLounge) return false;

    const roomId = targetLounge.slug || String(targetLounge.id);

    const result = await this.client.getMessages(roomId, 20);
    return result.success;
  }

  private async actionBlockUser(): Promise<boolean> {
    if (this.discoveredUsers.length === 0) {
      return false;
    }

    const randomUser = this.discoveredUsers[Math.floor(Math.random() * this.discoveredUsers.length)];
    const result = await this.client.blockUser(randomUser.id);

    return result.success;
  }

  private async actionMuteUser(): Promise<boolean> {
    if (this.discoveredUsers.length === 0) {
      return false;
    }

    const randomUser = this.discoveredUsers[Math.floor(Math.random() * this.discoveredUsers.length)];
    const result = await this.client.muteUser(randomUser.id);

    return result.success;
  }

  private async actionReportUser(): Promise<boolean> {
    if (this.discoveredUsers.length === 0) {
      return false;
    }

    const randomUser = this.discoveredUsers[Math.floor(Math.random() * this.discoveredUsers.length)];
    const reasons = ['Inappropriate behavior', 'Spamming', 'Harassment', 'Offensive content', 'Trolling'];
    const reason = reasons[Math.floor(Math.random() * reasons.length)];

    const result = await this.client.reportUser(randomUser.id, reason);
    return result.success;
  }

  private async actionCreateTicket(): Promise<boolean> {
    const ticket = this.getRandomTicket();
    const result = await this.client.createTicket(ticket.reason, ticket.description);
    
    if (!result.success) {
      return false;
    }

    // Verify ticket was created by checking if ticket_id was returned
    if (!result.data || !result.data.ticket_id) {
      chaosLogger.logFailure(
        this.config.agentId,
        'createTicket',
        'API returned success but no ticket_id provided',
        false,
        false
      );
      return false;
    }

    return true;
  }

  private async actionCompromiseAccount(): Promise<boolean> {
    // Simulate account compromise by changing password
    this.compromised = true;
    this.credentials.password = `COMPROMISED_${crypto.randomBytes(4).toString('hex')}`;
    
    chaosLogger.logCompromiseEvent(
      this.config.agentId,
      'password_change',
      false,
      false
    );

    // Try to use the compromised credentials
    const result = await this.client.login();
    
    if (!result.success) {
      chaosLogger.logCompromiseEvent(
        this.config.agentId,
        'password_change',
        true,
        false
      );
    }

    return false; // Compromise always fails initially
  }

  private async actionAttemptBypass(): Promise<boolean> {
    // Try to send message even though muted
    if (!this.currentSublounge && !this.currentLounge) {
      return false;
    }

    const targetLounge = this.currentSublounge || this.currentLounge;
    if (!targetLounge) return false;

    const roomId = targetLounge.slug || String(targetLounge.id);
    
    // Try different methods to bypass
    const bypassMethods = [
      () => this.client.sendMessage(roomId, 'Bypass attempt 1'),
      () => this.client.joinLounge(roomId),
      () => this.client.createLounge('Bypass Lounge', 'Trying to bypass restrictions')
    ];

    const randomMethod = bypassMethods[Math.floor(Math.random() * bypassMethods.length)];
    const result = await randomMethod();

    chaosLogger.logAdminInteraction(
      this.config.agentId,
      'mute',
      true,
      true,
      result.success
    );

    return result.success;
  }

  private async actionAttemptRecovery(): Promise<boolean> {
    // Try to recover account by logging in with stored credentials
    const storedCreds = persistenceManager.getCredentials(this.credentials.username);
    
    if (!storedCreds) {
      return false;
    }

    // Restore original credentials
    this.credentials.password = storedCreds.password;
    this.credentials.panicPhrase = storedCreds.panicPhrase;
    this.credentials.safeWord = storedCreds.safeWord;
    this.credentials.salt = storedCreds.salt;

    const result = await this.client.login();
    
    chaosLogger.logCompromiseEvent(
      this.config.agentId,
      'password_change',
      true,
      result.success
    );

    if (result.success) {
      this.compromised = false;
    }

    return result.success;
  }

  async start(duration: number = 60000): Promise<void> {
    this.isRunning = true;
    const endTime = Date.now() + duration;

    while (this.isRunning && Date.now() < endTime) {
      try {
        await this.performAction();
        await this.sleep(this.getRandomInterval());
      } catch (error) {
        chaosLogger.logFailure(
          this.config.agentId,
          'action_execution',
          (error as Error).message,
          false,
          false
        );
      }
    }

    this.stop();
  }

  stop(): void {
    this.isRunning = false;
    chaosLogger.logSessionEnd(this.config.agentId, false);
  }

  getMetrics(): any {
    return chaosLogger.getMetrics(this.config.agentId);
  }
}