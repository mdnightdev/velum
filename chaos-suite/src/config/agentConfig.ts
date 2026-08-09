// Realistic user personas with behavioral patterns
export type PersonaType = 
  | 'SOCIAL_BUTTERFLY'    // Very active, creates lounges, messages everyone
  | 'LURKER'              // Mostly reads, rarely posts
  | 'SPAMMER'             // High volume, repetitive actions
  | 'ADMIN_POWER'         // Uses admin features, sanctions users
  | 'SUPPORT_SEEKER'     // Creates tickets, asks for help
  | 'DRAMA_QUEEN'         // Reports users, creates conflicts
  | 'TECH_SAVVY'          // Tests features, tries edge cases
  | 'CASUAL_USER'         // Normal usage patterns
  | 'NIGHT_OWL'           // Active at odd hours
  | 'WEEKEND_WARRIOR';    // Active mainly on weekends

export interface PersonaConfig {
  type: PersonaType;
  name: string;
  description: string;
  // Action weights (higher = more likely)
  actionWeights: {
    sendMessage: number;
    createLounge: number;
    joinLounge: number;
    leaveLounge: number;
    sendSanction: number;
    createTicket: number;
    reportUser: number;
    blockUser: number;
    muteUser: number;
    deleteChat: number;
    viewProfile: number;
    compromiseAccount: number;
    requestDeletion: number;
    login: number;
    logout: number;
  };
  // Timing patterns
  timingPatterns: {
    minActionInterval: number;  // ms
    maxActionInterval: number;  // ms
    activeHours: number[];      // 0-23, empty = all day
    inactivityProbability: number; // 0-1
    weekendOnly?: boolean;      // Optional flag for weekend-only behavior
  };
  // Error behavior
  errorBehavior: {
    retryAttempts: number;
    backoffMultiplier: number;
    ignoreCertainErrors: boolean;
  };
}

