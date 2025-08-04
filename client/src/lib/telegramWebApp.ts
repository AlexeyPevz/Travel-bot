// Define types for the Telegram WebApp object
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: InitDataUnsafe;
  colorScheme: 'light' | 'dark';
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  onEvent(eventType: string, eventHandler: () => void): void;
  offEvent(eventType: string, eventHandler: () => void): void;
  sendData(data: string): void;
  ready(): void;
  expand(): void;
  close(): void;
  showPopup(params: PopupParams, callback?: (id: string) => void): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (ok: boolean) => void): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  openInvoice(url: string, callback?: (status: 'paid' | 'cancelled' | 'failed') => void): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  HapticFeedback: HapticFeedback;
  MainButton: MainButton;
  BackButton: BackButton;
  CloudStorage: CloudStorage;
}

export interface PopupParams {
  title?: string;
  message: string;
  buttons?: PopupButton[];
}

export interface PopupButton {
  id: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text: string;
}

export interface InitDataUnsafe {
  query_id?: string;
  user?: WebAppUser;
  receiver?: WebAppUser;
  chat?: WebAppChat;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  auth_date: number;
  hash: string;
}

export interface WebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface WebAppChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title: string;
  username?: string;
  photo_url?: string;
}

export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface MainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText(text: string): MainButton;
  onClick(callback: () => void): MainButton;
  offClick(callback: () => void): MainButton;
  show(): MainButton;
  hide(): MainButton;
  enable(): MainButton;
  disable(): MainButton;
  showProgress(leaveActive?: boolean): MainButton;
  hideProgress(): MainButton;
  setParams(params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): MainButton;
}

export interface BackButton {
  isVisible: boolean;
  onClick(callback: () => void): BackButton;
  offClick(callback: () => void): BackButton;
  show(): BackButton;
  hide(): BackButton;
}

export interface CloudStorage {
  setItem(key: string, value: string, callback?: (error: Error | null, success: boolean) => void): void;
  getItem(key: string, callback: (error: Error | null, value: string | null) => void): void;
  getItems(keys: string[], callback: (error: Error | null, values: Record<string, string | null>) => void): void;
  removeItem(key: string, callback?: (error: Error | null, success: boolean) => void): void;
  removeItems(keys: string[], callback?: (error: Error | null, success: boolean) => void): void;
  getKeys(callback: (error: Error | null, keys: string[]) => void): void;
}

export interface HapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

/**
 * Get Telegram WebApp instance
 * @returns Telegram WebApp instance or null if not available
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp as TelegramWebApp;
  }
  return null;
}

/**
 * Check if app is running inside Telegram WebApp
 * Uses multiple detection methods to ensure accuracy
 * @returns True if running inside Telegram WebApp, false otherwise
 */
export function isRunningInTelegram(): boolean {
  // Method 1: Check for WebApp object
  const webAppExists = !!getTelegramWebApp();
  
  // Method 2: Check for user object in WebApp
  const webAppUser = getTelegramUser();
  
  // Method 3: Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const hasTgWebAppData = urlParams.has('tgWebAppData');
  const hasTgWebAppPlatform = urlParams.has('tgWebAppPlatform');
  
  // Method 4: Check user agent (not reliable but additional signal)
  const userAgent = navigator.userAgent.toLowerCase();
  const isTelegramUserAgent = 
    userAgent.includes('telegram') || 
    userAgent.includes('tgweb') || 
    userAgent.includes('tgios') || 
    userAgent.includes('tgandroid');
  
  // Check if we're in development mode
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.log('Telegram detection:', {
      webAppExists,
      webAppUser: !!webAppUser,
      hasTgWebAppData,
      hasTgWebAppPlatform,
      isTelegramUserAgent
    });
  }
  
  // In dev mode, we'll always return true to simulate Telegram environment
  if (isDev) {
    return true;
  }
  
  // In production: Check if any of the methods indicate we're in Telegram
  return webAppExists || !!webAppUser || hasTgWebAppData || hasTgWebAppPlatform || isTelegramUserAgent;
}

/**
 * Get user data from Telegram WebApp
 * @returns User data or null if not available
 */
export function getTelegramUser(): WebAppUser | null {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.user || null;
}

/**
 * Get chat data from Telegram WebApp
 * @returns Chat data or null if not available
 */
export function getTelegramChat(): WebAppChat | null {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.chat || null;
}

/**
 * Close Telegram WebApp
 */
export function closeTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.close();
  }
}

/**
 * Show Telegram WebApp main button
 * @param text Button text
 * @param onClick Click handler
 */
export function showMainButton(text: string, onClick: () => void): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    const mainButton = webApp.MainButton;
    mainButton.setText(text);
    mainButton.onClick(onClick);
    mainButton.show();
  }
}

/**
 * Hide Telegram WebApp main button
 */
export function hideMainButton(): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.MainButton.hide();
  }
}

/**
 * Initialize Telegram WebApp
 * Call this function when your app loads
 */
export function initTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.ready();
    webApp.expand();
  }
}

/**
 * Send data back to Telegram bot
 * @param data Data to send
 */
export function sendDataToTelegram(data: Record<string, any>): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.sendData(JSON.stringify(data));
  }
}

/**
 * Show an alert in Telegram WebApp
 * @param message Alert message
 * @param callback Callback to call when alert is closed
 */
export function showAlert(message: string, callback?: () => void): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.showAlert(message, callback);
  } else {
    alert(message);
    if (callback) callback();
  }
}

/**
 * Show a confirmation dialog in Telegram WebApp
 * @param message Confirmation message
 * @param callback Callback to call with result
 */
export function showConfirm(message: string, callback?: (ok: boolean) => void): void {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.showConfirm(message, callback);
  } else {
    const result = confirm(message);
    if (callback) callback(result);
  }
}

/**
 * Enable haptic feedback
 * @param style Feedback style
 */
export function hapticFeedback(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void {
  const webApp = getTelegramWebApp();
  if (webApp?.HapticFeedback) {
    webApp.HapticFeedback.impactOccurred(style);
  }
}

/**
 * Show success notification with haptic feedback
 */
export function hapticSuccess(): void {
  const webApp = getTelegramWebApp();
  if (webApp?.HapticFeedback) {
    webApp.HapticFeedback.notificationOccurred('success');
  }
}

/**
 * Show error notification with haptic feedback
 */
export function hapticError(): void {
  const webApp = getTelegramWebApp();
  if (webApp?.HapticFeedback) {
    webApp.HapticFeedback.notificationOccurred('error');
  }
}
