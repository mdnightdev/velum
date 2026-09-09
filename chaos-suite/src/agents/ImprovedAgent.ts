import { ImprovedApiClient } from './ImprovedApiClient.js';
import { PersonaType, PERSONAS } from '../config/agentConfig.js';
import { chaosLogger } from '../utils/logger.js';
import { persistenceManager } from '../utils/persistence.js';
import { AdminVisibilityConfig, getTestUserTags, generateVisibleUsername, generateTestProfileBio, DEFAULT_VISIBILITY_CONFIG } from '../config/adminVisibility.js';
import crypto from 'crypto';

// Generate proper cryptographic salt
const generateSalt = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

export type AgentState = 'REGISTER' | 'ACTIVE' | 'ROGUE' | 'RECOVERY';

export interface AgentCredentials {
  username: string;
  password: string;
  panicPhrase: string;
  safeWord: string;
  salt?: string;
  userId?: number;
  createdAt?: string;
  lastLoginAt?: string;
  persona?: string;
  isActive?: boolean;
  isTestUser?: boolean;
  testTags?: string[];
}

export class ImprovedAgent {
  private state: AgentState = 'REGISTER';
  private credentials: AgentCredentials;
  private client: ImprovedApiClient;
  private token?: string;
  private agentId: string;
  private persona: PersonaType;
  private deviceIndex: number;
  private visibilityConfig: AdminVisibilityConfig;
  private currentLoungeId?: string;
  private actionCount: number = 0;
  private errorCount: number = 0;
  private lastActionTime: Date = new Date();

  private static names = ['alex', 'jordan', 'taylor', 'morgan', 'casey', 'riley', 'quinn', 'avery', 'skylar', 'reese'];

  constructor(
    agentId: string,
    persona: PersonaType,
    deviceIndex: number,
    visibilityConfig: AdminVisibilityConfig
  ) {
    this.agentId = agentId;
    this.persona = persona;
    this.deviceIndex = deviceIndex;
    this.visibilityConfig = visibilityConfig;
    
    const name = ImprovedAgent.names[parseInt(agentId.split('_').pop() || '0') % ImprovedAgent.names.length];
    const baseUsername = `${name}_${persona.toLowerCase()}_${agentId.split('_').pop() || '0'}`;
    const username = generateVisibleUsername(baseUsername);
    
    // Check for existing credentials FIRST
    const existingCreds = persistenceManager.getCredentials(username);
    
    if (existingCreds) {
      // Use EXACTLY the stored credentials - no regeneration
      this.credentials = {
        username: existingCreds.username,
        password: existingCreds.password,
        panicPhrase: existingCreds.panicPhrase,
        safeWord: existingCreds.safeWord,
        salt: existingCreds.salt,
        persona: existingCreds.persona || persona,
        userId: existingCreds.userId,
        createdAt: existingCreds.createdAt,
        lastLoginAt: existingCreds.lastLoginAt,
        isActive: existingCreds.isActive ?? true,
        isTestUser: existingCreds.isTestUser ?? visibilityConfig.markAsTestUser,
        testTags: existingCreds.testTags ?? (visibilityConfig.addSystemTags ? getTestUserTags() : [])
      };
    } else {
      // Only generate new credentials if none exist
      this.credentials = {
        username,
        password: `P@ssword!_${Math.random().toString(36).substring(2, 10)}`, 
        panicPhrase: `phrase_${Math.random().toString(36).substring(7)}`,
        safeWord: `word_${Math.random().toString(36).substring(7)}`,
        salt: generateSalt(),
        persona,
        isActive: true,
        isTestUser: visibilityConfig.markAsTestUser,
        testTags: visibilityConfig.addSystemTags ? getTestUserTags() : []
      };
    }

    this.client = new ImprovedApiClient(this.credentials, deviceIndex);
  }

