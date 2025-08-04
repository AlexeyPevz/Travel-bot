import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { TelegramWebApp } from "./lib/telegramWebApp";

// Add Telegram type to Window interface
declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

// Setup Telegram Web App integration
if (!window.Telegram?.WebApp) {
  // Polyfill for development outside Telegram
  // In production this would be provided by Telegram Mini App environment
  window.Telegram = {
    WebApp: {
      initData: "",
      initDataUnsafe: {
        // Mock user data for development
        user: {
          id: 123456789,
          first_name: "Test",
          last_name: "User",
          username: "testuser",
          language_code: "ru"
        },
        auth_date: Math.floor(Date.now() / 1000),
        hash: "mock_hash"
      },
      ready: () => console.log("WebApp ready called"),
      expand: () => console.log("WebApp expand called"),
      close: () => console.log("WebApp close called"),
      MainButton: {
        text: "",
        color: "#2481cc",
        textColor: "#ffffff",
        isVisible: false,
        isActive: true,
        isProgressVisible: false,
        setText: (text: string) => {
          console.log(`MainButton.setText: ${text}`);
          return window.Telegram!.WebApp.MainButton;
        },
        show: () => {
          console.log("MainButton.show called");
          return window.Telegram!.WebApp.MainButton;
        },
        hide: () => {
          console.log("MainButton.hide called");
          return window.Telegram!.WebApp.MainButton;
        },
        enable: () => {
          console.log("MainButton.enable called");
          return window.Telegram!.WebApp.MainButton;
        },
        disable: () => {
          console.log("MainButton.disable called");
          return window.Telegram!.WebApp.MainButton;
        },
        onClick: (callback: () => void) => {
          console.log("MainButton.onClick registered");
          document.addEventListener("keydown", (e) => {
            if (e.key === "Enter") callback();
          });
          return window.Telegram!.WebApp.MainButton;
        },
        offClick: (callback: () => void) => {
          console.log("MainButton.offClick called");
          return window.Telegram!.WebApp.MainButton;
        },
        showProgress: (leaveActive?: boolean) => {
          console.log("MainButton.showProgress called");
          return window.Telegram!.WebApp.MainButton;
        },
        hideProgress: () => {
          console.log("MainButton.hideProgress called");
          return window.Telegram!.WebApp.MainButton;
        },
        setParams: () => {
          console.log("MainButton.setParams called");
          return window.Telegram!.WebApp.MainButton;
        }
      },
      BackButton: {
        isVisible: false,
        show: () => {
          console.log("BackButton.show called");
          return window.Telegram!.WebApp.BackButton;
        },
        hide: () => {
          console.log("BackButton.hide called");
          return window.Telegram!.WebApp.BackButton;
        },
        onClick: (callback: () => void) => {
          console.log("BackButton.onClick registered");
          document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") callback();
          });
          return window.Telegram!.WebApp.BackButton;
        },
        offClick: (callback: () => void) => {
          console.log("BackButton.offClick called");
          return window.Telegram!.WebApp.BackButton;
        }
      },
      HapticFeedback: {
        impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
          console.log(`HapticFeedback.impactOccurred: ${style}`);
        },
        notificationOccurred: (type: 'error' | 'success' | 'warning') => {
          console.log(`HapticFeedback.notificationOccurred: ${type}`);
        },
        selectionChanged: () => {
          console.log("HapticFeedback.selectionChanged called");
        }
      },
      colorScheme: 'light',
      themeParams: {
        bg_color: "#ffffff",
        text_color: "#000000",
        hint_color: "#707579",
        link_color: "#2481cc",
        button_color: "#2481cc",
        button_text_color: "#ffffff"
      },
      isExpanded: true,
      viewportHeight: window.innerHeight,
      viewportStableHeight: window.innerHeight,
      headerColor: "#ffffff",
      backgroundColor: "#ffffff",
      isClosingConfirmationEnabled: false,
      onEvent: () => {},
      offEvent: () => {},
      sendData: () => {},
      openLink: () => {},
      openTelegramLink: (url: string) => window.open(url, "_blank"),
      openInvoice: () => {},
      setHeaderColor: () => {},
      setBackgroundColor: () => {},
      enableClosingConfirmation: () => {},
      disableClosingConfirmation: () => {},
      showPopup: () => {},
      showAlert: () => {},
      showConfirm: () => {},
      CloudStorage: {
        setItem: () => {},
        getItem: () => {},
        getItems: () => {},
        removeItem: () => {},
        removeItems: () => {},
        getKeys: () => {}
      }
    },
  };
  console.log("Telegram WebApp polyfill initialized for development");
}

createRoot(document.getElementById("root")!).render(<App />);
