import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { copyFor, useLocale } from "@/lib/locale";

const NotFound = () => {
  const location = useLocation();
  const { language } = useLocale();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">
          {copyFor(language, "Oops! Page not found", "页面不存在")}
        </p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {copyFor(language, "Return to Home", "返回首页")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