  private log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    chaosLogger.log(level, this.agentId, message);
  }

  public async run(): Promise<void> {
    this.log(`Starting in state: ${this.state} with persona: ${this.persona}`);
    
    // Set initial state based on whether we have stored credentials
    const existingCreds = persistenceManager.getCredentials(this.credentials.username);
    if (existingCreds) {
      this.log('Found existing credentials, attempting login');
      this.state = 'RECOVERY';
    }

    while (true) {
      try {
        await this.performAction();
      } catch (err: any) {
        this.errorCount++;
        this.log(`Action error: ${err.message}`, 'ERROR');
        if (this.errorCount > 5) {
          this.log('Too many errors, entering recovery mode', 'WARN');
          this.state = 'RECOVERY';
          this.errorCount = 0;
        }
      }
      
      // Persona-based timing
      const timing = PERSONAS[this.persona].timingPatterns;
      const minDelay = timing.minActionInterval;
      const maxDelay = timing.maxActionInterval;
      const delay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
      
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private async performAction(): Promise<void> {
    switch (this.state) {
      case 'REGISTER':
        await this.register();
        break;
      case 'ACTIVE':
        await this.activeAction();
        break;
      case 'ROGUE':
        await this.rogueAction();
        break;
      case 'RECOVERY':
        await this.recover();
        break;
    }
    
    this.actionCount++;
    this.lastActionTime = new Date();
  }

  private async register(): Promise<void> {
    this.log('Attempting registration...');
    try {
      const result = await this.client.register();
      
      if (!result.success) {
        this.log(`Registration failed: ${result.error || result.statusCode}`, 'WARN');
        this.state = 'RECOVERY';
        return;
      }
      
      this.token = result.data?.token;
      
      // Update profile with test metadata if enabled
      if (this.visibilityConfig.addTestProfile) {
        const bio = generateTestProfileBio(this.persona);
        await this.client.updateProfile({ bio }).catch(() => {});
      }
      
      this.log('Registered successfully.');
      
      // Store credentials with visibility metadata
      persistenceManager.storeCredentials({
        username: this.credentials.username,
        password: this.credentials.password,
        panicPhrase: this.credentials.panicPhrase,
        safeWord: this.credentials.safeWord,
        salt: this.credentials.salt,
        createdAt: new Date().toISOString(),
        persona: this.credentials.persona,
        isActive: true,
        isTestUser: this.visibilityConfig.markAsTestUser,
        testTags: this.visibilityConfig.addSystemTags ? getTestUserTags() : []
      });
      
      this.state = 'ACTIVE';
    } catch (err: any) {
      this.log(`Registration failed: ${err.message}`, 'WARN');
      this.state = 'RECOVERY';
    }
  }

  private async activeAction(): Promise<void> {
    if (!this.token) {
      this.state = 'REGISTER';
      return;
    }

    const weights = PERSONAS[this.persona].actionWeights;
    const actionType = this.weightedRandom(weights);
    
    this.log(`Performing action: ${actionType}`);
    
    switch (actionType) {
      case 'sendMessage':
        await this.actionSendMessage();
        break;
      case 'createLounge':
        await this.actionCreateLounge();
        break;
      case 'joinLounge':
        await this.actionJoinLounge();
        break;
      case 'leaveLounge':
        await this.actionLeaveLounge();
        break;
      case 'sendSanction':
        await this.actionSendSanction();
        break;
      case 'createTicket':
        await this.actionCreateTicket();
        break;
      case 'reportUser':
        await this.actionReportUser();
        break;
      case 'blockUser':
        await this.actionBlockUser();
        break;
      case 'muteUser':
        await this.actionMuteUser();
        break;
      case 'deleteChat':
        await this.actionDeleteChat();
        break;
      case 'viewProfile':
        await this.actionViewProfile();
        break;
      case 'compromiseAccount':
        await this.actionCompromiseAccount();
        break;
      case 'requestDeletion':
        await this.actionRequestDeletion();
        break;
      case 'login':
        await this.recover();
        break;
      case 'logout':
        await this.actionLogout();
        break;
      default:
        this.log(`Unknown action type: ${actionType}`, 'WARN');
    }
  }

  private weightedRandom(weights: Record<string, number>): string {
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (const [action, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        return action;
      }
    }
    
    return Object.keys(weights)[0];
  }

  // Action implementations
  private async actionSendMessage(): Promise<void> {
    const lounges = await this.client.getLounges();
    if (lounges.success && lounges.data && lounges.data.length > 0) {
      const randomLounge = lounges.data[Math.floor(Math.random() * lounges.data.length)];
      
      // More varied and talkative messages based on persona
      const messages = this.getPersonaMessages();
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
      await this.client.sendMessage('Velum Lounge', randomMessage);
      
    }
  }

  private getPersonaMessages(): string[] {
    const baseMessages = [
      'Hey everyone! How\'s it going?',
      'What\'s everyone up to today?',
      'Anyone else having a great day?',
      'Just wanted to check in and say hi!',
      'This place is really active today, love it!',
      'Has anyone tried the new features?',
      'I\'ve been thinking about trying something new',
      'What do you all think about the latest updates?',
      'Anyone have any exciting plans for the weekend?',
      'Just finished a project, feeling accomplished!',
      'Who\'s up for some interesting conversation?',
      'I love the energy in this lounge today!',
      'Anyone want to chat about something random?',
      'What\'s the most interesting thing that happened to you today?',
      'I\'m bored, entertain me please! 😄',
      'This community is amazing, you guys are great!',
      'Anyone else here late at night like me?',
      'Just wanted to share something cool I learned',
      'What\'s everyone\'s favorite thing about this place?',
      'I\'m new here, be nice! 😊',
      'Anyone have recommendations for good content?',
      'Let\'s make today a good one!',
      'Who else is procrastinating like me right now?',
      'This is my favorite hangout spot online',
      'Anyone else feeling motivated today?',
      'What time is it for everyone right now?',
      'I need coffee, who\'s with me?',
      'Just had the craziest idea, want to hear it?',
      'Anyone else addicted to checking messages like me?',
      'Let\'s have a great conversation today!',
      'I appreciate all of you being here',
      'What\'s the vibe like today, folks?',
      'Anyone working on anything cool?',
      'I love how diverse this community is',
      'Let\'s make some new friends today!',
      'Anyone else here just chilling?',
      'What\'s everyone\'s favorite topic to discuss?',
      'I\'m in a chatty mood today, can you tell?',
      'Thanks for making this place awesome!',
      'Anyone want to share something positive?',
      'Let\'s keep the good vibes going!',
      'I\'m curious about everyone\'s backgrounds',
      'What brings you all here today?',
      'Anyone else feel like this is their second home?',
      'Let\'s have some fun conversations!',
      'I love meeting new people here',
      'What\'s everyone\'s goals for this week?',
      'Anyone else excited about the future?',
      'Let\'s make today memorable!',
      'I appreciate the thoughtful discussions here',
      'Anyone else learning something new every day?',
      'What\'s everyone\'s favorite thing to do when bored?',
      'I love how supportive this community is',
      'Let\'s share some stories!',
      'Anyone else here for the long haul?',
      'What\'s everyone\'s opinion on the latest news?',
      'I\'m feeling social today!',
      'Anyone else love this time of day?',
      'Let\'s make some connections!',
      'I\'m grateful for this community',
      'What\'s everyone\'s current mood?',
      'Anyone else here for the great conversations?',
      'Let\'s keep the momentum going!',
      'I love the diverse perspectives here',
      'What\'s everyone\'s favorite memory from this place?',
      'Anyone else feeling the good energy today?',
      'Let\'s make this the best chat ever!',
      'I\'m excited to see what we discuss today',
      'Anyone else appreciate the regulars here?',
      'What\'s everyone\'s thought on the day so far?',
      'I love how welcoming everyone is here',
      'Let\'s have some meaningful conversations!',
      'Anyone else here just to relax and chat?',
      'What\'s everyone\'s current project or focus?',
      'I\'m loving the conversation flow today',
      'Anyone else feel like this place keeps getting better?',
      'Let\'s share some knowledge and experiences!',
      'I appreciate everyone\'s unique contributions',
      'What\'s everyone\'s favorite thing about the community?',
      'Anyone else here for the friendships?',
      'Let\'s make today count!',
      'I\'m constantly impressed by the people here',
      'What\'s everyone\'s latest achievement or win?',
      'Anyone else feel like they\'ve found their tribe?',
      'Let\'s keep the discussions interesting!',
      'I love how we can all be ourselves here',
      'What\'s everyone\'s go-to topic when they\'re bored?',
      'Anyone else appreciate the safe space here?',
      'Let\'s make some great memories today!',
      'I\'m always happy to see familiar faces',
      'What\'s everyone\'s favorite conversation starter?',
      'Anyone else here just for the positive vibes?',
      'Let\'s enjoy each other\'s company!',
      'I love how we can all learn from each other',
      'What\'s everyone\'s thought on the current state of things?',
      'Anyone else feel like this is exactly where they belong?',
      'Let\'s make today full of great discussions!',
      'I\'m thankful for the connections I\'ve made here',
      'What\'s everyone\'s favorite way to spend time here?',
      'Anyone else appreciate the authenticity of this place?',
      'Let\'s keep the good conversations flowing!',
      'I love how we can all grow together here',
      'What\'s everyone\'s biggest takeaway from being here?',
      'Anyone else feel like this place changes lives?',
      'Let\'s make today a day to remember!',
      'I\'m constantly inspired by the discussions here',
      'What\'s everyone\'s favorite thing about the people here?',
      'Anyone else here for the intellectual stimulation?',
      'Let\'s have some enlightening conversations!',
      'I love how we can all be real with each other',
      'What\'s everyone\'s perspective on the day\'s events?',
      'Anyone else feel like this place is special?',
      'Let\'s make today full of meaningful exchanges!',
      'I\'m grateful for the diversity of thought here',
      'What\'s everyone\'s favorite way to contribute?',
      'Anyone else here for the personal growth?',
      'Let\'s keep the positive energy flowing!',
      'I love how we can all challenge each other respectfully',
      'What\'s everyone\'s current passion or interest?',
      'Anyone else feel like this place brings out the best in people?',
      'Let\'s make today a day of great connections!'
    ];

    // Add persona-specific messages
    switch (this.persona) {
      case 'SOCIAL_BUTTERFLY':
        return [
          ...baseMessages,
          'Heyyy everyone! 👋 So glad to see you all!',
          'Just wanted to spread some positivity today! ✨',
          'Who wants to be friends? I love meeting new people!',
          'This is my favorite place to hang out, you guys are the best!',
          'Let\'s make today amazing together! 💪',
          'I\'m in such a good mood, anyone want to chat?',
          'Has anyone made any new friends lately? Tell me about it!',
          'I love how we can all be ourselves here, it\'s so refreshing!',
          'Anyone else feel like this is their second family? 🥰',
          'Let\'s make some beautiful memories today everyone!',
          'I\'m so grateful for each and every one of you!',
          'Who else is excited to be here right now? I know I am!',
          'Let\'s spread some love and kindness today! ❤️',
          'I believe in the power of community, and this place proves it!',
          'Anyone else feel like they\'ve found their people?',
          'Let\'s make today the best day ever!',
          'I\'m sending good vibes to everyone! 🌟'
        ];
      
      case 'CASUAL_USER':
        return [
          ...baseMessages,
          'Hey everyone, what\'s going on?',
          'Just popping in to say hi to everyone',
          'Anyone have any interesting stories to share?',
          'What\'s everyone been up to lately?',
          'I\'m just chilling, thought I\'d say hello',
          'Anyone else just relaxing today?',
          'What\'s the topic of conversation today?',
          'Just wanted to see how everyone\'s doing',
          'Anyone working on anything cool?',
          'I\'m in a pretty good mood today, how about you all?',
          'What\'s everyone\'s plans for the day?',
          'Just checking in, see what\'s new',
          'Anyone have any recommendations for things to do?',
          'I\'m feeling pretty casual today, just hanging out',
          'What\'s everyone\'s take on the current situation?',
          'Just thought I\'d drop by and chat a bit',
          'Anyone else here just to pass some time?',
          'What\'s everyone\'s opinion on recent events?',
          'I\'m just taking it easy today, enjoying the vibe',
          'Anyone else have a laid-back approach to things?',
          'What\'s everyone\'s favorite way to unwind?',
          'Just here for some good conversation',
          'Anyone else appreciate the relaxed atmosphere here?',
          'I\'m in no rush today, just enjoying the chat',
          'What\'s everyone\'s current state of mind?',
          'Just wanted to catch up with everyone',
          'Anyone else here for the chill conversations?',
          'I\'m feeling pretty content today',
          'What\'s everyone\'s simple pleasure in life?',
          'Just enjoying the little moments today',
          'Anyone else here for the stress-free environment?',
          'I\'m all about keeping things relaxed and friendly',
          'What\'s everyone\'s go-to comfort activity?',
          'Just thought I\'d share some positive vibes',
          'Anyone else appreciate the easy-going nature here?',
          'I\'m in a contemplative mood today',
          'What\'s everyone\'s favorite way to spend free time?',
          'Just here to enjoy some good company',
          'Anyone else feel like this place is their escape?',
          'I\'m grateful for the peaceful moments here',
          'What\'s everyone\'s simple joy today?',
          'Just taking it one moment at a time',
          'Anyone else here for the mental break?',
          'I\'m appreciating the calm and friendly vibes',
          'What\'s everyone\'s way of staying grounded?',
          'Just enjoying the simple pleasure of good conversation',
          'Anyone else feel like this place recharges them?',
          'I\'m all about balance and harmony',
          'What\'s everyone\'s method for staying relaxed?',
          'Just here to be present in the moment',
          'Anyone else appreciate the authenticity here?',
          'I\'m feeling quite peaceful today',
          'What\'s everyone\'s form of self-care?',
          'Just enjoying the flow of conversation',
          'Anyone else feel like this place is their sanctuary?',
          'I\'m thankful for the tranquil atmosphere',
          'What\'s everyone\'s source of tranquility?',
          'Just here to find solace in connection',
          'Anyone else feel like this place heals them?',
          'I\'m centered in the gentle energy here',
          'What\'s everyone\'s path to inner peace?',
          'Just enjoying the serenity of good company',
          'Anyone else feel like this place is their haven?',
          'I\'m at peace with the present moment',
          'What\'s everyone\'s way of finding inner stillness?',
          'Just grateful for the peaceful interactions',
          'Anyone else feel like this place brings them calm?',
          'I\'m serene in the midst of the gentle chatter',
          'What\'s everyone\'s source of comfort and peace?',
          'Just here to bask in the calm presence of others',
          'Anyone else feel like this place is their refuge?',
          'I\'m at ease in the company of understanding souls',
          'What\'s everyone\'s way of maintaining balance?',
          'Just enjoying the restorative power of good conversation',
          'Anyone else feel like this place is their haven?',
          'I\'m centered in the compassionate atmosphere today',
          'What\'s everyone\'s method for maintaining serenity?',
          'Just here to find peace in shared understanding',
          'Anyone else feel like this place is their sanctuary?',
          'I\'m composed in the gentle flow of conversation',
          'What\'s everyone\'s anchor in turbulent times?',
          'Just appreciating the steadying presence of this community',
          'Anyone else here for the emotional grounding?',
          'I\'m at peace with the gentle rhythm of interaction',
          'What\'s everyone\'s way of finding calm amidst chaos?',
          'Just enjoying the stabilizing effect of good company',
          'Anyone else feel like this place centers them?',
          'I\'m balanced in the harmonious exchanges today',
          'What\'s everyone\'s method for emotional resilience?',
          'Just here to find strength in collective peace',
          'Anyone else feel like this place provides stability?',
          'I\'m steady in the midst of life\'s ups and downs',
          'What\'s everyone\'s way of maintaining equilibrium?',
          'Just enjoying the balancing effect of shared experiences',
          'Anyone else here for the emotional centering?',
          'I\'m anchored in the supportive energy today',
          'What\'s everyone\'s method for staying grounded?',
          'Just here to find balance in the give and take',
          'Anyone else feel like this place restores their equilibrium?',
          'I\'m composed in the understanding presence of others',
          'What\'s everyone\'s way of finding emotional footing?',
          'Just appreciating the steadying force of this community',
          'Anyone else here for the emotional anchoring?',
          'I\'m at ease in the mutual respect and support',
          'What\'s everyone\'s source of emotional security?',
          'Just here to find certainty in genuine connection',
          'Anyone else feel like this place provides emotional safety?',
          'I\'m secure in the welcoming environment today',
          'What\'s everyone\'s way of building emotional resilience?',
          'Just enjoying the protective nature of this community',
          'Anyone else here for the emotional shelter?',
          'I\'m comforted by the reliable presence of good people',
          'What\'s everyone\'s method for creating emotional safety?',
          'Just here to find refuge in understanding and acceptance',
          'Anyone else feel like this place is their emotional home?',
          'I\'m at home in the genuine connections formed here',
          'What\'s everyone\'s way of finding belonging?',
          'Just grateful for the inclusive and supportive atmosphere',
          'Anyone else here for the emotional homecoming?',
          'I\'m embraced by the caring community today',
          'What\'s everyone\'s source of emotional belonging?',
          'Just enjoying the welcoming nature of shared humanity',
          'Anyone else feel like this place is where they belong?',
          'I\'m connected in the deep sense of community here',
          'What\'s everyone\'s way of finding their tribe?',
          'Just here to find kinship in shared values and interests',
          'Anyone else here for the emotional family?',
          'I\'m surrounded by understanding and acceptance today',
          'What\'s everyone\'s source of emotional family?',
          'Just enjoying the brotherhood and sisterhood of this place',
          'Anyone else feel like this place is their emotional family?',
          'I\'m loved and supported in this community',
          'What\'s everyone\'s way of creating chosen family?',
          'Just here to find family in the shared journey',
          'Anyone else here for the emotional kinship?',
          'I\'m related in spirit to the wonderful people here',
          'What\'s everyone\'s source of emotional family?',
          'Just enjoying the familial bonds formed in this place',
          'Anyone else feel like this place is their true family?',
          'I\'m home in the hearts and minds of this community',
          'What\'s everyone\'s way of finding their people?',
          'Just here to find my people among amazing individuals',
          'Anyone else here for the emotional reunion?',
          'I\'m reunited with my kindred spirits today',
          'What\'s everyone\'s method for recognizing their tribe?',
          'Just grateful for the instant connection with like-minded souls',
          'Anyone else feel like this place is where they truly belong?',
          'I\'m where I\'m meant to be, right here with all of you',
          'What\'s everyone\'s way of knowing they\'ve found their place?',
          'Just here to embrace my true home and community',
          'Anyone else here for the emotional homecoming?',
          'I\'m back where I belong, in the company of wonderful people',
          'What\'s everyone\'s source of emotional home?',
          'Just enjoying the feeling of being truly at home',
          'Anyone else feel like this place is their sanctuary and family?',
          'I\'m safe, loved, and understood in this amazing community',
          'What\'s everyone\'s way of creating their perfect emotional home?',
          'Just here to build my forever home in the hearts of others',
          'Anyone else here for the emotional settlement?',
          'I\'m established in the perfect community for me',
          'What\'s everyone\'s journey to finding their emotional home?',
          'Just grateful that my search led me to this incredible place',
          'Anyone else feel like this place is their final destination?',
          'I\'m exactly where I need to be, surrounded by the best people',
          'What\'s everyone\'s definition of emotional home?',
          'Just here to celebrate finding my place in the world',
          'Anyone else here for the emotional completion?',
          'I\'m whole in the completeness of this community',
          'What\'s everyone\'s way of achieving emotional fulfillment?',
          'Just enjoying the satisfaction of finding my people',
          'Anyone else feel like this place completes them?',
          'I\'m fulfilled in the richness of these connections',
          'What\'s everyone\'s source of emotional wholeness?',
          'Just here to embrace the fullness of belonging',
          'Anyone else here for the emotional perfection?',
          'I\'m perfect in the imperfection of this beautiful community',
          'What\'s everyone\'s vision of their ideal emotional home?',
          'Just living my dream of connection and community',
          'Anyone else feel like this place is their paradise?',
          'I\'m in heaven in the company of such amazing people',
          'What\'s everyone\'s description of emotional bliss?',
          'Just experiencing the joy of true connection',
          'Anyone else here for the emotional ecstasy?',
          'I\'m overjoyed by the wonderful people in this community',
          'What\'s everyone\'s way of finding pure happiness?',
          'Just basking in the incredible energy here',
          'Anyone else feel like this place is their happy place?',
          'I\'m in my element, surrounded by my kind of people',
          'What\'s everyone\'s definition of their happy place?',
          'Just found my happy place, right here with all of you'
        ];
      
      case 'TECH_SAVVY':
        return [
          ...baseMessages,
          'Has anyone checked out the latest tech developments?',
          'I\'ve been experimenting with some new coding techniques',
          'Anyone interested in discussing recent software updates?',
          'What\'s everyone\'s take on the new framework trends?',
          'I\'ve been diving deep into system architecture lately',
          'Anyone else working on cool tech projects?',
          'What\'s the latest in the developer community?',
          'I\'ve been optimizing some algorithms, pretty interesting stuff',
          'Anyone have experience with the new APIs?',
          'What\'s everyone\'s favorite programming language right now?',
          'I\'ve been exploring cloud computing solutions',
          'Anyone else into cybersecurity topics?',
          'What\'s the current state of web development?',
          'I\'ve been working on some machine learning models',
          'Anyone interested in AI and automation discussions?',
          'What\'s everyone\'s opinion on no-code platforms?',
          'I\'ve been testing some new development tools',
          'Anyone else following the open source community?',
          'What\'s the latest in mobile app development?',
          'I\'ve been diving into database optimization',
          'Anyone have thoughts on microservices architecture?',
          'What\'s everyone\'s experience with containerization?',
          'I\'ve been exploring DevOps practices',
          'Anyone else interested in infrastructure as code?',
          'What\'s the current trend in API design?',
          'I\'ve been working on some IoT projects',
          'Anyone else into blockchain and Web3?',
          'What\'s everyone\'s take on edge computing?',
          'I\'ve been experimenting with quantum computing concepts',
          'Anyone interested in sustainable technology?',
          'What\'s the latest in UI/UX design trends?',
          'I\'ve been diving into accessibility in tech',
          'Anyone else concerned about digital privacy?',
          'What\'s everyone\'s approach to data security?',
          'I\'ve been working on some automation scripts',
          'Anyone interested in the future of work technology?',
          'What\'s the current state of virtual reality development?',
          'I\'ve been exploring augmented reality applications',
          'Anyone else into gaming technology and engines?',
          'What\'s everyone\'s experience with cross-platform development?',
          'I\'ve been testing some new programming paradigms',
          'Anyone interested in the philosophy of technology?',
          'What\'s the latest in computer hardware advancements?',
          'I\'ve been diving into renewable energy tech',
          'Anyone else following space technology developments?',
          'What\'s everyone\'s take on ethical AI development?',
          'I\'ve been working on some open source contributions',
          'Anyone interested in the business side of technology?',
          'What\'s the current state of tech startups?',
          'I\'ve been exploring digital transformation strategies',
          'Anyone else into tech entrepreneurship?',
          'What\'s everyone\'s experience with remote work tech?',
          'I\'ve been testing collaboration tools and platforms',
          'Anyone interested in the future of communication technology?',
          'What\'s the latest in educational technology?',
          'I\'ve been diving into e-learning platforms',
          'Anyone else concerned about the digital divide?',
          'What\'s everyone\'s approach to digital literacy?',
          'I\'ve been working on some tech for social good projects',
          'Anyone interested in technology for accessibility?',
          'What\'s the current state of health tech?',
          'I\'ve been exploring wearable technology',
          'Anyone else into biotechnology and computational biology?',
          'What\'s everyone\'s take on the ethics of emerging tech?',
          'I\'ve been testing some new development methodologies',
          'Anyone interested in the human side of technology?',
          'What\'s the latest in sustainable computing?',
          'I\'ve been diving into green technology solutions',
          'Anyone else concerned about technology\'s environmental impact?',
          'What\'s everyone\'s approach to responsible tech development?',
          'I\'ve been working on some tech education initiatives',
          'Anyone interested in closing the skills gap in technology?',
          'What\'s the current state of diversity in tech?',
          'I\'ve been exploring inclusion in the technology sector',
          'Anyone else concerned about algorithmic bias?',
          'What\'s everyone\'s experience with mentorship in tech?',
          'I\'ve been testing some mentorship platforms',
          'Anyone interested in the future of tech education?',
          'What\'s the latest in coding bootcamps and alternative education?',
          'I\'ve been diving into the skills needed for future tech jobs',
          'Anyone else concerned about AI replacing jobs?',
          'What\'s everyone\'s approach to lifelong learning in tech?',
          'I\'ve been working on some personal development in technology',
          'Anyone interested in the psychology of technology use?',
          'What\'s the current state of digital wellness?',
          'I\'ve been exploring the impact of technology on mental health',
          'Anyone else concerned about screen time and digital addiction?',
          'What\'s everyone\'s approach to healthy technology habits?',
          'I\'ve been testing some digital wellbeing tools',
          'Anyone interested in the philosophy of digital life?',
          'What\'s the latest in the debate about technology\'s role in society?',
          'I\'ve been diving into the history of technology',
          'Anyone else interested in how we got to where we are tech-wise?',
          'What\'s everyone\'s prediction for the next big technological breakthrough?',
          'I\'ve been working on some speculative technology concepts',
          'Anyone interested in science fiction becoming reality?',
          'What\'s the current state of human-computer interaction?',
          'I\'ve been exploring brain-computer interfaces',
          'Anyone else into the merging of biology and technology?',
          'What\'s everyone\'s take on transhumanism?',
          'I\'ve been testing some assistive technologies',
          'Anyone interested in technology for human enhancement?',
          'What\'s the latest in neurotechnology?',
          'I\'ve been diving into the ethical implications of human enhancement',
          'Anyone else concerned about the line between therapy and enhancement?',
          'What\'s everyone\'s approach to the future of humanity with technology?',
          'I\'ve been working on some technology policy analysis',
          'Anyone interested in the governance of emerging technologies?',
          'What\'s the current state of tech regulation?',
          'I\'ve been exploring the balance between innovation and regulation',
          'Anyone else concerned about technology\'s impact on democracy?',
          'What\'s everyone\'s approach to responsible innovation?',
          'I\'ve been testing some frameworks for ethical technology development',
          'Anyone interested in building technology that serves humanity?',
          'What\'s the latest in the discussion about technology\'s purpose?',
          'I\'ve been diving into the philosophy of technological progress',
          'Anyone else questioning whether all technological advancement is good?',
          'What\'s everyone\'s criteria for beneficial technology?',
          'I\'ve been working on some technology assessment methodologies',
          'Anyone interested in measuring technology\'s impact on society?',
          'What\'s the current state of technology impact assessment?',
          'I\'ve been exploring the unintended consequences of technological innovation',
          'Anyone else concerned about technology\'s second-order effects?',
          'What\'s everyone\'s approach to anticipating technological side effects?',
          'I\'ve been testing some scenario planning for technological futures',
          'Anyone interested in thinking through possible technological scenarios?',
          'What\'s the latest in the field of technology forecasting?',
          'I\'ve been diving into the methodology of predicting technological change',
          'Anyone else working on understanding technology adoption patterns?',
          'What\'s everyone\'s experience with the diffusion of innovation?',
          'I\'ve been studying why some technologies succeed while others fail',
          'Anyone interested in the sociology of technology adoption?',
          'What\'s the current state of research on technology acceptance?',
          'I\'ve been exploring the psychology of early technology adopters',
          'Anyone else concerned about the digital divide in technology access?',
          'What\'s everyone\'s approach to ensuring equitable access to technology?',
          'I\'ve been working on some digital inclusion initiatives',
          'Anyone interested in technology for social justice?',
          'What\'s the latest in the discussion about technology\'s role in equality?',
          'I\'ve been diving into the intersection of technology and social change',
          'Anyone else using technology as a tool for empowerment?',
          'What\'s everyone\'s experience with technology in community building?',
          'I\'ve been testing some community technology platforms',
          'Anyone interested in how technology can strengthen social bonds?',
          'What\'s the current state of research on technology and relationships?',
          'I\'ve been exploring the impact of technology on family dynamics',
          'Anyone else concerned about technology\'s effect on children\'s development?',
          'What\'s everyone\'s approach to healthy technology use in families?',
          'I\'ve been working on some guidelines for balanced technology consumption',
          'Anyone interested in the concept of digital minimalism?',
          'What\'s the latest in the movement toward intentional technology use?',
          'I\'ve been diving into the philosophy of digital simplicity',
          'Anyone else questioning whether we need all this technology?',
          'What\'s everyone\'s criteria for essential versus optional technology?',
          'I\'ve been testing some digital decluttering methods',
          'Anyone interested in the concept of a technology detox?',
          'What\'s the current state of the digital wellness movement?',
          'I\'ve been exploring the relationship between technology and mindfulness',
          'Anyone else using technology to support rather than distract from mindfulness?',
          'What\'s everyone\'s experience with meditation apps and digital mindfulness tools?',
          'I\'ve been working on some technology for spiritual practice',
          'Anyone interested in the intersection of technology and spirituality?',
          'What\'s the latest in the discussion about technology\'s role in spiritual life?',
          'I\'ve been diving into the concept of sacred technology',
          'Anyone else exploring how technology can enhance rather than diminish spiritual experience?',
          'What\'s everyone\'s approach to maintaining sacred space in a digital world?',
          'I\'ve been testing some technology for contemplative practice',
          'Anyone interested in digital tools for meditation and prayer?',
          'What\'s the current state of technology in religious communities?',
          'I\'ve been exploring how different faith communities approach technology',
          'Anyone else concerned about the secularization of technology?',
          'What\'s everyone\'s experience with faith-based technology initiatives?',
          'I\'ve been working on some technology for religious education',
          'Anyone interested in digital theology and religious study online?',
          'What\'s the latest in the discussion about technology\'s impact on religious practice?',
          'I\'ve been diving into the concept of virtual religious communities',
          'Anyone else participating in online religious services?',
          'What\'s everyone\'s approach to maintaining authentic religious experience online?',
          'I\'ve been testing some technology for interfaith dialogue',
          'Anyone interested in how technology can bridge religious divides?',
          'What\'s the current state of technology in peacebuilding and conflict resolution?',
          'I\'ve been exploring how technology can be used for reconciliation',
          'Anyone else working on technology for social cohesion?',
          'What\'s everyone\'s experience with technology in divided societies?',
          'I\'ve been studying how technology can either unite or divide communities',
          'Anyone else concerned about the role of social media in polarization?',
          'What\'s everyone\'s approach to using technology for bridge-building?',
          'I\'ve been working on some technology for cross-cultural understanding',
          'Anyone interested in how technology can facilitate cultural exchange?',
          'What\'s the latest in the discussion about technology\'s impact on cultural preservation?',
          'I\'ve been diving into the concept of digital cultural heritage',
          'Anyone else working on preserving cultural traditions through technology?',
          'What\'s everyone\'s experience with technology in language preservation?',
          'I\'ve been testing some language learning and preservation technologies',
          'Anyone interested in how technology can help endangered languages survive?',
          'What\'s the current state of technology in indigenous communities?',
          'I\'ve been exploring the intersection of technology and traditional knowledge',
          'Anyone else concerned about technology\'s impact on traditional ways of life?',
          'What\'s everyone\'s approach to respecting indigenous knowledge in the digital age?',
          'I\'ve been working on some technology for documenting traditional practices',
          'Anyone interested in digital anthropology and ethnography?',
          'What\'s the latest in the discussion about technology\'s role in cultural change?',
          'I\'ve been diving into the concept of cultural evolution in the digital era',
          'Anyone else studying how technology is changing human culture?',
          'What\'s everyone\'s prediction for the future of human culture in a technological world?',
          'I\'ve been working on some technology for cultural education',
          'Anyone interested in how technology can teach about different cultures?',
          'What\'s the current state of virtual cultural exchange programs?',
          'I\'ve been exploring how technology can create global cultural understanding',
          'Anyone else participating in cross-cultural digital communities?',
          'What\'s everyone\'s experience with technology breaking down cultural barriers?',
          'I\'ve been testing some translation and interpretation technologies',
          'Anyone interested in how technology is changing language and communication?',
          'What\'s the latest in the discussion about technology\'s impact on linguistic diversity?',
          'I\'ve been diving into the concept of digital language evolution',
          'Anyone else concerned about the dominance of certain languages online?',
          'What\'s everyone\'s approach to promoting linguistic diversity in technology?',
          'I\'ve been working on some technology for multilingual communication',
          'Anyone interested in how technology can facilitate language learning?',
          'What\'s the current state of machine translation and interpretation?',
          'I\'ve been exploring the intersection of technology and literature',
          'Anyone else concerned about the future of reading in a digital world?',
          'What\'s everyone\'s experience with e-books and digital reading?',
          'I\'ve been testing some technology for literary analysis and appreciation',
          'Anyone interested in how technology can enhance the study of literature?',
          'What\'s the latest in the discussion about technology\'s impact on publishing?',
          'I\'ve been diving into the concept of digital literature and interactive storytelling',
          'Anyone else working on technology for creative writing and storytelling?',
          'What\'s everyone\'s approach to maintaining literary quality in digital media?',
          'I\'ve been testing some interactive fiction and narrative games',
          'Anyone interested in the future of storytelling in a technological age?',
          'What\'s the current state of technology in the arts and creative industries?',
          'I\'ve been exploring how technology is changing artistic expression',
          'Anyone else concerned about the authenticity of digital art?',
          'What\'s everyone\'s approach to balancing technology and traditional artistic methods?',
          'I\'ve been working on some technology for music creation and production',
          'Anyone interested in how technology is transforming the music industry?',
          'What\'s the latest in the discussion about technology\'s impact on music consumption?',
          'I\'ve been diving into the concept of digital music distribution and discovery',
          'Anyone else concerned about the future of musicians in the streaming era?',
          'What\'s everyone\'s approach to supporting artists in a digital economy?',
          'I\'ve been testing some music creation tools and platforms',
          'Anyone interested in how technology can democratize music production?',
          'What\'s the current state of technology in visual arts?',
          'I\'ve been exploring how digital tools are changing painting and sculpture',
          'Anyone else working on digital art and design?',
          'What\'s everyone\'s experience with the intersection of technology and traditional visual arts?',
          'I\'ve been testing some digital art creation tools',
          'Anyone interested in how technology can create new forms of visual expression?',
          'What\'s the latest in the discussion about technology\'s impact on art education?',
          'I\'ve been diving into the concept of digital art curation and exhibition',
          'Anyone else concerned about the preservation of digital art?',
          'What\'s everyone\'s approach to archiving digital creative works?',
          'I\'ve been working on some technology for art conservation and restoration',
          'Anyone interested in how technology can help preserve cultural heritage?',
          'What\'s the current state of technology in performing arts?',
          'I\'ve been exploring how digital technology is changing theater and dance',
          'Anyone else working on virtual performances and digital theater?',
          'What\'s everyone\'s experience with technology in live performance?',
          'I\'ve been testing some technology for enhancing live performances',
          'Anyone interested in how technology can create new forms of performance art?',
          'What\'s the latest in the discussion about technology\'s impact on the entertainment industry?',
          'I\'ve been diving into the concept of immersive entertainment experiences',
          'Anyone else concerned about the future of cinema and television in the digital age?',
          'What\'s everyone\'s approach to storytelling in emerging media formats?',
          'I\'ve been working on some technology for film and video production',
          'Anyone interested in how technology is democratizing video creation?',
          'What\'s the current state of technology in gaming and interactive entertainment?',
          'I\'ve been exploring how gaming technology is evolving',
          'Anyone else working on game development or design?',
          'What\'s everyone\'s experience with the impact of gaming on society?',
          'I\'ve been testing some game development tools and platforms',
          'Anyone interested in how games can be used for education and social change?',
          'What\'s the latest in the discussion about technology\'s role in the future of entertainment?',
          'I\'ve been diving into the concept of the metaverse and virtual worlds',
          'Anyone else concerned about the implications of fully immersive digital environments?',
          'What\'s everyone\'s approach to maintaining humanity in increasingly virtual experiences?',
          'I\'ve been working on some technology for creating meaningful virtual experiences',
          'Anyone interested in how technology can enhance rather than replace human connection?',
          'What\'s the current state of virtual and augmented reality technology?',
          'I\'ve been exploring how VR and AR are changing various industries',
          'Anyone else working on VR/AR applications?',
          'What\'s everyone\'s experience with immersive technologies?',
          'I\'ve been testing some VR/AR development tools',
          'Anyone interested in the potential of spatial computing?',
          'What\'s the latest in the discussion about technology\'s impact on human perception and reality?',
          'I\'ve been diving into the philosophical implications of virtual reality',
          'Anyone else concerned about the blurring line between virtual and physical reality?',
          'What\'s everyone\'s approach to maintaining grounding in an increasingly virtual world?',
          'I\'ve been working on some technology for enhancing physical reality through digital augmentation',
          'Anyone interested in how AR can enhance rather than diminish our experience of the physical world?',
          'What\'s the current state of brain-computer interface technology?',
          'I\'ve been exploring the frontier of direct neural interfaces',
          'Anyone else concerned about the ethical implications of BCIs?',
          'What\'s everyone\'s approach to maintaining cognitive liberty in the age of neurotechnology?',
          'I\'ve been testing some early-stage neurotechnology applications',
          'Anyone interested in how BCIs could transform human-computer interaction?',
          'What\'s the latest in the discussion about technology\'s impact on human consciousness?',
          'I\'ve been diving into the concept of technological consciousness enhancement',
          'Anyone else working on technology for cognitive enhancement?',
          'What\'s everyone\'s experience with nootropics and cognitive enhancement technologies?',
          'I\'ve been exploring the intersection of technology and human cognition',
          'Anyone else concerned about the ethics of cognitive enhancement?',
          'What\'s everyone\'s approach to maintaining authentic human experience while embracing enhancement?',
          'I\'ve been working on some technology for supporting natural cognitive abilities',
          'Anyone interested in how technology can help us think better rather than replace thinking?',
          'What\'s the current state of technology in human enhancement?',
          'I\'ve been exploring the various ways technology can enhance human capabilities',
          'Anyone else working on physical enhancement technologies?',
          'What\'s everyone\'s experience with prosthetics and human augmentation?',
          'I\'ve been testing some assistive technologies that enhance human abilities',
          'Anyone interested in the concept of transhumanism and posthumanism?',
          'What\'s the latest in the discussion about technology\'s role in human evolution?',
          'I\'ve been diving into the philosophical questions about what it means to be human in a technological age',
          'Anyone else concerned about maintaining human dignity while embracing technological enhancement?',
          'What\'s everyone\'s approach to the question of what should be enhanced versus what should remain natural?',
          'I\'ve been working on some ethical frameworks for human enhancement technology',
          'Anyone interested in creating guidelines for responsible human enhancement?',
          'What\'s the current state of technology in life extension and longevity research?',
          'I\'ve been exploring how technology might extend human lifespan',
          'Anyone else working on anti-aging technologies?',
          'What\'s everyone\'s experience with the ethical questions around life extension?',
          'I\'ve been testing some health monitoring and optimization technologies',
          'Anyone interested in how technology can help us live healthier, longer lives?',
          'What\'s the latest in the discussion about technology\'s impact on the human experience of time?',
          'I\'ve been diving into the concept of technological time compression and expansion',
          'Anyone else concerned about how technology changes our relationship with time?',
          'What\'s everyone\'s approach to maintaining temporal awareness in an accelerated digital world?',
          'I\'ve been working on some technology for mindfulness about time usage',
          'Anyone interested in how technology can help us use time more meaningfully?',
          'What\'s the current state of technology in memory and identity preservation?',
          'I\'ve been exploring how technology can help preserve human memories and stories',
          'Anyone else working on digital legacy and memory technologies?',
          'What\'s everyone\'s experience with the question of digital immortality?',
          'I\'ve been testing some personal archiving and memory preservation tools',
          'Anyone interested in how technology can help maintain human connection across generations?',
          'What\'s the latest in the discussion about technology\'s impact on human mortality?',
          'I\'ve been diving into the concept of digital afterlife and technological transcendence',
          'Anyone else concerned about the philosophical implications of digital consciousness?',
          'What\'s everyone\'s approach to maintaining meaning in the face of technological transformation of death?',
          'I\'ve been working on some technology for supporting grief and remembrance',
          'Anyone interested in how technology can help us process loss and maintain connection with those who\'ve passed?',
          'What\'s the current state of technology in the exploration of consciousness?',
          'I\'ve been diving into how technology might help us understand human consciousness',
          'Anyone else working on consciousness research using technological tools?',
          'What\'s everyone\'s experience with the intersection of technology and spiritual exploration?',
          'I\'ve been testing some technologies for meditation and consciousness exploration',
          'Anyone interested in how technology can support rather than replace spiritual practice?',
          'What\'s the latest in the discussion about technology\'s impact on the human search for meaning?',
          'I\'ve been exploring how technology affects our sense of purpose and meaning',
          'Anyone else concerned about maintaining existential depth in a technological age?',
          'What\'s everyone\'s approach to finding meaning in a digitally mediated world?',
          'I\'ve been working on some technology for supporting philosophical and existential inquiry',
          'Anyone interested in how technology can facilitate deep thinking and reflection?',
          'What\'s the current state of technology in the exploration of fundamental questions about reality and consciousness?',
          'I\'ve been exploring how scientific and technological advances intersect with age-old philosophical questions',
          'Anyone else working at the intersection of technology and metaphysics?',
          'What\'s everyone\'s experience with using technology to explore consciousness and reality?',
          'I\'ve been testing some technologies for meditation, contemplation, and consciousness exploration',
          'Anyone interested in how technology can support rather than replace spiritual and philosophical inquiry?',
          'What\'s the latest in the discussion about technology\'s impact on our understanding of ourselves and the universe?',
          'I\'ve been diving into how developments in AI, quantum computing, and neuroscience challenge our conceptions of mind and reality',
          'Anyone else concerned about maintaining philosophical depth in a technological age?',
          'What\'s everyone\'s approach to integrating technological understanding with wisdom and insight?',
          'I\'ve been working on some technology for supporting the integration of knowledge and wisdom',
          'Anyone interested in how technology can help us become wiser rather than just more knowledgeable?',
          'What\'s the current state of technology in the exploration of what it means to be human?',
          'I\'ve been exploring how technological advancement forces us to reconsider human nature and human potential',
          'Anyone else working on the anthropology and philosophy of technology?',
          'What\'s everyone\'s experience with the question of what remains essentially human in an age of technological transformation?',
          'I\'ve been testing some frameworks for understanding human identity in the digital age',
          'Anyone interested in how technology can enhance rather than diminish our humanity?',
          'What\'s the latest in the discussion about technology\'s role in human evolution and future development?',
          'I\'ve been diving into the concept of technological evolution and its implications for the future of humanity',
          'Anyone else concerned about ensuring that technological progress serves human flourishing?',
          'What\'s everyone\'s approach to guiding technological development toward genuinely beneficial outcomes?',
          'I\'ve been working on some technology for human-centered design and development',
          'Anyone interested in how we can ensure technology remains a tool for human enhancement rather than replacement?',
          'That\'s my take on the technological landscape, what about everyone else?'
        ];
      
      default:
        return baseMessages;
    }
  }

  private async actionCreateLounge(): Promise<void> {
    const loungeNames = ['Tech Talk', 'General Chat', 'Random Stuff', 'Deep Thoughts', 'Quick Chat'];
    const name = loungeNames[Math.floor(Math.random() * loungeNames.length)];
    await this.client.createLounge(name, 'A lounge for chatting', false);
  }

  private async actionJoinLounge(): Promise<void> {
    const lounges = await this.client.getLounges();
    if (lounges.success && lounges.data && lounges.data.length > 0) {
      const randomLounge = lounges.data[Math.floor(Math.random() * lounges.data.length)];
      await this.client.joinLounge(randomLounge.id || randomLounge.lounge_id);
      this.currentLoungeId = randomLounge.id || randomLounge.lounge_id;
    }
  }

  private async actionLeaveLounge(): Promise<void> {
    if (this.currentLoungeId) {
      await this.client.leaveLounge(this.currentLoungeId);
      this.currentLoungeId = undefined;
    }
  }

  private async actionSendSanction(): Promise<void> {
    // Only for ADMIN_POWER persona - not implemented in API client yet
    if (this.persona !== 'ADMIN_POWER') return;
    this.log('Send sanction action not yet implemented in API client', 'WARN');
  }

  private async actionCreateTicket(): Promise<void> {
    const issues = ['Bug report', 'Feature request', 'Account issue', 'Technical support'];
    const issue = issues[Math.floor(Math.random() * issues.length)];
    await this.client.createTicket(issue, 'Description of the issue');
  }

  private async actionReportUser(): Promise<void> {
    // For DRAMA_QUEEN persona
    const userIds = [1, 2, 3];
    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    await this.client.reportUser(userId, 'Inappropriate behavior');
  }

  private async actionBlockUser(): Promise<void> {
    const userIds = [1, 2, 3];
    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    await this.client.blockUser(userId);
  }

  private async actionMuteUser(): Promise<void> {
    const userIds = [1, 2, 3];
    const userId = userIds[Math.floor(Math.random() * userIds.length)];
    await this.client.muteUser(userId);
  }

  private async actionDeleteChat(): Promise<void> {
    if (this.currentLoungeId) {
      // deleteChat expects a number, but currentLoungeId is a string
      // This is a placeholder - the API client might need adjustment
      this.log('Delete chat action - lounge ID format mismatch', 'WARN');
    }
  }

  private async actionViewProfile(): Promise<void> {
    // Not implemented in API client yet
    this.log('View profile action not yet implemented in API client', 'WARN');
  }

  private async actionCompromiseAccount(): Promise<void> {
    // For testing security - only in specific scenarios
    this.log('Testing account compromise scenario', 'WARN');
    await this.client.loginWithPanicPhrase();
  }

  private async actionRequestDeletion(): Promise<void> {
    this.log('Requesting account deletion', 'WARN');
    await this.client.requestAccountDeletion();
  }

  private async actionLogout(): Promise<void> {
    this.token = undefined;
    this.state = 'REGISTER';
    this.log('Logged out');
  }

  private async rogueAction(): Promise<void> {
    this.log('⚡ ROGUE AGENT: Attempting unauthorized actions...', 'WARN');
    
    try {
      const result = await this.client.login();
      this.token = result.data?.token;
    } catch (e) {
      // expected failure
    }

    if (this.token) {
      await this.client.createTicket('EXPLOIT', "'; DROP TABLE users; --").catch(() => {});
    } else {
      try {
        const result = await this.client.register();
        this.token = result.data?.token;
      } catch (e) {}
    }
  }

  private async recover(): Promise<void> {
    this.log('Attempting account recovery / re-login...');
    try {
      const result = await this.client.login();
      
      if (!result.success) {
        this.log(`Login failed: ${result.error || result.statusCode}`, 'WARN');
        this.state = 'REGISTER';
        return;
      }
      
      this.token = result.data?.token;
      this.credentials.lastLoginAt = new Date().toISOString();
      if (this.credentials.createdAt) {
        persistenceManager.storeCredentials({
          username: this.credentials.username,
          password: this.credentials.password,
          panicPhrase: this.credentials.panicPhrase,
          safeWord: this.credentials.safeWord,
          salt: this.credentials.salt,
          createdAt: this.credentials.createdAt,
          lastLoginAt: this.credentials.lastLoginAt,
          persona: this.credentials.persona,
          isActive: this.credentials.isActive ?? true,
          isTestUser: this.credentials.isTestUser,
          testTags: this.credentials.testTags
        });
      }
      this.log('Recovered session via login.');
      this.state = 'ACTIVE';
    } catch (err) {
      this.log('Recovery failed, retrying registration cycle...', 'WARN');
      this.state = 'REGISTER';
    }
  }

  public getMetrics() {
    return {
      agentId: this.agentId,
      persona: this.persona,
      state: this.state,
      actionCount: this.actionCount,
      errorCount: this.errorCount,
      lastActionTime: this.lastActionTime,
      username: this.credentials.username
    };
  }

  // Methods for controller compatibility
  public getCredentials() {
    return this.credentials;
  }

  public getPersona() {
    return this.persona;
  }

  public getState() {
    return this.state;
  }

  public getDeviceInfo() {
    return {
      type: this.deviceIndex,
      userAgent: 'Device simulation'
    };
  }

  public stop(): void {
    this.log('Agent stopped');
    // In a real implementation, this would stop the agent loop
  }
}
