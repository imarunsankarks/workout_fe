import React, {  useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

function useKeepAlive() {
    const { user, token, logout } = useContext(AuthContext);
    useEffect(() => {
        const interval = setInterval(async () => {
        try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/keepalive/ping`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Service pinged", res.data);
        } catch (err) {
        console.error("Ping failed:", err);
        } 
        }, 7 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);
}

export default useKeepAlive;