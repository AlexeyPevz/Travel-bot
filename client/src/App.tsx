import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import Tours from "@/pages/tours";
import Watchlist from "@/pages/watchlist";
import Groups from "@/pages/groups";
import TravelBuddy from "@/pages/travelBuddy";
import ReferralBanner from "@/components/ReferralBanner";

function Router() {
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    // Initialize Telegram WebApp
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      webApp.ready();
      webApp.expand();
    }
  }, []);

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/profile" component={Profile} />
        <Route path="/tours" component={Tours} />
        <Route path="/watchlist" component={Watchlist} />
        <Route path="/groups" component={Groups} />
        <Route path="/travel-buddy" component={TravelBuddy} />
        <Route component={NotFound} />
      </Switch>
      <ReferralBanner />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
