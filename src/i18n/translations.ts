export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'pl' | 'fil';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English (US)', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文 (简体)', flag: '🇨🇳' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'fil', name: 'Filipino', nativeName: 'Wikang Filipino', flag: '🇵🇭' }
];

export const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // General & Tagline
    'app.title': 'Velum Workspace',
    'app.build': 'Build',
    'app.tagline': 'Conversations that flow like a veil.',

    // Navigation
    'nav.directs': 'Directs',
    'nav.lounge': 'Lounge',
    'nav.market': 'Market',
    'nav.wallet': 'Wallet',
    'nav.tickets': 'Tickets',
    'nav.friends': 'Friends',

    // Settings
    'settings.title': 'Settings',
    'settings.account': 'Account',
    'settings.privacy': 'Privacy & Safety',
    'settings.notifications': 'Notifications',
    'settings.appearance': 'Appearance',
    'settings.voice_audio': 'Voice & Audio',
    'settings.language': 'Language',
    'settings.tickets': 'Support Tickets',
    'settings.diagnostics': 'Diagnostics',
    'settings.about': 'About Velum',
    'settings.logout': 'Log Out',

    // Language Section
    'language.title': 'Language Preferences',
    'language.subtitle': 'Select your preferred display language for Velum interface and system messages.',
    'language.active': 'Active Language',
    'language.saved': 'Language preference updated and saved.',

    // Diagnostics
    'diagnostics.title': 'Client Diagnostics & System Logs',
    'diagnostics.subtitle': 'Submit client diagnostic telemetry directly to Velum network engineers for review.',
    'diagnostics.notes_label': 'Optional Incident Notes / Description',
    'diagnostics.notes_placeholder': 'Describe any UI glitch or issues experienced...',
    'diagnostics.transmit_btn': 'Transmit Client Diagnostic Logs',
    'diagnostics.transmitting': 'Transmitting Telemetry...',
    'diagnostics.success': 'Diagnostic payload transmitted successfully.',
    'diagnostics.error': 'Failed to transmit diagnostic payload.',

    // Account & Profile
    'account.display_name': 'Display Name',
    'account.bio': 'Bio',
    'account.save': 'Save Changes',
    'account.saved': 'Profile settings updated.',

    // Direct Messages & Lounge & Market & Wallet & Friends & Chat
    'chats.search': 'Search chats...',
    'lounge.search': 'Search lounges...',
    'lounge.no_communities': 'No communities found',
    'market.buyer_mode': 'Buyer Mode',
    'market.seller_mode': 'Seller Mode',
    'wallet.accounts': 'Accounts',
    'wallet.cards_banks': 'Cards & Banks',
    'people.search': 'Search friends...',
    'people.add_friend': 'Add Friend',
    'people.tab_all': 'All Friends',
    'people.tab_online': 'Online',
    'people.tab_pending': 'Pending',
    'people.tab_blocked': 'Blocked',
    'chat.message_placeholder': 'Message...',
    'chat.message_peer': 'Message {name}'
  },
  es: {
    // General & Tagline
    'app.title': 'Espacio Velum',
    'app.build': 'Versión',
    'app.tagline': 'Conversaciones que fluyen como un velo.',

    // Navigation
    'nav.directs': 'Directos',
    'nav.lounge': 'Salón',
    'nav.market': 'Mercado',
    'nav.wallet': 'Billetera',
    'nav.tickets': 'Tiques',
    'nav.friends': 'Amigos',

    // Settings
    'settings.title': 'Ajustes',
    'settings.account': 'Cuenta',
    'settings.privacy': 'Privacidad y Seguridad',
    'settings.notifications': 'Notificaciones',
    'settings.appearance': 'Apariencia',
    'settings.voice_audio': 'Voz y Audio',
    'settings.language': 'Idioma',
    'settings.tickets': 'Tiques de Soporte',
    'settings.diagnostics': 'Diagnósticos',
    'settings.about': 'Acerca de Velum',
    'settings.logout': 'Cerrar Sesión',

    // Language Section
    'language.title': 'Preferencias de Idioma',
    'language.subtitle': 'Selecciona tu idioma preferido para la interfaz y mensajes de sistema en Velum.',
    'language.active': 'Idioma Activo',
    'language.saved': 'Preferencia de idioma actualizada y guardada.',

    // Diagnostics
    'diagnostics.title': 'Diagnósticos del Cliente y Registros',
    'diagnostics.subtitle': 'Envía telemetría de diagnóstico directamente a los ingenieros de red de Velum.',
    'diagnostics.notes_label': 'Notas Opcionales del Incidente / Descripción',
    'diagnostics.notes_placeholder': 'Describe cualquier error visual o problema experimentado...',
    'diagnostics.transmit_btn': 'Transmitir Registros de Diagnóstico',
    'diagnostics.transmitting': 'Transmitiendo Telemetría...',
    'diagnostics.success': 'Telemetría de diagnóstico transmitida con éxito.',
    'diagnostics.error': 'Error al transmitir la telemetría de diagnóstico.',

    // Account & Profile
    'account.display_name': 'Nombre de Pantalla',
    'account.bio': 'Biografía',
    'account.save': 'Guardar Cambios',
    'account.saved': 'Ajustes de perfil actualizados.',

    // Direct Messages & Lounge & Market & Wallet & Friends & Chat
    'chats.search': 'Buscar chats...',
    'lounge.search': 'Buscar salones...',
    'lounge.no_communities': 'No se encontraron comunidades',
    'market.buyer_mode': 'Modo Comprador',
    'market.seller_mode': 'Modo Vendedor',
    'wallet.accounts': 'Cuentas',
    'wallet.cards_banks': 'Tarjetas y Bancos',
    'people.search': 'Buscar amigos...',
    'people.add_friend': 'Añadir Amigo',
    'people.tab_all': 'Todos los Amigos',
    'people.tab_online': 'En Línea',
    'people.tab_pending': 'Pendiente',
    'people.tab_blocked': 'Bloqueados',
    'chat.message_placeholder': 'Mensaje...',
    'chat.message_peer': 'Enviar mensaje a {name}'
  },
  fr: {
    // General & Tagline
    'app.title': 'Espace Velum',
    'app.build': 'Build',
    'app.tagline': 'Des conversations fluides comme un voile.',

    // Navigation
    'nav.directs': 'Directs',
    'nav.lounge': 'Salon',
    'nav.market': 'Marché',
    'nav.wallet': 'Portefeuille',
    'nav.tickets': 'Tickets',
    'nav.friends': 'Amis',

    // Settings
    'settings.title': 'Paramètres',
    'settings.account': 'Compte',
    'settings.privacy': 'Confidentialité et Sécurité',
    'settings.notifications': 'Notifications',
    'settings.appearance': 'Apparence',
    'settings.voice_audio': 'Voix et Audio',
    'settings.language': 'Langue',
    'settings.tickets': 'Tickets de Support',
    'settings.diagnostics': 'Diagnostics',
    'settings.about': 'À propos de Velum',
    'settings.logout': 'Se Déconnecter',

    // Language Section
    'language.title': 'Préférences de Langue',
    'language.subtitle': 'Choisissez votre langue d\'affichage préférée pour l\'interface et les messages Velum.',
    'language.active': 'Langue Active',
    'language.saved': 'Préférence de langue mise à jour et enregistrée.',

    // Diagnostics
    'diagnostics.title': 'Diagnostics Client & Journaux Système',
    'diagnostics.subtitle': 'Transmettez la télémétrie de diagnostic directement aux ingénieurs réseau Velum.',
    'diagnostics.notes_label': 'Notes sur l\'incident / Description (Optionnel)',
    'diagnostics.notes_placeholder': 'Décrivez tout dysfonctionnement ou problème rencontré...',
    'diagnostics.transmit_btn': 'Transmettre les Journaux de Diagnostic',
    'diagnostics.transmitting': 'Transmission de la Télémétrie...',
    'diagnostics.success': 'Données de diagnostic transmises avec succès.',
    'diagnostics.error': 'Échec de la transmission des données de diagnostic.',

    // Account & Profile
    'account.display_name': 'Nom d\'affichage',
    'account.bio': 'Biographie',
    'account.save': 'Enregistrer les modifications',
    'account.saved': 'Paramètres de profil mis à jour.',

    // Direct Messages & Lounge & Market & Wallet & Friends & Chat
    'chats.search': 'Rechercher des discussions...',
    'lounge.search': 'Rechercher des salons...',
    'lounge.no_communities': 'Aucune communauté trouvée',
    'market.buyer_mode': 'Mode Acheteur',
    'market.seller_mode': 'Mode Vendeur',
    'wallet.accounts': 'Comptes',
    'wallet.cards_banks': 'Cartes et Banques',
    'people.search': 'Rechercher des amis...',
    'people.add_friend': 'Ajouter un ami',
    'people.tab_all': 'Tous les amis',
    'people.tab_online': 'En ligne',
    'people.tab_pending': 'En attente',
    'people.tab_blocked': 'Bloqués',
    'chat.message_placeholder': 'Message...',
    'chat.message_peer': 'Envoyer un message à {name}'
  },
  de: {
    // General & Tagline
    'app.title': 'Velum Arbeitsbereich',
    'app.build': 'Build',
    'app.tagline': 'Gespräche, die wie ein Schleier fließen.',

    // Navigation
    'nav.directs': 'Direkt',
    'nav.lounge': 'Lounge',
    'nav.market': 'Markt',
    'nav.wallet': 'Geldbörse',
    'nav.tickets': 'Tickets',
    'nav.friends': 'Freunde',

    // Settings
    'settings.title': 'Einstellungen',
    'settings.account': 'Konto',
    'settings.privacy': 'Datenschutz & Sicherheit',
    'settings.notifications': 'Benachrichtigungen',
    'settings.appearance': 'Erscheinungsbild',
    'settings.voice_audio': 'Sprache & Audio',
    'settings.language': 'Sprache',
    'settings.tickets': 'Support-Tickets',
    'settings.diagnostics': 'Diagnose',
    'settings.about': 'Über Velum',
    'settings.logout': 'Abmelden',

    // Language Section
    'language.title': 'Spracheinstellungen',
    'language.subtitle': 'Wählen Sie Ihre bevorzugte Anzeigesprache für die Velum-Benutzeroberfläche.',
    'language.active': 'Aktive Sprache',
    'language.saved': 'Spracheinstellung aktualisiert und gespeichert.',

    // Diagnostics
    'diagnostics.title': 'Client-Diagnose & Systemprotokolle',
    'diagnostics.subtitle': 'Senden Sie Diagnose-Telemetriedaten direkt an die Velum-Netzwerkingenieure.',
    'diagnostics.notes_label': 'Optionale Vorfallnotizen / Beschreibung',
    'diagnostics.notes_placeholder': 'Beschreiben Sie aufgetretene UI-Fehler oder Probleme...',
    'diagnostics.transmit_btn': 'Diagnoseprotokolle Übertragen',
    'diagnostics.transmitting': 'Telemetrie wird übertragen...',
    'diagnostics.success': 'Diagnosedaten erfolgreich übertragen.',
    'diagnostics.error': 'Fehler beim Übertragen der Diagnosedaten.',

    // Account & Profile
    'account.display_name': 'Anzeigename',
    'account.bio': 'Biografie',
    'account.save': 'Änderungen Speichern',
    'account.saved': 'Profileinstellungen aktualisiert.',

    // Direct Messages & Lounge & Market & Wallet & Friends & Chat
    'chats.search': 'Chats suchen...',
    'lounge.search': 'Lounges suchen...',
    'lounge.no_communities': 'Keine Communities gefunden',
    'market.buyer_mode': 'Käufermodus',
    'market.seller_mode': 'Verkäufermodus',
    'wallet.accounts': 'Konten',
    'wallet.cards_banks': 'Karten & Banken',
    'people.search': 'Freunde suchen...',
    'people.add_friend': 'Freund hinzufügen',
    'people.tab_all': 'Alle Freunde',
    'people.tab_online': 'Online',
    'people.tab_pending': 'Ausstehend',
    'people.tab_blocked': 'Blockiert',
    'chat.message_placeholder': 'Nachricht...',
    'chat.message_peer': 'Nachricht an {name}'
  },
  zh: {
    // General & Tagline
    'app.title': 'Velum 工作区',
    'app.build': '构建版本',
    'app.tagline': '如面纱般流畅自然的对话。',

    // Navigation
    'nav.directs': '私信',
    'nav.lounge': '大堂',
    'nav.market': '集市',
    'nav.wallet': '钱包',
    'nav.tickets': '工单',
    'nav.friends': '好友',

    // Settings
    'settings.title': '设置',
    'settings.account': '账户',
    'settings.privacy': '隐私与安全',
    'settings.notifications': '通知',
    'settings.appearance': '外观',
    'settings.voice_audio': '语音与音频',
    'settings.language': '语言',
    'settings.tickets': '工单支持',
    'settings.diagnostics': '诊断',
    'settings.about': '关于 Velum',
    'settings.logout': '退出登录',

    // Language Section
    'language.title': '语言偏好设置',
    'language.subtitle': '选择您首选的 Velum 界面和系统消息显示语言。',
    'language.active': '当前语言',
    'language.saved': '语言偏好设置已更新并保存。',

    // Diagnostics
    'diagnostics.title': '客户端诊断与系统日志',
    'diagnostics.subtitle': '直接提交客户端诊断遥测数据给 Velum 网络工程师进行审查。',
    'diagnostics.notes_label': '可选的事件说明 / 描述',
    'diagnostics.notes_placeholder': '请描述遇到的任何 UI 故障或问题...',
    'diagnostics.transmit_btn': '发送客户端诊断日志',
    'diagnostics.transmitting': '正在发送遥测数据...',
    'diagnostics.success': '诊断遥测数据已成功发送。',
    'diagnostics.error': '发送诊断遥测数据失败。',

    // Account & Profile
    'account.display_name': '显示名称',
    'account.bio': '个人简介',
    'account.save': '保存更改',
    'account.saved': '个人资料设置已更新。',

    // Direct Messages & Lounge & Market & Wallet & Friends & Chat
    'chats.search': '搜索聊天...',
    'lounge.search': '搜索大堂频道...',
    'lounge.no_communities': '未找到社区',
    'market.buyer_mode': '买家模式',
    'market.seller_mode': '卖家模式',
    'wallet.accounts': '账户',
    'wallet.cards_banks': '银行卡与银行',
    'people.search': '搜索好友...',
    'people.add_friend': '添加好友',
    'people.tab_all': '所有好友',
    'people.tab_online': '在线',
    'people.tab_pending': '待处理',
    'people.tab_blocked': '已黑名单',
    'chat.message_placeholder': '发送消息...',
    'chat.message_peer': '给 {name} 发送消息'
  },
  pl: {
    // General & Tagline
    'app.title': 'Obszar roboczy Velum',
    'app.build': 'Wersja',
    'app.tagline': 'Rozmowy płynące jak woal.',

    // Navigation
    'nav.directs': 'Wiadomości',
    'nav.lounge': 'Pokoje',
    'nav.market': 'Rynek',
    'nav.wallet': 'Portfel',
    'nav.tickets': 'Zgłoszenia',
    'nav.friends': 'Znajomi',

    // Settings
    'settings.title': 'Ustawienia',
    'settings.account': 'Konto',
    'settings.privacy': 'Prywatność i Bezpieczeństwo',
    'settings.notifications': 'Powiadomienia',
    'settings.appearance': 'Wygląd',
    'settings.voice_audio': 'Głos i Dźwięk',
    'settings.language': 'Język',
    'settings.tickets': 'Zgłoszenia Pomocy',
    'settings.diagnostics': 'Diagnostyka',
    'settings.about': 'O Velum',
    'settings.logout': 'Wyloguj się',

    // Language Section
    'language.title': 'Preferencje Językowe',
    'language.subtitle': 'Wybierz preferowany język wyświetlania interfejsu Velum oraz komunikatów systemowych.',
    'language.active': 'Aktywny Język',
    'language.saved': 'Preferencje językowe zostały zaktualizowane i zapisane.',

    // Diagnostics
    'diagnostics.title': 'Diagnostyka Klienta i Logi Systemowe',
    'diagnostics.subtitle': 'Prześlij dane telemetryczne bezpośrednio do inżynierów sieci Velum.',
    'diagnostics.notes_label': 'Opcjonalne Uwagi / Opis Incydentu',
    'diagnostics.notes_placeholder': 'Opisz napotkane usterki interfejsu lub problemy...',
    'diagnostics.transmit_btn': 'Prześlij Logi Diagnostyczne',
    'diagnostics.transmitting': 'Przesyłanie Telemetrii...',
    'diagnostics.success': 'Dane diagnostyczne zostały pomyślnie przesłane.',
    'diagnostics.error': 'Błąd podczas przesyłania danych diagnostycznych.',

    // Account & Profile
    'account.display_name': 'Wyświetlana Nazwa',
    'account.bio': 'O sobie',
    'account.save': 'Zapisz Zmiany',
    'account.saved': 'Ustawienia profilu zostały zaktualizowane.',

    // Direct Messages & Lounge & Market & Wallet & Friends & Chat
    'chats.search': 'Szukaj czatów...',
    'lounge.search': 'Szukaj pokoi...',
    'lounge.no_communities': 'Nie znaleziono społeczności',
    'market.buyer_mode': 'Tryb Kupującego',
    'market.seller_mode': 'Tryb Sprzedawcy',
    'wallet.accounts': 'Konta',
    'wallet.cards_banks': 'Karty i Banki',
    'people.search': 'Szukaj znajomych...',
    'people.add_friend': 'Dodaj Znajomego',
    'people.tab_all': 'Wszyscy Znajomi',
    'people.tab_online': 'Dostępni',
    'people.tab_pending': 'Oczekujące',
    'people.tab_blocked': 'Zablokowani',
    'chat.message_placeholder': 'Wiadomość...',
    'chat.message_peer': 'Wiadomość do {name}'
  },
  fil: {
    // General & Tagline
    'app.title': 'Velum Workspace',
    'app.build': 'Bersyon',
    'app.tagline': 'Mga pag-uusap na dumadaloy na parang belo.',

    // Navigation
    'nav.directs': 'Mga Directs',
    'nav.lounge': 'Lounge',
    'nav.market': 'Merkado',
    'nav.wallet': 'Pitaka',
    'nav.tickets': 'Mga Ticket',
    'nav.friends': 'Kaibigan',

    // Settings
    'settings.title': 'Mga Setting',
    'settings.account': 'Akwent',
    'settings.privacy': 'Pribisidad at Kaligtasan',
    'settings.notifications': 'Mga Notification',
    'settings.appearance': 'Hitsura',
    'settings.voice_audio': 'Boses at Tunog',
    'settings.language': 'Wika',
    'settings.tickets': 'Mga Ticket sa Suporta',
    'settings.diagnostics': 'Pagsusuri at Diagnostiko',
    'settings.about': 'Tungkol sa Velum',
    'settings.logout': 'Mag-log Out',

    // Language Section
    'language.title': 'Mga Kagustuhan sa Wika',
    'language.subtitle': 'Pumili ng iyong gustong wika para sa interface ng Velum at mga mensahe ng sistema.',
    'language.active': 'Aktibong Wika',
    'language.saved': 'Na-update at na-save na ang kagustuhan sa wika.',

    // Diagnostics
    'diagnostics.title': 'Diagnostiko ng Kliyente at Mga Log ng Sistema',
    'diagnostics.subtitle': 'Ipadala ang telemetry ng diagnostiko sa mga inhinyero ng Velum network.',
    'diagnostics.notes_label': 'Opsyonal na mga Tala o Paglalarawan ng Isyu',
    'diagnostics.notes_placeholder': 'Ilarawan ang anumang problema o glitch sa UI...',
    'diagnostics.transmit_btn': 'Ipadala ang Mga Log ng Diagnostiko',
    'diagnostics.transmitting': 'Ipinapadala ang Telemetry...',
    'diagnostics.success': 'Matagumpay na naipadala ang datos ng diagnostiko.',
    'diagnostics.error': 'Bigo sa pagpapadala ng datos ng diagnostiko.',

    // Account & Profile
    'account.display_name': 'Pangalan sa Display',
    'account.bio': 'Maikling Talambuhay',
    'account.save': 'I-save ang mga Pagbabago',
    'account.saved': 'Na-update na ang mga setting ng profile.',

    // Direct Messages & Lounge & Market & Wallet & Friends & Chat
    'chats.search': 'Maghanap ng chats...',
    'lounge.search': 'Maghanap ng lounges...',
    'lounge.no_communities': 'Walang nahanap na komunidad',
    'market.buyer_mode': 'Mode ng Tagabili',
    'market.seller_mode': 'Mode ng Tagatinda',
    'wallet.accounts': 'Mga Akwent',
    'wallet.cards_banks': 'Mga Karta at Bangko',
    'people.search': 'Maghanap ng kaibigan...',
    'people.add_friend': 'Magdagdag ng Kaibigan',
    'people.tab_all': 'Lahat ng Kaibigan',
    'people.tab_online': 'Naka-online',
    'people.tab_pending': 'Nakabinbin',
    'people.tab_blocked': 'Naka-block',
    'chat.message_placeholder': 'Mensahe...',
    'chat.message_peer': 'Magpadala ng mensahe kay {name}'
  }
};
