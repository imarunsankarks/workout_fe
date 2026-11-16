import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { RotateCw } from 'lucide-react';

const BackendGate = ({ children }) => {
  const [status, setStatus] = useState('connecting');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = Date.now();
    let retryTimer;

    const connect = async () => {
      try {
        await axios.get(`${process.env.REACT_APP_API_URL}/api/keepalive/ping`, {
          signal: controller.signal,
          timeout: 90000,
        });
        if (!controller.signal.aborted) setStatus('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        if (Date.now() - startedAt < 90000) {
          retryTimer = setTimeout(connect, 2000);
        } else {
          setStatus('error');
        }
      }
    };

    connect();
    return () => {
      controller.abort();
      clearTimeout(retryTimer);
    };
  }, [attempt]);

  if (status === 'ready') return children;

  return (
    <main className="startup-screen" role="status" aria-live="polite">
      <div className="startup-glow" aria-hidden="true" />
      <div className="startup-content">
        <div className={`startup-transform ${status === 'connecting' ? 'startup-transform--active' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 240 160" className="startup-transform-art">
            <path
              className="startup-activity-line"
              d="M218 80 H176 L148 135 L100 25 L72 80 H22"
            />
            <g className="startup-plates-inner">
              <rect x="70" y="50" width="10" height="60" rx="3" />
              <rect x="160" y="50" width="10" height="60" rx="3" />
            </g>
            <g className="startup-plates-middle">
              <rect x="53" y="50" width="12" height="60" rx="3" />
              <rect x="175" y="50" width="12" height="60" rx="3" />
            </g>
            <g className="startup-plates-outer">
              <rect x="34" y="50" width="14" height="60" rx="4" />
              <rect x="192" y="50" width="14" height="60" rx="4" />
            </g>
          </svg>
        </div>
        <p className="startup-kicker">YOUR SESSION STARTS HERE</p>
        <h1 className="startup-title">Get ready to move<span>.</span></h1>
        <p className="startup-description">
          {status === 'error'
            ? "We couldn't reach the server. Check your connection and try again."
            : 'Waking up your training space...'}
        </p>
        {status === 'error' ? (
          <button
            type="button"
            className="startup-retry"
            onClick={() => {
              setStatus('connecting');
              setAttempt((current) => current + 1);
            }}
          >
            <RotateCw size={16} /> Try again
          </button>
        ) : (
          <div className="startup-progress" aria-label="Connecting to server">
            <div className="startup-progress-bar" />
          </div>
        )}
      </div>
      <p className="startup-footer">PREPARING YOUR NEXT REP</p>
    </main>
  );
};

export default BackendGate;
