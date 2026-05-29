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
      // Pages can opt out of the "back -> home" behavior by setting
      // window.__overlayOpen while a modal/overlay is open. The page is
      // responsible for clearing the flag and closing the overlay itself.
      if (window.__overlayOpen) return;
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
