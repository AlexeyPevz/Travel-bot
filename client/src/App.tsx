import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { useUser } from "@/hooks/use-user";
import Header from "@/components/Header";
import { Loader2 } from "lucide-react";

// Lazy load page components
const Home = lazy(() => import("@/pages/Home"));
const Profile = lazy(() => import("@/pages/Profile"));
const Requests = lazy(() => import("@/pages/Requests"));
const RequestDetail = lazy(() => import("@/pages/RequestDetail"));

// Loading component
function PageLoader() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
}

function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Добро пожаловать!</h1>
              <p className="text-gray-600 mb-4">
                Откройте это приложение через Telegram бота для начала работы
              </p>
              <a
                href="https://t.me/tourtinder_bot"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
              >
                Открыть в Telegram
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/profile" component={Profile} />
            <Route path="/requests" component={Requests} />
            <Route path="/requests/:id" component={RequestDetail} />
            <Route>
              <div className="text-center py-12">
                <h2 className="text-2xl font-semibold text-gray-700">
                  Страница не найдена
                </h2>
                <p className="text-gray-600 mt-2">
                  Запрашиваемая страница не существует
                </p>
              </div>
            </Route>
          </Switch>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