export const PERSONAS: Record<PersonaType, PersonaConfig> = {
  SOCIAL_BUTTERFLY: {
    type: 'SOCIAL_BUTTERFLY',
    name: 'Social Butterfly',
    description: 'Very active user who loves to create lounges and message everyone',
    actionWeights: {
      sendMessage: 60, // Increased from 40 - very talkative
      createLounge: 10,
      joinLounge: 8,
      leaveLounge: 2,
      sendSanction: 1,
      createTicket: 1,
      reportUser: 1,
      blockUser: 1,
      muteUser: 2,
      deleteChat: 1,
      viewProfile: 8,
      compromiseAccount: 0,
      requestDeletion: 0,
      login: 3,
      logout: 2
    },
    timingPatterns: {
      minActionInterval: 2000,
      maxActionInterval: 8000,
      activeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
      inactivityProbability: 0.1
    },
    errorBehavior: {
      retryAttempts: 3,
      backoffMultiplier: 2,
      ignoreCertainErrors: true
    }
  },
  
  LURKER: {
    type: 'LURKER',
    name: 'Lurker',
    description: 'Mostly reads content, rarely posts or interacts',
    actionWeights: {
      sendMessage: 5,
      createLounge: 0,
      joinLounge: 8,
      leaveLounge: 2,
      sendSanction: 0,
      createTicket: 0,
      reportUser: 0,
      blockUser: 1,
      muteUser: 2,
      deleteChat: 1,
      viewProfile: 30,
      compromiseAccount: 0,
      requestDeletion: 0,
      login: 8,
      logout: 5
    },
    timingPatterns: {
      minActionInterval: 5000,
      maxActionInterval: 20000,
      activeHours: [],
      inactivityProbability: 0.4
    },
    errorBehavior: {
      retryAttempts: 1,
      backoffMultiplier: 1.5,
      ignoreCertainErrors: true
    }
  },
  
  SPAMMER: {
    type: 'SPAMMER',
    name: 'Spammer',
    description: 'High volume repetitive actions, tries to bypass limits',
    actionWeights: {
      sendMessage: 60,
      createLounge: 10,
      joinLounge: 5,
      leaveLounge: 5,
      sendSanction: 0,
      createTicket: 0,
      reportUser: 0,
      blockUser: 0,
      muteUser: 0,
      deleteChat: 0,
      viewProfile: 2,
      compromiseAccount: 0,
      requestDeletion: 0,
      login: 3,
      logout: 0
    },
    timingPatterns: {
      minActionInterval: 500,
      maxActionInterval: 2000,
      activeHours: [],
      inactivityProbability: 0.05
    },
    errorBehavior: {
      retryAttempts: 5,
      backoffMultiplier: 1.2,
      ignoreCertainErrors: false
    }
  },
  
  ADMIN_POWER: {
    type: 'ADMIN_POWER',
    name: 'Admin Power User',
    description: 'Tests admin features, sanctions users, manages lounges',
    actionWeights: {
      sendMessage: 20,
      createLounge: 10,
      joinLounge: 5,
      leaveLounge: 2,
      sendSanction: 15,
      createTicket: 5,
      reportUser: 8,
      blockUser: 10,
      muteUser: 12,
      deleteChat: 3,
      viewProfile: 8,
      compromiseAccount: 0,
      requestDeletion: 0,
      login: 2,
      logout: 1
    },
    timingPatterns: {
      minActionInterval: 3000,
      maxActionInterval: 10000,
      activeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      inactivityProbability: 0.15
    },
    errorBehavior: {
      retryAttempts: 2,
      backoffMultiplier: 2,
      ignoreCertainErrors: false
    }
  },
  
  SUPPORT_SEEKER: {
    type: 'SUPPORT_SEEKER',
    name: 'Support Seeker',
    description: 'Frequently creates tickets and asks for help',
    actionWeights: {
      sendMessage: 25, // Increased from 15 - more talkative
      createLounge: 2,
      joinLounge: 5,
      leaveLounge: 1,
      sendSanction: 0,
      createTicket: 30, // Slightly reduced to make room for more messages
      reportUser: 2,
      blockUser: 3,
      muteUser: 5,
      deleteChat: 2,
      viewProfile: 5,
      compromiseAccount: 0,
      requestDeletion: 0,
      login: 5,
      logout: 3
    },
    timingPatterns: {
      minActionInterval: 4000,
      maxActionInterval: 12000,
      activeHours: [10, 11, 12, 13, 14, 15, 16, 17, 18],
      inactivityProbability: 0.2
    },
    errorBehavior: {
      retryAttempts: 2,
      backoffMultiplier: 1.5,
      ignoreCertainErrors: true
    }
  },
  
  DRAMA_QUEEN: {
    type: 'DRAMA_QUEEN',
    name: 'Drama Queen',
    description: 'Reports users, creates conflicts, high emotional actions',
    actionWeights: {
      sendMessage: 35, // Increased from 25 - very talkative when creating drama
      createLounge: 6,
      joinLounge: 4,
      leaveLounge: 6,
      sendSanction: 5,
      createTicket: 3,
      reportUser: 18, // Slightly reduced
      blockUser: 12, // Slightly reduced
      muteUser: 8, // Slightly reduced
      deleteChat: 4,
      viewProfile: 10,
      compromiseAccount: 0,
      requestDeletion: 0,
      login: 4,
      logout: 2
    },
    timingPatterns: {
      minActionInterval: 2500,
      maxActionInterval: 7000,
      activeHours: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
      inactivityProbability: 0.1
    },
    errorBehavior: {
      retryAttempts: 3,
      backoffMultiplier: 1.8,
      ignoreCertainErrors: false
    }
  },
  
  TECH_SAVVY: {
    type: 'TECH_SAVVY',
    name: 'Tech Savvy',
    description: 'Tests features, tries edge cases, explores the system',
    actionWeights: {
      sendMessage: 30, // Increased from 20 - more talkative
      createLounge: 10,
      joinLounge: 8,
      leaveLounge: 6,
      sendSanction: 5,
      createTicket: 8,
      reportUser: 3,
      blockUser: 4,
      muteUser: 6,
      deleteChat: 4,
      viewProfile: 12,
      compromiseAccount: 2,
      requestDeletion: 1,
      login: 2,
      logout: 2
    },
    timingPatterns: {
      minActionInterval: 3000,
      maxActionInterval: 9000,
      activeHours: [],
      inactivityProbability: 0.15
    },
    errorBehavior: {
      retryAttempts: 4,
      backoffMultiplier: 2,
      ignoreCertainErrors: false
    }
  },
  
  CASUAL_USER: {
    type: 'CASUAL_USER',
    name: 'Casual User',
    description: 'Normal usage patterns, moderate activity',
    actionWeights: {
      sendMessage: 35, // Increased from 25 - more talkative
      createLounge: 5,
      joinLounge: 8,
      leaveLounge: 3,
      sendSanction: 1,
      createTicket: 2,
      reportUser: 1,
      blockUser: 2,
      muteUser: 3,
      deleteChat: 2,
      viewProfile: 10,
      compromiseAccount: 0,
      requestDeletion: 0,
      login: 6,
      logout: 4
    },
    timingPatterns: {
      minActionInterval: 4000,
      maxActionInterval: 15000,
      activeHours: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      inactivityProbability: 0.25
    },
    errorBehavior: {
      retryAttempts: 2,
      backoffMultiplier: 1.5,
      ignoreCertainErrors: true
    }
  },
  
  NIGHT_OWL: {
    type: 'NIGHT_OWL',
    name: 'Night Owl',
    description: 'Active mainly during late night hours',
    actionWeights: {
      sendMessage: 40, // Increased from 30 - very talkative at night
      createLounge: 6,
      joinLounge: 5,
      leaveLounge: 3,
      sendSanction: 2,
      createTicket: 3,
      reportUser: 2,
      blockUser: 3,
      muteUser: 4,
      deleteChat: 2,
      viewProfile: 10,
      compromiseAccount: 0,
      requestDeletion: 0,
      login: 4,
      logout: 3
    },
    timingPatterns: {
      minActionInterval: 3000,
      maxActionInterval: 10000,
      activeHours: [22, 23, 0, 1, 2, 3, 4, 5],
      inactivityProbability: 0.2
    },
    errorBehavior: {
      retryAttempts: 2,
      backoffMultiplier: 1.5,
      ignoreCertainErrors: true
    }
  },
  
  WEEKEND_WARRIOR: {
    type: 'WEEKEND_WARRIOR',
    name: 'Weekend Warrior',
    description: 'Very active on weekends, inactive during weekdays',
    actionWeights: {
      sendMessage: 35,
      createLounge: 12,
      joinLounge: 10,
      leaveLounge: 5,
      sendSanction: 3,
      createTicket: 2,
      reportUser: 2,
      blockUser: 4,
      muteUser: 5,
      deleteChat: 3,
      viewProfile: 15,
      compromiseAccount: 0,
      requestDeletion: 0,
      login: 3,
      logout: 2
    },
    timingPatterns: {
      minActionInterval: 2500,
      maxActionInterval: 8000,
      activeHours: [],
      inactivityProbability: 0.3,
      // Special flag for weekend-only behavior
      weekendOnly: true
    },
    errorBehavior: {
      retryAttempts: 3,
      backoffMultiplier: 1.8,
      ignoreCertainErrors: true
    }
  }
};

// Device simulation
export const DEVICE_TYPES = [
  { type: 'desktop', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { type: 'desktop', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  { type: 'mobile', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' },
  { type: 'mobile', userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' },
  { type: 'tablet', userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' }
];

// Realistic usernames for easy tracking
export const REALISTIC_USERNAMES = [
  'alex_smith', 'emma_jones', 'michael_wilson', 'sarah_davis', 'james_brown',
  'emily_taylor', 'david_anderson', 'jennifer_thomas', 'robert_jackson', 'lisa_white',
  'william_martin', 'jessica_garcia', 'richard_rodriguez', 'mary_clark', 'john_lewis',
  'patricia_walker', 'joseph_hall', 'linda_allen', 'thomas_young', 'barbara_king',
  'charles_wright', 'susan_lopez', 'christopher_hill', 'nancy_green', 'daniel_adams',
  'karen_baker', 'matthew_gonzalez', 'betty_nelson', 'anthony_carter', 'diana_mitchell',
  'donald_perez', 'carol_roberts', 'mark_turner', 'doris_phillips', 'paul_campbell',
  'anderson_parker', 'michelle_evans', 'james_edwards', 'david_collins', 'linda_stewart'
];