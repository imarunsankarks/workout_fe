import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const useControlledBack = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const blockedPaths = ["/workout", "/reports", "/add-exercise", "/library"];

  useEffect(() => {
    if (blockedPaths.includes(location.pathname)) {
      window.history.replaceState(null, "", "/");

      window.history.pushState(null, "", location.pathname);
    }

    const handlePopState = () => {
      if (blockedPaths.includes(location.pathname)) {
        navigate("/", { replace: true });
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [location.pathname, navigate]);
};

export default useControlledBack;
